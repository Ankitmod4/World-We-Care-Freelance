import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/site/auth-shell";
import { ResetPasswordForm } from "@/components/site/reset-password-form";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.reset.password.title", "Choose a new password"),
    // A reset link should never end up in an index or a referrer log.
    robots: { index: false, follow: false },
  };
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const t = await getT();
  const { token } = await searchParams;

  // Deliberately NOT validated here. Checking the token on GET would
  // consume nothing but would tell anyone with a guess whether it was
  // real, and email clients and link scanners fetch URLs on their
  // own — a page that reacted to a GET would let a scanner burn the
  // link before the person ever clicked it. The shape check below is
  // only to catch a mangled URL early.
  const looksLikeToken = typeof token === "string" && /^[a-f0-9]{64}$/.test(token);

  if (!looksLikeToken) {
    return (
      <AuthShell
        title={t("reset.badLink", "That link doesn't look right")}
        subtitle={t("reset.badLinkSub", "It may have been cut short by your email client.")}
        footer={
          <Link href="/login" className="font-medium text-[color:var(--color-brand)] hover:underline">
            {t("auth.backToSignIn", "Back to sign in")}
          </Link>
        }
      >
        <div className="text-center">
          <p className="mx-auto max-w-[40ch] text-[13.5px] leading-relaxed text-[color:var(--color-text-muted)]">
            {t(
              "reset.badLinkBody",
              "Reset links are long, and some email apps break them across lines. Try copying the whole link, or ask for a fresh one \u2014 they only last ten minutes anyway.",
            )}
          </p>
          <Link href="/forgot-password" className="mt-5 block">
            <span className="inline-flex h-11 w-full items-center justify-center rounded-full bg-[color:var(--color-brand)] px-4 text-[14px] font-medium text-[color:var(--color-on-brand)]">
              {t("reset.newLink", "Send me a new link")}
            </span>
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={t("reset.title", "Choose a new password")}
      subtitle={t("reset.subtitle", "Make it long. Length beats punctuation.")}
      footer={
        <Link href="/login" className="font-medium text-[color:var(--color-brand)] hover:underline">
          {t("auth.backToSignIn", "Back to sign in")}
        </Link>
      }
    >
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
