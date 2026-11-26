"use client";

/**
 * Choosing the new password.
 *
 * Same rules, same meter, same confirm behaviour as signup — from the
 * same module, so a reset can't sneak in a password the signup form
 * would have refused.
 *
 * On success this does not sign the person in. It sends them to the
 * login page to type the new password once, which is the difference
 * between proving you can read an inbox and proving you know the
 * password.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { confirmError, passwordError, passwordStrength } from "@/lib/signup-rules";
import { useT } from "./locale-context";
import { serverText } from "@/lib/i18n-core";

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useT();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState<{ password?: boolean; confirm?: boolean }>({});
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const pwErr = passwordError(password);
  const cfErr = confirmError(password, confirm);
  const strength = useMemo(() => passwordStrength(password), [password]);

  const showPw = touched.password || tried ? pwErr : null;
  const showCf = touched.confirm || tried ? cfErr : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setTried(true);
    if (pwErr || cfErr) return;

    setSaving(true);
    setError(null);
    const res = await fetch("/api/user/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password, confirm }),
    }).catch(() => null);
    setSaving(false);

    if (!res?.ok) {
      const d = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
      setError(serverText(t, d?.error) || t("auth.resetFailed", "Couldn't change your password. Try again."));
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <div className="text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--color-success)]/12 text-[color:var(--color-success)]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <p className="text-[16px] font-semibold">{t("auth.passwordChanged", "Password changed")}</p>
        <p className="mx-auto mt-1.5 max-w-[40ch] text-[13.5px] leading-relaxed text-[color:var(--color-text-muted)]">
          {t("auth.passwordChangedBlurb", "We've emailed you to confirm. Sign in with your new password.")}
        </p>
        <Button size="lg" className="mt-5 w-full" onClick={() => router.push("/login")}>
          {t("header.signIn", "Sign in")}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="password" className="mb-1.5 block text-[13px] font-medium">
          {t("settings.newPassword", "New password")}
        </label>
        <PasswordInput
          id="password"
          name="password"
          autoComplete="new-password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          placeholder={t("settings.passwordPlaceholder", "At least 8 characters")}
          invalid={!!showPw}
          aria-invalid={!!showPw}
          aria-describedby={
            showPw ? "password-error" : password.length > 0 ? "password-strength" : undefined
          }
        />
        {showPw && (
          <p id="password-error" className="mt-1.5 text-[12px] text-[color:var(--color-danger)]">
            {showPw}
          </p>
        )}
        {password.length > 0 && (
          <div id="password-strength" className="mt-2">
            <div className="flex gap-1" aria-hidden>
              {[1, 2, 3, 4].map((i) => (
                <span
                  key={i}
                  className={`h-1 flex-1 rounded-full transition-colors duration-200 ${
                    i <= strength.score ? BAR_TONE[strength.score] : "bg-[color:var(--color-surface-muted)]"
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
        )}
      </div>

      <div>
        <label htmlFor="confirm" className="mb-1.5 block text-[13px] font-medium">
          {t("settings.confirmPassword", "Confirm new password")}
        </label>
        <PasswordInput
          id="confirm"
          name="confirm"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, confirm: true }))}
          placeholder={t("auth.typeItAgain", "Type it again")}
          invalid={!!showCf}
          aria-invalid={!!showCf}
          aria-describedby={showCf ? "confirm-error" : undefined}
        />
        {showCf && (
          <p id="confirm-error" className="mt-1.5 text-[12px] text-[color:var(--color-danger)]">
            {showCf}
          </p>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="space-y-2 rounded-[10px] border border-[color:var(--color-danger-soft)] bg-[color:var(--color-danger-soft)] px-3 py-2.5 text-[13px] text-[color:var(--color-danger)]"
        >
          <p>{error}</p>
          {/expired|already been used|Invalid/i.test(error) && (
            <Link href="/forgot-password" className="inline-block font-medium underline">
              {t("auth.askNewLink", "Ask for a new link")}
            </Link>
          )}
        </div>
      )}

      <Button type="submit" size="lg" loading={saving} className="w-full">
        {saving ? t("common.saving", "Saving…") : t("settings.changePassword", "Change password")}
      </Button>
    </form>
  );
}

const BAR_TONE = [
  "bg-[color:var(--color-danger)]",
  "bg-[color:var(--color-danger)]",
  "bg-[color:var(--color-warning)]",
  "bg-[color:var(--color-brand)]",
  "bg-[color:var(--color-success)]",
];
