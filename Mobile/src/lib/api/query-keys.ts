/**
 * All TanStack Query keys in one place, so invalidation is never a typo.
 * Add a block per feature module as it is built.
 */
export const queryKeys = {
  auth: {
    captcha: ["auth", "captcha"] as const,
  },
  profile: {
    me: ["profile", "me"] as const,
    stats: ["profile", "stats"] as const,
    user: (id: string) => ["profile", "user", id] as const,
  },
  feed: {
    all: ["feed"] as const,
    list: (countryId?: string) => ["feed", "list", countryId ?? "all"] as const,
    comments: (postId: string) => ["feed", "comments", postId] as const,
  },
} as const;
