"use client";

/**
 * /town-heroes — the list, and the nominate button.
 *
 * Scoped by the header's country picker like campaigns and events,
 * with the same rule: a hero with no country belongs to everyone, so
 * a nomination made before anyone set a country never disappears.
 *
 * A member's OWN pending nomination is shown to them with a status
 * pill, which is why this list can contain rows nobody else can see.
 * That is deliberate — the alternative is a member sending a
 * nomination and getting no evidence it went anywhere.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SiteShell, type ShellViewer } from "./site-shell";
import { useCountry } from "./country-context";
import { PageHeading } from "./page-heading";
import { Img } from "@/components/ui/img";
import type { TownHeroView } from "@/lib/town-heroes";
import type { PublicHeroCategory } from "@/lib/town-hero-categories";
import { CategoryBrowse } from "./category-browse";
import { useT } from "./locale-context";
import { TranslatedContent } from "./translated-content";

export function TownHeroesClient({
  viewer,
  categories,
}: {
  viewer: ShellViewer;
  categories: PublicHeroCategory[];
}) {
  const t = useT();
  const { countryId, country } = useCountry();
  const [heroes, setHeroes] = useState<TownHeroView[] | null>(null);
  // Only the viewer's own, still unreviewed. Approved ones are public
  // and belong behind their category tile like everybody else's.
  const mine = (heroes ?? []).filter((h) => h.isOwn && h.status !== "APPROVED");

  // Loaded once, unfiltered, ONLY to find the viewer's own pending
  // nominations for the strip at the bottom. The public list is
  // CategoryBrowse's job now, a page at a time per tab.
  const load = useCallback(async () => {
    const params = new URLSearchParams({ take: "60" });
    if (countryId) params.set("countryId", countryId);
    const res = await fetch(`/api/user/town-heroes?${params}`, { cache: "no-store" }).catch(
      () => null,
    );
    const d = (await res?.json().catch(() => ({ heroes: [] }))) as { heroes?: TownHeroView[] };
    setHeroes(d?.heroes ?? []);
  }, [countryId]);

  useEffect(() => {
    void load();
  }, [load]);

  const fetchPage = useCallback(
    async (slug: string | null, page: number) => {
      const params = new URLSearchParams({ page: String(page), take: "12" });
      if (countryId) params.set("countryId", countryId);
      if (slug) params.set("category", slug);
      const res = await fetch(`/api/user/town-heroes?${params}`, { cache: "no-store" }).catch(
        () => null,
      );
      const d = (await res?.json().catch(() => ({}))) as { heroes?: TownHeroView[] };
      // THE VIEWER'S OWN UNREVIEWED ONES ARE NOT PART OF THE LIST.
      // The endpoint returns approved heroes PLUS the caller's own, so
      // that somebody can always reach what they wrote. That is right
      // for the endpoint and wrong for this grid: those already have
      // their own "Yours, waiting" strip below, and before the strip
      // replaced the tiles there was no grid here to double them up
      // in. Filtering here rather than at the endpoint keeps the
      // member's own work reachable for the strip that needs it.
      return { items: (d.heroes ?? []).filter((h) => !(h.isOwn && h.status !== "APPROVED")) };
    },
    [countryId],
  );

  return (
    <SiteShell viewer={viewer}>
      <PageHeading
        title={t("page.townHeroesTitle", "Town Heroes")}
        intro={t("page.townHeroesIntro", "The people{country} who quietly make things better. Nominate someone you know.")}
        country={country?.name}
        note={t("heroes.modNote", "Every nomination is read by a moderator before it appears.")}
        actions={
          <Link
            href="/town-heroes/new"
            className="inline-flex h-10 shrink-0 items-center rounded-full bg-[color:var(--color-brand)] px-4 text-[13.5px] font-semibold text-[color:var(--color-on-brand)] transition-colors hover:bg-[color:var(--color-brand-hover)]"
          >
            {t("heroes.nominate", "Nominate someone")}
          </Link>
        }
      />

      {/*
        The people are back on this page. It was tiles only for a
        while, on the argument that a directory's job is to point at
        its sections — but a strip points at them in one row, so the
        rest of the screen can hold the faces it is a directory of.

        The "Yours, waiting" block below is kept from the older list
        version, and for the reason it was kept then: everything else
        here is public and can live behind a click, but somebody who
        has just sent a nomination needs to see it went somewhere, and
        a notification whenever a moderator gets round to it is not
        that.
      */}
      {categories.length === 0 ? (
        <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-10 text-center shadow-card">
          <p className="text-[15px] font-medium">{t("heroes.noCategories", "Nothing set up yet")}</p>
          <p className="mx-auto mt-1 max-w-[46ch] text-[13.5px] text-[color:var(--color-text-muted)]">
            {t("heroes.noCategoriesBlurb", "An admin needs to add a category before anyone can be nominated.")}
          </p>
        </div>
      ) : (
        <CategoryBrowse
          kind="townHeroCategory"
          categories={categories.map((c) => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            emoji: c.emoji,
            count: c.publicCount,
          }))}
          label={t("heroes.categories", "Hero categories")}
          layout="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          fetchPage={fetchPage}
          renderItem={(h) => <HeroTile key={h.id} hero={h} />}
          empty={(slug) => (
            <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-10 text-center shadow-card">
              <p className="text-[15px] font-medium">
                {slug ? t("heroes.noneInSection", "Nobody here yet") : t("heroes.none", "No heroes yet")}
              </p>
              <p className="mx-auto mt-1 max-w-[46ch] text-[13.5px] text-[color:var(--color-text-muted)]">
                {t("heroes.emptyBlurb", "Somebody near you is quietly holding things together. Say who.")}
              </p>
              <Link
                href="/town-heroes/new"
                className="mt-4 inline-flex h-10 items-center rounded-full border border-[color:var(--color-border)] px-4 text-[13.5px] font-medium transition-colors hover:border-[color:var(--color-brand)] hover:text-[color:var(--color-brand)]"
              >
                {t("heroes.nominate", "Nominate someone")}
              </Link>
            </div>
          )}
        />
      )}

      {mine.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-[color:var(--color-text-subtle)]">
            {t("heroes.yoursWaiting", "Yours, waiting")}
          </h2>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mine.map((h) => (
              <li key={h.id}>
                <HeroTile hero={h} />
              </li>
            ))}
          </ul>
        </section>
      )}

    </SiteShell>
  );
}

/**
 * One hero.
 *
 * A PENDING or REJECTED row is the viewer's own, and is deliberately
 * NOT a link: there is nothing to read yet, and a dead-ending click is
 * worse than an obviously inert card. It carries the status instead.
 */
export function HeroTile({ hero }: { hero: TownHeroView }) {
  const t = useT();
  const inner = (
    <>
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-[color:var(--color-surface-muted)]">
        {hero.photoUrl ? (
          <Img
            src={hero.photoUrl}
            alt={hero.photoAlt}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[color:var(--color-brand-soft)] to-[color:var(--color-surface-muted)] text-[30px] font-semibold text-[color:var(--color-text-subtle)]">
            {initialsOf(hero.heroName)}
          </span>
        )}
        {hero.isFeatured && hero.status === "APPROVED" && (
          <span className="absolute left-3 top-3 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
            {t("heroes.featured", "Featured")}
          </span>
        )}
        {hero.status !== "APPROVED" && (
          <span
            className={`absolute left-3 top-3 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
              hero.status === "PENDING"
                ? "bg-[color:var(--color-warning-soft)] text-[color:var(--color-warning-ink)]"
                : "bg-[color:var(--color-danger)] text-[color:var(--color-on-danger)]"
            }`}
          >
            {hero.status === "PENDING"
              ? t("heroes.waitingReview", "Waiting for review")
              : t("heroes.notPublished", "Not published")}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-[16.5px] font-semibold leading-snug tracking-[-0.01em]">
          <TranslatedContent kind="townHero" id={hero.id} field="heroName" text={hero.heroName} toggle={false} />
        </h3>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-[color:var(--color-text-subtle)]">
          {hero.town && (
            <>
              <span>{hero.town}</span>
              <span aria-hidden>·</span>
            </>
          )}
          <span>
            {hero.category.emoji ? `${hero.category.emoji} ` : ""}
            <TranslatedContent
              kind="townHeroCategory"
              id={hero.category.id}
              field="name"
              text={hero.category.name}
              toggle={false}
            />
          </span>
        </p>
        {hero.summary && (
          <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-relaxed text-[color:var(--color-text-muted)]">
            <TranslatedContent kind="townHero" id={hero.id} field="summary" text={hero.summary} toggle={false} />
          </p>
        )}
        <div className="mt-auto flex items-center gap-3 pt-3 text-[12.5px] text-[color:var(--color-text-subtle)]">
          <span>
            {hero.heartCount === 1
              ? t("heroes.oneThankYou", "1 thank you")
              : t("heroes.nThankYous", "{n} thank yous", { n: hero.heartCount })}
          </span>
          {hero.nominatorName && (
            <span>· {t("heroes.byNominator", "by {name}", { name: hero.nominatorName })}</span>
          )}
        </div>
        {hero.status === "REJECTED" && hero.rejectionReason && (
          <p className="mt-2 text-[12px] text-[color:var(--color-danger)]">
            {hero.rejectionReason}
          </p>
        )}
      </div>
    </>
  );

  const shell =
    "group flex h-full flex-col overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] shadow-card";

  if (hero.status !== "APPROVED") {
    return <div className={`${shell} opacity-80`}>{inner}</div>;
  }
  return (
    <Link href={`/town-heroes/${hero.slug}`} className={`${shell} transition-shadow duration-200 hover:shadow-elevated`}>
      {inner}
    </Link>
  );
}

function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
