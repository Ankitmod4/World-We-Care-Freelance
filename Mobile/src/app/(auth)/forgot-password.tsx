import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { forgotPasswordSchema, useForgotPassword, type ForgotPasswordForm } from "@/features/auth";
import { errorMessage } from "@/lib/api";
import { AppText, Button, Screen, TextField } from "@/ui";

/**
 * The reset link in the email opens the web page /reset-password?token=…
 * (see docs/features/account.md → Reset password). Handling it in-app needs
 * universal links / app links, which is a later step.
 */
export default function ForgotPasswordScreen() {
  const forgot = useForgotPassword();
  const { control, handleSubmit, formState } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  if (forgot.isSuccess) {
    return (
      <Screen edges={["bottom"]} contentStyle={{ padding: 16, gap: 12 }}>
        <AppText variant="heading">Check your email</AppText>
        <AppText tone="muted">{forgot.data.message}</AppText>
      </Screen>
    );
  }

  return (
    <Screen scroll edges={["bottom"]}>
      <AppText tone="muted">Enter your email and we'll send you a link to choose a new password.</AppText>
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <TextField
            label="Email"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={formState.errors.email?.message}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
        )}
      />
      {forgot.isError ? <AppText tone="danger">{errorMessage(forgot.error)}</AppText> : null}
      <Button
        title="Send reset link"
        loading={forgot.isPending}
        onPress={() => void handleSubmit((f) => forgot.mutate(f.email))()}
      />
    </Screen>
  );
}
