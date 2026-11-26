import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/site/auth-shell";
import { confirmEmailChange } from "@/lib/account";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.verify.email.change.title", "Confirm your new email"),
    robots: { index: false, follow: false },
  };
}

export default async function VerifyEmailChangePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const t = await getT();
  const { token } = await searchParams;

  // Consumed on GET, unlike the password reset. The difference is what
  // the link can do: this one only swaps in an address the account
  // holder already typed and can undo, so a link scanner burning it
  // costs them a re-request, not access to their account.
  const result = token ? await confirmEmailChange(token) : { ok: false as const };

  return (
    <AuthShell
      title={
        result.ok
          ? t("emailChange.ok", "Email updated")
          : t("verifyPage.bad", "That link didn't work")
      }
      subtitle={
        result.ok
          ? t("emailChange.okSub", "Use the new address from now on.")
          : t("emailChange.badSub", "It may have expired, or already been used.")
      }
      footer={
        <Link href="/settings" className="font-medium text-[color:var(--color-brand)] hover:underline">
          {t("emailChange.backToSettings", "Back to settings")}
        </Link>
      }
    >
      <div className="text-center">
        {result.ok ? (
          <>
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--color-success)]/12 text-[color:var(--color-success)]">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <p className="text-[15px] font-medium">{result.email}</p>
            <p className="mx-auto mt-1.5 max-w-[40ch] text-[13.5px] leading-relaxed text-[color:var(--color-text-muted)]">
              {t(
                "emailChange.okBody",
                "That's the address on your account now, and it's already verified \u2014 you confirmed it by opening this link.",
              )}
            </p>
          </>
        ) : (
          <p className="mx-auto max-w-[40ch] text-[13.5px] leading-relaxed text-[color:var(--color-text-muted)]">
            {"error" in result && result.error
              ? result.error
              : t("emailChange.badBody", "Ask for a new one from your settings page.")}
          </p>
        )}
      </div>
    </AuthShell>
  );
}
