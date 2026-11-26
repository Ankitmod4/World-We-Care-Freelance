"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useT } from "@/components/site/locale-context";
import { serverText } from "@/lib/i18n-core";

/**
 * Sits above the fold on any signed-in page for a user who hasn't
 * verified their email yet. Two states:
 *
 *   idle     — "Please verify" + Resend button + Dismiss for session
 *   sent     — "Sent — check your inbox"
 *   error    — inline red text with the API error
 *
 * Dismiss is client-side only (sessionStorage). Verification is a
 * gentle nag, not a hard gate — the user can browse while unverified.
 */
export function UnverifiedBanner({ email }: { email: string }) {
  const t = useT();
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem("wwc-unverified-dismissed") === "1";
  });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  if (dismissed) return null;

  const resend = async () => {
    setStatus("sending");
    setError(null);
    const res = await fetch("/api/user/auth/resend-verification", {
      method: "POST",
    });
    const d = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      alreadyVerified?: boolean;
      error?: string;
    };
    if (!res.ok || d.error) {
      setStatus("error");
      setError(serverText(t, d?.error) || t("verify.sendFailedShort", "Send failed"));
      return;
    }
    setStatus("sent");
  };

  const dismiss = () => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("wwc-unverified-dismissed", "1");
    }
    setDismissed(true);
  };

  return (
    <div className="border-b border-[color:var(--color-warning-soft)] bg-[color:var(--color-warning-soft)]/80 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
        <div className="flex items-start sm:items-center gap-2 flex-1 min-w-0">
          <span className="shrink-0 mt-0.5 sm:mt-0 h-5 w-5 rounded-full bg-[color:var(--color-warning)]/25 text-[color:var(--color-warning-ink)] inline-flex items-center justify-center">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path
                d="M6 3v4M6 9v.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <p className="text-[13px] text-[color:var(--color-warning-ink)] leading-snug">
            {status === "sent" ? (
              <>
                {t("verify.bannerSent", "Sent — check {email} for a confirmation link.", {
                  email,
                })}
              </>
            ) : status === "error" ? (
              <>
                <strong className="font-semibold">
                  {t("verify.bannerFailed", "Couldn't send:")}
                </strong>{" "}
                <span className="text-[color:var(--color-warning-ink)]">{error}</span>
              </>
            ) : (
              <>
                {t("verify.bannerPrompt", "Verify your email to unlock everything.")}{" "}
                <span className="hidden sm:inline text-[color:var(--color-warning-ink)]">
                  {t("verify.bannerSentTo", "We sent a link to {email}.", { email })}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={resend}
            disabled={status === "sending" || status === "sent"}
            className={cn(
              "h-8 px-3 rounded-[10px] text-[12.5px] font-medium transition-colors",
              status === "sent"
                ? "bg-[color:var(--color-success)] text-[color:var(--color-on-success)]"
                : "bg-[color:var(--color-warning)] text-[color:var(--color-on-warning)] hover:bg-[color:var(--color-warning-ink)]",
              "disabled:opacity-60",
            )}
          >
            {status === "sending"
              ? t("auth.sending", "Sending…")
              : status === "sent"
                ? t("verify.sent", "Sent")
                : t("verify.resendEmail", "Resend email")}
          </button>
          <button
            type="button"
            onClick={dismiss}
            className="h-8 px-2.5 rounded-[10px] text-[12.5px] font-medium text-[color:var(--color-warning-ink)] hover:bg-[color:var(--color-warning-soft)] transition-colors"
          >
            {t("common.dismiss", "Dismiss")}
          </button>
        </div>
      </div>
    </div>
  );
}
