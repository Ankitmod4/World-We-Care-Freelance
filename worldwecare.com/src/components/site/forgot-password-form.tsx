"use client";

/**
 * "I can't get in."
 *
 * One field, and a success state that says the same thing whether or
 * not the address was registered — matching the endpoint, which is
 * where that rule actually lives. If this screen said "no account with
 * that email", the endpoint's careful non-disclosure would have been
 * for nothing.
 */

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { emailError } from "@/lib/signup-rules";
import { useT } from "./locale-context";
import { serverText } from "@/lib/i18n-core";

export function ForgotPasswordForm() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [tried, setTried] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fieldError = touched || tried ? emailError(email) : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setTried(true);
    if (emailError(email)) return;

    setSending(true);
    setError(null);
    const res = await fetch("/api/user/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    }).catch(() => null);
    setSending(false);

    if (!res?.ok) {
      const d = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
      setError(serverText(t, d?.error) || t("auth.tryAgainSoon", "Something went wrong. Try again in a moment."));
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div className="text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--color-brand)]/10 text-[color:var(--color-brand)]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
            <rect x="3.25" y="5.5" width="17.5" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
            <path d="M4 7.5l8 5 8-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <p className="text-[16px] font-semibold">{t("auth.checkInbox", "Check your inbox")}</p>
        <p className="mx-auto mt-1.5 max-w-[40ch] text-[13.5px] leading-relaxed text-[color:var(--color-text-muted)]">
          {t(
            "auth.resetSent",
            "If {email} is registered, a reset link is on its way. It expires in 10 minutes, so use it soon.",
            { email: email.trim() },
          )}
        </p>
        <p className="mx-auto mt-3 max-w-[40ch] text-[12.5px] text-[color:var(--color-text-subtle)]">
          {t("auth.checkSpam", "Nothing after a few minutes? Check your spam folder, then try again.")}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Link href="/login">
            <Button variant="secondary" className="w-full">
              {t("auth.backToSignIn", "Back to sign in")}
            </Button>
          </Link>
          <button
            type="button"
            onClick={() => {
              setSent(false);
              setTried(false);
            }}
            className="text-[13px] text-[color:var(--color-text-muted)] hover:underline"
          >
            {t("auth.differentEmail", "Use a different email")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="email" className="mb-1.5 block text-[13px] font-medium">
          {t("settings.email", "Email")}
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder={t("settings.emailPlaceholder", "you@example.com")}
          invalid={!!fieldError}
          aria-invalid={!!fieldError}
          aria-describedby={fieldError ? "email-error" : undefined}
        />
        {fieldError && (
          <p id="email-error" className="mt-1.5 text-[12px] text-[color:var(--color-danger)]">
            {fieldError}
          </p>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-[10px] border border-[color:var(--color-danger-soft)] bg-[color:var(--color-danger-soft)] px-3 py-2 text-[13px] text-[color:var(--color-danger)]"
        >
          {error}
        </div>
      )}

      <Button type="submit" size="lg" loading={sending} className="w-full">
        {sending ? t("auth.sending", "Sending…") : t("auth.sendResetLink", "Send reset link")}
      </Button>
    </form>
  );
}
