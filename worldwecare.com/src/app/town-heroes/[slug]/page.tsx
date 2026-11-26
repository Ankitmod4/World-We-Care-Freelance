import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user-auth";
import { getTownHero } from "@/lib/town-heroes";
import { Markdown } from "@/lib/rich-text";
import { SiteShell } from "@/components/site/site-shell";
import { Img } from "@/components/ui/img";
import { HeroThanks } from "@/components/site/hero-thanks";
import { getT } from "@/lib/i18n";
import { TranslatedContent } from "@/components/site/translated-content";
import { TranslatedMarkdown } from "@/components/site/translated-markdown";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  // No viewer here, so this only ever describes an APPROVED hero —
  // which is right: an unreviewed nomination must not have shareable
  // metadata, or the review is decorative.
  const hero = await getTownHero(slug, null);
  if (!hero) return { title: "Town Hero" };
  return {
    title: hero.heroName,
    description: hero.summary ?? undefined,
  };
}

export default async function TownHeroPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const t = await getT();
  const viewer = await getCurrentUser();
  const { slug } = await params;
  if (!viewer) redirect(`/login?next=/town-heroes/${slug}`);

  const hero = await getTownHero(slug, viewer.id);
  if (!hero) notFound();

  return (
    <SiteShell viewer={viewer}>
      <Link
        href="/town-heroes"
        className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {t("nav.townHeroes", "Town Heroes")}
      </Link>

      <article className="overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] shadow-card">
        {hero.photoUrl && (
          <Img
            src={hero.photoUrl}
            alt={hero.photoAlt}
            className="h-[220px] w-full object-cover sm:h-[300px]"
          />
        )}

        <div className="p-5 sm:p-7">
          {hero.status !== "APPROVED" && (
            <p className="mb-3 rounded-[12px] border border-[color:var(--color-warning-soft)] bg-[color:var(--color-warning-soft)] px-3.5 py-2.5 text-[13px] text-[color:var(--color-warning-ink)]">
              {hero.status === "PENDING"
                ? t("heroDetail.pending", "Only you can see this. A moderator is reading it.")
                : hero.rejectionReason
                  ? t("heroDetail.rejectedWhy", "This wasn't published. {reason}", {
                      reason: hero.rejectionReason,
                    })
                  : t("heroDetail.rejected", "This wasn't published.")}
            </p>
          )}

          <h1 className="text-[26px] font-semibold tracking-[-0.02em]">
            <TranslatedContent kind="townHero" id={hero.id} field="heroName" text={hero.heroName} toggle={false} />
          </h1>
          {hero.town && (
            <p className="mt-1 text-[14px] text-[color:var(--color-text-muted)]">{hero.town}</p>
          )}
          {hero.summary && (
            <p className="mt-3 text-[15.5px] leading-relaxed text-[color:var(--color-text-muted)]">
              <TranslatedContent kind="townHero" id={hero.id} field="summary" text={hero.summary} toggle={false} />
            </p>
          )}

          <div className="mt-5 border-t border-[color:var(--color-border-soft)] pt-5">
            <TranslatedMarkdown kind="townHero" id={hero.id} text={hero.body ?? ""} />
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--color-border-soft)] pt-4">
            <p className="text-[12.5px] text-[color:var(--color-text-subtle)]">
              {hero.nominatorName
                ? t("heroDetail.nominatedBy", "Nominated by {name}", { name: hero.nominatorName })
                : t("heroDetail.nominatedByMember", "Nominated by a member")}
            </p>
            {hero.status === "APPROVED" && (
              <HeroThanks
                heroId={hero.id}
                initialCount={hero.heartCount}
                initialHearted={hero.hearted}
              />
            )}
          </div>
        </div>
      </article>
    </SiteShell>
  );
}
