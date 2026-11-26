import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from "react-native";
import { useTheme } from "@/theme";
import { AppText } from "./AppText";

type Variant = "primary" | "secondary" | "ghost" | "danger";

export interface ButtonProps extends Omit<PressableProps, "children"> {
  title: string;
  variant?: Variant;
  loading?: boolean;
}

export function Button({ title, variant = "primary", loading, disabled, style, ...rest }: ButtonProps) {
  const { colors, radius, spacing } = useTheme();
  const isDisabled = disabled || loading;

  const bg = {
    primary: colors.brand,
    secondary: colors.surfaceMuted,
    ghost: "transparent",
    danger: colors.danger,
  }[variant];
  const fg = {
    primary: colors.onBrand,
    secondary: colors.text,
    ghost: colors.brand,
    danger: colors.onDanger,
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      style={(state) => [
        styles.base,
        {
          backgroundColor: bg,
          borderRadius: radius.md,
          paddingHorizontal: spacing.lg,
          borderColor: variant === "secondary" ? colors.border : "transparent",
          opacity: isDisabled ? 0.6 : state.pressed ? 0.85 : 1,
        },
        typeof style === "function" ? style(state) : style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <AppText variant="label" style={{ color: fg }}>
          {title}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
  },
});
