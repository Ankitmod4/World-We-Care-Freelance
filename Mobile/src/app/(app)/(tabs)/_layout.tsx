import { Tabs } from "expo-router";
import { useTheme } from "@/theme";

/**
 * Main tabs. Icons are still to come: @expo/vector-icons currently has a
 * peer-dependency conflict with React 19.3 on SDK 58 (see README → Known issues).
 */
export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIconStyle: { display: "none" },
        tabBarLabelStyle: { fontSize: 14, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Feed" }} />
      <Tabs.Screen name="messages" options={{ title: "Messages" }} />
      <Tabs.Screen name="notifications" options={{ title: "Alerts" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
