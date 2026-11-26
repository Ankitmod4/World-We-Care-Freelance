import { ActivityIndicator, View } from "react-native";
import { errorMessage } from "@/lib/api";
import { useTheme } from "@/theme";
import { AppText } from "./AppText";
import { Button } from "./Button";

function Centered({ children }: { children: React.ReactNode }) {
  const { spacing } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md }}>
      {children}
    </View>
  );
}

export function LoadingView() {
  const { colors } = useTheme();
  return (
    <Centered>
      <ActivityIndicator color={colors.brand} />
    </Centered>
  );
}

export function ErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <Centered>
      <AppText align="center" tone="muted">
        {errorMessage(error)}
      </AppText>
      {onRetry ? <Button title="Try again" variant="secondary" onPress={onRetry} /> : null}
    </Centered>
  );
}

export function EmptyView({ title, message }: { title: string; message?: string }) {
  return (
    <Centered>
      <AppText variant="heading" align="center">
        {title}
      </AppText>
      {message ? (
        <AppText align="center" tone="muted">
          {message}
        </AppText>
      ) : null}
    </Centered>
  );
}

/** A screen whose feature module is documented but not built yet. */
export function ComingSoon({ feature, doc }: { feature: string; doc: string }) {
  return <EmptyView title={feature} message={`Coming soon. Spec: docs/features/${doc}`} />;
}
