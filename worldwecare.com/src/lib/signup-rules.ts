/**
 * Signup validation, written once and used twice.
 *
 * The form imports this and so does `/api/user/auth/signup`. That is
 * the whole point: the moment the browser and the server keep their
 * own copies of "what counts as a valid password", they drift, and the
 * drift is always in the same direction — the form gets stricter, the
 * endpoint stays open, and the rule that matters is the one nobody
 * looks at.
 *
 * NOTHING HERE IS SECURITY ON ITS OWN. Client-side validation is a
 * courtesy to the person typing; the server calls the same functions
 * because a request never has to come from the form.
 *
 * No imports on purpose — this file has to be safe to pull into a
 * client component, which rules out touching the database.
 */

export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 200;
export const MIN_NAME = 2;
export const MAX_NAME = 40;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ── individual fields ───────────────────────────────────────── */

export function nameError(value: string): string | null {
  const v = value.trim();
  if (!v) return "Pick a name people will see.";
  if (v.length < MIN_NAME) return `At least ${MIN_NAME} characters.`;
  if (v.length > MAX_NAME) return `${MAX_NAME} characters at most.`;
  return null;
}

export function emailError(value: string): string | null {
  const v = value.trim();
  if (!v) return "We need an email to reach you.";
  if (!EMAIL_RE.test(v)) return "That doesn't look like an email address.";
  if (v.length > 200) return "That email is too long.";
  return null;
}

export function passwordError(value: string): string | null {
  if (!value) return "Choose a password.";
  if (value.length < MIN_PASSWORD) return `At least ${MIN_PASSWORD} characters.`;
  if (value.length > MAX_PASSWORD) return `${MAX_PASSWORD} characters at most.`;
  // Bcrypt silently truncates past 72 bytes. Long passphrases are good,
  // so this is a nudge rather than a rejection — but a person who types
  // 90 characters should know only the first 72 count.
  return null;
}

export function confirmError(password: string, confirm: string): string | null {
  if (!confirm) return "Type it once more.";
  if (password !== confirm) return "These don't match.";
  return null;
}

export function countryError(value: string | null | undefined): string | null {
  if (!value) return "Pick where you are.";
  return null;
}

export function termsError(accepted: boolean): string | null {
  if (!accepted) return "You'll need to accept the terms to join.";
  return null;
}

/**
 * The arithmetic check.
 *
 * Shape only — whether the number is RIGHT is decided in
 * `@/lib/captcha` on the server, against a signed token this file must
 * never see. All this does is stop the form posting an empty box and
 * coming back with a server error for something the browser could have
 * said instantly.
 */
export function captchaAnswerError(value: string): string | null {
  const v = value.trim();
  if (!v) return "Answer the sum so we know you're a person.";
  if (!/^-?\d{1,4}$/.test(v)) return "Just the number.";
  return null;
}

/* ── the whole form ──────────────────────────────────────────── */

export interface SignupFields {
  displayName: string;
  email: string;
  password: string;
  confirm: string;
  countryId: string;
  acceptedTerms: boolean;
  captchaAnswer: string;
}

export type SignupErrors = Partial<Record<keyof SignupFields, string>>;

export function validateSignup(f: SignupFields): SignupErrors {
  const errors: SignupErrors = {};
  const put = (k: keyof SignupFields, e: string | null) => {
    if (e) errors[k] = e;
  };
  put("displayName", nameError(f.displayName));
  put("email", emailError(f.email));
  put("password", passwordError(f.password));
  put("confirm", confirmError(f.password, f.confirm));
  put("countryId", countryError(f.countryId));
  put("acceptedTerms", termsError(f.acceptedTerms));
  put("captchaAnswer", captchaAnswerError(f.captchaAnswer));
  return errors;
}

/* ── strength ────────────────────────────────────────────────── */

export type StrengthLevel = 0 | 1 | 2 | 3 | 4;

export interface Strength {
  score: StrengthLevel;
  label: string;
  /** What would most improve it, or null once it's strong. */
  advice: string | null;
}

/**
 * A length-first strength estimate.
 *
 * Length is weighted above character variety because it is what
 * actually costs an attacker time — "correct horse battery staple"
 * beats "P@ssw0rd!" and any meter that says otherwise is teaching the
 * wrong lesson. Variety still counts, but it cannot carry a short
 * password past "fair" on its own.
 *
 * This is a hint for a human, not a security control. Nothing is
 * rejected for scoring low; the only hard rule is the length minimum.
 */
export function passwordStrength(password: string): Strength {
  if (!password) return { score: 0, label: "", advice: null };

  const len = password.length;
  const lower = /[a-z]/.test(password);
  const upper = /[A-Z]/.test(password);
  const digit = /[0-9]/.test(password);
  const symbol = /[^A-Za-z0-9]/.test(password);
  const variety = [lower, upper, digit, symbol].filter(Boolean).length;

  // Things that are long but obvious shouldn't score for their length.
  const repeated = /^(.)\1+$/.test(password);
  const sequential = /^(?:0123|1234|2345|abcd|qwer|asdf)/i.test(password);
  const common =
    /^(?:password|passw0rd|welcome|letmein|iloveyou|admin|qwerty|monkey|dragon|football|123456)/i.test(
      password,
    );

  if (repeated || sequential || common) {
    return {
      score: 0,
      label: "Too easy to guess",
      advice: "That's one of the first things anyone would try.",
    };
  }

  let score = 0;
  if (len >= MIN_PASSWORD) score += 1;
  if (len >= 12) score += 1;
  if (len >= 16) score += 1;
  if (variety >= 3 && len >= MIN_PASSWORD) score += 1;
  // Variety alone can't rescue something short.
  if (len < MIN_PASSWORD) score = 0;

  const clamped = Math.min(4, score) as StrengthLevel;

  const labels = ["Too short", "Weak", "Fair", "Good", "Strong"];
  let advice: string | null = null;
  if (len < MIN_PASSWORD) advice = `${MIN_PASSWORD - len} more character${MIN_PASSWORD - len === 1 ? "" : "s"} to go.`;
  else if (len < 12) advice = "Longer is the easiest way to make it stronger.";
  else if (variety < 3) advice = "A capital, a number or a symbol would help.";
  else if (clamped < 4) advice = "Nearly there — a few more characters.";

  return { score: clamped, label: labels[clamped], advice };
}
