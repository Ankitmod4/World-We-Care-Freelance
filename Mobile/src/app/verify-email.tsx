import { View } from "react-native";
import { useResendVerification, useSession, useVerificationPolling } from "@/features/auth";
import { errorMessage } from "@/lib/api";
import { AppText, Button, Screen } from "@/ui";

/**
 * Shown while the member is signed in but has not confirmed their email.
 * The backend blocks most APIs with 403 needsVerification until then.
 */
export default function VerifyEmailScreen() {
  const resend = useResendVerification();
  const afterSignIn = useSession((s) => s.afterSignIn);
  const signOut = useSession((s) => s.signOut);

  useVerificationPolling(true);

  return (
    <Screen contentStyle={{ justifyContent: "center", padding: 24, gap: 16 }}>
      <View style={{ gap: 8 }}>
        <AppText variant="title">Confirm your email</AppText>
        <AppText tone="muted">
          We sent you a link. Open it, then come back here. We'll notice automatically.
        </AppText>
      </View>

      <Button title="I've confirmed it" onPress={() => void afterSignIn()} />
      <Button
        title={resend.isSuccess ? "Sent. Check your inbox" : "Resend email"}
        variant="secondary"
        loading={resend.isPending}
        onPress={() => resend.mutate()}
      />
      {resend.isError ? <AppText tone="danger">{errorMessage(resend.error)}</AppText> : null}
      <Button title="Sign out" variant="ghost" onPress={() => void signOut()} />
    </Screen>
  );
}
