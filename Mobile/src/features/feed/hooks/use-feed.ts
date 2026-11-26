import { useInfiniteQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api";
import { feedApi } from "../api/feed-api";

/** Infinite feed. `posts` is the flattened list; call `fetchNextPage` near the end. */
export function useFeed(countryId?: string) {
  const query = useInfiniteQuery({
    queryKey: queryKeys.feed.list(countryId),
    queryFn: ({ pageParam, signal }) => feedApi.list({ cursor: pageParam, countryId }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const posts = query.data?.pages.flatMap((p) => p.items) ?? [];
  return { ...query, posts };
}
