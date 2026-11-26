"use client";

import Link from "next/link";
import { SiteShell, type ShellViewer } from "./site-shell";
import { PostFeedList } from "./post-feed-list";
import type { FeedPost } from "./post-card";
import { useT } from "./locale-context";

/**
 * Post permalink / detail page body. Reuses PostFeedList with a
 * single static item and comments open by default, so a shared link
 * lands the reader straight on the conversation.
 */
export function PostDetail({ viewer, post }: { viewer: ShellViewer; post: FeedPost }) {
  const t = useT();
  const cardViewer = {
    id: viewer.id,
    displayName: viewer.displayName,
    avatarUrl: viewer.avatarUrl,
  };
  return (
    <SiteShell viewer={viewer}>
      <div className="mb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t("post.backToFeed", "Back to feed")}
        </Link>
      </div>
      <PostFeedList viewer={cardViewer} initialItems={[post]} singleOpenComments />
    </SiteShell>
  );
}
