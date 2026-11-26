/**
 * Signed-in area. Tabs live in (tabs); every other signed-in screen
 * (post detail, settings, chat room…) is pushed on top of them from here.
 */
import { Stack } from "expo-router";
import { useTheme } from "@/theme";

export const unstable_settings = { initialRouteName: "(tabs)" };

export default function AppLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.ground },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ title: "Settings" }} />
    </Stack>
  );
}
