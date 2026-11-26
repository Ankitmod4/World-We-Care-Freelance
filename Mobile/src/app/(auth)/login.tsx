import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "expo-router";
import { View } from "react-native";
import { loginSchema, useLogin, type LoginForm } from "@/features/auth";
import { errorMessage } from "@/lib/api";
import { AppText, Button, Screen, TextField } from "@/ui";

export default function LoginScreen() {
  const login = useLogin();
  const { control, handleSubmit, formState } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  // On success the session status changes and the root gate moves the user on.
  const onSubmit = () => void handleSubmit((form) => login.mutate(form))();

  return (
    <Screen scroll contentStyle={{ justifyContent: "center" }}>
      <View style={{ gap: 4 }}>
        <AppText variant="title">Welcome back</AppText>
        <AppText tone="muted">Sign in to World We Care.</AppText>
      </View>

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
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
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
            error={formState.errors.password?.message}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            onSubmitEditing={onSubmit}
          />
        )}
      />

      {login.isError ? <AppText tone="danger">{errorMessage(login.error)}</AppText> : null}

      <Button title="Sign in" loading={login.isPending} onPress={onSubmit} />

      <View style={{ gap: 12, alignItems: "center" }}>
        <Link href="/forgot-password">
          <AppText tone="brand">Forgot your password?</AppText>
        </Link>
        <Link href="/signup">
          <AppText tone="brand">Create an account</AppText>
        </Link>
      </View>
    </Screen>
  );
}
