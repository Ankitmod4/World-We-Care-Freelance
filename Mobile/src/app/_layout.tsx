/**
 * Root layout: providers + the auth gate.
 *
 * Stack.Protected shows exactly one branch for the current session status.
 * When the status changes (login, logout, 401, email confirmed), Expo Router
 * moves the user to the branch that is now allowed. No manual redirects needed.
 */
import { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useSession } from "@/features/auth";
import { AppProviders } from "@/providers/AppProviders";
import { useTheme } from "@/theme";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}

function RootNavigator() {
  const { colors } = useTheme();
  const status = useSession((s) => s.status);
  const refresh = useSession((s) => s.refresh);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (status !== "loading") void SplashScreen.hideAsync();
  }, [status]);

  if (status === "loading") return null; // native splash is still visible

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }}>
      <Stack.Protected guard={status === "signedIn"}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={status === "unverified"}>
        <Stack.Screen name="verify-email" />
      </Stack.Protected>
      <Stack.Protected guard={status === "signedOut"}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
