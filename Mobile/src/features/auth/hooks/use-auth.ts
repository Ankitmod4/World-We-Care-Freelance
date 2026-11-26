import { useEffect } from "react";
import { AppState } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api";
import { authApi } from "../api/auth-api";
import type { LoginForm, SignupForm } from "../schemas/auth-schemas";
import { useSession } from "../store/session-store";

export function useLogin() {
  const afterSignIn = useSession((s) => s.afterSignIn);
  return useMutation({
    mutationFn: async (form: LoginForm) => {
      await authApi.login({ email: form.email.trim().toLowerCase(), password: form.password });
      return afterSignIn();
    },
  });
}

export function useCaptcha() {
  return useQuery({ queryKey: queryKeys.auth.captcha, queryFn: authApi.captcha, staleTime: 0 });
}

export function useCountries() {
  return useQuery({
    queryKey: ["geo", "countries"],
    queryFn: async () => (await authApi.countries()).items,
    staleTime: 60 * 60_000,
  });
}

export function useSignup() {
  const afterSignIn = useSession((s) => s.afterSignIn);
  return useMutation({
    mutationFn: async ({ form, captchaToken }: { form: SignupForm; captchaToken: string }) => {
      const res = await authApi.signup({
        displayName: form.displayName.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        countryId: form.countryId,
        acceptedTerms: true,
        captchaToken,
        captchaAnswer: form.captchaAnswer.trim(),
      });
      await afterSignIn();
      return res;
    },
  });
}

export function useForgotPassword() {
  return useMutation({ mutationFn: (email: string) => authApi.forgotPassword({ email: email.trim().toLowerCase() }) });
}

export function useResendVerification() {
  return useMutation({ mutationFn: authApi.resendVerification });
}

/**
 * While the verify-email gate is open, check every 15 s and whenever the app
 * returns to the foreground (the user confirms in their mail app, then comes back).
 */
export function useVerificationPolling(enabled: boolean) {
  const afterSignIn = useSession((s) => s.afterSignIn);

  useEffect(() => {
    if (!enabled) return;
    const check = () => void afterSignIn();
    const timer = setInterval(check, 15_000);
    const sub = AppState.addEventListener("change", (s) => s === "active" && check());
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [enabled, afterSignIn]);
}
