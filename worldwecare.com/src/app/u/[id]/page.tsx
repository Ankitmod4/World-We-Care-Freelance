import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user-auth";
import { getPublicProfile } from "@/lib/profile";
import { isFollowing } from "@/lib/follows";
import { getBlockedIds } from "@/lib/blocks";
import { listPublicStreaks } from "@/lib/streaks";
import { listPublicBadges } from "@/lib/badges";
import { PublicProfileClient } from "@/components/site/public-profile-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const p = await getPublicProfile(id);
  return { title: p ? p.displayName : "Profile" };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await getCurrentUser();
  if (!viewer) redirect(`/login?next=/u/${id}`);
  if (id === viewer.id) redirect("/profile");
  // Both of these return [] unless the member turned progress on AND
  // ticked the individual streak — the gate lives in the lib, not here,
  // so a second caller cannot forget half of it.
  const [profile, following, blockedIds, streaks, badges] = await Promise.all([
    getPublicProfile(id),
    isFollowing(viewer.id, id),
    getBlockedIds(viewer.id),
    listPublicStreaks(id),
    listPublicBadges(id),
  ]);
  if (!profile) notFound();
  return (
    <PublicProfileClient
      viewer={viewer}
      profile={profile}
      initialFollowing={following}
      initialBlocked={blockedIds.includes(id)}
      streaks={streaks}
      badges={badges}
    />
  );
}
