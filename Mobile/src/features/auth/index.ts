/** Public surface of the auth feature. Screens import from here, not from deep paths. */
export { authApi, type Country } from "./api/auth-api";
export { useSession, type SessionStatus } from "./store/session-store";
export {
  useLogin,
  useSignup,
  useCaptcha,
  useCountries,
  useForgotPassword,
  useResendVerification,
  useVerificationPolling,
} from "./hooks/use-auth";
export * from "./schemas/auth-schemas";
export { CountryPicker } from "./components/CountryPicker";
