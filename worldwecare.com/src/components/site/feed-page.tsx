import { UnverifiedBanner } from "@/components/user/unverified-banner";
import { SiteShell } from "./site-shell";
import { FeedClient } from "./feed-client";

export interface FeedViewer {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  emailVerifiedAt: string | null;
}

/**
 * Signed-in home. Wraps <FeedClient> inside the shared SiteShell
 * so the header, sidebar, and mobile drawer stay consistent across
 * every future page — /saved, /profile, /posts/[id], etc. all mount
 * the same way.
 */
export function FeedPage({ viewer }: { viewer: FeedViewer }) {
  return (
    <SiteShell viewer={viewer}>
      {!viewer.emailVerifiedAt && (
        <div className="mb-4">
          <UnverifiedBanner email={viewer.email} />
        </div>
      )}
      <FeedClient viewer={viewer} />
    </SiteShell>
  );
}
