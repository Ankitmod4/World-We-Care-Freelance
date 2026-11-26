/**
 * Form validation. Limits copied from worldwecare.com/src/lib/signup-rules.ts
 * so the app shows the same messages the server would return.
 */
import { z } from "zod";

export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 200;
export const MIN_NAME = 2;
export const MAX_NAME = 40;

const email = z
  .string()
  .trim()
  .min(1, "We need an email to reach you.")
  .max(200, "That email is too long.")
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "That doesn't look like an email address.");

const password = z
  .string()
  .min(1, "Choose a password.")
  .min(MIN_PASSWORD, `At least ${MIN_PASSWORD} characters.`)
  .max(MAX_PASSWORD, `${MAX_PASSWORD} characters at most.`);

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password."),
});
export type LoginForm = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Pick a name people will see.")
    .min(MIN_NAME, `At least ${MIN_NAME} characters.`)
    .max(MAX_NAME, `${MAX_NAME} characters at most.`),
  email,
  password,
  countryId: z.string().min(1, "Choose your country."),
  captchaAnswer: z.string().trim().min(1, "Answer the question."),
  acceptedTerms: z.boolean().refine((v) => v, "Please accept the terms to continue."),
});
export type SignupForm = z.infer<typeof signupSchema>;

export const forgotPasswordSchema = z.object({ email });
export type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;
