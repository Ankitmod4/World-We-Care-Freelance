import { Link, Stack } from "expo-router";
import { AppText, Screen } from "@/ui";

export default function NotFound() {
  return (
    <Screen contentStyle={{ alignItems: "center", justifyContent: "center", gap: 16 }}>
      <Stack.Screen options={{ title: "Not found" }} />
      <AppText variant="heading">This screen doesn't exist.</AppText>
      <Link href="/">
        <AppText tone="brand">Go home</AppText>
      </Link>
    </Screen>
  );
}
