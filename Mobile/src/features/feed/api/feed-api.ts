/**
 * Community feed endpoints. Contract: worldwecare.com/docs/features/feed.md
 */
import { api } from "@/lib/api";
import type { Feed } from "@/types/api-types";

export const FEED_PAGE_SIZE = 20; // server clamps to 5–50

export const feedApi = {
  /** GET /api/user/posts/feed: cursor-paginated, newest first. */
  list: (params: Feed.FeedListQuery, signal?: AbortSignal) =>
    api.get<Feed.FeedPage>("/api/user/posts/feed", { limit: FEED_PAGE_SIZE, ...params }, signal),
};
