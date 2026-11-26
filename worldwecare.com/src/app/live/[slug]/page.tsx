import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/user-auth";
import { getBySlug, noteView } from "@/lib/live-streams";
import { SiteShell } from "@/components/site/site-shell";
import { SiteHeader } from "@/components/site/site-header";
import { LiveWatch } from "@/components/site/live-clients";
import { getT } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const s = await getBySlug(slug);
  if (!s) return { title: "Live" };
  return {
    title: s.title,
    description: s.summary ?? undefined,
    // An unlisted stream must not turn up in a search result — the
    // whole of its privacy is that nobody finds the address.
    robots: s.visibility === "UNLISTED" ? { index: false, follow: false } : undefined,
  };
}

export default async function WatchPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const t = await getT();
  const { slug } = await params;
  const viewer = await getCurrentUser();
  const stream = await getBySlug(slug, viewer?.id ?? null);
  if (!stream) notFound();

  // Not counted for someone who can't watch — a view is a viewer.
  if (viewer) void noteView(slug);

  // Watching needs an account. An unlisted stream gives nothing away
  // beyond what the visitor already had — they hold the address — but
  // a public one is listed on /live anyway, so its title is not a
  // secret and showing it makes the sign-in worth doing.
  if (!viewer) {
    return (
      <>
        <SiteHeader user={null} />
        <main className="mx-auto w-full">
          <SignInToWatch
            slug={slug}
            title={stream.visibility === "PUBLIC" ? stream.title : null}
            live={stream.status === "LIVE"}
          />
        </main>
      </>
    );
  }

  const body = (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[1100px]">
        <LiveWatch slug={slug} initial={stream} signedIn />
      </div>
    </div>
  );

  return <SiteShell viewer={viewer} hideRightRail>{body}</SiteShell>;
}

async function SignInToWatch({
  slug,
  title,
  live,
}: {
  slug: string;
  title: string | null;
  live: boolean;
}) {
  const t = await getT();
  // Back to this exact page after signing in, so a shared link still
  // lands where it was pointing.
  const next = encodeURIComponent(`/live/${slug}`);
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-[42rem] rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-8 text-center shadow-card sm:p-10">
        {live && (
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-danger-soft)] px-2.5 py-1 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-danger-ink)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-danger)]" />
            {t("liveDetail.liveNow", "Live now")}
          </span>
        )}
        <h1 className="text-[21px] font-semibold tracking-[-0.02em] sm:text-[24px]">
          {title ?? t("liveDetail.membersOnly", "This broadcast is for members")}
        </h1>
        <p className="mx-auto mt-2 max-w-[46ch] text-[14px] leading-relaxed text-[color:var(--color-text-muted)]">
          {title
            ? t(
                "liveDetail.signInKnown",
                "Sign in to watch. Live broadcasts are for members \u2014 reading everything else here still costs nothing.",
              )
            : t(
                  "liveDetail.signInBlurb",
                  "Sign in to watch. Live broadcasts are for members, so a link on its own isn't enough.",
                )}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          <Link
            href={`/login?next=${next}`}
            className="inline-flex h-11 items-center justify-center rounded-full bg-[color:var(--color-brand)] px-6 text-[14px] font-semibold text-[color:var(--color-on-brand)] transition-opacity hover:opacity-90"
          >
            {t("header.signIn", "Sign in")}
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-11 items-center justify-center rounded-full border border-[color:var(--color-border)] px-6 text-[14px] font-semibold transition-colors hover:border-[color:var(--color-brand)]"
          >
            {t("landing.createAccount", "Create an account")}
          </Link>
        </div>
      </div>
    </div>
  );
}
