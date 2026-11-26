import Link from "next/link";
import { getSiteName } from "@/lib/site-metadata";
import { getT } from "@/lib/i18n";

/**
 * Site footer — the last row on the pages a signed-out visitor sees.
 *
 * Deliberately small. The signed-in app has its own bottom navigation,
 * so this is not rendered there; a second bar under the first would
 * just eat thumb space on a phone.
 *
 * The links are the three a stranger looks for before they trust a
 * site with anything: what the rules are, what happens to what they
 * write, and whether a human is reachable.
 */

const LINKS = [
  { href: "/terms", key: "footer.terms" },
  { href: "/privacy", key: "footer.privacy" },
  { href: "/contact", key: "footer.contact" },
];

export async function SiteFooter() {
  const [siteName, t] = await Promise.all([getSiteName(), getT()]);
  // Literal calls, so the extractor can see them — see header-nav.tsx.
  const text: Record<string, string> = {
    "footer.terms": t("footer.terms", "Terms"),
    "footer.privacy": t("footer.privacy", "Privacy policy"),
    "footer.contact": t("footer.contact", "Contact"),
  };
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)]">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-8 text-[13.5px] text-[color:var(--color-text-muted)] sm:flex-row sm:justify-between sm:gap-6">
        <p>
          © {year} {siteName}
        </p>

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="font-medium underline-offset-4 transition-colors hover:text-[color:var(--color-brand)] hover:underline"
            >
              {text[l.key]}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
