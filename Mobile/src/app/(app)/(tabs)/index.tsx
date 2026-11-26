import { FlatList, RefreshControl, View } from "react-native";
import { PostCard, useFeed } from "@/features/feed";
import { useTheme } from "@/theme";
import { EmptyView, ErrorView, LoadingView } from "@/ui";

export default function FeedScreen() {
  const { colors, spacing } = useTheme();
  const feed = useFeed();

  if (feed.isPending) return <LoadingView />;
  if (feed.isError) return <ErrorView error={feed.error} onRetry={() => feed.refetch()} />;

  return (
    <FlatList
      data={feed.posts}
      keyExtractor={(p) => p.id}
      renderItem={({ item }) => <PostCard post={item} />}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, flexGrow: 1 }}
      ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
      ListEmptyComponent={<EmptyView title="No posts yet" message="Be the first to share something." />}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
      }}
      ListFooterComponent={feed.isFetchingNextPage ? <LoadingView /> : undefined}
      refreshControl={
        <RefreshControl
          refreshing={feed.isRefetching && !feed.isFetchingNextPage}
          onRefresh={() => void feed.refetch()}
          tintColor={colors.brand}
        />
      }
    />
  );
}
