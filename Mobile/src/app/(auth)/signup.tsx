import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Switch, View } from "react-native";
import { CountryPicker, signupSchema, useCaptcha, useSignup, type SignupForm } from "@/features/auth";
import { errorMessage, isApiError } from "@/lib/api";
import { useTheme } from "@/theme";
import { AppText, Button, Screen, TextField } from "@/ui";

export default function SignupScreen() {
  const { colors } = useTheme();
  const captcha = useCaptcha();
  const signup = useSignup();
  const { control, handleSubmit, formState, resetField } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
    defaultValues: { displayName: "", email: "", password: "", countryId: "", captchaAnswer: "", acceptedTerms: false },
  });

  const submit = handleSubmit((form) => {
    if (!captcha.data) return;
    signup.mutate(
      { form, captchaToken: captcha.data.token },
      {
        onError: (e) => {
          // A wrong or expired captcha answer comes back with newChallenge: true.
          if (isApiError(e) && e.body?.newChallenge) {
            resetField("captchaAnswer");
            void captcha.refetch();
          }
        },
      },
    );
  });

  const onSubmit = () => void submit();
  const err = formState.errors;

  return (
    <Screen scroll edges={["bottom"]}>
      <AppText tone="muted">Join a community that shows up for each other.</AppText>

      <Controller
        control={control}
        name="displayName"
        render={({ field }) => (
          <TextField
            label="Display name"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={err.displayName?.message}
            hint="This is what other members see."
            autoComplete="name"
          />
        )}
      />
      <Controller
        control={control}
        name="email"
        render={({ field }) => (
          <TextField
            label="Email"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={err.email?.message}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
          />
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field }) => (
          <TextField
            label="Password"
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={err.password?.message}
            hint="At least 8 characters."
            secureTextEntry
            autoComplete="new-password"
            textContentType="newPassword"
          />
        )}
      />
      <Controller
        control={control}
        name="countryId"
        render={({ field }) => (
          <CountryPicker value={field.value} onChange={field.onChange} error={err.countryId?.message} />
        )}
      />
      <Controller
        control={control}
        name="captchaAnswer"
        render={({ field }) => (
          <TextField
            label={captcha.data ? captcha.data.question : "Loading question…"}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={err.captchaAnswer?.message}
            keyboardType="number-pad"
          />
        )}
      />
      <Controller
        control={control}
        name="acceptedTerms"
        render={({ field }) => (
          <View style={{ gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Switch
                value={field.value}
                onValueChange={field.onChange}
                trackColor={{ true: colors.brand, false: colors.borderStrong }}
                accessibilityLabel="I accept the terms and privacy policy"
              />
              <AppText style={{ flex: 1 }}>I accept the terms and privacy policy.</AppText>
            </View>
            {err.acceptedTerms ? (
              <AppText variant="caption" tone="danger">
                {err.acceptedTerms.message}
              </AppText>
            ) : null}
          </View>
        )}
      />

      {signup.isError ? <AppText tone="danger">{errorMessage(signup.error)}</AppText> : null}

      <Button title="Create account" loading={signup.isPending} disabled={!captcha.data} onPress={onSubmit} />
    </Screen>
  );
}
