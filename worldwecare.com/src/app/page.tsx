import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/user-auth";
import { LandingPage } from "@/components/site/landing";
import { FeedPage } from "@/components/site/feed-page";

// Landing IS the site — no "%s - siteName" prefix.
export async function generateMetadata(): Promise<Metadata> {
  const { getSiteName } = await import("@/lib/site-metadata");
  const siteName = await getSiteName();
  return { title: { absolute: siteName } };
}

/**
 * / — the front door.
 *
 * Signed-in: shows the community feed (composer + posts).
 * Signed-out: shows the marketing landing page.
 *
 * Kept as one route so returning users don't hit an interstitial —
 * they land, and the site is either "the app" or "the pitch"
 * depending on whether they've signed in.
 */
export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) return <LandingPage />;
  return <FeedPage viewer={user} />;
}
