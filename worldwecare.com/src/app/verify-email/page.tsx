import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/user-auth";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { VerifyGate } from "@/components/site/verify-gate";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.verify.email.title", "Confirm your email"),
  };
}
export const dynamic = "force-dynamic";

/**
 * /verify-email — where the middleware sends an unconfirmed account.
 *
 * `getSessionUser`, not `getCurrentUser`: the gated one answers null
 * for exactly the people this page exists for.
 *
 * The already-verified branch is the repair path, and it redirects
 * rather than rendering because a page render is not allowed to write
 * a cookie. It catches everyone who was signed in when this shipped
 * (no claim cookie exists for them yet), anyone who cleared their
 * cookies, and anyone who confirmed on another device.
 *
 * The header is passed the member even though they cannot use the
 * site yet. They ARE signed in — that is the whole reason they are
 * looking at this — and the alternative header offers "Sign in" and
 * "Create account" to somebody who has just done both.
 */
export default async function VerifyEmailPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/");
  if (user.emailVerifiedAt) redirect("/api/user/auth/refresh-verified?next=/");

  return (
    <div className="flex min-h-dvh flex-col bg-[color:var(--color-surface-muted)]">
      <SiteHeader user={{ displayName: user.displayName }} />
      <main className="flex-1 px-4 py-12 sm:py-16">
        <VerifyGate email={user.email} />
      </main>
      <SiteFooter />
    </div>
  );
}
