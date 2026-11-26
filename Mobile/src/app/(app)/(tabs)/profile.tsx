import { Link } from "expo-router";
import { View } from "react-native";
import { Image } from "expo-image";
import { useJourneyStats, useMe } from "@/features/profile";
import { mediaUrl } from "@/lib/utils/media";
import { useTheme } from "@/theme";
import { AppText, Button, Screen } from "@/ui";

export default function ProfileScreen() {
  const { colors, radius, spacing } = useTheme();
  const me = useMe();
  const stats = useJourneyStats();

  if (!me) return null;

  const tiles = stats.data
    ? [
        ["Posts", stats.data.posts],
        ["Followers", stats.data.followers],
        ["Following", stats.data.following],
        ["Saved", stats.data.saved],
      ]
    : [];

  return (
    <Screen scroll edges={[]}>
      <View style={{ alignItems: "center", gap: spacing.sm }}>
        <Image
          source={mediaUrl(me.avatarUrl)}
          style={{ width: 88, height: 88, borderRadius: radius.pill, backgroundColor: colors.brandSoft }}
          contentFit="cover"
        />
        <AppText variant="heading">{me.displayName}</AppText>
        {me.bio ? (
          <AppText tone="muted" align="center">
            {me.bio}
          </AppText>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
        {tiles.map(([label, value]) => (
          <View key={label} style={{ alignItems: "center" }}>
            <AppText variant="heading">{String(value)}</AppText>
            <AppText variant="caption" tone="muted">
              {label}
            </AppText>
          </View>
        ))}
      </View>

      <Link href="/settings" asChild>
        <Button title="Settings" variant="secondary" />
      </Link>
    </Screen>
  );
}
