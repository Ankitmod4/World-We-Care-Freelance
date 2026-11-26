import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/user-auth";
import { listActiveCountries } from "@/lib/geography";
import { AuthShell } from "@/components/site/auth-shell";
import { UserAuthForm } from "../login/user-auth-form";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.signup.title", "Create account"),
  };
}

export default async function UserSignupPage() {
  const t = await getT();
  const existing = await getCurrentUser();
  if (existing) redirect("/");

  // Rendered here, not fetched by the browser. The picker is then in
  // the HTML before any JavaScript runs, so there is no request left
  // to fail — which is what was emptying it intermittently.
  const countries = await listActiveCountries();

  return (
    <AuthShell
      title={t("signup.title", "Join WorldWeCare")}
      subtitle={t("signup.subtitle", "You don't have to say anything until you're ready.")}
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-[color:var(--color-brand)] hover:underline">
            {t("header.signIn", "Sign in")}
          </Link>
        </>
      }
    >
      <UserAuthForm mode="signup" countries={countries} />
    </AuthShell>
  );
}
