"use client";

/**
 * Community login and signup.
 *
 * Login stays deliberately bare — two fields and a button. Nobody
 * needs a strength meter to type a password they already have.
 *
 * Signup does the work: per-field validation, a confirm box, a live
 * strength hint, a country, and the terms tick. Three rules govern how
 * the errors behave, and they matter more than the fields do:
 *
 *  1. NOTHING GOES RED WHILE YOU ARE STILL TYPING IN IT. A field shows
 *     its error once you leave it, or once you try to submit. Telling
 *     someone their email is invalid on the second keystroke is a
 *     reprimand for not having finished.
 *  2. ONCE A FIELD HAS ERRORED, IT UPDATES LIVE. After you've been
 *     told, the message should disappear the moment you fix it rather
 *     than waiting for another blur.
 *  3. THE SUBMIT BUTTON IS NEVER DISABLED. A greyed-out button that
 *     won't say why is the worst version of this form. Pressing it
 *     reveals every problem at once and moves focus to the first.
 *
 * Every rule here comes from `@/lib/signup-rules`, which the signup
 * endpoint imports too — so the browser and the server cannot disagree
 * about what is acceptable.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CountrySelect } from "@/components/ui/country-select";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import {
  MAX_NAME,
  passwordStrength,
  validateSignup,
  type SignupErrors,
  type SignupFields,
} from "@/lib/signup-rules";
import { useT } from "@/components/site/locale-context";

export interface CountryOption {
  id: string;
  name: string;
  emojiFlag: string | null;
  /** Used by the picker's search — "CI" finds Côte d'Ivoire. */
  code?: string | null;
}

type FieldName = keyof SignupFields;

/**
 * Where to go after signing in.
 *
 * TEN PAGES ALREADY REDIRECT TO `/login?next=…` — saved, settings,
 * messages, chatrooms, places, profiles, a post — and until now the
 * parameter was read by nobody. Everyone who hit a signed-out page
 * was sent to the home feed after signing in, having lost the thing
 * they were trying to open.
 *
 * ONLY A SAME-SITE PATH IS ACCEPTED. `?next=https://elsewhere/` on a
 * login form is an open redirect: an attacker sends someone our own
 * sign-in link, they sign in, and land on a copy of the site that
 * asks them to do it again. A leading "/" is necessary but not
 * sufficient — "//evil.com" is a protocol-relative URL the browser
 * treats as another origin, and "/\evil.com" is the same trick with
 * a backslash. Both are refused here.
 */
function safeNext(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  return raw;
}

export function UserAuthForm({
  mode,
  countries: initialCountries,
}: {
  mode: "login" | "signup";
  /**
   * Rendered by the server where the caller can do it — /signup does.
   *
   * THIS IS THE FIX FOR "THE COUNTRY LIST SOMETIMES DOESN'T OPEN".
   * The list used to arrive only from a fetch on mount whose failure
   * path was `if (!res?.ok) return;` — silent, no retry, no message.
   * One blip (a pm2 restart mid-deploy returning 502, a dropped
   * connection, a JS chunk that 404s because the browser is holding
   * yesterday's HTML) and the picker stayed empty for the life of that
   * page, with nothing on screen saying so and nothing that would ever
   * fill it. Reloading fixed it, which is exactly what "sometimes it
   * shows and sometimes it doesn't" looks like from the outside.
   *
   * Passed from the server it is in the HTML before any JavaScript
   * runs, so there is no request to fail.
   */
  countries?: CountryOption[];
}) {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isSignup = mode === "signup";
  const endpoint = isSignup ? "/api/user/auth/signup" : "/api/user/auth/login";

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [countryId, setCountryId] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [captchaAnswer, setCaptchaAnswer] = useState("");

  /**
   * The arithmetic check.
   *
   * `question` is display only; `token` is what the server verifies
   * against. Neither is a secret — the sum is on screen — so there is
   * nothing to protect here beyond fetching a fresh pair whenever the
   * old one stops being answerable.
   */
  const [captcha, setCaptcha] = useState<{ question: string; token: string } | null>(null);
  const [captchaBusy, setCaptchaBusy] = useState(false);

  /** The honeypot. Never touched by a person; see the field below. */
  const [website, setWebsite] = useState("");

  const [countries, setCountries] = useState<CountryOption[]>(initialCountries ?? []);
  const [countriesFailed, setCountriesFailed] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({});
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  /**
   * The fallback, for any caller that didn't render the list server-side.
   *
   * Two things it does that the old version didn't: it retries once
   * (most failures here are a single bad moment, not a broken server),
   * and if it still can't it SAYS SO and offers a button. An empty
   * dropdown that never explains itself is the bug being fixed; an
   * empty dropdown that says "couldn't load — retry" is a nuisance
   * someone can get past.
   */
  const loadCountries = useCallback(async () => {
    setCountriesFailed(false);
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 600));
      const res = await fetch("/api/public/geo/countries", {
        cache: "no-store",
      }).catch(() => null);
      if (!res?.ok) continue;
      const d = (await res.json().catch(() => null)) as {
        items?: CountryOption[];
      } | null;
      if (d?.items?.length) {
        setCountries(d.items);
        return;
      }
    }
    setCountriesFailed(true);
  }, []);

  useEffect(() => {
    // Nothing to do when the server already handed us the list.
    if (!isSignup || (initialCountries && initialCountries.length > 0)) return;
    void loadCountries();
  }, [isSignup, initialCountries, loadCountries]);

  const loadCaptcha = useCallback(async () => {
    setCaptchaBusy(true);
    setCaptchaAnswer("");
    const res = await fetch("/api/user/auth/captcha", { cache: "no-store" }).catch(
      () => null,
    );
    setCaptchaBusy(false);
    if (!res?.ok) {
      setCaptcha(null);
      return;
    }
    const d = (await res.json().catch(() => null)) as {
      question?: string;
      token?: string;
    } | null;
    if (d?.question && d?.token) setCaptcha({ question: d.question, token: d.token });
  }, []);

  useEffect(() => {
    if (!isSignup) return;
    void loadCaptcha();
  }, [isSignup, loadCaptcha]);

  const fields: SignupFields = useMemo(
    () => ({
      displayName,
      email,
      password,
      confirm,
      countryId,
      acceptedTerms,
      captchaAnswer,
    }),
    [displayName, email, password, confirm, countryId, acceptedTerms, captchaAnswer],
  );

  const errors: SignupErrors = useMemo(
    () => (isSignup ? validateSignup(fields) : {}),
    [isSignup, fields],
  );

  // Rules 1 and 2, in one line: show a field's error once it has been
  // left or the form has been tried, and from then on keep it current.
  const shown = useCallback(
    (name: FieldName): string | undefined =>
      touched[name] || tried ? errors[name] : undefined,
    [touched, tried, errors],
  );

  const strength = useMemo(() => passwordStrength(password), [password]);

  const blur = (name: FieldName) => () =>
    setTouched((t) => (t[name] ? t : { ...t, [name]: true }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (isSignup) {
      setTried(true);
      const first = Object.keys(errors)[0] as FieldName | undefined;
      if (first) {
        // Rule 3: say what is wrong and put the cursor on it, rather
        // than leaving a dead button and no explanation.
        const el = formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`);
        el?.focus();
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isSignup
            ? {
                email,
                password,
                displayName,
                countryId,
                acceptedTerms,
                captchaToken: captcha?.token ?? "",
                captchaAnswer,
                website,
              }
            : { email, password },
        ),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        newChallenge?: boolean;
      };
      if (!res.ok) {
        setError(
          data.error ??
            (isSignup
              ? t("auth.signupFailed", "Couldn't create your account.")
              : t("auth.signinFailed", "Sign in failed.")),
        );
        // A spent or expired token can never be answered correctly
        // again, so leaving it on screen would strand the person on a
        // question that is now unanswerable however hard they try.
        if (isSignup && data.newChallenge) void loadCaptcha();
        setSubmitting(false);
        return;
      }
      router.replace(safeNext(searchParams.get("next")));
      router.refresh();
    } catch {
      setError(t("auth.networkError", "Network error. Check your connection and try again."));
      setSubmitting(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4" noValidate>
      {isSignup && (
        <Field
          label={t("auth.displayName", "Display name")}
          htmlFor="displayName"
          error={shown("displayName")}
        >
          <Input
            id="displayName"
            name="displayName"
            autoComplete="nickname"
            maxLength={MAX_NAME}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            onBlur={blur("displayName")}
            placeholder={t("auth.displayNamePlaceholder", "What should we call you?")}
            invalid={!!shown("displayName")}
            aria-invalid={!!shown("displayName")}
            aria-describedby={shown("displayName") ? "displayName-error" : undefined}
          />
        </Field>
      )}

      <Field label={t("settings.email", "Email")} htmlFor="email" error={shown("email")}>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete={isSignup ? "email" : "username"}
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={isSignup ? blur("email") : undefined}
          placeholder={t("settings.emailPlaceholder", "you@example.com")}
          invalid={isSignup ? !!shown("email") : !!error}
          aria-invalid={!!shown("email")}
          aria-describedby={shown("email") ? "email-error" : undefined}
        />
      </Field>

      <Field label={t("settings.password", "Password")} htmlFor="password" error={shown("password")}>
        <PasswordInput
          id="password"
          name="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={isSignup ? blur("password") : undefined}
          placeholder={
            isSignup ? t("settings.passwordPlaceholder", "At least 8 characters") : "••••••••"
          }
          invalid={isSignup ? !!shown("password") : !!error}
          aria-invalid={!!shown("password")}
          // Only point at the strength meter once it exists. A dangling
          // aria-describedby is read by some screen readers as an empty
          // description, which is worse than no description at all.
          aria-describedby={
            shown("password")
              ? "password-error"
              : isSignup && password.length > 0
                ? "password-strength"
                : undefined
          }
        />
        {isSignup && password.length > 0 && (
          <StrengthMeter strength={strength} />
        )}
      </Field>

      {isSignup && (
        <>
          <Field
            label={t("auth.confirmPassword", "Confirm password")}
            htmlFor="confirm"
            error={shown("confirm")}
          >
            <PasswordInput
              id="confirm"
              name="confirm"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              onBlur={blur("confirm")}
              placeholder={t("auth.typeItAgain", "Type it again")}
              invalid={!!shown("confirm")}
              aria-invalid={!!shown("confirm")}
              aria-describedby={shown("confirm") ? "confirm-error" : undefined}
            />
          </Field>

          <Field label={t("common.country", "Country")} htmlFor="countryId" error={shown("countryId")}>
            <CountrySelect
              value={countryId}
              onChange={(next) => {
                setCountryId(next);
                // A picker has no blur to wait for — choosing IS the
                // interaction, so mark it touched here or the error
                // sits there after it has been fixed.
                setTouched((t) => ({ ...t, countryId: true }));
              }}
              countries={countries}
              placeholder={
                countries.length > 0
                  ? t("auth.countryPlaceholder", "Where are you?")
                  : countriesFailed
                    ? t("auth.countryFailed", "Couldn't load the list")
                    : t("auth.countryLoading", "Loading countries…")
              }
              invalid={!!shown("countryId")}
              describedBy={shown("countryId") ? "countryId-error" : undefined}
            />
            {countriesFailed ? (
              /* Never a dead end. The list is normally rendered by the
                 server, so this only shows when a caller relied on the
                 fetch and it failed twice. */
              <p className="mt-1.5 text-[11px] text-[color:var(--color-danger)]">
                {t("auth.countryListFailed", "We couldn't load the country list.")}{" "}
                <button
                  type="button"
                  onClick={() => void loadCountries()}
                  className="font-semibold underline underline-offset-2"
                >
                  {t("common.tryAgain", "Try again")}
                </button>
                {t("auth.orReload", ", or reload the page.")}
              </p>
            ) : (
              <p className="mt-1.5 text-[11px] text-[color:var(--color-text-subtle)]">
                {t(
                  "auth.countryHint",
                  "So we can show you what\u2019s near you. You can change it any time.",
                )}
              </p>
            )}
          </Field>

          <div>
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                name="acceptedTerms"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                onBlur={blur("acceptedTerms")}
                aria-invalid={!!shown("acceptedTerms")}
                aria-describedby={
                  shown("acceptedTerms") ? "acceptedTerms-error" : undefined
                }
                className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[color:var(--color-brand)]"
              />
              <span className="text-[13px] leading-relaxed text-[color:var(--color-text-muted)]">
                I accept the{" "}
                <Link
                  href="/terms"
                  target="_blank"
                  className="font-medium text-[color:var(--color-brand)] hover:underline"
                >
                  terms of use
                </Link>{" "}
                and the{" "}
                <Link
                  href="/privacy"
                  target="_blank"
                  className="font-medium text-[color:var(--color-brand)] hover:underline"
                >
                  privacy notice
                </Link>
                .
              </span>
            </label>
            {shown("acceptedTerms") && (
              <p
                id="acceptedTerms-error"
                className="mt-1.5 text-[12px] text-[color:var(--color-danger)]"
              >
                {shown("acceptedTerms")}
              </p>
            )}
          </div>

          {/* The arithmetic check.
              Text, not a picture: a screen reader can read "7 + 5" and a
              person with a migraine can too, which is more than can be
              said for the warped-letters kind. */}
          <Field
            label={t("auth.quickCheck", "Quick check")}
            htmlFor="captchaAnswer"
            error={shown("captchaAnswer")}
          >
            <div className="flex items-stretch gap-2.5">
              <span
                aria-hidden
                className="flex h-11 min-w-[112px] select-none items-center justify-center rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] px-3 text-[16.5px] font-semibold tabular-nums tracking-wide"
              >
                {captcha ? `${captcha.question} =` : "…"}
              </span>
              <Input
                id="captchaAnswer"
                name="captchaAnswer"
                className="flex-1"
                inputMode="numeric"
                autoComplete="off"
                maxLength={5}
                value={captchaAnswer}
                onChange={(e) => setCaptchaAnswer(e.target.value)}
                onBlur={blur("captchaAnswer")}
                placeholder={t("auth.answer", "Answer")}
                /* The visible sum is aria-hidden, so the label has to
                   carry the question or this box is just "Quick check"
                   to anyone not looking at the screen. */
                aria-label={
                  captcha
                    ? t("auth.quickCheckAria", "Quick check: what is {sum}?", {
                        sum: captcha.question,
                      })
                    : t("auth.quickCheck", "Quick check")
                }
                invalid={!!shown("captchaAnswer")}
                aria-invalid={!!shown("captchaAnswer")}
                aria-describedby={
                  shown("captchaAnswer") ? "captchaAnswer-error" : undefined
                }
              />
              <button
                type="button"
                onClick={() => void loadCaptcha()}
                disabled={captchaBusy}
                aria-label={t("auth.newSum", "Give me a different sum")}
                title={t("auth.newSum", "Give me a different sum")}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-[color:var(--color-border)] text-[color:var(--color-text-muted)] transition-colors hover:border-[color:var(--color-brand)] hover:text-[color:var(--color-brand)] disabled:opacity-50"
              >
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                  className={captchaBusy ? "animate-spin" : undefined}
                >
                  <path d="M20 11.5A8 8 0 106.6 17.4" />
                  <path d="M20 5.5v6h-6" />
                </svg>
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-[color:var(--color-text-subtle)]">
              {t("auth.captchaNote", "One small sum, to keep scripts from signing up in bulk.")}
            </p>
          </Field>

          {/* Honeypot.
              Off-screen rather than display:none — some bots skip
              anything hidden, most fill every input they can find. A
              person never reaches it: no tab stop, hidden from the
              accessibility tree, and autocomplete off so a password
              manager has nothing to match. */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden"
          >
            <label htmlFor="website">Website</label>
            <input
              id="website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>
        </>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-[10px] border border-[color:var(--color-danger-soft)] bg-[color:var(--color-danger-soft)] px-3 py-2 text-[13px] text-[color:var(--color-danger)]"
        >
          {error}
        </div>
      )}

      <Button type="submit" size="lg" loading={submitting} className="w-full">
        {submitting
          ? isSignup
            ? t("auth.creating", "Creating account…")
            : t("auth.signingIn", "Signing in…")
          : isSignup
            ? t("header.createAccount", "Create account")
            : t("header.signIn", "Sign in")}
      </Button>
    </form>
  );
}

/* ── bits ────────────────────────────────────────────────────── */

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${htmlFor}-error`} className="mt-1.5 text-[12px] text-[color:var(--color-danger)]">
          {error}
        </p>
      )}
    </div>
  );
}

const BAR_TONE = [
  "bg-[color:var(--color-danger)]",
  "bg-[color:var(--color-danger)]",
  "bg-[color:var(--color-warning)]",
  "bg-[color:var(--color-brand)]",
  "bg-[color:var(--color-success)]",
];

function StrengthMeter({
  strength,
}: {
  strength: ReturnType<typeof passwordStrength>;
}) {
  return (
    <div id="password-strength" className="mt-2">
      <div className="flex gap-1" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
              i <= strength.score
                ? BAR_TONE[strength.score]
                : "bg-[color:var(--color-surface-muted)]"
            }`}
          />
        ))}
      </div>
      {/* Polite, not assertive: this updates on every keystroke and
          should never interrupt what a screen reader is saying. */}
      <p aria-live="polite" className="mt-1.5 text-[11.5px]">
        <span className="font-medium">{strength.label}</span>
        {strength.advice && (
          <span className="text-[color:var(--color-text-subtle)]"> · {strength.advice}</span>
        )}
      </p>
    </div>
  );
}
