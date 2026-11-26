"use client";

/**
 * /settings — the account, not the profile.
 *
 * The split is deliberate. /profile is what other people see: your
 * name, photo, bio. This is what only you see: how you get in, what
 * the site assumes about you, and how to leave.
 *
 * The layout rules:
 *
 *  • Each section is a card: a titled header, then hairline-separated
 *    rows. The card is what makes "these three things belong together"
 *    legible without reading any of them.
 *  • Each row is label / value / action on one line, aligned — so the
 *    page can be scanned down the left edge for "what can I change"
 *    and down the right for "what is it set to".
 *  • Editing opens a WELL — tinted and recessed inside the card,
 *    because an open form genuinely is a different kind of thing from
 *    the rows around it, and because a card that simply sprouts input
 *    fields looks like it burst.
 *  • Feedback is a toast, not a line of text that appears mid-page and
 *    shoves everything below it down.
 *  • Only one form is open at a time. Two half-filled password forms on
 *    one screen is a way to type the wrong thing into the wrong box.
 *
 * Everything that changes how you sign in asks for the current
 * password. That is not ceremony — an unlocked phone on a table is the
 * realistic threat, and it is the one thing a borrowed session cannot
 * supply.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteShell, type ShellViewer } from "./site-shell";
import { NavIcon, type NavIconName } from "./nav-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { confirmError, passwordError, passwordStrength } from "@/lib/signup-rules";
import { Img } from "@/components/ui/img";
import { AppearanceToggle, ThemePicker, TonePicker } from "./appearance";
import { useT } from "./locale-context";
import { TRich } from "./t-rich";
import { DELETE_CONFIRM_WORD } from "@/lib/delete-confirm";
import { serverText } from "@/lib/i18n-core";

interface CountryOption {
  id: string;
  name: string;
  emojiFlag: string | null;
}

interface BlockedRow {
  /* `userId`, not `id`. This mirrors what `listBlocked()` in
     @/lib/blocks actually returns — it is a row ABOUT a block, and the
     id on it is the blocked person's. Declaring `id` here compiled
     fine (the response is cast, not parsed) and broke unblocking
     entirely: the POST sent `userId: undefined`, the key on every row
     was undefined, and `busy === b.id` was true for all of them at
     once. src/components/site/blocked-client.tsx had it right. */
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

interface Settings {
  email: string;
  pendingEmail: string | null;
  displayName: string;
  countryId: string | null;
  anonymousByDefault: boolean;
  emailVerifiedAt: string | null;
}

/** Which inline form is open. Never two. */
type OpenForm = null | "email" | "password" | "deactivate" | "delete";

export function SettingsClient({ viewer }: { viewer: ShellViewer }) {
  const t = useT();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [blocked, setBlocked] = useState<BlockedRow[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [open, setOpen] = useState<OpenForm>(null);
  const [toast, setToast] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  const say = useCallback((tone: "ok" | "bad", text: string) => {
    setToast({ tone, text });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const load = useCallback(async () => {
    const res = await fetch("/api/user/settings", { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const d = (await res.json()) as { settings: Settings; blocked: BlockedRow[] };
    setSettings(d.settings);
    setBlocked(d.blocked ?? []);
  }, []);

  useEffect(() => {
    void load();
    void fetch("/api/public/geo/countries")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { items?: CountryOption[] } | null) => setCountries(d?.items ?? []))
      .catch(() => {});
  }, [load]);

  return (
    <SiteShell viewer={viewer} hideRightRail>
      <div className="mx-auto max-w-[660px] space-y-4 pb-8">
        <header>
          <h1 className="text-[27px] font-semibold leading-tight tracking-[-0.025em] sm:text-[30px]">
            {t("menu.settings", "Settings")}
          </h1>
          <p className="mt-1 text-[13.5px] leading-relaxed text-[color:var(--color-text-muted)]">
            {/*
              ONE STRING WITH THE LINK AS A PLACEHOLDER, not a sentence
              cut in three around a <Link>. Split, a translator gets
              "Your account and how you sign in. Your name, photo and
              bio live on", "your profile" and "." — and no way to put
              the link where their language wants it. This is what
              `TRich` is for, and it was already imported in this file
              and used further down; the header just predates it.
            */}
            <TRich
              text={t(
                "settings.subtitle",
                "Your account and how you sign in. Your name, photo and bio live on {profile}.",
              )}
              vars={{
                profile: (
                  <Link
                    href="/profile"
                    className="font-medium text-[color:var(--color-brand)] hover:underline"
                  >
                    {t("settings.yourProfile", "your profile")}
                  </Link>
                ),
              }}
            />
          </p>
        </header>

        {settings === null ? (
          <Skeleton />
        ) : (
          <>
            <AccountSection
              settings={settings}
              open={open}
              setOpen={setOpen}
              say={say}
              onChanged={load}
            />
            <AppearanceSection say={say} />
            <PreferencesSection
              settings={settings}
              countries={countries}
              say={say}
              onChanged={load}
            />
            <BlockedSection blocked={blocked} say={say} onChanged={load} />
            <LeavingSection open={open} setOpen={setOpen} say={say} />
          </>
        )}
      </div>

      {toast && <Toast tone={toast.tone}>{toast.text}</Toast>}
    </SiteShell>
  );
}

/* ── the building blocks ─────────────────────────────────────── */

function Group({
  icon,
  title,
  subtitle,
  tone = "normal",
  children,
}: {
  icon: NavIconName;
  title: string;
  subtitle?: string;
  tone?: "normal" | "danger";
  children: React.ReactNode;
}) {
  const danger = tone === "danger";
  return (
    <section
      className={`overflow-hidden rounded-2xl border bg-[color:var(--color-surface)] shadow-card ${
        danger
          ? "border-[color:var(--color-danger)]/25"
          : "border-[color:var(--color-border-soft)]"
      }`}
    >
      <header className="flex items-start gap-3 px-5 pb-4 pt-5">
        <span
          className={`mt-px flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            danger
              ? "bg-[color:var(--color-danger)]/10 text-[color:var(--color-danger)]"
              : "bg-[color:var(--color-brand)]/10 text-[color:var(--color-brand)]"
          }`}
        >
          <NavIcon name={icon} size={17} />
        </span>
        <div className="min-w-0">
          <h2
            className={`text-[15.5px] font-semibold leading-tight tracking-[-0.015em] ${
              danger ? "text-[color:var(--color-danger)]" : ""
            }`}
          >
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 max-w-[52ch] text-[12.5px] leading-relaxed text-[color:var(--color-text-muted)]">
              {subtitle}
            </p>
          )}
        </div>
      </header>
      <div className="border-t border-[color:var(--color-border-soft)] px-5">{children}</div>
    </section>
  );
}

/** label / value / action, on one line. The spine of the whole page. */
function Row({
  label,
  hint,
  value,
  action,
  children,
}: {
  label: string;
  hint?: string;
  value?: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-t border-[color:var(--color-border-soft)] py-4 first:border-t-0">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-[14px] font-medium leading-tight">{label}</p>
          {value !== undefined && (
            <div className="mt-1 truncate text-[13.5px] text-[color:var(--color-text-muted)]">
              {value}
            </div>
          )}
          {hint && (
            <p className="mt-1 max-w-[52ch] text-[12px] leading-relaxed text-[color:var(--color-text-subtle)]">
              {hint}
            </p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </div>
  );
}

/**
 * The well a form opens into — the only tinted, rounded thing left on
 * the page, which is exactly why it reads as "this is a form" without
 * needing a border to say so.
 */
function Inset({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)] p-4">
      {children}
    </div>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[12.5px] font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1.5 text-[12px] text-[color:var(--color-danger)]">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-[color:var(--color-text-subtle)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function FormActions({
  submitLabel,
  busy,
  onCancel,
  variant = "primary",
}: {
  submitLabel: string;
  busy: boolean;
  onCancel: () => void;
  variant?: "primary" | "danger";
}) {
  const t = useT();
  return (
    <div className="flex items-center gap-2 pt-1">
      <Button type="submit" size="sm" variant={variant} loading={busy}>
        {submitLabel}
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
        {t("common.cancel", "Cancel")}
      </Button>
    </div>
  );
}

function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-[26px] w-[46px] shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50 ${
        checked
          ? "bg-[color:var(--color-brand)]"
          : "bg-[color:var(--color-border)]"
      }`}
    >
      <span
        className={`absolute top-[3px] h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? "translate-x-[23px]" : "translate-x-[3px]"
        }`}
      />
    </button>
  );
}

function Toast({ tone, children }: { tone: "ok" | "bad"; children: React.ReactNode }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-[calc(1.5rem+var(--bottom-nav-h))] z-40 flex justify-center px-4"
    >
      <span
        className={`rounded-full px-4 py-2.5 text-[13.5px] font-medium shadow-[var(--shadow-elevated)] ${
          tone === "ok"
            ? "bg-[color:var(--color-text)] text-[color:var(--color-surface)]"
            : "bg-[color:var(--color-danger)] text-[color:var(--color-on-danger)]"
        }`}
      >
        {children}
      </span>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-36 animate-pulse rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)]"
        />
      ))}
    </div>
  );
}

type Say = (tone: "ok" | "bad", text: string) => void;

/* ── account ─────────────────────────────────────────────────── */

function AccountSection({
  settings,
  open,
  setOpen,
  say,
  onChanged,
}: {
  settings: Settings;
  open: OpenForm;
  setOpen: (v: OpenForm) => void;
  say: Say;
  onChanged: () => void;
}) {
  const t = useT();
  return (
    <Group
      icon="user"
      title={t("settings.account", "Account")}
      subtitle={t("settings.accountSub", "How you sign in. Both of these ask for your current password.")}
    >
      <Row
        label={t("settings.email", "Email")}
        value={
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="truncate">{settings.email}</span>
            <Pill tone={settings.emailVerifiedAt ? "ok" : "warn"}>
              {settings.emailVerifiedAt ? t("settings.verified", "Verified") : t("settings.unverified", "Unverified")}
            </Pill>
          </span>
        }
        action={
          open !== "email" && (
            <Button size="sm" variant="secondary" onClick={() => setOpen("email")}>
              {t("settings.change", "Change")}
            </Button>
          )
        }
      >
        {settings.pendingEmail && <PendingEmail email={settings.pendingEmail} onChanged={onChanged} say={say} />}
        {open === "email" && (
          <EmailForm onDone={() => setOpen(null)} say={say} onChanged={onChanged} />
        )}
      </Row>

      <Row
        label={t("settings.password", "Password")}
        value="••••••••••"
        hint={t(
          "settings.passwordHint",
          "Changing it signs out every other device — phones, other browsers, anything you left signed in.",
        )}
        action={
          open !== "password" && (
            <Button size="sm" variant="secondary" onClick={() => setOpen("password")}>
              {t("settings.change", "Change")}
            </Button>
          )
        }
      >
        {open === "password" && (
          <PasswordForm onDone={() => setOpen(null)} say={say} />
        )}
      </Row>
    </Group>
  );
}

function Pill({ tone, children }: { tone: "ok" | "warn"; children: React.ReactNode }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        tone === "ok"
          ? "bg-[color:var(--color-success)]/12 text-[color:var(--color-success)]"
          : "bg-[color:var(--color-warning)]/12 text-[color:var(--color-warning)]"
      }`}
    >
      {children}
    </span>
  );
}

function PendingEmail({
  email,
  onChanged,
  say,
}: {
  email: string;
  onChanged: () => void;
  say: Say;
}) {
  const t = useT();
  const cancel = async () => {
    await fetch("/api/user/settings/email", { method: "DELETE" }).catch(() => {});
    say("ok", t("settings.emailCancelled", "Email change cancelled."));
    onChanged();
  };
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[color:var(--color-warning)]/40 bg-[color:var(--color-warning-soft)] px-3.5 py-3">
      <p className="min-w-0 text-[12.5px] leading-relaxed text-[color:var(--color-warning-ink)]">
        <TRich
          text={t(
            "settings.waitingOnEmail",
            "Waiting on {email}. Until you open the link in that inbox, you sign in with the old address.",
          )}
          vars={{ email: <span className="font-semibold">{email}</span> }}
        />
      </p>
      <button
        type="button"
        onClick={() => void cancel()}
        className="shrink-0 text-[12.5px] font-semibold text-[color:var(--color-warning-ink)] underline underline-offset-2"
      >
        {t("common.cancel", "Cancel")}
      </button>
    </div>
  );
}

function EmailForm({
  onDone,
  say,
  onChanged,
}: {
  onDone: () => void;
  say: Say;
  onChanged: () => void;
}) {
  const t = useT();
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/user/settings/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, currentPassword }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const d = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
      setError(serverText(t, d?.error) || t("settings.couldNotDoThat", "Couldn't do that."));
      return;
    }
    say("ok", t("settings.emailSent", "Check the new inbox for a confirmation link."));
    onDone();
    onChanged();
  };

  return (
    <Inset>
      <form onSubmit={submit} className="space-y-3.5">
        <Field
          id="new-email"
          label={t("settings.newEmail", "New email")}
          hint={t(
            "settings.newEmailHint",
            "We send a link there. Nothing changes until you open it, so a typo can't lock you out.",
          )}
        >
          <Input
            id="new-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("settings.emailPlaceholder", "you@example.com")}
            invalid={!!error}
          />
        </Field>
        <Field
          id="email-current"
          label={t("settings.currentPassword", "Current password")}
          error={error}
        >
          <PasswordInput
            id="email-current"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            invalid={!!error}
          />
        </Field>
        <FormActions submitLabel={t("settings.sendConfirmation", "Send confirmation")} busy={busy} onCancel={onDone} />
      </form>
    </Inset>
  );
}

function PasswordForm({ onDone, say }: { onDone: () => void; say: Say }) {
  const t = useT();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const strength = passwordStrength(password);
  const pwErr = password ? passwordError(password) : null;
  const cfErr = confirm ? confirmError(password, confirm) : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/user/settings/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, password, confirm }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const d = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
      setError(serverText(t, d?.error) || t("settings.couldNotChange", "Couldn't change it."));
      return;
    }
    say("ok", t("settings.passwordChanged", "Password changed. Other devices signed out."));
    onDone();
  };

  return (
    <Inset>
      <form onSubmit={submit} className="space-y-3.5">
        <Field
          id="pw-current"
          label={t("settings.currentPassword", "Current password")}
          error={error}
        >
          <PasswordInput
            id="pw-current"
            autoComplete="current-password"
            required
            autoFocus
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            invalid={!!error}
          />
        </Field>
        <Field id="pw-new" label={t("settings.newPassword", "New password")} error={pwErr}>
          <PasswordInput
            id="pw-new"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t("settings.passwordPlaceholder", "At least 8 characters")}
            invalid={!!pwErr}
          />
          {password.length > 0 && <Strength strength={strength} />}
        </Field>
        <Field id="pw-confirm" label={t("settings.confirmPassword", "Confirm new password")} error={cfErr}>
          <PasswordInput
            id="pw-confirm"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            invalid={!!cfErr}
          />
        </Field>
        <FormActions submitLabel={t("settings.changePassword", "Change password")} busy={busy} onCancel={onDone} />
      </form>
    </Inset>
  );
}

const BAR_TONE = [
  "bg-[color:var(--color-danger)]",
  "bg-[color:var(--color-danger)]",
  "bg-[color:var(--color-warning)]",
  "bg-[color:var(--color-brand)]",
  "bg-[color:var(--color-success)]",
];

function Strength({ strength }: { strength: ReturnType<typeof passwordStrength> }) {
  return (
    <div className="mt-2">
      <div className="flex gap-1" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
              i <= strength.score ? BAR_TONE[strength.score] : "bg-[color:var(--color-border)]"
            }`}
          />
        ))}
      </div>
      <p aria-live="polite" className="mt-1.5 text-[11.5px]">
        <span className="font-medium">{strength.label}</span>
        {strength.advice && (
          <span className="text-[color:var(--color-text-subtle)]"> · {strength.advice}</span>
        )}
      </p>
    </div>
  );
}

/* ── preferences ─────────────────────────────────────────────── */

/* ── appearance ──────────────────────────────────────────────── */

/**
 * The only settings card that does not reload anything on save.
 *
 * Every other row here PATCHes and then calls `onChanged()` to
 * re-fetch, because the value shown is the value stored. Appearance
 * is different: the page has already changed colour by the time the
 * request goes out, so there is nothing to re-read — and a refetch
 * would only introduce a window where the card disagrees with the
 * page it is sitting on.
 */
function AppearanceSection({ say }: { say: Say }) {
  const t = useT();
  return (
    <Group
      icon="settings"
      title={t("settings.appearance", "Appearance")}
      subtitle="Yours only — nobody else sees the site the way you have set it."
    >
      <Row
        label={t("settings.mode", "Mode")}
        hint={t(
          "settings.modeHint",
          "Light, auto or dark. Auto follows your device, so the site goes dark when your phone does.",
        )}
        action={
          <AppearanceToggle
            onSaved={(m, ok) =>
              say(
                ok ? "ok" : "bad",
                ok
                  ? m === "system"
                    ? t("settings.followingDevice", "Following your device.")
                    : t("settings.switchedTo", "Switched to {mode}.", { mode: m })
                  : t("settings.notSaved", "Changed here, but we couldn't save it."),
              )
            }
          />
        }
      />

      <Row
        label={t("settings.colour", "Colour")}
        hint={t(
          "settings.colourHint",
          "Each one changes the greys and the backgrounds too, not just the buttons — which is why the swatches show a whole little page rather than a dot.",
        )}
      >
        <div className="mt-3.5">
          <ThemePicker
            onSaved={(_id, ok) =>
              say(
                ok ? "ok" : "bad",
                ok
                  ? t("settings.colourSaved", "Colour saved.")
                  : t("settings.notSaved", "Changed here, but we couldn't save it."),
              )
            }
          />
        </div>
      </Row>

      <Row
        label={t("settings.tone", "Tone")}
        hint={t(
          "settings.toneHint",
          "How deep that colour runs — lighter for something quieter, deeper for more of it. The sample below is live, not a picture.",
        )}
      >
        <div className="mt-3.5">
          <TonePicker
            onSaved={(_tone, ok) =>
              say(
                ok ? "ok" : "bad",
                ok
                  ? t("settings.toneSaved", "Tone saved.")
                  : t("settings.notSaved", "Changed here, but we couldn't save it."),
              )
            }
          />
        </div>
      </Row>
    </Group>
  );
}

function PreferencesSection({
  settings,
  countries,
  say,
  onChanged,
}: {
  settings: Settings;
  countries: CountryOption[];
  say: Say;
  onChanged: () => void;
}) {
  const t = useT();
  const [saving, setSaving] = useState(false);

  const save = async (patch: Record<string, unknown>, note: string) => {
    setSaving(true);
    const res = await fetch("/api/user/settings/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => null);
    setSaving(false);
    say(res?.ok ? "ok" : "bad", res?.ok ? note : t("settings.couldNotSave", "Couldn't save that."));
    onChanged();
  };

  return (
    <Group
      icon="settings"
      title={t("settings.preferences", "Preferences")}
      subtitle={t("settings.preferencesSub", "What the site assumes about you.")}
    >
      <Row
        label={t("common.country", "Country")}
        hint={t("settings.countryHint", "Scopes places, events and campaigns to where you are.")}
        action={
          <select
            aria-label={t("common.country", "Country")}
            value={settings.countryId ?? ""}
            disabled={saving}
            onChange={(e) => void save({ countryId: e.target.value || null }, t("settings.countrySaved", "Country saved."))}
            className="h-10 min-w-[170px] rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 text-[13.5px] focus:border-[color:var(--color-brand)] focus:outline-none focus:ring-4 focus:ring-[color:var(--color-brand-soft)] disabled:opacity-50"
          >
            <option value="">{t("places.everywhere", "Everywhere")}</option>
            {countries.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emojiFlag ? `${c.emojiFlag} ` : ""}
                {c.name}
              </option>
            ))}
          </select>
        }
      />

      <Row
        label={t("settings.anonDefault", "Post anonymously by default")}
        hint="Your name is hidden from other members on new posts. It is still linked to your account in our database — that is how you can delete a post later, and how we act when someone abuses anonymity."
        action={
          <Switch
            label={t("settings.anonDefault", "Post anonymously by default")}
            checked={settings.anonymousByDefault}
            disabled={saving}
            onChange={(v) =>
              void save(
                { anonymousByDefault: v },
                v
                  ? t("settings.anonOn", "New posts will be anonymous.")
                  : t("settings.anonOff", "New posts will show your name."),
              )
            }
          />
        }
      />
    </Group>
  );
}

/* ── blocked ─────────────────────────────────────────────────── */

function BlockedSection({
  blocked,
  say,
  onChanged,
}: {
  blocked: BlockedRow[];
  say: Say;
  onChanged: () => void;
}) {
  const t = useT();
  const [busy, setBusy] = useState<string | null>(null);

  const unblock = async (row: BlockedRow) => {
    setBusy(row.userId);
    // The existing endpoint takes the id in the body with block:false,
    // rather than a DELETE on a path — matched here rather than adding
    // a second way to do the same thing.
    const res = await fetch("/api/user/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: row.userId, block: false }),
    }).catch(() => null);
    setBusy(null);
    say(
      res?.ok ? "ok" : "bad",
      res?.ok
        ? t("settings.unblocked", "Unblocked {name}.", { name: row.displayName })
        : t("settings.couldNotUnblock", "Couldn't unblock."),
    );
    onChanged();
  };

  return (
    <Group
      icon="confess"
      title={t("settings.blocked", "Blocked accounts")}
      subtitle={t("settings.blockedSub", "They can't see your posts, and you won't see theirs.")}
    >
      {blocked.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-[color:var(--color-text-subtle)]">
          {t("settings.noBlocked", "You haven\u2019t blocked anyone.")}
        </p>
      ) : (
        <ul>
          {blocked.map((b) => (
            <li
              key={b.userId}
              className="flex items-center gap-3 border-t border-[color:var(--color-border-soft)] py-3 first:border-t-0"
            >
              {b.avatarUrl ? (
                <Img src={b.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover"
                  variant="thumb"
                />
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--color-surface-muted)] text-[13px] font-semibold text-[color:var(--color-text-muted)]">
                  {b.displayName.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-[14px] font-medium">
                {b.displayName}
              </span>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy === b.userId}
                onClick={() => void unblock(b)}
              >
                {t("settings.unblock", "Unblock")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Group>
  );
}

/* ── leaving ─────────────────────────────────────────────────── */

function LeavingSection({
  open,
  setOpen,
  say,
}: {
  open: OpenForm;
  setOpen: (v: OpenForm) => void;
  say: Say;
}) {
  const t = useT();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [confirmWord, setConfirmWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mode = open === "deactivate" || open === "delete" ? open : null;

  const close = () => {
    setOpen(null);
    setError(null);
    setCurrentPassword("");
    setConfirmWord("");
  };

  const run = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mode) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/user/settings/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        mode === "delete" ? { currentPassword, confirm: confirmWord } : { currentPassword },
      ),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const d = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
      setError(serverText(t, d?.error) || t("settings.couldNotDoThat", "Couldn't do that."));
      return;
    }
    say(
      "ok",
      mode === "delete"
        ? t("settings.deleted", "Your account has been deleted.")
        : t("settings.deactivated", "Account deactivated."),
    );
    router.replace("/");
    router.refresh();
  };

  return (
    <Group
      icon="bookmark"
      title={t("settings.leaving", "Leaving")}
      subtitle={t("settings.leavingSub", "Two ways out. One you can come back from.")}
      tone="danger"
    >
      <Row
        label={t("settings.deactivate", "Deactivate")}
        hint={t(
          "settings.deactivateHint",
          "Freezes the account and signs you out everywhere. Nothing is deleted, but you'll need to ask us to switch it back on.",
        )}
        action={
          mode !== "deactivate" && (
            <Button size="sm" variant="secondary" onClick={() => setOpen("deactivate")}>
              {t("settings.deactivate", "Deactivate")}
            </Button>
          )
        }
      >
        {mode === "deactivate" && (
          <Inset>
            <form onSubmit={run} className="space-y-3.5">
              <Field
                id="deact-password"
                label={t("settings.currentPassword", "Current password")}
                error={error}
                hint={t(
                  "settings.currentPasswordHint",
                  "Confirming it's you, not someone who found your phone.",
                )}
              >
                <PasswordInput
                  id="deact-password"
                  autoComplete="current-password"
                  required
                  autoFocus
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  invalid={!!error}
                />
              </Field>
              <FormActions
                submitLabel={t("settings.deactivateConfirm", "Deactivate my account")}
                busy={busy}
                onCancel={close}
              />
            </form>
          </Inset>
        )}
      </Row>

      <Row
        label={t("common.delete", "Delete")}
        hint={t(
          "settings.deleteHint",
          "Removes your profile, posts, comments, gratitude entries, messages and uploads. Places and events you contributed stay, without your name on them. This cannot be undone.",
        )}
        action={
          mode !== "delete" && (
            <Button size="sm" variant="danger" onClick={() => setOpen("delete")}>
              {t("common.delete", "Delete")}
            </Button>
          )
        }
      >
        {mode === "delete" && (
          <Inset>
            <form onSubmit={run} className="space-y-3.5">
              <Field
                id="del-password"
                label={t("settings.currentPassword", "Current password")}
                error={error}
              >
                <PasswordInput
                  id="del-password"
                  autoComplete="current-password"
                  required
                  autoFocus
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  invalid={!!error}
                />
              </Field>
              <Field
                id="del-confirm"
                /*
                  `{word}` rather than the word itself: Google
                  translates "DELETE" inside the sentence, and the
                  server compares what was typed against the English.
                  A member following translated instructions would be
                  refused, with nothing on screen explaining why.
                */
                label={t("settings.typeDelete", "Type {word} to confirm", {
                  word: DELETE_CONFIRM_WORD,
                })}
                hint={t(
                  "settings.typeDeleteHint",
                  "Deliberately awkward. This is the one thing here you cannot undo.",
                )}
              >
                <Input
                  id="del-confirm"
                  value={confirmWord}
                  onChange={(e) => setConfirmWord(e.target.value)}
                  placeholder={DELETE_CONFIRM_WORD}
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
              <FormActions
                submitLabel={t("settings.deleteConfirm", "Delete permanently")}
                busy={busy}
                onCancel={close}
                variant="danger"
              />
            </form>
          </Inset>
        )}
      </Row>
    </Group>
  );
}
