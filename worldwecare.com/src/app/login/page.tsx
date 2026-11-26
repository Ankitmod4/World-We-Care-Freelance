import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/user-auth";
import { AuthShell } from "@/components/site/auth-shell";
import { UserAuthForm } from "./user-auth-form";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.login.title", "Sign in"),
  };
}

export default async function UserLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const t = await getT();
  const existing = await getCurrentUser();
  const { next } = await searchParams;
  if (existing) {
    // Already signed in and following a `next` link — send them where
    // they were going, not to the feed. Same same-site guard as the
    // form uses; see safeNext there.
    const target =
      next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
        ? next
        : "/";
    redirect(target);
  }

  return (
    <AuthShell
      title={t("login.title", "Welcome back")}
      subtitle={t("login.subtitle", "Sign in to continue your journey.")}
      footer={
        <>
          {t("login.newHere", "New here?")}{" "}
          <Link href="/signup" className="font-medium text-[color:var(--color-brand)] hover:underline">
            {t("landing.createAccount", "Create an account")}
          </Link>
        </>
      }
    >
      <UserAuthForm mode="login" />
      <p className="mt-4 text-center">
        <Link
          href="/forgot-password"
          className="text-[13px] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-brand)] hover:underline"
        >
          {t("login.forgot", "Forgot your password?")}
        </Link>
      </p>
    </AuthShell>
  );
}
