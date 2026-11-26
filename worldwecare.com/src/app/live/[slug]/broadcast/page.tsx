import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { appOriginFrom } from "@/lib/app-url";
import { getCurrentUser } from "@/lib/user-auth";
import { getBySlug } from "@/lib/live-streams";
import { SiteShell } from "@/components/site/site-shell";
import { BroadcastClient } from "@/components/site/broadcast-client";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.live.slug.broadcast.title", "Broadcast"),
  };
}
export const dynamic = "force-dynamic";

/**
 * The broadcaster's own controls.
 *
 * Ownership is settled on the server before the page renders — the
 * publish token is minted separately, by the start endpoint, and
 * never reaches this component.
 */
export default async function BroadcastPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const viewer = await getCurrentUser();
  if (!viewer) redirect(`/login?next=/live/${slug}/broadcast`);

  const stream = await getBySlug(slug, viewer.id);
  if (!stream) notFound();
  // Somebody else's stream is a 404, not a 403: whether a given slug
  // exists is not something to confirm to a stranger.
  if (!stream.isMine) notFound();
  if (stream.status === "ENDED") redirect(`/live/${slug}`);

  // Not hand-rolled from Host any more. This is a page navigation, so
  // the browser sends no Origin header, and behind `proxy_pass
  // http://localhost:3000` the Host header says localhost — which is
  // where the WHIP endpoint was being pointed. See @/lib/app-url.
  const origin = appOriginFrom(await headers());

  return (
    <SiteShell viewer={viewer} hideRightRail>
      <BroadcastClient
        slug={stream.slug}
        title={stream.title}
        visibility={stream.visibility}
        shareUrl={`${origin}/live/${stream.slug}`}
      />
    </SiteShell>
  );
}
