import type { ComponentProps } from "react";
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { useTheme } from "@/theme";
import { AppText } from "./AppText";

export interface TextFieldProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
  /** React 19: ref is a normal prop, no forwardRef needed. */
  ref?: ComponentProps<typeof TextInput>["ref"];
}

export function TextField({ label, error, hint, style, ref, ...rest }: TextFieldProps) {
  const { colors, radius, spacing, typography } = useTheme();

  return (
    <View style={{ gap: spacing.xs }}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={colors.textSubtle}
        style={[
          styles.input,
          typography.body,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : colors.borderStrong,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <AppText variant="caption" tone="danger">
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" tone="muted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 48, borderWidth: 1 },
});
