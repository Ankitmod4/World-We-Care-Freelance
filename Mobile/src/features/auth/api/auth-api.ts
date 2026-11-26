/**
 * Auth endpoints. Contract: worldwecare.com/docs/features/account.md (Auth section).
 */
import { api, request } from "@/lib/api";
import type { Account } from "@/types/api-types";

export interface Country {
  id: string;
  name: string;
  code: string;
  slug: string;
  emojiFlag: string | null;
}

export const authApi = {
  /** GET /api/user/auth/captcha: a small maths question plus a signed token. */
  captcha: () => api.get<Account.AccountCaptchaChallenge>("/api/user/auth/captcha"),

  /** POST /api/user/auth/signup: creates the account and sends the confirmation email. */
  signup: (body: Account.AccountSignupRequest) =>
    api.post<Account.AccountSignupResponse>("/api/user/auth/signup", body),

  /** POST /api/user/auth/login: sets the session cookies; returns only { ok: true }. */
  login: (body: Account.AccountLoginRequest) =>
    api.post<Account.AccountLoginResponse>("/api/user/auth/login", body),

  /** POST /api/user/auth/logout: clears cookies with a 303 redirect, so there is no JSON body. */
  logout: () => request<void>("/api/user/auth/logout", { method: "POST", parse: "none" }),

  /** POST /api/user/auth/refresh-verified: mints the "verified" cookie once the email is confirmed. */
  refreshVerified: () =>
    api.post<Account.AccountRefreshVerifiedResponse>("/api/user/auth/refresh-verified"),

  /** POST /api/user/auth/resend-verification: 429 while the cooldown is active. */
  resendVerification: () =>
    api.post<Account.AccountResendVerificationResponse>("/api/user/auth/resend-verification"),

  /** POST /api/user/auth/forgot-password: always answers 200 (no account enumeration). */
  forgotPassword: (body: Account.AccountForgotPasswordRequest) =>
    api.post<Account.AccountForgotPasswordResponse>("/api/user/auth/forgot-password", body),

  /** GET /api/user/profile: the signed-in member; 401 signed out, 403 needsVerification unverified. */
  me: () => api.get<Account.AccountMyProfileResponse>("/api/user/profile"),

  /** GET /api/public/geo/countries: active countries for the signup picker. */
  countries: () => api.get<{ items: Country[] }>("/api/public/geo/countries"),
};
