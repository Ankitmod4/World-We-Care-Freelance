import { Alert, View } from "react-native";
import { useSession } from "@/features/auth";
import { useTheme, useThemeStore, type AppearanceMode } from "@/theme";
import { AppText, Button, Screen } from "@/ui";

const MODES: { value: AppearanceMode; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "system", label: "System" },
];

/**
 * Settings. Only appearance and sign-out are built so far; the full list
 * (email, password, digest, deactivate, delete) is in docs/features/account.md.
 * Appearance is local for now; syncing it uses PATCH /api/user/settings/appearance.
 */
export default function SettingsScreen() {
  const { spacing } = useTheme();
  const signOut = useSession((s) => s.signOut);
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  const confirmSignOut = () =>
    Alert.alert("Sign out?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void signOut() },
    ]);

  return (
    <Screen scroll edges={["bottom"]}>
      <AppText variant="label">Appearance</AppText>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        {MODES.map((m) => (
          <Button
            key={m.value}
            title={m.label}
            variant={mode === m.value ? "primary" : "secondary"}
            onPress={() => setMode(m.value)}
            style={{ flex: 1 }}
          />
        ))}
      </View>

      <View style={{ flex: 1 }} />
      <Button title="Sign out" variant="danger" onPress={confirmSignOut} />
    </Screen>
  );
}
