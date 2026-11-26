import type { Metadata } from "next";
import { getSiteMetadata } from "@/lib/site-metadata";
import { cookies } from "next/headers";
import { getMessages, listEnabledLocales, resolveLocale } from "@/lib/i18n";
import { LocaleProvider } from "@/components/site/locale-context";
import { LOCALE_COOKIE } from "@/lib/i18n-core";
import "./globals.css";

/**
 * Root metadata is dynamic — reads siteName + description from
 * platform_settings so an admin edit propagates to every page's
 * <title> without a rebuild.
 *
 * Child pages set their own `title: "Page name"` and Next combines
 * them with our template into "Page name - siteName".
 */
export async function generateMetadata(): Promise<Metadata> {
  return getSiteMetadata();
}

/**
 * `lang` and `dir` COME FROM THE COOKIE, ON THE SERVER.
 *
 * Both have to be on the <html> tag of the first byte sent. Setting
 * them after hydration would mean an Arabic reader gets one paint of
 * a left-to-right page before it flips {D} which is the same layout
 * jump the rail script above exists to avoid, only across the whole
 * document instead of one column.
 *
 * `dir` is what makes RTL work at all: with it set, every `start`/`end`
 * margin, the rails, and the category strip's scroll direction mirror
 * themselves without a single conditional in a component.
 */
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jar = await cookies();
  const [locales, locale] = await Promise.all([
    listEnabledLocales(),
    resolveLocale(jar.get(LOCALE_COOKIE)?.value),
  ]);
  // Empty for an English reader, so the common case ships no payload.
  const messages = await getMessages(locale.code);

  return (
    <html
      lang={locale.code}
      dir={locale.direction === "RTL" ? "rtl" : "ltr"}
      suppressHydrationWarning
    >
      <body className="antialiased">
        {/*
          THE RIGHT RAIL'S STATE, BEFORE FIRST PAINT.

          It is an attribute on <html> rather than React state because
          React state is only correct after hydration: the server has
          no idea what this member chose, so it would render the rail
          open and then snap it shut a moment later — a layout jump on
          every single page load, and the wider the content column the
          more obvious it is.

          Running as the first thing in <body> means the attribute is
          set before the shell is parsed, so the very first paint is
          already right. The CSS in globals.css keys off it; the
          toggle in site-shell writes it. Wrapped in try/catch because
          localStorage throws outright in some privacy modes, and a
          collapsed sidebar is not worth a blank page.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('wwc-rail')==='collapsed')" +
              "document.documentElement.dataset.rail='collapsed'}catch(e){}",
          }}
        />
        <LocaleProvider
          value={{
            locale: locale.code,
            direction: locale.direction,
            locales,
            messages,
          }}
        >
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
