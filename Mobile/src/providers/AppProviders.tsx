import { useEffect, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { bindAppFocus, queryClient } from "@/lib/api";
import { useColorSchemeResolved } from "@/theme";

/** Every app-wide provider, in one place. The root layout wraps everything in this. */
export function AppProviders({ children }: { children: ReactNode }) {
  const scheme = useColorSchemeResolved();

  useEffect(() => bindAppFocus(), []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
        {children}
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
