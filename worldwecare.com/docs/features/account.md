# Auth, Account, Profile & Social

This module covers everything about a member's identity and personal space: signup with an arithmetic captcha, email verification, login, logout, password reset, email change, account settings (preferences, appearance, digest), deactivate and delete, own and public profiles, follows, blocks, the members directory, notifications, the sidebar summary, site-wide search, saved items, streaks, badges, the private journal and the daily reflection.

**Auth model (applies to every endpoint here).** Sessions are HMAC-signed cookies only (`src/lib/session.ts`, `src/lib/user-auth.ts`). There are no bearer or refresh tokens.
- `wwc-user-session`: payload `userId:issuedAtMs`, 30-day max age, HttpOnly, SameSite=Lax, Secure in production.
- `wwc-user-verified`: the "email confirmed" claim that `src/middleware.ts` reads. It is set by login (only if the email is verified) and by `/api/user/auth/refresh-verified`.
- **Member** below means `requireUser`. It returns `401 {error:"Unauthorized"}` when there is no session, the email is unverified, the account is banned or deactivated, or the cookie was issued before `sessionsValidFrom` (set when the password changes, a reset completes or the account is deactivated).
- When a session cookie exists but the verified claim is missing, the middleware answers `403 {error:"Confirm your email address first.", needsVerification:true}` on every `/api/*` route except `/api/user/auth/*`, `/api/public/*`, `/api/admin/*` and `/api/webhooks/*`.
- **Mobile:** keep a persistent cookie jar and send both cookies. After the user confirms their email (the link opens a web page), call `POST /api/user/auth/refresh-verified` to get the verified cookie.

## Table of contents
1. [Auth → Captcha challenge](#auth--captcha-challenge)
2. [Auth → Sign up](#auth--sign-up)
3. [Auth → Email verification gate](#auth--email-verification-gate)
4. [Auth → Confirm email link (/verify)](#auth--confirm-email-link-verify)
5. [Auth → Log in](#auth--log-in)
6. [Auth → Log out](#auth--log-out)
7. [Auth → Forgot password](#auth--forgot-password)
8. [Auth → Reset password](#auth--reset-password)
9. [Settings → Overview](#settings--overview)
10. [Settings → Change email](#settings--change-email)
11. [Settings → Confirm email change link](#settings--confirm-email-change-link)
12. [Settings → Change password](#settings--change-password)
13. [Settings → Preferences](#settings--preferences)
14. [Settings → Appearance](#settings--appearance)
15. [Settings → Daily digest](#settings--daily-digest)
16. [Settings → Deactivate account](#settings--deactivate-account)
17. [Settings → Delete account](#settings--delete-account)
18. [Profile → My profile](#profile--my-profile)
19. [Profile → My posts](#profile--my-posts)
20. [Profile → Journey stats](#profile--journey-stats)
21. [Profile → Public profile](#profile--public-profile)
22. [Profile → Public streaks, badges, follow/block state](#profile--public-streaks-badges-followblock-state)
23. [Social → Followers & following lists](#social--followers--following-lists)
24. [Social → Follow / unfollow](#social--follow--unfollow)
25. [Social → Who to follow](#social--who-to-follow)
26. [Social → Members directory](#social--members-directory)
27. [Social → Block / unblock](#social--block--unblock)
28. [Notifications → Inbox](#notifications--inbox)
29. [Navigation → Sidebar summary](#navigation--sidebar-summary)
30. [Search → Site-wide search](#search--site-wide-search)
31. [Saved → Saved posts, articles & clips](#saved--saved-posts-articles--clips)
32. [Progress → Overview & badges](#progress--overview--badges)
33. [Progress → Streaks](#progress--streaks)
34. [Journal → Private journal](#journal--private-journal)
35. [Journal → Share entry as post](#journal--share-entry-as-post)
36. [Journal → Daily reflection](#journal--daily-reflection)
37. [Emails & notifications sent by this module](#emails--notifications-sent-by-this-module)
38. [Gaps & open questions](#gaps--open-questions)

## Endpoints in this module
| Method | Path | Feature | Auth |
|---|---|---|---|
| GET | /api/user/auth/captcha | Captcha challenge | Public |
| POST | /api/user/auth/signup | Sign up | Public |
| POST | /api/user/auth/login | Log in | Public |
| POST | /api/user/auth/logout | Log out | Public (clears cookies) |
| POST | /api/user/auth/resend-verification | Email verification gate | Session (verified or not) |
| GET | /api/user/auth/refresh-verified | Email verification gate | Session (verified or not) |
| POST | /api/user/auth/refresh-verified | Email verification gate | Session (verified or not) |
| POST | /api/user/auth/pending-email | Email verification gate | Session, unverified only |
| POST | /api/user/auth/forgot-password | Forgot password | Public |
| POST | /api/user/auth/reset-password | Reset password | Public (token) |
| GET | /api/user/settings | Settings overview | Member |
| POST | /api/user/settings/email | Change email | Member |
| DELETE | /api/user/settings/email | Change email (cancel) | Member |
| POST | /api/user/settings/password | Change password | Member |
| PATCH | /api/user/settings/preferences | Preferences | Member |
| PATCH | /api/user/settings/appearance | Appearance | Member |
| PATCH | /api/user/settings/digest | Daily digest | Member |
| POST | /api/user/settings/deactivate | Deactivate account | Member |
| POST | /api/user/settings/delete | Delete account | Member |
| GET | /api/user/profile | My profile | Member |
| PATCH | /api/user/profile | My profile | Member |
| GET | /api/user/profile/posts | My posts | Member |
| GET | /api/user/profile/stats | Journey stats | Member |
| GET | /api/user/u/[id] | Public profile | Member |
| GET | /api/user/u/[id]/posts | Public profile | Member |
| GET | /api/user/u/[id]/followers | Followers & following | Member |
| GET | /api/user/u/[id]/following | Followers & following | Member |
| POST | /api/user/follow | Follow / unfollow | Member |
| GET | /api/user/follow/suggestions | Who to follow | Member |
| GET | /api/user/members | Members directory | Member |
| POST | /api/user/block | Block / unblock | Member |
| GET | /api/user/blocks | Block / unblock | Member |
| GET | /api/user/notifications | Notifications | Member |
| POST | /api/user/notifications/read | Notifications | Member |
| GET | /api/user/sidebar | Sidebar summary | Member |
| GET | /api/user/search | Search | Member |
| GET | /api/user/saved | Saved | Member |
| GET | /api/user/saved/articles | Saved | Member |
| GET | /api/user/saved/clips | Saved | Member |
| GET | /api/user/progress | Progress & badges | Member |
| GET | /api/user/streaks | Streaks | Member |
| POST | /api/user/streaks | Streaks | Member |
| PATCH | /api/user/streaks/[id] | Streaks | Member (owner) |
| DELETE | /api/user/streaks/[id] | Streaks | Member (owner) |
| GET | /api/user/journal | Journal | Member |
| POST | /api/user/journal | Journal | Member |
| PATCH | /api/user/journal/[id] | Journal | Member (owner) |
| DELETE | /api/user/journal/[id] | Journal | Member (owner) |
| POST | /api/user/journal/[id]/share | Share entry | Member (owner) |
| GET | /api/user/daily-reflection | Daily reflection | Optional |
| POST | /api/user/daily-reflection | Daily reflection | Member |

Total: 51 endpoints (42 route files).

---

## Auth → Captcha challenge
- **Description:** Hands out a stateless arithmetic challenge that the signup form needs. The question is a sum written with real Unicode operators: `+`, `−` (U+2212) and `×` (U+00D7). The answer is never sent to the client. The token is an HMAC-signed payload holding the answer hash, issue time, expiry and a nonce.
- **Who can use it:** Anyone (no session).
- **Source files:** `src/app/api/user/auth/captcha/route.ts`, `src/lib/captcha.ts`, `src/lib/rate-limit.ts`
- **User flow:**
  1. The Signup screen opens and calls `GET /api/user/auth/captcha`.
  2. It shows `question` (for example "7 × 5") with a numeric answer box and keeps `token` in hidden state.
  3. On submit, it sends `captchaToken` and `captchaAnswer` with the signup body.
  4. If signup returns `newChallenge: true`, the app fetches a new challenge and clears the answer box.
  5. If this endpoint returns 429, the app shows the error and offers a retry later.
- **Suggested mobile screen(s):** Part of **Signup**: a "Quick check: what is 7 × 5?" label, a numeric keyboard input and a refresh icon.
- **API(s):**
  - `GET /api/user/auth/captcha`
  - Auth required: no
  - Request: no params.
  - Response (success) 200. The response is never cached (`Cache-Control: no-store`).
    ```ts
    interface CaptchaChallenge { question: string; token: string }
    ```
    ```json
    { "question": "12 − 5", "token": "eyJoIjoi...In0.Q2xK..." }
    ```
  - Errors: 429 — "Too many attempts. Please wait a few minutes." — more than 40 requests per IP in 10 minutes. The response includes a `Retry-After` header.
- **Form fields:** see Sign up (`captchaAnswer`).
- **Business rules:**
  - Operations: `a + b` with a and b from 2 to 9; `a − b` with a from 6 to 15 and b from 1 to a−1 (never negative); `a × b` with a and b from 2 to 6.
  - The token is valid for 10 minutes.
  - The server rejects answers sent less than 2 seconds after the challenge was issued ("That was quick — please try once more.").
  - The answer must match `^-?\d{1,4}$`.
  - The nonce is spent only after the account is actually created, so one solved sum cannot create two accounts. Spent nonces are kept in process memory.
  - The signing key comes from env `CAPTCHA_SECRET`, falling back to `USER_SESSION_SECRET`, and then to a random per-process key in development.
- **Edge cases / notes for the mobile app:**
  - Do not auto-submit faster than 2 seconds after fetching the challenge.
  - Treat the token as opaque.
  - After an app restart, fetch a new challenge.
  - The question can contain `−` and `×`, so render it with a font that has those glyphs.
- **Status:** ✅ Complete

## Auth → Sign up
- **Description:** Creates a community account, signs the user in immediately (session cookie only, without the verified claim) and emails a confirmation link. It is protected by an IP rate limit, a honeypot field and the arithmetic captcha, all checked before bcrypt runs.
- **Who can use it:** Anyone. The web page redirects already signed-in users to `/`.
- **Source files:** `src/app/api/user/auth/signup/route.ts`, `src/lib/signup-rules.ts`, `src/lib/captcha.ts`, `src/lib/verification.ts`, `src/lib/admin-notifications.ts`, `src/lib/user-activity.ts`, `src/app/signup/page.tsx`, `src/app/login/user-auth-form.tsx`, country list from `GET /api/public/geo/countries` (another module)
- **User flow:**
  1. Load the country list (`GET /api/public/geo/countries` returns `{items}`) and a captcha.
  2. The user fills in display name, email, password, confirm password, country and the terms checkbox, then answers the sum. The client validates with the same rules (`validateSignup`) and shows a password strength meter (`passwordStrength`: Too short / Weak / Fair / Good / Strong, plus advice).
  3. `POST /api/user/auth/signup`.
  4. On success (200): the session cookie is set, the response includes `emailSent`, and the app routes to **VerifyEmailGate**. Every other member API returns 403 `needsVerification` until the email is confirmed.
  5. Failure paths: 400 validation message (show it on the form); 400 with `newChallenge:true` (reload the captcha); 409 email already registered (offer "Sign in instead"); 429 (wait); 500 (retry).
- **Suggested mobile screen(s):** **Signup**: display name, email, password with strength bar, confirm password, country picker (searchable), terms checkbox with links, captcha row, "Create account" button and a "Sign in" link.
- **API(s):**
  - `POST /api/user/auth/signup`
  - Auth required: no
  - Request body (JSON):
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | email | string | yes | trimmed, lowercased; `^[^\s@]+@[^\s@]+\.[^\s@]+$`; ≤200 chars; must not already exist | – | "maya@example.com" |
    | password | string | yes | 8–200 chars (bcrypt only uses the first 72 bytes) | – | "long calm river 42" |
    | displayName | string | yes | trimmed, 2–40 chars | – | "Maya" |
    | countryId | string | yes | id of an **active** Country | – | "ckc0untry123" |
    | acceptedTerms | boolean | yes | must be exactly `true` | – | true |
    | captchaToken | string | yes | from the captcha endpoint | – | "eyJ…" |
    | captchaAnswer | string \| number | yes | `^-?\d{1,4}$` | – | "35" |
    | website | string | no | honeypot: must be empty or omitted | "" | "" |
  - Response (success) 200:
    ```ts
    interface SignupResponse { ok: true; emailSent: boolean; emailError?: string }
    ```
    ```json
    { "ok": true, "emailSent": true }
    ```
    The response also sets the `wwc-user-session` cookie.
  - Errors:
    - 429 — "Too many attempts from this connection. Please try later." — more than 25 attempts per IP per hour (includes `Retry-After`).
    - 400 — "Invalid JSON".
    - 400 — the field rule messages, checked in order email → password → name → country → terms: "We need an email to reach you." / "That doesn't look like an email address." / "That email is too long." / "Choose a password." / "At least 8 characters." / "200 characters at most." / "Pick a name people will see." / "At least 2 characters." / "40 characters at most." / "Pick where you are." / "You'll need to accept the terms to join."
    - 400 — "Something in the form didn't look right. Reload the page and try again." — the honeypot was filled.
    - 400 — `{ error, newChallenge }` — captcha failures: "Answer the sum below." (newChallenge true), "Type the answer as a number." (false), "That check expired. Here's a new one." (true), "That check was already used. Here's a new one." (true), "That was quick — please try once more." (false), "That's not the right answer. Here's another." (true).
    - 400 — "Pick a country from the list." — the country is unknown or inactive.
    - 409 — "That email is already registered. Try signing in instead."
    - 429 — "Too many accounts from this connection. Please try later." — more than 5 accounts created per IP per hour.
    - 500 — "Couldn't create your account. Please try again."
- **Form fields:**
  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | Display name | text | yes | 2–40 chars | – |
  | Email | email | yes | email regex, ≤200 | – |
  | Password | password | yes | 8–200 | – |
  | Confirm password | password | yes (client only) | must equal password ("These don't match.") | – |
  | Country | select | yes | active country id | from `/api/public/geo/countries` |
  | I accept the terms | checkbox | yes | must be true | – |
  | Captcha answer | number | yes | `^-?\d{1,4}$` | – |
- **Business rules:**
  - The account is created with `termsAcceptedAt = now`, and `emailVerifiedAt` stays null.
  - Side effects: a `UserActivity SIGNED_UP` entry; an admin bell notification `USER_SIGNED_UP` ("<name> joined", message = the email, link `/admin/users/<id>`); the `email_confirm` email with link `{APP_URL}/verify?token=<64 hex>`, valid 24 hours.
  - Email send failure does not block signup; the response has `emailSent:false` and an `emailError`.
  - The email-taken answer is deliberately explicit, unlike login.
  - Rate limits are in process memory.
- **Edge cases / notes for the mobile app:**
  - Confirm password is checked on the client only; the API does not take `confirm`.
  - The session cookie is set, but the user is not usable until verified. Go straight to the verification gate.
  - Keep the honeypot field out of the UI and do not send it, or send it empty.
- **Status:** ✅ Complete

## Auth → Email verification gate
- **Description:** A signed-in user whose email is unconfirmed is held at the gate. From there they can resend the confirmation email, fix a mistyped address (password required), or re-check their status. Re-checking mints the `wwc-user-verified` cookie that the middleware requires. On the web this is `/verify-email` with `VerifyGate`, which polls every 15 seconds.
- **Who can use it:** A signed-in member, verified or not. These endpoints use `getSessionUser` (the gate is skipped). `pending-email` is for unverified users only.
- **Source files:** `src/app/api/user/auth/resend-verification/route.ts`, `src/app/api/user/auth/refresh-verified/route.ts`, `src/app/api/user/auth/pending-email/route.ts`, `src/lib/user-auth.ts`, `src/lib/verification.ts`, `src/lib/account.ts` (`requestEmailChange`), `src/app/verify-email/page.tsx`, `src/components/site/verify-gate.tsx`, `src/middleware.ts`
- **User flow:**
  1. After signup or login, any member API returns 403 `{needsVerification:true}`, or the session's `emailVerifiedAt` is null. Show **VerifyEmailGate** with the address.
  2. Poll `POST /api/user/auth/refresh-verified` every 15 seconds and when the app returns to the foreground. When it returns `{verified:true}`, the verified cookie is set and the app continues into the tabs.
  3. "Resend email": `POST /api/user/auth/resend-verification`. 200 shows "Sent"; 429 shows the wait message with seconds; `alreadyVerified:true` means call refresh-verified.
  4. "Wrong address?": the user enters the new email and current password and calls `POST /api/user/auth/pending-email`. The confirmation link goes to the new address. Opening it (the `/verify-email-change` web page) sets the new email **and** marks it verified.
  5. "Sign out": `POST /api/user/auth/logout`.
- **Suggested mobile screen(s):** **VerifyEmailGate**: envelope illustration, "We sent a link to maya@example.com", "Resend" button with a cooldown, "Change address" sheet (email and password), "I've confirmed" button (refresh) and "Sign out".
- **API(s):**
  - `POST /api/user/auth/resend-verification`
    - Auth required: yes (session cookie, verified or not)
    - Request: no body.
    - Response 200: `{ ok: true }` or `{ ok: true, alreadyVerified: true }`
    - Errors: 401 "Sign in first"; 404 "Account missing"; 429 "Please wait {n}s before requesting another email." (30 seconds per user, measured from the last EMAIL_CONFIRM token); 500 send error message (for example "Template not found" or "Send failed").
  - `POST /api/user/auth/refresh-verified`
    - Auth required: a session cookie is optional; without one the answer is `false`.
    - Response 200: `{ verified: boolean }`. When true, a `wwc-user-verified` cookie is set.
    - Errors: none.
  - `GET /api/user/auth/refresh-verified?next=/path`
    - Auth required: same as POST.
    - Query: `next` (string, optional; same-site path only, `//` and `/\` are rejected, defaults to `/`).
    - Response: `303` with a **relative** `Location`. It points to `next` when verified, otherwise to `/verify-email`. This exists for web links; mobile should use POST.
  - `POST /api/user/auth/pending-email`
    - Auth required: yes (session), and the email must be **unverified**.
    - Body:
      | Field | Type | Required | Validation / Rules | Default | Example |
      |---|---|---|---|---|---|
      | email | string | yes | email rules; not the current email; not used by another account | – | "maya@gmail.com" |
      | currentPassword | string | yes | must match | – | "••••••••" |
    - Response 200: `{ ok: true, pendingEmail: "maya@gmail.com" }`
    - Errors: 401 "Sign in first"; 400 "Your email is already confirmed. Change it in Settings."; 429 "Too many attempts. Please try later." (10 per IP per hour); 400 email rule messages / "Account not found" / "That's not your current password." / "That's already your email address." / "That address can't be used. Try another."
- **Form fields (change address):**
  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | New email | email | yes | email regex ≤200 | – |
  | Current password | password | yes | – | – |
- **Business rules:**
  - Each new token invalidates the previous unused token of the same purpose.
  - EMAIL_CONFIRM tokens last 24 hours; EMAIL_CHANGE tokens last 1 hour.
  - A pending email is stored in `User.pendingEmail`; the old email still signs in until the change is confirmed.
  - Confirming the new address sets `emailVerifiedAt`.
- **Edge cases / notes for the mobile app:**
  - The middleware decides from cookies alone: if the verified cookie is missing, all gated APIs return 403 even for a verified account. Always call `POST refresh-verified` after login, on app start, and whenever a `needsVerification` 403 is seen.
  - Confirmation itself happens on a web page (see next feature).
- **Status:** ✅ Complete

## Auth → Confirm email link (/verify)
- **Description:** The link in the `email_confirm` email opens `/verify?token=…`. This is a **server-rendered page** that consumes the token, sets `emailVerifiedAt` (idempotent), logs `EMAIL_VERIFIED` and shows "Email confirmed". Its "Go home" button goes through `/api/user/auth/refresh-verified?next=/` to mint the cookie. **No API endpoint does this.**
- **Who can use it:** Whoever holds the link (no session needed; it does not sign anyone in).
- **Source files:** `src/app/verify/page.tsx`, `src/lib/verification.ts` (`consumeToken`)
- **User flow:**
  1. The user taps the link in the email, and the web page opens.
  2. Success shows "Email confirmed". Failure shows "Invalid or expired link." / "This link has already been used." / "This link has expired. Please request a new one."
  3. In the app, the gate's polling of `POST refresh-verified` then succeeds.
- **Suggested mobile screen(s):** Either open the link in the system browser and keep the app's gate polling, or (after a backend change) handle it as a universal link with a **ConfirmEmailResult** screen.
- **API(s):** none. ⚠️ The token can only be consumed by the web page.
- **Form fields:** none.
- **Business rules:**
  - The token is 64 hex characters, single-use and purpose-scoped.
  - Consuming a token also stops any other outstanding token of that purpose from being reused.
- **Edge cases / notes for the mobile app:**
  - Email security scanners that pre-fetch links would consume the token (the page consumes it on GET).
  - Suggested backend change: `POST /api/user/auth/verify-email {token}`.
- **Status:** ⚠️ Web-only (no API)

## Auth → Log in
- **Description:** Email and password login. It sets `wwc-user-session`, and also `wwc-user-verified` if the email is confirmed. It gives specific messages for banned and deactivated accounts and a generic message for a wrong email or password (timing-safe for unknown emails).
- **Who can use it:** Anyone with an account.
- **Source files:** `src/app/api/user/auth/login/route.ts`, `src/lib/password.ts` (bcrypt), `src/lib/user-auth.ts`, `src/lib/user-activity.ts`, `src/app/login/page.tsx`, `src/app/login/user-auth-form.tsx`
- **User flow:**
  1. The user enters email and password and the app calls `POST /api/user/auth/login`.
  2. On 200, call `POST /api/user/auth/refresh-verified`. If `verified` is true, go to the main tabs; otherwise go to **VerifyEmailGate**. (On the web the user is redirected to `?next` or `/`, and the middleware bounces unverified users to the gate.)
  3. 401 shows "Invalid email or password". 403 shows the banned or deactivated message, with no retry.
  4. A "Forgot your password?" link leads to ForgotPassword.
- **Suggested mobile screen(s):** **Login**: email, password (show/hide), "Sign in", "Forgot your password?", "Create an account".
- **API(s):**
  - `POST /api/user/auth/login`
  - Auth required: no
  - Body:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | email | string | yes | trimmed and lowercased | – | "maya@example.com" |
    | password | string | yes | non-empty | – | "long calm river 42" |
  - Response 200: `{ "ok": true }`. It sets cookies but returns no user object.
  - Errors: 400 "Invalid JSON"; 400 "Email and password are required"; 401 "Invalid email or password" (unknown email or wrong password); 403 "This account has been banned. Contact support if you believe this is a mistake."; 403 "This account has been deactivated."
- **Form fields:** | Email | email | yes | non-empty | – | ; | Password | password | yes | non-empty | – |
- **Business rules:**
  - The ban check runs before the password check.
  - Logs `SIGN_IN_FAILED` (banned / deactivated / wrong password) or `SIGNED_IN`.
  - Updates `lastLoginAt`.
  - Login has **no rate limit** (⚠️ note for the backend).
- **Edge cases / notes for the mobile app:**
  - The response has no user data. Fetch `GET /api/user/profile` after verification. Before verification that call returns 403 `needsVerification`; use this to decide which stack to show.
  - Cookies last 30 days.
- **Status:** ✅ Complete

## Auth → Log out
- **Description:** Clears both member cookies (`maxAge 0`). It answers with a `303` redirect to `/`, built from the Referer header.
- **Who can use it:** Anyone (no auth check).
- **Source files:** `src/app/api/user/auth/logout/route.ts`, `src/lib/user-auth.ts` (`clearUserCookie`)
- **User flow:**
  1. The user taps Sign out and the app calls `POST /api/user/auth/logout`.
  2. The app ignores the redirect, clears its local cookie jar and cached user data, and shows the Auth stack.
- **Suggested mobile screen(s):** "Sign out" row in Settings or the menu, with a confirm dialog.
- **API(s):**
  - `POST /api/user/auth/logout`
  - Auth required: no
  - Request: no body.
  - Response: `303 See Other`, `Location: /`, with Set-Cookie headers that clear `wwc-user-session` and `wwc-user-verified`. There is no JSON body.
  - Errors: none.
- **Form fields:** none.
- **Business rules:**
  - No server-side revocation: the token stays cryptographically valid until it expires or `sessionsValidFrom` moves.
- **Edge cases / notes for the mobile app:**
  - Disable automatic redirect-following, or treat any 2xx/3xx as success.
  - Always wipe the cookie jar locally as well.
- **Status:** ✅ Complete

## Auth → Forgot password
- **Description:** Requests a password-reset email. To avoid revealing who has an account, it always gives the same answer, whether or not the address is registered, banned, deactivated or throttled.
- **Who can use it:** Anyone.
- **Source files:** `src/app/api/user/auth/forgot-password/route.ts`, `src/lib/verification.ts` (`sendPasswordResetEmail`), `src/lib/signup-rules.ts`, `src/app/forgot-password/page.tsx`, `src/components/site/forgot-password-form.tsx`
- **User flow:**
  1. The user enters their email and the app calls `POST /api/user/auth/forgot-password`.
  2. On 200, show the returned `message` ("If that email is registered, a reset link is on its way. It expires in 10 minutes.").
  3. On 400, show the malformed-email message.
- **Suggested mobile screen(s):** **ForgotPassword**: email input, "Send link" button, then a confirmation state with "Back to sign in".
- **API(s):**
  - `POST /api/user/auth/forgot-password`
  - Auth required: no
  - Body: | email | string | yes | email regex, ≤200 (trimmed, lowercased) | – | "maya@example.com" |
  - Response 200:
    ```ts
    interface ForgotPasswordResponse { ok: true; message: string }
    ```
    ```json
    { "ok": true, "message": "If that email is registered, a reset link is on its way. It expires in 10 minutes." }
    ```
  - Errors: 400 email rule messages ("We need an email to reach you." / "That doesn't look like an email address." / "That email is too long.").
- **Form fields:** | Email | email | yes | email regex | – |
- **Business rules:**
  - An email is sent only to an active, non-banned account, and at most once per minute per account (silently dropped otherwise).
  - The send is not awaited.
  - Template `password_reset` with link `{APP_URL}/reset-password?token=<64 hex>`, valid **10 minutes**. A new token invalidates earlier ones.
- **Edge cases / notes for the mobile app:**
  - Never tell the user whether the account exists.
  - The link opens a web URL. To finish in the app, register `/reset-password` as a universal/app link and read `token` from the query string.
- **Status:** ✅ Complete

## Auth → Reset password
- **Description:** Consumes a reset token and sets a new password. It signs out every device (`sessionsValidFrom = now`) and does **not** sign the user in afterwards. It also sends a "password changed" security email.
- **Who can use it:** Whoever holds a valid reset token.
- **Source files:** `src/app/api/user/auth/reset-password/route.ts`, `src/lib/verification.ts`, `src/lib/signup-rules.ts`, `src/app/reset-password/page.tsx`, `src/components/site/reset-password-form.tsx`
- **User flow:**
  1. The app opens from the email link with `token`. If the token does not match `^[a-f0-9]{64}$`, show "That link doesn't look right" with "Send me a new link".
  2. The user enters a new password and confirms it, and the app calls `POST /api/user/auth/reset-password`.
  3. On 200, show a success message and go to Login (the user must sign in again).
  4. On 400 with a token error, offer "Request a new link". On 403, the account cannot be reset.
- **Suggested mobile screen(s):** **ResetPassword**: new password with strength meter, confirm password, "Save password".
- **API(s):**
  - `POST /api/user/auth/reset-password`
  - Auth required: no (the token is the credential)
  - Body:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | token | string | yes | 64 hex chars, purpose PASSWORD_RESET, unused, not expired | – | "9f3c…(64)" |
    | password | string | yes | 8–200 | – | "new long passphrase" |
    | confirm | string | yes | must equal password | – | "new long passphrase" |
  - Response 200: `{ "ok": true }`
  - Errors: 400 "Choose a password." / "At least 8 characters." / "200 characters at most." / "Type it once more." / "These don't match."; 400 "Invalid or expired link." / "This link has already been used." / "This link has expired. Please request a new one."; 403 "This account can't be reset. Get in touch with us." (deactivated or banned); 500 "Couldn't change your password. Please try again."
- **Form fields:** | New password | password | yes | 8–200 | – | ; | Confirm | password | yes | equals password | – |
- **Business rules:**
  - The password is validated **before** the token is consumed, so a validation error does not burn the token.
  - All other unused reset tokens are invalidated.
  - Logs `PASSWORD_CHANGED`.
  - Sends the `password_reset_confirmed` email (fire-and-forget).
- **Edge cases / notes for the mobile app:**
  - The token lives only 10 minutes.
  - Any session the app holds is revoked; clear the cookie jar.
- **Status:** ✅ Complete

## Settings → Overview
- **Description:** One call that loads the settings screen: account email, pending email, display name, country, anonymous-by-default, verification date, member-since date and the blocked list.
- **Who can use it:** Verified member.
- **Source files:** `src/app/api/user/settings/route.ts`, `src/lib/blocks.ts`, `src/app/settings/page.tsx`, `src/components/site/settings-client.tsx`
- **User flow:**
  1. Open Settings and call `GET /api/user/settings`.
  2. Render the sections: Account (email, pending email with Cancel), Password, Preferences (country, anonymous default), Appearance, Blocked members, Danger zone.
  3. On 401, go to Login. On 403 `needsVerification`, go to the gate.
- **Suggested mobile screen(s):** **Settings**: grouped list with an Account row (email + "pending: …" chip), Change password, Country, "Post anonymously by default" toggle, Appearance, Daily digest, Blocked members (count), Sign out, Deactivate, Delete.
- **API(s):**
  - `GET /api/user/settings`
  - Auth required: yes (Member)
  - Response 200:
    ```ts
    interface SettingsResponse {
      settings: { email: string; pendingEmail: string | null; displayName: string; countryId: string | null;
                  anonymousByDefault: boolean; emailVerifiedAt: string | null; createdAt: string };
      blocked: Array<{ userId: string; displayName: string; avatarUrl: string | null; createdAt: string }>;
    }
    ```
    ```json
    { "settings": { "email": "maya@example.com", "pendingEmail": null, "displayName": "Maya", "countryId": "ckc0untry123",
      "anonymousByDefault": false, "emailVerifiedAt": "2026-10-02T09:12:00.000Z", "createdAt": "2026-10-02T09:00:00.000Z" },
      "blocked": [ { "userId": "cku2", "displayName": "Sam", "avatarUrl": null, "createdAt": "2026-11-01T10:00:00.000Z" } ] }
    ```
  - Errors: 401 "Unauthorized"; 404 "Account not found".
- **Form fields:** none (read-only).
- **Business rules:**
  - `passwordHash` is never selected.
  - A blocked user whose account was deleted shows as "Unknown member".
- **Edge cases / notes for the mobile app:**
  - ⚠️ Appearance (`colorThemeId`, `appearanceMode`, `brandTone`) and digest (`digestEnabled`, `digestHour`, `timezone`) are **not** returned here or by any other API. The web gets appearance from the server-side session. The mobile app cannot read the current values (see Gaps).
- **Status:** ✅ Complete

## Settings → Change email
- **Description:** Requests a new email address. The current password is required. The new address is saved as `pendingEmail`, and a confirmation link is sent **to the new address**, valid 1 hour. The account keeps signing in with the old email until the change is confirmed. The request can be cancelled.
- **Who can use it:** Verified member. Unverified users use `POST /api/user/auth/pending-email` instead.
- **Source files:** `src/app/api/user/settings/email/route.ts`, `src/lib/account.ts` (`requestEmailChange`, `cancelEmailChange`, `confirmEmailChange`), `src/lib/verification.ts` (`sendEmailChangeEmail`), `src/components/site/settings-client.tsx`
- **User flow:**
  1. Settings → Email → "Change". The user enters the new email and current password and the app calls `POST /api/user/settings/email`.
  2. On 200, show "Check <pendingEmail> for a confirmation link" and a "pending" chip in Settings.
  3. "Cancel change" calls `DELETE /api/user/settings/email`.
  4. The user opens the link on the new address. The web page `/verify-email-change` swaps the email (see next feature).
  5. On 400, show the message.
- **Suggested mobile screen(s):** **ChangeEmail** sheet: new email, current password, "Send confirmation"; a pending banner with "Cancel".
- **API(s):**
  - `POST /api/user/settings/email`
    - Auth: Member
    - Body:
      | Field | Type | Required | Validation / Rules | Default | Example |
      |---|---|---|---|---|---|
      | email | string | yes | trimmed, lowercased; email regex ≤200; not the current email; not used by any account | – | "maya.new@example.com" |
      | currentPassword | string | yes | must match | – | "••••" |
    - Response 200: `{ "ok": true, "pendingEmail": "maya.new@example.com" }`
    - Errors: 401; 400 "We need an email to reach you." / "That doesn't look like an email address." / "That email is too long." / "Account not found" / "That's not your current password." / "That's already your email address." / "That address can't be used. Try another." (deliberately vague when the address is taken).
  - `DELETE /api/user/settings/email`
    - Auth: Member; no body.
    - Response 200: `{ "ok": true }`. Clears `pendingEmail` and kills unused EMAIL_CHANGE tokens.
    - Errors: 401.
- **Form fields:** | New email | email | yes | email regex ≤200 | – | ; | Current password | password | yes | – | – |
- **Business rules:**
  - Template `email_confirm` (reused) is sent to the new address with link `{APP_URL}/verify-email-change?token=…`. The token lives 1 hour.
  - A second request replaces the earlier token.
  - The email send result is not checked by `requestEmailChange`.
- **Edge cases / notes for the mobile app:**
  - Requesting a change does not sign the user out.
  - Show `pendingEmail` from `GET /api/user/settings`.
- **Status:** ✅ Complete

## Settings → Confirm email change link
- **Description:** `/verify-email-change?token=…` is a server-rendered page that calls `confirmEmailChange`. It swaps `email := pendingEmail`, clears `pendingEmail` and sets `emailVerifiedAt = now`. It re-checks that the address is still free; if not, it clears the pending email and shows "That address is no longer available."
- **Who can use it:** Whoever holds the link.
- **Source files:** `src/app/verify-email-change/page.tsx`, `src/lib/account.ts` (`confirmEmailChange`)
- **User flow:**
  1. The user taps the link and the web page consumes the token on GET.
  2. Success shows "Email updated" with the new address. Failure shows "Invalid or expired link." / "This link has already been used." / "This link has expired. Please request a new one." / "There's no pending email change on this account." / "That address is no longer available."
- **Suggested mobile screen(s):** Open the link in the browser, then refresh Settings when the app resumes.
- **API(s):** none. ⚠️
- **Form fields:** none.
- **Business rules:**
  - The session is not revoked; the user stays signed in.
- **Edge cases / notes for the mobile app:**
  - Suggested backend change: `POST /api/user/settings/email/confirm {token}`.
- **Status:** ⚠️ Web-only (no API)

## Settings → Change password
- **Description:** Changes the password from inside the account. It signs out every **other** device (`sessionsValidFrom`) and re-issues a fresh session cookie to the device making the request. It sends a security email.
- **Who can use it:** Verified member.
- **Source files:** `src/app/api/user/settings/password/route.ts`, `src/lib/account.ts` (`changePassword`), `src/lib/verification.ts` (`sendPasswordChangedEmail`)
- **User flow:**
  1. Settings → Change password. The user enters current, new and confirm passwords and the app calls `POST /api/user/settings/password`.
  2. On 200, store the new `Set-Cookie` and show "Password changed. Other devices were signed out."
  3. On 400, show the message.
- **Suggested mobile screen(s):** **ChangePassword**: three password fields, strength meter, "Save".
- **API(s):**
  - `POST /api/user/settings/password`
  - Auth: Member
  - Body:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | currentPassword | string | yes | must match | – | "old pass" |
    | password | string | yes | 8–200; must differ from the current password | – | "new long passphrase" |
    | confirm | string | yes | equals password | – | "new long passphrase" |
  - Response 200: `{ "ok": true, "otherDevicesSignedOut": true }` plus a new `wwc-user-session` cookie.
  - Errors: 401; 400 "Choose a password." / "At least 8 characters." / "200 characters at most." / "Type it once more." / "These don't match." / "Account not found" / "That's not your current password." / "That's the password you already have."
- **Form fields:** current / new / confirm password (as above).
- **Business rules:**
  - Unused reset tokens are invalidated.
  - Logs `PASSWORD_CHANGED`.
  - Sends the `password_reset_confirmed` email (fire-and-forget).
  - The `wwc-user-verified` cookie is not re-issued; the existing one is still valid because it is checked only by signature and user id.
- **Edge cases / notes for the mobile app:**
  - The cookie jar **must** accept the new session cookie from this response, or the app is logged out on its next request.
- **Status:** ✅ Complete

## Settings → Preferences
- **Description:** Sets the member's country and whether new posts default to anonymous.
- **Who can use it:** Verified member.
- **Source files:** `src/app/api/user/settings/preferences/route.ts`, `src/lib/account.ts` (`setCountry`, `setAnonymousDefault`), `src/components/site/settings-client.tsx`
- **User flow:**
  1. The user changes the country picker or the toggle, and the app calls `PATCH /api/user/settings/preferences` with only the changed key.
  2. On 200, keep the new value. On 400, revert and show the message.
- **Suggested mobile screen(s):** Rows in **Settings**: Country (picker from `/api/public/geo/countries`) and an "Post anonymously by default" switch.
- **API(s):**
  - `PATCH /api/user/settings/preferences`
  - Auth: Member
  - Body:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | countryId | string \| null | no | active country id; `null` or `""` clears it | unchanged | "ckc0untry123" |
    | anonymousByDefault | boolean | no | – | unchanged | true |
  - Response 200: `{ "ok": true }`. Returns 200 even if no keys were sent.
  - Errors: 401; 400 "Pick a country from the list."
- **Form fields:** | Country | select | no | active country | country list | ; | Post anonymously by default | switch | no | boolean | – |
- **Business rules:**
  - `anonymousByDefault` is read by the post composer (feed module).
  - The country can be cleared here even though signup requires one.
- **Edge cases / notes for the mobile app:**
  - When both keys are sent, the country is saved first; if it fails, the anonymous flag is not saved.
- **Status:** ✅ Complete

## Settings → Appearance
- **Description:** Saves the member's colour theme, light/dark/system mode and brand tone. Send any key on its own; omitted keys are untouched. On the web these values travel on the session and theme every page during server rendering. The palettes are defined in `src/lib/theming.ts`.
- **Who can use it:** Verified member.
- **Source files:** `src/app/api/user/settings/appearance/route.ts`, `src/lib/account.ts` (`setAppearance`), `src/lib/theming.ts`, `src/components/site/appearance.tsx`, `src/components/site/settings-client.tsx`, `src/components/site/mobile-menu.tsx`, `src/components/site/site-header-app.tsx`
- **User flow:**
  1. The user picks a theme swatch, a mode (Light / Dark / Auto) or a tone (5 steps).
  2. The app repaints immediately and calls `PATCH /api/user/settings/appearance`.
  3. If the save fails, the web does **not** revert the UI; it tells the user the change wasn't saved.
- **Suggested mobile screen(s):** **Appearance**: grid of 12 theme swatches (name + blurb), a segmented control Light / Dark / System, and 5 tone swatches (Lightest, Light, Default, Deep, Deepest).
- **API(s):**
  - `PATCH /api/user/settings/appearance`
  - Auth: Member
  - Body:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | colorThemeId | string \| null | no | one of `sky, grounded, dusk, meadow, ember, plum, rose, slate, apricot, citron, lagoon, mulberry`; null = app default (`sky`) | unchanged | "meadow" |
    | appearanceMode | string | no | `light` \| `dark` \| `system`; anything else becomes `dark` (the default) | unchanged | "system" |
    | brandTone | number | no | integer 0–4; out-of-range values become 2 | unchanged | 3 |
  - Response 200: `{ "ok": true }`
  - Errors: 401; 400 "That's not one of the themes."
- **Form fields:** theme (enum above), mode (enum above), tone (0–4).
- **Business rules:**
  - A null mode in the database means "never chose" and resolves to `dark`.
  - `system` is stored as itself.
  - Tone shifts the brand colours by OKLCH lightness steps (+0.1, +0.05, 0, −0.05, −0.1).
  - Status colours are never themed.
- **Edge cases / notes for the mobile app:**
  - ⚠️ No endpoint returns the saved appearance, so the app cannot restore it on another device. Store it locally and see Gaps.
  - Colour tokens (hex) for each theme in light and dark are in `THEMES` in `src/lib/theming.ts`; copy them into the app's theme file.
- **Status:** ⚠️ Partial (write-only API; current values are only available on the web session)

## Settings → Daily digest
- **Description:** An opt-in daily email ("today's quote, a streak reminder, one small suggestion") sent at a local hour the member picks. Turning it on should also send the device's IANA timezone.
- **Who can use it:** Verified member.
- **Source files:** `src/app/api/user/settings/digest/route.ts`, `src/lib/digest.ts`, `prisma/send-digests.ts` (runner, via `npm run digest:send`), `prisma/schema.prisma` (`User.digestEnabled` default false, `digestHour` default 8, `timezone` VarChar(64))
- **User flow:**
  1. The user toggles "Daily digest" and picks an hour, and the app calls `PATCH /api/user/settings/digest` with `{digestEnabled, digestHour, timezone}`.
  2. The response echoes the saved values.
- **Suggested mobile screen(s):** A **DailyDigest** row in Settings: switch, hour picker (0–23 shown in local time), and the timezone sent automatically from the device.
- **API(s):**
  - `PATCH /api/user/settings/digest`
  - Auth: Member
  - Body:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | digestEnabled | boolean | no | – | unchanged | true |
    | digestHour | integer | no | clamped to 0–23; non-integers are ignored | unchanged | 7 |
    | timezone | string | no | ≤64 chars, must be a valid IANA zone for `Intl`; invalid values are silently ignored | unchanged | "Europe/Dublin" |
  - Response 200:
    ```json
    { "settings": { "digestEnabled": true, "digestHour": 7, "timezone": "Europe/Dublin" } }
    ```
  - Errors: 401; 400 "Nothing to change." (no valid key was sent).
- **Form fields:** | Daily digest | switch | no | boolean | – | ; | Send at | hour | no | 0–23 | – |
- **Business rules:**
  - There is no scheduler in the app. An operator runs `prisma/send-digests.ts` hourly (cron).
  - The runner sends the `daily_digest` template once per local day (`digestLastSentOn`).
  - A missing timezone is treated as UTC.
- **Edge cases / notes for the mobile app:**
  - ⚠️ No GET returns these fields, and the web UI never calls this endpoint. The route's header mentions "progress visibility", but that setting is not implemented.
- **Status:** ⚠️ Partial (write-only; no web UI; delivery depends on an external cron)

## Settings → Deactivate account
- **Description:** Freezes the account (`isActive=false`) and signs out every device. Nothing is deleted. The user **cannot reactivate it themselves**: login answers "This account has been deactivated." and an admin must re-enable the account.
- **Who can use it:** Verified member.
- **Source files:** `src/app/api/user/settings/deactivate/route.ts`, `src/lib/account.ts` (`deactivateAccount`), `src/components/site/settings-client.tsx`
- **User flow:**
  1. Danger zone → "Deactivate". A confirmation sheet explains the consequences and asks for the current password.
  2. The app calls `POST /api/user/settings/deactivate`.
  3. On 200, the cookies are cleared; wipe local state and show the Auth stack.
  4. On 400 (wrong password), show the error.
- **Suggested mobile screen(s):** **DeactivateAccount** sheet: explanation text, password field, a destructive "Deactivate" button.
- **API(s):**
  - `POST /api/user/settings/deactivate`
  - Auth: Member
  - Body: | currentPassword | string | yes | must match | – | "••••" |
  - Response 200: `{ "ok": true }`. Both cookies are cleared.
  - Errors: 401; 400 "That's not your current password."
- **Form fields:** | Current password | password | yes | – | – |
- **Business rules:**
  - Sets `isActive=false` and `sessionsValidFrom=now`.
  - The public profile, search, member lists and follow lists hide inactive users.
- **Edge cases / notes for the mobile app:**
  - Tell the user that reactivating requires contacting support.
- **Status:** ✅ Complete

## Settings → Delete account
- **Description:** Permanently erases the account. Both the current password and the typed word `DELETE` are required. Personal content is removed; contributions to shared resources are detached rather than deleted. The response reports what was removed.
- **Who can use it:** Verified member.
- **Source files:** `src/app/api/user/settings/delete/route.ts`, `src/lib/account.ts` (`deleteAccount`), `src/lib/delete-confirm.ts` (`DELETE_CONFIRM_WORD = "DELETE"`), `src/lib/recount.ts`, `src/components/site/settings-client.tsx`
- **User flow:**
  1. Danger zone → "Delete account". The sheet lists what will be removed. The user types `DELETE` (always in English, whatever the UI language) and enters the password.
  2. The app calls `POST /api/user/settings/delete`.
  3. On 200, show "Deleted N posts, M comments…" from `removed`, wipe local state and show the Auth stack.
  4. On 400, show the message. On 500, show "Nothing was lost — try again".
- **Suggested mobile screen(s):** **DeleteAccount** sheet: warning list, a "Type DELETE" text field, a password field, and a destructive button that stays disabled until the word matches.
- **API(s):**
  - `POST /api/user/settings/delete`
  - Auth: Member
  - Body:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | confirm | string | yes | after trim must equal `DELETE` exactly | – | "DELETE" |
    | currentPassword | string | yes | must match | – | "••••" |
  - Response 200:
    ```ts
    interface DeleteAccountResponse { ok: true; removed: { posts: number; comments: number; gratitude: number; messages: number; chatMessages: number } }
    ```
    ```json
    { "ok": true, "removed": { "posts": 12, "comments": 30, "gratitude": 4, "messages": 57, "chatMessages": 210 } }
    ```
  - Errors: 401; 400 "Type DELETE to confirm."; 400 "That's not your current password."; 500 "Couldn't finish deleting the account. Nothing was lost — try again."
- **Form fields:** | Type DELETE | text | yes | equals "DELETE" | DELETE | ; | Current password | password | yes | – | – |
- **Business rules:**
  - **Removed:**
    - posts, including their media and video files
    - post, article and clip comments (parent comment counts are recounted)
    - gratitude entries
    - their own direct messages and conversation participation
    - chat messages and memberships
    - uploaded clips and videos
    - follows (both directions) and blocks (both directions)
    - notifications
    - likes, saves, RSVPs, supports, theme follows, hearts and reactions
    - avatar and cover files
    - by database cascade: tokens, activity, reflections, streaks and badges
  - **Detached (kept, link to the user removed):** places they submitted, events they hosted, and reports they filed (place, post and chat).
  - Counters on other people's content are recounted at the end, best-effort.
  - Cookies are cleared.
- **Edge cases / notes for the mobile app:**
  - Deletion can take several seconds; show a blocking spinner.
  - Signed petitions and donations are not in the delete list; only the counters are recomputed.
- **Status:** ✅ Complete

## Profile → My profile
- **Description:** Reads and edits the member's own profile: display name, bio, location, avatar and cover image. Images are uploaded first through `POST /api/user/upload` (uploads module), and the returned `url` is then saved here.
- **Who can use it:** Verified member.
- **Source files:** `src/app/api/user/profile/route.ts`, `src/lib/profile.ts` (`getMyProfile`, `updateMyProfile`), `src/app/profile/page.tsx`, `src/components/site/profile-client.tsx`
- **User flow:**
  1. Open the Profile tab and call `GET /api/user/profile` (plus stats, posts and progress).
  2. "Edit profile" opens the edit form. Picking an avatar or cover calls `POST /api/user/upload` (multipart `file`), which returns `{url}`.
  3. "Save" calls `PATCH /api/user/profile` with all fields.
  4. On 200, refresh. On 400, show the message ("Name can't be empty." and so on).
- **Suggested mobile screen(s):** **MyProfile** (cover, avatar, name, location, bio, stats row, tabs for Posts / Saved, badge and streak strip, "Edit" button). **EditProfile** (cover picker, avatar picker, name, location, bio with counter /600).
- **API(s):**
  - `GET /api/user/profile`
    - Auth: Member
    - Response 200:
      ```ts
      interface MyProfileResponse { profile: { id: string; displayName: string; email: string; avatarUrl: string | null; coverUrl: string | null;
        bio: string | null; location: string | null; emailVerifiedAt: string | null; createdAt: string } | null }
      ```
      ```json
      { "profile": { "id": "cku1", "displayName": "Maya", "email": "maya@example.com", "avatarUrl": "/uploads/posts/2026/11/a1.webp",
        "coverUrl": null, "bio": "One day at a time.", "location": "Cork", "emailVerifiedAt": "2026-10-02T09:12:00.000Z", "createdAt": "2026-10-02T09:00:00.000Z" } }
      ```
    - Errors: 401.
  - `PATCH /api/user/profile`
    - Auth: Member
    - Body (every field optional; `null` or `""` clears the nullable ones):
      | Field | Type | Required | Validation / Rules | Default | Example |
      |---|---|---|---|---|---|
      | displayName | string | no | trimmed, 1–60 chars | unchanged | "Maya R." |
      | bio | string \| null | no | trimmed ≤600 | unchanged | "One day at a time." |
      | location | string \| null | no | trimmed ≤100 | unchanged | "Cork, Ireland" |
      | avatarUrl | string \| null | no | not validated (⚠️) | unchanged | "/uploads/posts/2026/11/a1.webp" |
      | coverUrl | string \| null | no | not validated (⚠️) | unchanged | "/uploads/posts/2026/11/c1.webp" |
    - Response 200: `{ "ok": true }`
    - Errors: 401; 400 "Name can't be empty." / "Name is too long." / "Bio is too long (max 600)." / "Location is too long."
- **Form fields:** | Display name | text | yes | 1–60 | – | ; | Location | text | no | ≤100 | – | ; | Bio | textarea | no | ≤600 | – | ; | Avatar | image | no | via upload | – | ; | Cover | image | no | via upload | – |
- **Business rules:**
  - Old avatar or cover files are not deleted when replaced.
  - No activity log entry is written (the `PROFILE_UPDATED` type exists but is unused).
- **Edge cases / notes for the mobile app:**
  - Signup limits names to 40 characters while edit allows 60. Use 40 in the app for consistency.
  - Image URLs are relative (`/uploads/...`); prefix them with the API host.
- **Status:** ✅ Complete

## Profile → My posts
- **Description:** The member's own published posts, including anonymous ones, in the standard feed card shape.
- **Who can use it:** Verified member.
- **Source files:** `src/app/api/user/profile/posts/route.ts`, `src/lib/posts-feed.ts` (`listFeed`), `src/components/site/profile-client.tsx`
- **User flow:**
  1. Profile → Posts tab calls `GET /api/user/profile/posts`.
  2. Infinite scroll passes `cursor=nextCursor`.
  3. When the list is empty, show an empty state with "Write your first post".
- **Suggested mobile screen(s):** **MyProfile** Posts tab, a list of `PostCard`.
- **API(s):**
  - `GET /api/user/profile/posts?cursor=&limit=`
  - Auth: Member
  - Query: | cursor | string | no | `<ISO createdAt>_<id>` from `nextCursor` | – | "2026-11-20T10:00:00.000Z_ckp9" | ; | limit | int | no | clamped 5–50 | 20 | 20 |
  - Response 200 (`FeedPage`):
    ```ts
    interface FeedPost { id: string; authorId: string | null; authorName: string; authorAvatar: string | null; body: string;
      images: { url: string; alt?: string | null }[]; video: { assetId: string; url: string; posterUrl: string | null; width: number | null; height: number | null; durationSec: number | null } | null;
      isAnonymous: boolean; isFeatured: boolean; likeCount: number; commentCount: number; saveCount: number; liked: boolean;
      myReaction: string | null; saved: boolean; isOwn: boolean; countryName: string | null; countryCode: string | null; createdAt: string }
    interface FeedPage { items: FeedPost[]; nextCursor: string | null }
    ```
    ```json
    { "items": [ { "id": "ckp9", "authorId": "cku1", "authorName": "Maya", "authorAvatar": null, "body": "Day 40.", "images": [], "video": null,
      "isAnonymous": false, "isFeatured": false, "likeCount": 3, "commentCount": 1, "saveCount": 0, "liked": false, "myReaction": null,
      "saved": false, "isOwn": true, "countryName": "Ireland", "countryCode": "IE", "createdAt": "2026-11-20T10:00:00.000Z" } ], "nextCursor": null }
    ```
  - Errors: 401.
- **Form fields:** none.
- **Business rules:**
  - Only `status = PUBLISHED` posts are shown.
  - Sorted by createdAt desc, then id desc.
  - The `myReaction` values are documented in the Feed module.
- **Edge cases / notes for the mobile app:**
  - Uses a cursor, not page numbers.
- **Status:** ✅ Complete

## Profile → Journey stats
- **Description:** Counts for the member's own profile header.
- **Who can use it:** Verified member.
- **Source files:** `src/app/api/user/profile/stats/route.ts`, `src/lib/profile.ts` (`getJourneyStats`), `src/lib/follows.ts` (`getFollowCounts`)
- **User flow:**
  1. The profile loads and calls `GET /api/user/profile/stats`.
  2. Tapping Followers or Following opens the follow lists.
- **Suggested mobile screen(s):** Stats row on **MyProfile**: Posts · Replies · Rooms · Saved · Followers · Following · "Member since Oct 2026".
- **API(s):**
  - `GET /api/user/profile/stats`
  - Auth: Member
  - Response 200:
    ```json
    { "stats": { "posts": 12, "replies": 30, "rooms": 3, "saved": 8, "followers": 21, "following": 17, "memberSince": "2026-10-02T09:00:00.000Z" } }
    ```
    (`stats` is null if the user row is missing.)
  - Errors: 401.
- **Form fields:** none.
- **Business rules:**
  - Posts and replies count only PUBLISHED items.
  - Rooms counts ACTIVE chat memberships.
  - Saved counts saved posts only.
- **Edge cases / notes for the mobile app:** none.
- **Status:** ✅ Complete

## Profile → Public profile
- **Description:** A read-only profile of another member and their non-anonymous posts. Banned or deactivated members return 404.
- **Who can use it:** Verified member. Signed-out visitors cannot see `/u/[id]`; the web redirects them to login.
- **Source files:** `src/app/api/user/u/[id]/route.ts`, `src/app/api/user/u/[id]/posts/route.ts`, `src/lib/profile.ts` (`getPublicProfile`), `src/lib/posts-feed.ts`, `src/app/u/[id]/page.tsx`, `src/components/site/public-profile-client.tsx`
- **User flow:**
  1. The user taps an author name or avatar and the app calls `GET /api/user/u/{id}`. If `isSelf` is true, go to MyProfile instead (the web redirects).
  2. Load posts with `GET /api/user/u/{id}/posts` (cursor paging).
  3. Follow and Block buttons call `POST /api/user/follow` and `POST /api/user/block`.
  4. A 404 shows "This member isn't available".
- **Suggested mobile screen(s):** **PublicProfile**: cover, avatar, name, location, bio, member since; counts (posts, rooms, followers, following, where followers and following open the lists); Follow button; "⋯" menu with Block; Posts list.
- **API(s):**
  - `GET /api/user/u/[id]`
    - Auth: Member
    - Path: | id | string | yes | user id | – | "cku2" |
    - Response 200:
      ```ts
      interface PublicProfileResponse { profile: { id: string; displayName: string; avatarUrl: string | null; coverUrl: string | null; bio: string | null;
        location: string | null; createdAt: string; postCount: number; roomCount: number; followerCount: number; followingCount: number }; isSelf: boolean }
      ```
      ```json
      { "profile": { "id": "cku2", "displayName": "Sam", "avatarUrl": null, "coverUrl": null, "bio": "Gardener.", "location": "Leeds",
        "createdAt": "2026-08-01T00:00:00.000Z", "postCount": 4, "roomCount": 2, "followerCount": 10, "followingCount": 3 }, "isSelf": false }
      ```
    - Errors: 401; 404 "Not found" (missing, inactive or banned).
  - `GET /api/user/u/[id]/posts?cursor=&limit=`
    - Auth: Member
    - Query: cursor (`<ISO>_<id>`), limit (5–50, default 20).
    - Response 200: `FeedPage` (see My posts). Anonymous posts are excluded.
    - Errors: 401.
- **Form fields:** none.
- **Business rules:**
  - `postCount` counts only PUBLISHED, non-anonymous posts.
  - Blocking does not hide a profile from its viewer through this API (no block check here).
- **Edge cases / notes for the mobile app:**
  - ⚠️ The response has no `isFollowing` or `isBlocked`. The web page reads them server-side. Until the backend adds them, infer them from `GET /api/user/u/{viewerId}/following` and `GET /api/user/blocks`.
- **Status:** ⚠️ Partial (follow/block state and streaks/badges missing from the API)

## Profile → Public streaks, badges, follow/block state
- **Description:** On the web `/u/[id]` page, the server also loads `isFollowing(viewer, id)`, the viewer's blocked ids, `listPublicStreaks(id)` (streaks with `isPublic=true` that are not archived) and `listPublicBadges(id)` (all earned badges). None of these are available through an API for another member.
- **Who can use it:** Verified member (web only).
- **Source files:** `src/app/u/[id]/page.tsx`, `src/lib/streaks.ts` (`listPublicStreaks`), `src/lib/badges.ts` (`listPublicBadges`), `src/lib/follows.ts` (`isFollowing`), `src/lib/blocks.ts` (`getBlockedIds`)
- **User flow:**
  1. On the web the profile shows a streak strip (for example "🌱 120 days sober") and a badge grid.
  2. The Follow and Block buttons start in the correct state.
- **Suggested mobile screen(s):** Streak and badge sections on **PublicProfile** (needs a backend change).
- **API(s):** none. ⚠️ Suggested backend change: add `isFollowing`, `isBlocked`, `streaks: StreakView[]` and `badges: EarnedBadge[]` to `GET /api/user/u/[id]`.
- **Form fields:** none.
- **Business rules:**
  - Streaks are visible only when the streak's own `isPublic` is true. New streaks default to public; older ones stay private.
  - Badges are always public.
- **Edge cases / notes for the mobile app:** see Gaps.
- **Status:** ⚠️ Web-only (no API)

## Social → Followers & following lists
- **Description:** Lists who follows a member and who the member follows. Each row includes the viewer's follow state.
- **Who can use it:** Verified member, for any member id.
- **Source files:** `src/app/api/user/u/[id]/followers/route.ts`, `src/app/api/user/u/[id]/following/route.ts`, `src/lib/follows.ts` (`listFollowers`, `listFollowing`), `src/components/site/follow-list-modal.tsx`
- **User flow:**
  1. The user taps "Followers" or "Following" and the app calls the matching endpoint.
  2. Each row has a Follow / Following button (hidden when `isSelf`).
  3. When the list is empty, show "No followers yet".
- **Suggested mobile screen(s):** **FollowList** with tabs Followers / Following; rows show avatar, name, bio snippet and a follow button.
- **API(s):**
  - `GET /api/user/u/[id]/followers` and `GET /api/user/u/[id]/following`
  - Auth: Member
  - Path: id (user id).
  - Response 200:
    ```ts
    interface FollowListResponse { users: { id: string; displayName: string; avatarUrl: string | null; bio: string | null; isFollowing: boolean; isSelf: boolean }[] }
    ```
    ```json
    { "users": [ { "id": "cku3", "displayName": "Ana", "avatarUrl": null, "bio": "Runner", "isFollowing": true, "isSelf": false } ] }
    ```
  - Errors: 401. An unknown id returns an empty list.
- **Form fields:** none.
- **Business rules:**
  - Newest first.
  - At most 200 rows, with **no pagination**.
  - Inactive and banned users are dropped.
  - Blocked users are **not** filtered out.
- **Edge cases / notes for the mobile app:**
  - Do the paging on the client if needed.
- **Status:** ✅ Complete

## Social → Follow / unfollow
- **Description:** Follows or unfollows a member through one endpoint. A follow is a one-directional edge. A genuinely new follow notifies the followed person in the app.
- **Who can use it:** Verified member.
- **Source files:** `src/app/api/user/follow/route.ts`, `src/lib/follows.ts` (`followUser`, `unfollowUser`), `src/lib/notifications.ts`, `src/components/site/public-profile-client.tsx`
- **User flow:**
  1. The user taps Follow and the app calls `POST {userId}`. It updates the button optimistically.
  2. Tapping Following → Unfollow calls `POST {userId, follow:false}`.
  3. On 400, revert the button and show the message.
- **Suggested mobile screen(s):** Follow button component (used on profile, member list, suggestions and follow lists).
- **API(s):**
  - `POST /api/user/follow`
  - Auth: Member
  - Body:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | userId | string | yes | non-empty; not yourself; no block in either direction | – | "cku2" |
    | follow | boolean | no | `false` unfollows; anything else follows | true | false |
  - Response 200: `{ "ok": true, "following": true }`
  - Errors: 401; 400 "userId required"; 400 "You can't follow yourself."; 400 "You can't follow a blocked member."; 400 "No user given."
- **Form fields:** none.
- **Business rules:**
  - Following is idempotent (no duplicate notification).
  - A new follow increments `User.followerCount` in a transaction and creates an in-app `FOLLOW` notification: "<name> started following you", actionUrl `/u/<followerId>`.
  - Unfollow decrements the count only if an edge existed.
  - Following a non-existent id fails as a DB error with a generic 400 message.
- **Edge cases / notes for the mobile app:**
  - Safe to retry.
- **Status:** ✅ Complete

## Social → Who to follow
- **Description:** Three suggested members for the right rail. Each comes with a structured `reason` that the client turns into text. No follower counts are shown, and the order is stable rather than shuffled.
- **Who can use it:** Verified member.
- **Source files:** `src/app/api/user/follow/suggestions/route.ts`, `src/lib/follows.ts` (`suggestFollows`), `src/lib/follow-reason.ts`, `src/components/site/site-sidebar-right.tsx`
- **User flow:**
  1. Load the card with `GET /api/user/follow/suggestions`.
  2. Following someone refreshes the card.
- **Suggested mobile screen(s):** **WhoToFollowCard** on the home feed or Members screen: avatar, name, reason line, Follow button.
- **API(s):**
  - `GET /api/user/follow/suggestions`
  - Auth: Member
  - Response 200:
    ```ts
    type FollowReason = { kind: "sharedRoom"; room: string; roomId: string } | { kind: "sharedRooms"; n: number } | { kind: "followedByOne" }
      | { kind: "followedByMany"; n: number } | { kind: "postingThisWeek" } | { kind: "newHere" };
    interface SuggestionsResponse { people: { id: string; displayName: string; avatarUrl: string | null; reason: FollowReason }[] }
    ```
    ```json
    { "people": [ { "id": "cku5", "displayName": "Lee", "avatarUrl": null, "reason": { "kind": "sharedRoom", "room": "Sobriety", "roomId": "ckr1" } },
      { "id": "cku6", "displayName": "Jo", "avatarUrl": null, "reason": { "kind": "newHere" } } ] }
    ```
  - Errors: 401. Any server failure returns `{people: []}`.
- **Form fields:** none.
- **Business rules:**
  - Signals in priority order: shared active chat rooms, followed by people you follow, posted non-anonymously in the last 14 days, newest members.
  - Excludes yourself, people you already follow, and blocks in either direction.
  - Reason text, from `follow-reason.ts`:
    - sharedRoom: "Also in {room}"
    - sharedRooms: "In {n} of your rooms"
    - followedByOne: "Followed by someone you follow"
    - followedByMany: "Followed by {n} people you follow"
    - postingThisWeek: "Posting this week"
    - newHere: "New here too"
- **Edge cases / notes for the mobile app:**
  - Always 3 or fewer suggestions.
  - Translate the room name with the app's i18n.
- **Status:** ✅ Complete

## Social → Members directory
- **Description:** A directory of all active members, most-followed first, with a name search and a country filter. The viewer and both sides of any block are excluded.
- **Who can use it:** Verified member.
- **Source files:** `src/app/api/user/members/route.ts`, `src/lib/follows.ts` (`listMembers`), `src/app/members/page.tsx`, `src/components/site/members-client.tsx`
- **User flow:**
  1. Open Members and call `GET /api/user/members`.
  2. Typing in search (debounced) or changing the country reloads from the start.
  3. Scrolling to the end loads the next page with `cursor=nextCursor`.
  4. Each row has a Follow button.
  5. When nothing matches, show "No members match".
- **Suggested mobile screen(s):** **Members**: search bar, country filter chip, list of avatar / name / location / bio / follower count / Follow.
- **API(s):**
  - `GET /api/user/members?q=&country=&cursor=&limit=`
  - Auth: Member
  - Query:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | q | string | no | substring of displayName | – | "maya" |
    | country | string | no | country id | – | "ckc0untry123" |
    | cursor | string | no | `<followerCount>:<id>` from nextCursor | – | "4:cku9" |
    | limit | int | no | clamped 1–60; 0 or invalid → 24 | 24 | 24 |
  - Response 200:
    ```ts
    interface MembersResponse { items: { id: string; displayName: string; avatarUrl: string | null; bio: string | null; location: string | null;
      followerCount: number; isFollowing: boolean }[]; nextCursor: string | null }
    ```
    ```json
    { "items": [ { "id": "cku2", "displayName": "Sam", "avatarUrl": null, "bio": "Gardener.", "location": "Leeds", "followerCount": 10, "isFollowing": false } ], "nextCursor": "10:cku2" }
    ```
  - Errors: 401. Any server failure returns `{items: [], nextCursor: null}`.
- **Form fields:** | Search | text | no | – | – | ; | Country | select | no | – | country list |
- **Business rules:**
  - Ordered by `followerCount` desc, then `id` asc.
  - Only active, non-banned users are listed.
- **Edge cases / notes for the mobile app:**
  - Uses a keyset cursor.
  - The country query param here is `country`, while search uses `countryId`.
- **Status:** ✅ Complete

## Social → Block / unblock
- **Description:** A one-directional block. If A blocks B, A no longer sees B's posts, comments and messages, B disappears from A's search, directory and suggestions, and follows between them are removed in both directions. A separate endpoint lists who the viewer has blocked.
- **Who can use it:** Verified member.
- **Source files:** `src/app/api/user/block/route.ts`, `src/app/api/user/blocks/route.ts`, `src/lib/blocks.ts`, `src/app/blocked/page.tsx`, `src/components/site/blocked-client.tsx`, `src/components/site/settings-client.tsx`, `src/components/site/public-profile-client.tsx`
- **User flow:**
  1. Profile "⋯" → Block shows a confirmation, then calls `POST /api/user/block {userId}`.
  2. Settings → Blocked members calls `GET /api/user/blocks`; tapping "Unblock" calls `POST /api/user/block {userId, block:false}`.
  3. When the list is empty, show "You haven't blocked anyone".
- **Suggested mobile screen(s):** Block action sheet on **PublicProfile**; **BlockedMembers** list (avatar, name, blocked date, Unblock).
- **API(s):**
  - `POST /api/user/block`
    - Auth: Member
    - Body:
      | Field | Type | Required | Validation / Rules | Default | Example |
      |---|---|---|---|---|---|
      | userId | string | yes | not yourself | – | "cku2" |
      | block | boolean | no | `false` unblocks | true | false |
    - Response 200: `{ "ok": true, "blocked": true }`
    - Errors: 401; 400 "userId required"; 400 "You can't block yourself."; 400 "No user given."; 400 generic message on a DB error.
  - `GET /api/user/blocks`
    - Auth: Member
    - Response 200:
      ```json
      { "blocked": [ { "userId": "cku2", "displayName": "Sam", "avatarUrl": null, "createdAt": "2026-11-01T10:00:00.000Z" } ] }
      ```
    - Errors: 401.
- **Form fields:** none.
- **Business rules:**
  - Blocking is idempotent (upsert).
  - Severed follows decrement `followerCount`.
  - Unblocking does not restore follows.
  - The list is newest first and unpaginated.
- **Edge cases / notes for the mobile app:**
  - The same blocked list is also returned in `GET /api/user/settings`.
- **Status:** ✅ Complete

## Notifications → Inbox
- **Description:** The member's in-app notifications (follows, likes, comments, chat, approvals, payouts and so on), with an unread count and mark-as-read. There is no push or SSE; the web polls.
- **Who can use it:** Verified member.
- **Source files:** `src/app/api/user/notifications/route.ts`, `src/app/api/user/notifications/read/route.ts`, `src/lib/notifications.ts`, `src/app/notifications/page.tsx`, `src/components/site/notifications-client.tsx`, `src/components/site/site-header-app.tsx` (bell, limit=8), `src/components/site/bottom-nav.tsx` (polls `limit=1` every 30s for the unread badge)
- **User flow:**
  1. Open Notifications and call `GET /api/user/notifications?limit=25`. Scrolling loads more with `cursor`.
  2. Tapping an item marks it read (`POST /read {ids:[id]}`) and navigates to `actionUrl` (a web path; map it to an app route).
  3. "Mark all read" calls `POST /read {}`.
  4. The tab badge polls `GET ?limit=10` (the minimum) every 30–60s, or on app focus, and reads `unread`.
- **Suggested mobile screen(s):** **Notifications** tab: list with a type icon, title, body, relative time and an unread dot; "Mark all read" header action; empty state "You're all caught up".
- **API(s):**
  - `GET /api/user/notifications?cursor=&limit=`
    - Auth: Member
    - Query: | cursor | string | no | `<ISO createdAt>_<id>` | – | | ; | limit | int | no | clamped 10–50 | 25 | 25 |
    - Response 200:
      ```ts
      type NotifType = "CHAT_REPLY"|"CHAT_MENTION"|"CHAT_REACTION"|"CRISIS_ALERT"|"POST_LIKE"|"POST_COMMENT"|"FOLLOW"|"DIRECT_MESSAGE"|"EVENT_APPROVED"|"EVENT_REJECTED"|"EVENT_CANCELLED"|"PLACE_APPROVED"|"PLACE_REJECTED"|"PETITION_APPROVED"|"PETITION_REJECTED"|"CAMPAIGN_APPROVED"|"CAMPAIGN_REJECTED"|"DONATION_RECEIVED"|"PAYOUT_APPROVED"|"PAYOUT_PAID"|"PAYOUT_REJECTED"|"TOWN_HERO_APPROVED"|"TOWN_HERO_REJECTED"|"SYSTEM";
      interface NotificationsResponse { items: { id: string; type: NotifType; title: string; body: string | null; actionUrl: string | null; isRead: boolean; createdAt: string }[];
        nextCursor: string | null; unread: number }
      ```
      ```json
      { "items": [ { "id": "ckn1", "type": "FOLLOW", "title": "Sam started following you", "body": null, "actionUrl": "/u/cku2", "isRead": false,
        "createdAt": "2026-11-25T08:00:00.000Z" } ], "nextCursor": null, "unread": 1 }
      ```
    - Errors: 401.
  - `POST /api/user/notifications/read`
    - Auth: Member
    - Body: | ids | string[] | no | non-string entries are dropped; omit or `[]` to mark **all** read | all | ["ckn1"] |
    - Response 200: `{ "ok": true }`
    - Errors: 401.
- **Form fields:** none.
- **Business rules:**
  - Newest first.
  - `unread` is the total unread count, not just the unread items on this page.
  - Notifications are never deleted except when the account is deleted.
- **Edge cases / notes for the mobile app:**
  - `limit=1` is clamped up to 10.
  - `actionUrl` values are web paths such as `/u/<id>` and `/chatrooms/<slug>`; build a route map.
- **Status:** ✅ Complete

## Navigation → Sidebar summary
- **Description:** One call that loads everything in the signed-in left rail: journey stats, the longest live streak, up to 6 earned badges, the badge count and up to 8 joined chat rooms with unread counts. Each part fails soft (returns an empty value).
- **Who can use it:** Verified member.
- **Source files:** `src/app/api/user/sidebar/route.ts`, `src/lib/profile.ts`, `src/lib/streaks.ts`, `src/lib/badges.ts`, `src/lib/chat-user.ts` (`listRoomsForUser`), `src/components/site/site-sidebar.tsx`
- **User flow:**
  1. The app shell loads it on start and when the drawer opens.
  2. Tapping the streak opens Progress, a badge opens Progress, and a room opens ChatRoom.
- **Suggested mobile screen(s):** **DrawerSummary** / profile header in the side drawer: name, stats, a "🌱 40 days sober" chip, badge emojis, "Your rooms" list with unread badges.
- **API(s):**
  - `GET /api/user/sidebar`
  - Auth: Member
  - Response 200:
    ```ts
    interface SidebarResponse {
      stats: { posts: number; replies?: number; rooms?: number; saved?: number; followers: number; following: number; memberSince?: string };
      topStreak: { kind: "SOBER"|"MEDITATION"|"VOLUNTEERING"|"JOURNALING"|"CUSTOM"; label: string | null; name: string; emoji: string; unit: string; days: number } | null;
      badges: { slug: string; name: string; emoji: string }[]; badgeCount: number;
      rooms: { id: string; slug: string; name: string; emoji: string | null; color: string | null; tier: string; unread: number }[];
    }
    ```
    ```json
    { "stats": { "posts": 12, "replies": 30, "rooms": 3, "saved": 8, "followers": 21, "following": 17, "memberSince": "2026-10-02T09:00:00.000Z" },
      "topStreak": { "kind": "SOBER", "label": null, "name": "Sober", "emoji": "🌱", "unit": "days sober", "days": 40 },
      "badges": [ { "slug": "first-post", "name": "Said hello", "emoji": "👋" } ], "badgeCount": 1,
      "rooms": [ { "id": "ckr1", "slug": "sobriety", "name": "Sobriety", "emoji": "🌱", "color": null, "tier": "SUPPORT", "unread": 2 } ] }
    ```
  - Errors: 401.
- **Form fields:** none.
- **Business rules:**
  - The top streak is the non-archived streak with the most `days`, whether public or not.
  - Badges are newest first.
  - Only rooms with `isMember` true are included.
  - If stats fail, `stats` falls back to `{posts:0, followers:0, following:0}`.
- **Edge cases / notes for the mobile app:**
  - Build streak text on the client from `kind` and `label`; do not show `name` for non-English UIs.
- **Status:** ✅ Complete

## Search → Site-wide search
- **Description:** One search across members (display name only), published articles, approved places, approved events, published campaigns and public/support chat rooms. It returns up to 6 results per type.
- **Who can use it:** Verified member.
- **Source files:** `src/app/api/user/search/route.ts`, `src/lib/search.ts`, `src/app/search/page.tsx`, `src/components/site/search-client.tsx`
- **User flow:**
  1. The user types a query (minimum 2 characters, debounced) and can pick a country filter. The app calls `GET /api/user/search?q=…&countryId=…`.
  2. Results are grouped by `kind`. Tapping a result navigates by kind and id/slug (`href` is a web path).
  3. If `truncated` is true, show a "Showing top results" hint.
  4. Empty states: fewer than 2 characters shows a prompt; no hits shows "Nothing found".
- **Suggested mobile screen(s):** **Search**: search bar, country chip, sectioned list (Members, Articles, Places, Events, Campaigns, Chatrooms), each row with an emoji tile (or avatar for members), title and subtitle.
- **API(s):**
  - `GET /api/user/search?q=&countryId=`
  - Auth: Member
  - Query:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | q | string | yes | trimmed, cut to 120 chars; fewer than 2 chars returns empty | "" | "food bank" |
    | countryId | string | no | narrows places, events and campaigns only | – | "ckc0untry123" |
  - Response 200:
    ```ts
    type SearchKind = "member" | "article" | "place" | "event" | "campaign" | "room";
    interface SearchResponse { q: string; hits: { kind: SearchKind; id: string; href: string; title: string; subtitle: string | null;
      onlineLabel?: boolean; emoji: string; avatarUrl?: string | null }[]; counts: Record<SearchKind, number>; truncated: boolean }
    ```
    ```json
    { "q": "food", "hits": [ { "kind": "place", "id": "ckpl1", "href": "/places/cork-food-bank", "title": "Cork Food Bank", "subtitle": "Cork", "emoji": "📍" },
      { "kind": "event", "id": "cke1", "href": "/events/food-drive", "title": "Food drive", "subtitle": null, "onlineLabel": true, "emoji": "📅" } ],
      "counts": { "member": 0, "article": 0, "place": 1, "event": 1, "campaign": 0, "room": 0 }, "truncated": false }
    ```
  - Errors: 401.
- **Form fields:** | Search | text | yes | ≥2 chars | – | ; | Country | select | no | – | country list |
- **Business rules:**
  - Matching is a `LIKE %q%` substring search.
  - Members: active and non-banned only, excluding the viewer and people the viewer blocked; ordered by name; the subtitle is their location.
  - Articles: ordered by publishedAt desc.
  - Places: donors first, then by name.
  - Events: by start time ascending; when `onlineLabel` is true the subtitle should read "Online".
  - Campaigns: by publishedAt desc.
  - Rooms: PUBLIC and SUPPORT tiers only, ordered by member count.
- **Edge cases / notes for the mobile app:**
  - There is no pagination.
  - The route expects `countryId`, while the Members directory uses `country`.
- **Status:** ✅ Complete

## Saved → Saved posts, articles & clips
- **Description:** The member's bookmarks. Posts use the standard feed page shape with a cursor; articles and clips are flat lists capped at 50. Saving and unsaving happen in the Feed, Articles and Library modules.
- **Who can use it:** Verified member.
- **Source files:** `src/app/api/user/saved/route.ts`, `src/app/api/user/saved/articles/route.ts`, `src/app/api/user/saved/clips/route.ts`, `src/lib/posts-feed.ts` (`listSaved`), `src/lib/articles.ts` (`listSavedArticles`), `src/lib/library.ts` (`listSavedClips`), `src/app/saved/page.tsx`, `src/components/site/saved-client.tsx`, `src/components/site/profile-client.tsx`
- **User flow:**
  1. Saved screen tabs: Posts calls `GET /api/user/saved` (infinite scroll); Articles calls `GET /api/user/saved/articles`; Clips calls `GET /api/user/saved/clips`.
  2. Unsaving uses the other modules' endpoints (for example `POST /api/user/clips/{id}/save`).
  3. Empty state: "No saved posts yet — tap the bookmark icon on any post to keep it here."
- **Suggested mobile screen(s):** **Saved** with 3 tabs: PostCard list, ArticleCard list (cover, title, excerpt, read minutes) and ClipCard grid (poster, title, duration).
- **API(s):**
  - `GET /api/user/saved?cursor=&limit=`
    - Auth: Member
    - Query: cursor (`<ISO savedAt>_<postId>`), limit (5–50, default 20).
    - Response 200: `FeedPage` (see My posts), ordered by save time desc. Only PUBLISHED posts are included, and `saved` is always true.
    - Errors: 401.
  - `GET /api/user/saved/articles`
    - Auth: Member
    - Response 200:
      ```json
      { "articles": [ { "savedAt": "2026-11-20T10:00:00.000Z", "id": "cka1", "slug": "sleep-and-recovery", "title": "Sleep and recovery", "excerpt": "Why rest matters.",
        "coverUrl": "/uploads/articles/x.webp", "coverAlt": null, "videoUrl": null, "readMinutes": 5, "publishedAt": "2026-11-01T00:00:00.000Z",
        "viewCount": 120, "likeCount": 9, "saveCount": 4, "commentCount": 2, "authorNameSnapshot": "Editor", "authorAvatarSnapshot": null,
        "category": { "id": "ckcat", "name": "Wellbeing", "slug": "wellbeing" } } ] }
      ```
    - Errors: 401.
  - `GET /api/user/saved/clips`
    - Auth: Member
    - Response 200:
      ```json
      { "clips": [ { "savedAt": "2026-11-21T10:00:00.000Z", "id": "ckcl1", "themeId": "ckth1", "title": "Morning stretch", "caption": null, "kind": "UPLOAD",
        "embedUrl": null, "videoUrl": "/uploads/videos/a/master.mp4", "posterUrl": "/uploads/videos/a/poster.jpg", "width": 1080, "height": 1920,
        "durationSec": 62, "likeCount": 5, "saveCount": 3, "commentCount": 0, "publishedAt": "2026-11-10T00:00:00.000Z", "createdAt": "2026-11-09T00:00:00.000Z",
        "isPublished": true, "theme": { "slug": "movement", "name": "Movement", "emoji": "🏃", "isActive": true }, "liked": false, "myReaction": null, "saved": true } ] }
      ```
    - Errors: 401.
- **Form fields:** none.
- **Business rules:**
  - Articles and clips: newest saved first, maximum 50, no paging.
  - Clips are included only if published and their theme is active.
  - ⚠️ Saved articles are not filtered by article status.
  - Saved clips always report `liked:false` (hard-coded).
- **Edge cases / notes for the mobile app:**
  - Don't trust `liked` on saved clips; fetch the clip detail for the real like state.
- **Status:** ✅ Complete

## Progress → Overview & badges
- **Description:** The member's progress page: all streaks, the full badge grid (earned with dates, plus locked ones) and the journaling day streak. Badges are recalculated from facts on every read and are never taken away once earned.
- **Who can use it:** Verified member.
- **Source files:** `src/app/api/user/progress/route.ts`, `src/lib/badges.ts`, `src/lib/streaks.ts`, `src/lib/journal.ts` (`journalingStreak`), `src/app/progress/page.tsx`, `src/components/site/progress-client.tsx`, `src/components/site/profile-client.tsx`
- **User flow:**
  1. Open Progress and call `GET /api/user/progress`.
  2. Show the streak cards (see Streaks), the "✍️ N days journaling in a row" line and the badge grid grouped by recovery / writing / community / action. Locked badges are greyed out.
- **Suggested mobile screen(s):** **Progress**: streak cards with a "+ Start tracking" button, a journaling-days chip, and a badge grid (emoji, name, description, earned date or locked).
- **API(s):**
  - `GET /api/user/progress`
  - Auth: Member
  - Response 200:
    ```ts
    interface ProgressResponse { streaks: StreakView[]; badges: { slug: string; name: string; description: string; emoji: string;
      group: "recovery"|"writing"|"community"|"action"; earnedAt: string | null }[]; journalDays: number }
    ```
    ```json
    { "streaks": [ { "id": "cks1", "kind": "SOBER", "label": null, "name": "Sober", "unit": "days sober", "emoji": "🌱", "startedOn": "2026-10-17",
      "days": 40, "bestDays": 40, "resetCount": 0, "isPublic": true, "archived": false } ],
      "badges": [ { "slug": "sober-30", "name": "Thirty days", "description": "Thirty days on your sobriety streak.", "emoji": "🌱", "group": "recovery", "earnedAt": "2026-11-15T08:00:00.000Z" },
        { "slug": "sober-90", "name": "Ninety days", "description": "Ninety days. That is a season of your life.", "emoji": "🌿", "group": "recovery", "earnedAt": null } ],
      "journalDays": 3 }
    ```
  - Errors: 401.
- **Form fields:** none.
- **Business rules (badge rules from `src/lib/badges.ts`):**
  | slug | name | rule |
  |---|---|---|
  | sober-30 / sober-90 / sober-365 | Thirty days / Ninety days / A year | best SOBER streak ≥ 30 / 90 / 365 days |
  | started-again | Started again | any streak with resetCount > 0 |
  | first-entry / journal-30 | First words / Thirty entries | ≥1 / ≥30 journal or reflection entries |
  | opened-up | Opened up | ≥1 shared journal entry |
  | grateful-10 | Ten gratitudes | ≥10 APPROVED gratitude entries |
  | first-post | Said hello | ≥1 post |
  | first-reply | First reply | ≥1 post comment |
  | crisis-responder | There at 2am | ≥1 message in a CRISIS-tier room |
  | hero-spotter | Hero spotter | ≥1 APPROVED Town Hero nominated |
  | showed-up | Showed up | ≥1 event RSVP |
  | petition-starter | Asked for change | ≥1 petition created |
  | gave | Gave | ≥1 SUCCEEDED donation |

  Additional rules:
  - Badges are recomputed on this GET and on streak POST and PATCH.
  - `journalDays` counts consecutive UTC dates with an entry, ending today or yesterday.
- **Edge cases / notes for the mobile app:**
  - The badge list comes in display order (registry order).
  - Badges are never revoked.
- **Status:** ✅ Complete

## Progress → Streaks
- **Description:** "Days since" counters (sober, meditation, volunteering, journaling or a custom one) counted from a date the member declares. There are no daily check-ins and nothing expires. Resetting keeps `bestDays`. A streak can be edited, reset, archived or deleted.
- **Who can use it:** Verified member, for their own streaks only.
- **Source files:** `src/app/api/user/streaks/route.ts`, `src/app/api/user/streaks/[id]/route.ts`, `src/lib/streaks.ts`, `src/lib/streak-text.ts`, `src/lib/badges.ts`, `src/components/site/progress-client.tsx`
- **User flow:**
  1. "+ Start tracking" opens a composer: pick a kind, a start date (today or earlier), a label (required for CUSTOM) and a "Show on my profile" switch (ticked by default). The app calls `POST /api/user/streaks`.
  2. On a card:
     - "Edit" calls `PATCH {startedOn?, label?, isPublic?}` to fix a typo; `bestDays` is unchanged.
     - "Start again" calls `PATCH {reset:true, startedOn}`, which banks the current run into `bestDays` and increments `resetCount`.
     - "Archive" calls `DELETE ?archive=1`.
     - "Delete" calls `DELETE`.
  3. A 400 shows the message ("You're already tracking that one." and so on).
- **Suggested mobile screen(s):** **Progress** streak cards (emoji, big day number, unit, "best N", public eye icon, a menu with Edit / Start again / Archive / Delete). **StartStreak** sheet with a kind picker, date picker (max today), label and public switch.
- **API(s):**
  - `GET /api/user/streaks`
    - Auth: Member
    - Response 200: `{ "streaks": StreakView[] }`. Active streaks come first, archived ones last, each group by startedOn ascending.
      ```ts
      interface StreakView { id: string; kind: "SOBER"|"MEDITATION"|"VOLUNTEERING"|"JOURNALING"|"CUSTOM"; label: string | null; name: string;
        unit: string; emoji: string; startedOn: string /* YYYY-MM-DD */; days: number; bestDays: number; resetCount: number; isPublic: boolean; archived: boolean }
      ```
    - Errors: 401.
  - `POST /api/user/streaks`
    - Auth: Member
    - Body:
      | Field | Type | Required | Validation / Rules | Default | Example |
      |---|---|---|---|---|---|
      | kind | enum | yes | SOBER \| MEDITATION \| VOLUNTEERING \| JOURNALING \| CUSTOM | – | "SOBER" |
      | startedOn | string | yes | `YYYY-MM-DD`, valid date, not in the future (UTC) | – | "2026-10-17" |
      | label | string \| null | CUSTOM: yes | trimmed, cut to 80 chars | null | "Days since I called mum" |
      | isPublic | boolean | no | omitted means **true**; only `false` makes it private | true | false |
    - Response 201: `{ "streak": StreakView }`
      ```json
      { "streak": { "id": "cks1", "kind": "SOBER", "label": null, "name": "Sober", "unit": "days sober", "emoji": "🌱", "startedOn": "2026-10-17",
        "days": 40, "bestDays": 40, "resetCount": 0, "isPublic": true, "archived": false } }
      ```
    - Errors: 401; 400 "Pick what you're tracking."; "Pick a date."; "That isn't a date."; "That's in the future — pick the day it started."; "Give it a name — whatever you'd call it yourself."; "You're already tracking that one." (a non-archived streak of the same kind exists; CUSTOM is exempt); "Couldn't save that."
  - `PATCH /api/user/streaks/[id]`
    - Auth: Member (owner)
    - Body, reset mode: `{ reset: true, startedOn: "YYYY-MM-DD" }`. This also un-archives the streak.
    - Body, edit mode: `{ startedOn?: string, label?: string, isPublic?: boolean }`
    - Response 200: `{ "streak": StreakView }`
    - Errors: 401; 400 "That one's gone." (not owned or missing), date errors, "Couldn't save that."
  - `DELETE /api/user/streaks/[id]?archive=1`
    - Auth: Member (owner)
    - Query: | archive | "1" | no | "1" archives; otherwise the streak is hard-deleted | – | "1" |
    - Response 200: `{ "ok": true }`
    - Errors: 401; 400 "That one's gone." (archive only; a hard delete of a missing id still returns ok); "Couldn't do that."
- **Form fields:**
  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | What are you tracking? | select | yes | enum | Sober, Meditation, Volunteering, Journaling, Something else |
  | Started on | date | yes | ≤ today | – |
  | Name (custom) | text | CUSTOM only | ≤80 | – |
  | Show on my profile | switch | no | – | default on |
- **Business rules:**
  - `days` = whole UTC calendar days since `startedOn`, counting the start day as day 1. A future date gives 0.
  - `bestDays` = max(stored best, current run).
  - Built-in units and emojis: SOBER "days sober" 🌱, MEDITATION "days meditating" 🕯️, VOLUNTEERING "days volunteering" 🤝, JOURNALING "days journaling" 📓, CUSTOM "days" ⭐.
  - Archiving banks `bestDays`.
  - Resets are private: no notification and no post.
  - Badges are recomputed after POST and PATCH.
- **Edge cases / notes for the mobile app:**
  - Send dates as plain `YYYY-MM-DD` strings. Day maths uses UTC, so near midnight a user can see a ±1 day difference from local time.
  - Translate `name` and `unit` on the client from `kind`; never translate `label`.
- **Status:** ✅ Complete

## Journal → Private journal
- **Description:** A private diary. Only the author can read their entries. It shares a table with daily-reflection answers, so answers to the daily question also appear here with their `question`.
- **Who can use it:** Verified member, for their own entries only.
- **Source files:** `src/app/api/user/journal/route.ts`, `src/app/api/user/journal/[id]/route.ts`, `src/lib/journal.ts`, `src/app/journal/page.tsx`, `src/components/site/journal-client.tsx`
- **User flow:**
  1. Open Journal and call `GET /api/user/journal`. "Load more" passes `cursor`.
  2. Composer → "Save" calls `POST {body}`, and the new entry is prepended.
  3. On an entry: "Edit" calls `PATCH {body}`; "Delete" (after a confirm) calls `DELETE`; "Share" (see next feature).
  4. Empty state: "Write what you can't say out loud yet. Only you can see this."
- **Suggested mobile screen(s):** **Journal**: privacy banner (lock icon), today's question prompt (optional, from daily-reflection), a multiline composer, and an entry list (date, body, question chip, "Shared" badge, menu).
- **API(s):**
  - `GET /api/user/journal?cursor=&limit=`
    - Auth: Member
    - Query: | cursor | string | no | entry id from nextCursor | – | "ckj9" | ; | limit | int | no | clamped 1–50 | 20 | 20 |
    - Response 200:
      ```ts
      interface JournalPage { entries: { id: string; body: string; question: { id: string; body: string } | null; sharedPostId: string | null;
        sharedAt: string | null; createdAt: string; updatedAt: string }[]; nextCursor: string | null; total: number }
      ```
      ```json
      { "entries": [ { "id": "ckj9", "body": "Hard day, but I didn't drink.", "question": null, "sharedPostId": null, "sharedAt": null,
        "createdAt": "2026-11-25T21:00:00.000Z", "updatedAt": "2026-11-25T21:00:00.000Z" } ], "nextCursor": null, "total": 1 }
      ```
    - Errors: 401.
  - `POST /api/user/journal`
    - Auth: Member
    - Body: | body | string | yes | trimmed, 1–20,000 chars | – | "Today I…" |
    - Response **201**: `{ "entry": JournalEntry }`
    - Errors: 401; 400 "Write something first." / "That's longer than the journal allows." / "Couldn't save that."
  - `PATCH /api/user/journal/[id]`
    - Auth: Member (owner)
    - Body: | body | string | yes | 1–20,000 | – | "Edited text" |
    - Response 200: `{ "entry": JournalEntry }`
    - Errors: 401; 400 "Write something first." / "That's longer than the journal allows." / "That entry is gone." / "Couldn't save that."
  - `DELETE /api/user/journal/[id]`
    - Auth: Member (owner)
    - Response 200: `{ "ok": true }`. Also returns ok when the id doesn't exist or isn't owned.
    - Errors: 401.
- **Form fields:** | Entry | textarea | yes | 1–20,000 chars | – |
- **Business rules:**
  - Newest first.
  - Editing after sharing does not change the shared post.
  - Deleting does not delete a shared post.
  - The first entry and the 30th entry earn badges.
- **Edge cases / notes for the mobile app:**
  - Uses an id cursor.
  - Never cache entries in shared or unencrypted storage; this content is sensitive.
- **Status:** ✅ Complete

## Journal → Share entry as post
- **Description:** Publishes one journal entry as a new community post (a copy, not a visibility flag), optionally anonymous. Each entry can be shared once.
- **Who can use it:** Verified member (owner of the entry).
- **Source files:** `src/app/api/user/journal/[id]/share/route.ts`, `src/lib/journal.ts` (`shareEntry`), `src/lib/posts-write.ts` (`createPost`)
- **User flow:**
  1. Entry menu → "Share". A sheet explains that a copy becomes public and offers a "Post anonymously" switch.
  2. The app calls `POST /api/user/journal/{id}/share`.
  3. On 200, mark the entry "Shared" and offer "View post" (`postId`).
  4. On 400, show the message.
- **Suggested mobile screen(s):** **ShareJournalEntry** confirmation sheet.
- **API(s):**
  - `POST /api/user/journal/[id]/share`
  - Auth: Member (owner)
  - Body: | isAnonymous | boolean | no | only `true` is anonymous | false | true |
  - Response 200: `{ "postId": "ckp42" }`
  - Errors: 401; 400 "That entry is gone." / "You've already shared this one." / "Couldn't share that." (also covers errors thrown by createPost, such as moderation or length limits from the feed module).
- **Form fields:** | Post anonymously | switch | no | – | – |
- **Business rules:**
  - Sets `sharedPostId` and `sharedAt` on the entry.
  - The new post goes through the normal `createPost` rules (Feed module).
  - Earns the "opened-up" badge.
- **Edge cases / notes for the mobile app:**
  - After sharing, `sharedPostId` is non-null; hide the Share action.
- **Status:** ✅ Complete

## Journal → Daily reflection
- **Description:** Today's quote and question (scheduled by admins for a UTC date) and the member's answer. Answers are saved into the journal table, one per question (upsert).
- **Who can use it:** GET: anyone (a guest sees no reflection). POST: verified member.
- **Source files:** `src/app/api/user/daily-reflection/route.ts`, `src/lib/daily-reflection.ts`, `src/components/site/daily-reflection-card.tsx`, `src/app/journal/page.tsx`
- **User flow:**
  1. The home or journal card calls `GET /api/user/daily-reflection` and shows the quote and question. If the user already answered, it shows their answer with "Edit".
  2. The user types an answer and the app calls `POST {questionId, body}`.
  3. On 200, show the saved answer. On 400 "That question is no longer available.", reload.
- **Suggested mobile screen(s):** **DailyReflectionCard**: the quote with attribution, the question, a text area (≤2,000) and "Save reflection".
- **API(s):**
  - `GET /api/user/daily-reflection`
    - Auth: optional (`getCurrentUser`)
    - Response 200:
      ```ts
      interface DailyReflectionResponse { quote: { id: string; body: string; attribution: string | null } | null;
        question: { id: string; body: string; reflection: { body: string; updatedAt: string } | null } | null }
      ```
      ```json
      { "quote": { "id": "ckq1", "body": "Small steps still move you forward.", "attribution": null },
        "question": { "id": "ckdq1", "body": "What helped you today?", "reflection": null } }
      ```
    - Errors: none. When nothing is scheduled, both fields are null.
  - `POST /api/user/daily-reflection`
    - Auth: Member
    - Body:
      | Field | Type | Required | Validation / Rules | Default | Example |
      |---|---|---|---|---|---|
      | questionId | string | yes | must be today's active question (UTC) | – | "ckdq1" |
      | body | string | yes | trimmed, 1–2,000 chars | – | "A walk with my sister." |
    - Response 200: `{ "reflection": { "body": "A walk with my sister.", "updatedAt": "2026-11-26T09:00:00.000Z" } }`
    - Errors: 401; 400 "Reflection must be between 1 and 2,000 characters."; 400 "That question is no longer available."
- **Form fields:** | Your reflection | textarea | yes | 1–2,000 | – |
- **Business rules:**
  - "Today" is the UTC date.
  - One answer per (user, question); posting again overwrites it.
  - Answers appear in the journal list with `question` set.
- **Edge cases / notes for the mobile app:**
  - Around midnight UTC the question changes, so users in other timezones may see "tomorrow's" question early or late.
  - Journal entries are limited to 20,000 characters, but reflections only 2,000.
- **Status:** ✅ Complete

---

## Emails & notifications sent by this module
| Channel | Trigger | Recipient | Template / content | Source |
|---|---|---|---|---|
| email | Sign up | new member | `email_confirm`: `{APP_URL}/verify?token=…` (24h) | `src/app/api/user/auth/signup/route.ts`, `src/lib/verification.ts` |
| email | Resend verification | unverified member | `email_confirm` (new token, older ones invalidated) | `src/app/api/user/auth/resend-verification/route.ts` |
| admin-notification | Sign up | all admins | `USER_SIGNED_UP` "<name> joined" → `/admin/users/<id>` | `src/app/api/user/auth/signup/route.ts` |
| email | Forgot password | account owner (active, not banned; max 1 per minute) | `password_reset`: `{APP_URL}/reset-password?token=…` (10 min) | `src/app/api/user/auth/forgot-password/route.ts` |
| email | Password reset or changed | account owner | `password_reset_confirmed` (security notice) | `reset-password/route.ts`, `settings/password/route.ts` |
| email | Email change requested | **new** address | `email_confirm`: `{APP_URL}/verify-email-change?token=…` (1h) | `src/lib/account.ts` |
| in-app | New follow | followed member | `FOLLOW` "<name> started following you" → `/u/<followerId>` | `src/lib/follows.ts` |
| email | Digest runner (operator cron) | members with `digestEnabled` | `daily_digest` | `src/lib/digest.ts`, `prisma/send-digests.ts` |

All emails go through `sendEmail` (`src/lib/email.ts`), which uses DB-stored templates and records every attempt in `email_logs`. A missing or disabled template makes the send fail without breaking the main action. Activity log entries (`UserActivity`) written here: SIGNED_UP, SIGNED_IN, SIGN_IN_FAILED, EMAIL_VERIFIED, PASSWORD_CHANGED.

## Gaps & open questions
1. **Cookie-only auth.** The app must use a persistent cookie jar with `wwc-user-session` and `wwc-user-verified`. There are no bearer or refresh tokens.
2. **The verified claim must be refreshed.** Call `POST /api/user/auth/refresh-verified` after login, on app start and after any `needsVerification` 403.
3. ⚠️ **Web-only token pages.** Email confirmation (`/verify`) and email-change confirmation (`/verify-email-change`) have no API. Reset links also point to the web (`/reset-password`). Needed: universal links plus `POST /api/user/auth/verify-email` and `POST /api/user/settings/email/confirm`.
4. **No "me" endpoint.** Appearance (`colorThemeId`, `appearanceMode`, `brandTone`) and digest settings cannot be read back by any API.
5. **Daily digest.** It is write-only, has no web UI, and depends on an external cron. The "progress visibility" setting mentioned in the route header is not implemented.
6. **Public profile API is incomplete.** It lacks `isFollowing`, `isBlocked`, public streaks and badges; the web page reads these server-side.
7. **Profile images.** `avatarUrl` and `coverUrl` accept any string, and old files are not cleaned up when replaced.
8. **Display-name limits differ.** Signup allows 2–40 characters; profile edit allows 1–60.
9. **Logout.** It is not revoked server-side and responds with a 303 redirect instead of JSON. Login has no rate limit.
10. **Unpaginated lists.** Followers and following are capped at 200; saved articles and clips at 50; the blocked list is unbounded.
11. **In-memory limits.** Rate limits and spent captcha nonces live in process memory and are not shared between workers.
12. **No push notifications** and no device-token endpoint; the web polls every 30 seconds.
13. **Deactivation can't be self-reversed.** Only an admin can reactivate an account.
14. **Saved articles** are not filtered by publish status.
