import { memo } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { mediaUrl } from "@/lib/utils/media";
import { timeAgo } from "@/lib/utils/time-ago";
import { useTheme } from "@/theme";
import { AppText } from "@/ui";
import type { Feed } from "@/types/api-types";

/**
 * One post in the feed. Rich text (**bold**, *italic*, ~~strike~~), video,
 * reactions, save and the overflow menu are listed in docs/features/feed.md
 * and are the next pieces to build here.
 */
export const PostCard = memo(function PostCard({ post }: { post: Feed.FeedPost }) {
  const { colors, radius, spacing } = useTheme();
  const name = post.isAnonymous ? "Anonymous member" : post.authorName;
  const avatar = post.isAnonymous ? undefined : mediaUrl(post.authorAvatar);
  const firstImage = post.images[0];

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radius.lg,
        padding: spacing.lg,
        gap: spacing.md,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <Image
          source={avatar}
          style={{ width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.brandSoft }}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
        <View style={{ flex: 1 }}>
          <AppText variant="label">{name}</AppText>
          <AppText variant="caption" tone="muted">
            {[post.countryName, timeAgo(post.createdAt)].filter(Boolean).join(" · ")}
          </AppText>
        </View>
      </View>

      {post.body ? <AppText>{post.body}</AppText> : null}

      {firstImage ? (
        <Image
          source={mediaUrl(firstImage.url)}
          style={{ width: "100%", aspectRatio: 4 / 3, borderRadius: radius.md, backgroundColor: colors.surfaceMuted }}
          contentFit="cover"
          accessibilityLabel={firstImage.alt ?? undefined}
        />
      ) : null}

      <AppText variant="caption" tone="muted">
        {`${post.likeCount} reactions · ${post.commentCount} comments`}
      </AppText>
    </View>
  );
});
