import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getT } from "@/lib/i18n";
import { LanguagePicker } from "./language-picker";

/**
 * Shared frontend header — one component for both the marketing
 * landing and the signed-in feed. Kept as a server component
 * because there's no interactive state; the logout form posts to
 * the API and the browser handles the redirect.
 */
export async function SiteHeader({
  user,
}: {
  user: { displayName: string } | null;
}) {
  const t = await getT();
  return (
    <header className="chrome sticky top-0 z-30 frost-strong">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Logo />
          <span className="font-semibold tracking-[-0.01em]">WorldWeCare</span>
        </Link>
        <nav className="flex items-center gap-2">
          {/*
            THE SIGNED-OUT HEADER NEEDS IT TOO, and did not have it.
            This header is the landing page, the sign-in page and
            every article a stranger reads before they have an
            account — which is exactly the audience deciding whether
            this site is for them, and the one most likely to need
            another language. It hides itself while English is the
            only live language, so it costs nothing until then.
          */}
          <LanguagePicker />
          {user ? (
            <>
              <span className="hidden sm:inline text-sm text-[color:var(--color-text-muted)] mr-2">
                {t("header.greeting", "Hi, {name}", { name: user.displayName })}
              </span>
              <form action="/api/user/auth/logout" method="post">
                <Button variant="secondary" size="sm">
                  {t("header.signOut", "Sign out")}
                </Button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  {t("header.signIn", "Sign in")}
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="sm">{t("header.createAccount", "Create account")}</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function Logo() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="16" cy="16" r="14" fill="var(--color-brand)" />
      <path
        d="M10 20c1.2-2.8 3.4-4.5 6-4.5s4.8 1.7 6 4.5M13 12.5a3 3 0 116 0"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
