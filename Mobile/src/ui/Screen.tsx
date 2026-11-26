import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { useTheme } from "@/theme";

export interface ScreenProps {
  children: ReactNode;
  /** Wrap content in a ScrollView (forms, static pages). Lists should pass false. */
  scroll?: boolean;
  /** Safe-area edges to pad. Screens under a header usually skip "top". */
  edges?: Edge[];
  contentStyle?: ViewStyle;
}

export function Screen({ children, scroll = false, edges = ["top", "bottom"], contentStyle }: ScreenProps) {
  const { colors, spacing } = useTheme();
  const padding: ViewStyle = { padding: spacing.lg, gap: spacing.lg };

  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: colors.ground }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[{ flexGrow: 1 }, padding, contentStyle]}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
