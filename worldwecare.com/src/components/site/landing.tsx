import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { HeroVisual } from "./landing-art";
import { LadderSection, TopicsSection, PrivacySection } from "./landing-sections";
import { getT } from "@/lib/i18n";

/**
 * Marketing landing page — shown to signed-out visitors.
 *
 * The hero says what the place is; the sections under it answer the
 * three questions the person reading actually has, in the order they
 * have them. See landing-sections.tsx.
 */
export async function LandingPage() {
  const t = await getT();
  return (
    <>
      <main className="min-h-screen">
        {/* The gradient belongs to the hero, not to the whole page — it
            used to run behind everything, and with sections under it that
            means content sitting on a wash that fades out mid-paragraph. */}
        <div className="hero-sky">
          <SiteHeader user={null} />

          <section className="mx-auto grid max-w-6xl gap-14 px-6 pt-16 pb-24 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-center lg:gap-16 lg:pt-24 lg:pb-28">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-ink)] px-3 py-1 text-xs font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-brand)]" />
                {t("landing.nowOpen", "Now open")}
              </span>
              {/*
                TWO HALVES, TWO KEYS. The line break is a design
                decision about this headline, not about English: a
                language that needs the words in another order can put
                them there, and the <br /> still falls between the two
                halves rather than in the middle of a word.
              */}
              <h1 className="mt-6 text-5xl sm:text-6xl font-semibold tracking-[-0.03em] leading-[1.05]">
                {t("landing.heroLine1", "People helping")} <br />
                <span className="text-[color:var(--color-brand)]">
                  {t("landing.heroLine2", "people.")}
                </span>
              </h1>
              <p className="mt-6 text-lg text-[color:var(--color-text-muted)] leading-relaxed">
                {t(
                  "landing.heroBlurb",
                  "A calm place where anyone can quietly find support \u2014 for sobriety, mental health, family recovery, or a cause worth fighting for. Read before you speak. Post anonymously. Take the next small step.",
                )}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/signup">
                  <Button size="lg">{t("landing.getStarted", "Get started")}</Button>
                </Link>
                <Link href="/login">
                  <Button variant="secondary" size="lg">
                    {t("landing.haveAccount", "I have an account")}
                  </Button>
                </Link>
              </div>
            </div>

            {/* Ordered second so a phone reads the sentence before the
                picture; `lg:` puts it alongside on a wide screen. */}
            <HeroVisual className="mx-auto w-full max-w-[380px] lg:max-w-none" />
          </section>
        </div>

        <LadderSection />
        <TopicsSection />
        <PrivacySection />
      </main>

      <SiteFooter />
    </>
  );
}
