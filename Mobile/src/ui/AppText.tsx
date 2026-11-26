import { Text, type TextProps } from "react-native";
import { useTheme, type TypographyVariant } from "@/theme";

type Tone = "default" | "muted" | "subtle" | "brand" | "danger" | "onBrand";

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  tone?: Tone;
  align?: "left" | "center" | "right";
}

export function AppText({ variant = "body", tone = "default", align, style, ...rest }: AppTextProps) {
  const { colors, typography } = useTheme();
  const color = {
    default: colors.text,
    muted: colors.textMuted,
    subtle: colors.textSubtle,
    brand: colors.brand,
    danger: colors.danger,
    onBrand: colors.onBrand,
  }[tone];

  return <Text {...rest} style={[typography[variant], { color, textAlign: align }, style]} />;
}
