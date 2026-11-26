import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/user-auth";
import { AuthShell } from "@/components/site/auth-shell";
import { ForgotPasswordForm } from "@/components/site/forgot-password-form";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.forgot.password.title", "Reset your password"),
  };
}

export default async function ForgotPasswordPage() {
  const t = await getT();
  // Already signed in? Then this page has nothing to offer.
  const existing = await getCurrentUser();
  if (existing) redirect("/");

  return (
    <AuthShell
      title={t("forgot.title", "Reset your password")}
      subtitle={t("forgot.subtitle", "We'll email you a link to set a new one.")}
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-[color:var(--color-brand)] hover:underline">
            {t("header.signIn", "Sign in")}
          </Link>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
