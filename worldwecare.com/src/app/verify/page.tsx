import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { logUserActivity } from "@/lib/user-activity";
import { consumeToken } from "@/lib/verification";
import { Button } from "@/components/ui/button";
import { getT } from "@/lib/i18n";
import { serverText } from "@/lib/i18n-core";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.verify.title", "Verify email"),
  };
}

/**
 * /verify?token=… — email confirmation landing.
 *
 * Server-rendered so a click straight from the inbox works even
 * without JS. Consumes the token, flips `emailVerifiedAt`, logs the
 * event, and shows a friendly result page.
 *
 * We deliberately don't sign the user in here — they may click the
 * link from a different device / browser. The success screen
 * routes them to Sign in.
 */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const t = await getT();
  const { token = "" } = await searchParams;
  const result = await consumeToken(token, "EMAIL_CONFIRM");

  if (result.ok && result.userId) {
    // Idempotent: findUnique before update so a duplicate click
    // doesn't overwrite an existing verifiedAt with a later time.
    const existing = await prisma.user.findUnique({
      where: { id: result.userId },
      select: { emailVerifiedAt: true },
    });
    if (existing && !existing.emailVerifiedAt) {
      await prisma.user.update({
        where: { id: result.userId },
        data: { emailVerifiedAt: new Date() },
      });
      await logUserActivity({
        userId: result.userId,
        type: "EMAIL_VERIFIED",
        message: "Email verified.",
      });
    }
  }

  return (
    <main className="min-h-screen hero-sky flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-[color:var(--color-surface)] shadow-[var(--shadow-elevated)] mb-6">
          {result.ok ? <CheckIcon /> : <AlertIcon />}
        </div>
        <h1 className="text-[26px] font-semibold tracking-[-0.02em]">
          {result.ok
            ? t("verifyPage.ok", "Email confirmed")
            : t("verifyPage.bad", "That link didn't work")}
        </h1>
        <p className="mt-2 text-[14px] text-[color:var(--color-text-muted)]">
          {result.ok
            ? t(
                "verifyPage.okBody",
                "Thanks \u2014 your email is now verified. You can close this tab or head back to the site.",
              )
            : (serverText(t, result?.error) || t("verifyPage.badBody", "Invalid or expired link."))}
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-2 justify-center">
          {/* Straight home on failure; through the refresh handler on
              success, because that is where the middleware's claim
              cookie gets minted — a page render is not allowed to
              write one. Someone who confirmed in this same browser is
              then let in without meeting the gate at all. It is a
              plain link, so it still works from an email client with
              JavaScript switched off. */}
          <Link href={result.ok ? "/api/user/auth/refresh-verified?next=/" : "/"}>
            <Button size="lg" variant={result.ok ? "primary" : "secondary"}>
              {result.ok ? t("verifyPage.goHome", "Go home") : t("verifyPage.backToSite", "Back to the site")}
            </Button>
          </Link>
          {!result.ok && (
            <Link href="/login">
              <Button size="lg" variant="secondary">
                {t("verifyPage.signInResend", "Sign in to resend")}
              </Button>
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}

function CheckIcon() {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 30 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="15" cy="15" r="12" fill="var(--color-brand)" opacity="0.15" />
      <path
        d="M9 15l4 4 8-8"
        stroke="var(--color-brand)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function AlertIcon() {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 30 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="15" cy="15" r="12" fill="var(--color-danger)" opacity="0.12" />
      <path
        d="M15 9v7M15 20.5v.5"
        stroke="var(--color-danger)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
