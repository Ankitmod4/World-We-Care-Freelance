# Admin Core — Auth, Team, Users, Moderation, Chat, Live, Notifications, Settings, Money, Media, Translations

## Module overview

The admin area runs on its own session, separate from member accounts. Signing in sets the HttpOnly `wwc-admin-session` cookie. It is HMAC-signed, lasts up to 30 days, and uses SameSite=Lax (`src/lib/session.ts`, `src/lib/admin-auth.ts`). Every `/api/admin/*` handler checks it again with one of these helpers:

| Helper | Allowed roles | 401/403 message |
|---|---|---|
| `requireAdmin(req)` | OWNER, ADMIN, MODERATOR (any **active** admin) | 401 `Unauthorized` |
| `requireOwner(auth)` (after requireAdmin) | OWNER | 403 `Only an owner can manage admin accounts.` |
| `requireMoneyAdmin(req)` (level `"admin"`) | OWNER, ADMIN | 403 `Moderators can't work with payments or payouts.` |
| `requireMoneyAdmin(req, "owner")` | OWNER | 403 `Only an owner can change the payment credentials.` |
| Inline `auth.role !== "OWNER"` / `auth.role === "MODERATOR"` | as stated per endpoint | custom message |

`getCurrentAdmin()` returns null (so you get a 401) when the cookie is missing, has a bad signature or has expired, or when the admin row was deleted or deactivated (`isActive=false`).

Page middleware (`src/middleware.ts`) redirects `/admin/*` (except `/admin/login`) to `/admin/login?next=<path>` when no valid admin cookie is present. `/api/admin/*` is exempt from the member email-verification gate. The dashboard layout `src/app/admin/(dashboard)/layout.tsx` also redirects when `getCurrentAdmin()` returns null.

**Audit trail:** most user, post, report and payout mutations write an `AdminActionLog` row (`src/lib/admin-action-log.ts`). Some also add an `ADMIN_ACTION` entry to the member's own activity feed. That entry never includes the admin's reason. Chat, settings, template, translation, ffmpeg and live actions are **not** audited.

**Mobile note:** the admin area may or may not be built in the mobile app. It is documented in full here anyway. Things the app must know:
1. Admin auth is **cookie-only**, so the app needs a cookie jar.
2. There is **no `/me` endpoint** that returns the admin's role (see gaps).
3. Errors are `{ error: string }`. The exceptions are a few `{ ok:false, error|message }` shapes, noted per endpoint.

**Common list contract** (users, admins, posts, reports): query `page` (default 1) and `perPage` (default 25, clamped 5..100). The response is `{ items, total, page, perPage, totalPages }`. Sending a non-numeric `page` or `perPage` gives NaN and a 500 (⚠️ gap). All dates are ISO-8601 strings. Money is integer cents.

## Table of contents

- [Admin Auth → Login](#admin-auth--login)
- [Admin Auth → Logout](#admin-auth--logout)
- [Admin Auth → Current admin / role](#admin-auth--current-admin--role)
- [Admin → Dashboard overview](#admin--dashboard-overview)
- [Team → List admins](#team--list-admins)
- [Team → Invite admin](#team--invite-admin)
- [Team → View / edit admin](#team--view--edit-admin)
- [Team → Delete admin](#team--delete-admin)
- [Team → Reset admin password](#team--reset-admin-password)
- [Team → Activate / deactivate admin](#team--activate--deactivate-admin)
- [Users → List users](#users--list-users)
- [Users → Create user](#users--create-user)
- [Users → View / edit / delete user](#users--view--edit--delete-user)
- [Users → Activate / deactivate / ban / unban](#users--activate--deactivate--ban--unban)
- [Users → Activity & audit feed](#users--activity--audit-feed)
- [Users → Send password-reset email](#users--send-password-reset-email)
- [Users → Send template email](#users--send-template-email)
- [Moderation → Posts list & stats](#moderation--posts-list--stats)
- [Moderation → Post detail & permanent delete](#moderation--post-detail--permanent-delete)
- [Moderation → Post actions](#moderation--post-actions)
- [Moderation → Comment actions](#moderation--comment-actions)
- [Moderation → Reports queue](#moderation--reports-queue)
- [Moderation → Banned words](#moderation--banned-words)
- [Chat → Categories](#chat--categories)
- [Chat → Rooms](#chat--rooms)
- [Chat → Members](#chat--members)
- [Chat → Message moderation](#chat--message-moderation)
- [Live → Broadcast moderation](#live--broadcast-moderation)
- [Notifications → Admin bell](#notifications--admin-bell)
- [Settings → General](#settings--general)
- [Settings → Email delivery](#settings--email-delivery)
- [Settings → Email templates](#settings--email-templates)
- [Settings → Email logs](#settings--email-logs)
- [Settings → Storage](#settings--storage)
- [Settings → Cache](#settings--cache)
- [Settings → Streaming server](#settings--streaming-server)
- [Money → Payment & payout settings](#money--payment--payout-settings)
- [Money → Payout queue](#money--payout-queue)
- [Money → Donations ledger](#money--donations-ledger)
- [Media → ffmpeg management](#media--ffmpeg-management)
- [Media → Admin image upload](#media--admin-image-upload)
- [Media → Admin video upload](#media--admin-video-upload)
- [Translations → Languages & Google key](#translations--languages--google-key)
- [Translations → String catalogue](#translations--string-catalogue)
- [Translations → Machine translate](#translations--machine-translate)
- [Translations → Extract strings](#translations--extract-strings)
- [Translations → Content translation health](#translations--content-translation-health)
- [Gaps & open questions](#gaps--open-questions)

## Endpoints in this module

| Method | Path | Feature | Auth (roles) |
|---|---|---|---|
| POST | /api/admin/auth/login | Admin Auth → Login | Public |
| POST | /api/admin/auth/logout | Admin Auth → Logout | Public |
| GET | /api/admin/admins | Team → List admins | Admin (OWNER, ADMIN, MODERATOR) |
| POST | /api/admin/admins | Team → Invite admin | OWNER |
| GET | /api/admin/admins/[id] | Team → View / edit admin | Admin (all roles) |
| PUT | /api/admin/admins/[id] | Team → View / edit admin | Self name/email: any role · others or role change: OWNER |
| DELETE | /api/admin/admins/[id] | Team → Delete admin | OWNER |
| POST | /api/admin/admins/[id]/reset-password | Team → Reset admin password | OWNER |
| POST | /api/admin/admins/[id]/status | Team → Activate / deactivate admin | OWNER |
| GET | /api/admin/users | Users → List users | Admin (all roles) |
| POST | /api/admin/users | Users → Create user | Admin (all roles) |
| GET | /api/admin/users/[id] | Users → View / edit / delete user | Admin (all roles) |
| PUT | /api/admin/users/[id] | Users → View / edit / delete user | Admin (all roles) |
| DELETE | /api/admin/users/[id] | Users → View / edit / delete user | Admin (all roles) |
| GET | /api/admin/users/[id]/activity | Users → Activity & audit feed | Admin (all roles) |
| POST | /api/admin/users/[id]/reset-password | Users → Send password-reset email | Admin (all roles) |
| POST | /api/admin/users/[id]/send-email | Users → Send template email | Admin (all roles) |
| POST | /api/admin/users/[id]/status | Users → Activate / deactivate / ban / unban | Admin (all roles) |
| GET | /api/admin/posts | Moderation → Posts list & stats | Admin (all roles) |
| GET | /api/admin/posts/stats | Moderation → Posts list & stats | Admin (all roles) |
| GET | /api/admin/posts/[id] | Moderation → Post detail & permanent delete | Admin (all roles) |
| DELETE | /api/admin/posts/[id] | Moderation → Post detail & permanent delete | OWNER (inline) |
| POST | /api/admin/posts/[id]/action | Moderation → Post actions | Admin (all roles) |
| POST | /api/admin/posts/comments/[id]/action | Moderation → Comment actions | Admin (all roles) |
| GET | /api/admin/posts/reports | Moderation → Reports queue | Admin (all roles) |
| POST | /api/admin/posts/reports/[id] | Moderation → Reports queue | Admin (all roles) |
| GET | /api/admin/posts/reports/count | Moderation → Reports queue | Admin (all roles) |
| GET | /api/admin/banned-words | Moderation → Banned words | Admin (all roles) |
| POST | /api/admin/banned-words | Moderation → Banned words | Admin (all roles) |
| DELETE | /api/admin/banned-words/[id] | Moderation → Banned words | Admin (all roles) |
| GET | /api/admin/chat/categories | Chat → Categories | Admin (all roles) |
| POST | /api/admin/chat/categories | Chat → Categories | Admin (all roles) |
| PATCH | /api/admin/chat/categories/[id] | Chat → Categories | Admin (all roles) |
| DELETE | /api/admin/chat/categories/[id] | Chat → Categories | Admin (all roles) |
| GET | /api/admin/chat/rooms | Chat → Rooms | Admin (all roles) |
| POST | /api/admin/chat/rooms | Chat → Rooms | Admin (all roles) |
| GET | /api/admin/chat/rooms/[id] | Chat → Rooms | Admin (all roles) |
| PATCH | /api/admin/chat/rooms/[id] | Chat → Rooms | Admin (all roles) |
| DELETE | /api/admin/chat/rooms/[id] | Chat → Rooms | Admin (all roles) |
| GET | /api/admin/chat/rooms/[id]/members | Chat → Members | Admin (all roles) |
| PATCH | /api/admin/chat/rooms/[id]/members/[memberId] | Chat → Members | Admin (all roles) |
| DELETE | /api/admin/chat/rooms/[id]/members/[memberId] | Chat → Members | Admin (all roles) |
| GET | /api/admin/chat/rooms/[id]/messages | Chat → Message moderation | Admin (all roles) |
| PATCH | /api/admin/chat/rooms/[id]/messages/[messageId] | Chat → Message moderation | Admin (all roles) |
| DELETE | /api/admin/chat/rooms/[id]/messages/[messageId] | Chat → Message moderation | Admin (all roles) |
| GET | /api/admin/live | Live → Broadcast moderation | Admin (all roles) |
| POST | /api/admin/live/[id]/end | Live → Broadcast moderation | Admin (all roles) |
| POST | /api/admin/live/owner/[userId] | Live → Broadcast moderation | Admin (all roles) |
| GET | /api/admin/notifications | Notifications → Admin bell | Admin (all roles) |
| POST | /api/admin/notifications/read | Notifications → Admin bell | Admin (all roles) |
| GET | /api/admin/notifications/stream | Notifications → Admin bell (SSE) | Admin (all roles) |
| GET | /api/admin/settings/general | Settings → General | Admin (all roles) |
| PUT | /api/admin/settings/general | Settings → General | Admin (all roles) |
| GET | /api/admin/settings/email | Settings → Email delivery | Admin (all roles) |
| PUT | /api/admin/settings/email | Settings → Email delivery | Admin (all roles) |
| GET | /api/admin/email-templates | Settings → Email templates | Admin (all roles) |
| POST | /api/admin/email-templates | Settings → Email templates | Admin (all roles) |
| GET | /api/admin/email-templates/[id] | Settings → Email templates | Admin (all roles) |
| PUT | /api/admin/email-templates/[id] | Settings → Email templates | Admin (all roles) |
| DELETE | /api/admin/email-templates/[id] | Settings → Email templates | Admin (all roles) |
| POST | /api/admin/email-templates/[id]/test | Settings → Email templates | Admin (all roles) |
| GET | /api/admin/settings/storage | Settings → Storage | Admin (all roles) |
| PUT | /api/admin/settings/storage | Settings → Storage | Admin (all roles) |
| GET | /api/admin/settings/cache | Settings → Cache | Admin (all roles) |
| PUT | /api/admin/settings/cache | Settings → Cache | Admin (all roles) |
| DELETE | /api/admin/settings/cache | Settings → Cache | Admin (all roles) |
| GET | /api/admin/settings/stream | Settings → Streaming server | Admin (all roles) |
| PUT | /api/admin/settings/stream | Settings → Streaming server | OWNER, ADMIN (inline: MODERATOR → 403) |
| POST | /api/admin/settings/stream | Settings → Streaming server | Admin (all roles) |
| GET | /api/admin/payments/settings | Money → Payment & payout settings | Money-admin (OWNER, ADMIN) |
| PUT | /api/admin/payments/settings | Money → Payment & payout settings | OWNER (money-admin "owner") |
| POST | /api/admin/payments/test | Money → Payment & payout settings | OWNER (money-admin "owner") |
| GET | /api/admin/payouts | Money → Payout queue | Money-admin (OWNER, ADMIN) |
| GET | /api/admin/payouts/[id] | Money → Payout queue | Money-admin (OWNER, ADMIN) |
| PUT | /api/admin/payouts/[id] | Money → Payout queue | Money-admin (OWNER, ADMIN) |
| GET | /api/admin/donations | Money → Donations ledger | Money-admin (OWNER, ADMIN) |
| GET | /api/admin/ffmpeg | Media → ffmpeg management | Admin (all roles) |
| DELETE | /api/admin/ffmpeg | Media → ffmpeg management | OWNER (inline) |
| POST | /api/admin/ffmpeg/install | Media → ffmpeg management | OWNER (inline) |
| POST | /api/admin/upload | Media → Admin image upload | Admin (all roles) |
| POST | /api/admin/upload/video | Media → Admin video upload | Admin (all roles) |
| GET | /api/admin/upload/video | Media → Admin video upload | Admin (all roles) |
| GET | /api/admin/upload/video/[id] | Media → Admin video upload | Admin (all roles) |
| DELETE | /api/admin/upload/video/[id] | Media → Admin video upload | Admin (all roles) |
| GET | /api/admin/translations/locales | Translations → Languages & Google key | Admin (all roles) |
| POST | /api/admin/translations/locales | Translations → Languages & Google key | Admin (all roles) |
| GET | /api/admin/translations/strings | Translations → String catalogue | Admin (all roles) |
| POST | /api/admin/translations/strings | Translations → String catalogue | Admin (all roles) |
| POST | /api/admin/translations/translate | Translations → Machine translate | Admin (all roles) |
| POST | /api/admin/translations/extract | Translations → Extract strings | Admin (all roles); `prune:true` → OWNER, ADMIN |
| GET | /api/admin/translations/content | Translations → Content translation health | Admin (all roles) |

---

## Admin Auth → Login
- **Description:** Admins sign in with email and password. On success the server sets the `wwc-admin-session` cookie. Admin accounts live in a separate `AdminUser` table and never mix with member accounts.
- **Who can use it:** Anyone (public). Only an active `AdminUser` can actually log in.
- **Source files:** `src/app/api/admin/auth/login/route.ts`, `src/lib/admin-auth.ts` (`setAdminCookie`), `src/lib/session.ts`, `src/lib/password.ts`, `src/app/admin/login/page.tsx`, `src/app/admin/login/login-form.tsx`, `src/middleware.ts`
- **User flow:**
  1. The admin opens `/admin/login`. Middleware sends unauthenticated `/admin/*` visits here with `?next=<path>`.
  2. They enter email and password, then submit.
  3. Success: 200 `{ ok: true }`, the cookie is set and `lastLoginAt` is updated (best-effort). The web form then calls `router.replace(next)`.
  4. Failure: a missing field gives 400. A wrong password, unknown email or deactivated account all give 401 with the same generic message. A dummy bcrypt compare runs on unknown emails so response timing doesn't reveal which emails exist.
- **Suggested mobile screen(s):** `AdminLogin`: email field, password field (secure, show/hide), "Sign in" button, inline error banner.
- **API(s):**
  - `POST /api/admin/auth/login`
  - Auth required: no
  - Request — body (JSON):
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | email | string | yes | trimmed, lower-cased; non-empty | – | `owner@example.org` |
    | password | string | yes | non-empty | – | `correct horse battery` |
  - Response (success): `Set-Cookie: wwc-admin-session=…; HttpOnly; SameSite=Lax; Max-Age=2592000`
    ```ts
    interface AdminLoginResponse { ok: true }
    ```
    ```json
    { "ok": true }
    ```
  - Errors: 400 — `Invalid JSON` — body is not JSON · 400 — `Email and password are required` · 401 — `Invalid email or password` — unknown email, inactive admin, or wrong password
- **Form fields:**
  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | Email | email | yes | non-empty | – |
  | Password | password | yes | non-empty | – |
- **Business rules:** The session lasts 30 days, with no refresh. Successful logins update `lastLoginAt`. Logins are not audit-logged.
- **Edge cases / notes for the mobile app:** Login returns no token and no profile; the app must persist the cookie. ⚠️ There is no rate limit or lockout. ⚠️ No endpoint tells you the admin's role after login (see "Current admin / role").
- **Status:** ✅ Complete

## Admin Auth → Logout
- **Description:** Clears the admin cookie.
- **Who can use it:** Anyone. No auth check is done.
- **Source files:** `src/app/api/admin/auth/logout/route.ts`, `src/lib/admin-auth.ts` (`clearAdminCookie`), `src/components/admin/topbar.tsx`
- **User flow:** 1. The admin taps "Sign out". 2. `POST` → 200 `{ ok: true }` and the cookie is cleared (Max-Age 0). 3. The client navigates to `/admin/login`. It is POST-only so that a hostile `<img>` cannot log an admin out.
- **Suggested mobile screen(s):** "Sign out" item in the admin drawer or profile menu.
- **API(s):**
  - `POST /api/admin/auth/logout`
  - Auth required: no
  - Request: no body
  - Response (success):
    ```ts
    interface AdminLogoutResponse { ok: true }
    ```
    ```json
    { "ok": true }
    ```
  - Errors: none
- **Form fields:** none
- **Business rules:** Tokens are stateless, so logout only removes the cookie from that client. A copied token stays valid until it expires or the admin is deactivated.
- **Edge cases / notes for the mobile app:** Clear the cookie jar locally as well.
- **Status:** ✅ Complete

## Admin Auth → Current admin / role
- **Description:** The web admin reads the signed-in admin's `{ id, email, displayName, role }` on the server with `getCurrentAdmin()`. The UI uses it to hide owner-only controls (e.g. settings/payments `canEdit={admin.role==="OWNER"}`, ffmpeg `canInstall`).
- **Who can use it:** n/a (server-side only)
- **Source files:** `src/lib/admin-auth.ts` (`getCurrentAdmin`, `AdminSession`), `src/app/admin/(dashboard)/layout.tsx`, `src/app/admin/(dashboard)/settings/payments/page.tsx`, `settings/payouts/page.tsx`, `settings/ffmpeg/page.tsx`
- **User flow:** none via API.
- **Suggested mobile screen(s):** The admin drawer header (name and role badge) would need this data.
- **API(s):** none. ⚠️ No `GET /api/admin/auth/me` exists.
  ```ts
  // Shape that WOULD be returned (server-side type today)
  interface AdminSession { id: string; email: string; displayName: string; role: "OWNER" | "ADMIN" | "MODERATOR" }
  ```
- **Form fields:** none
- **Business rules:** Roles are OWNER > ADMIN > MODERATOR. Role gates for each endpoint are listed in the module table.
- **Edge cases / notes for the mobile app:** Until a `/me` endpoint exists, a workaround is to call `GET /api/admin/admins?q=<own email>` after login (allowed for every role) and read your own row's `role`. A 401 on any admin call means signed out or deactivated.
- **Status:** ⚠️ Web-only (no API)

## Admin → Dashboard overview
- **Description:** The landing page `/admin` shows live counters and recent lists. It is a Server Component that queries Prisma directly:
  - users total, last 7 days vs. previous 7 days, unverified for more than 3 days
  - active admins
  - published posts, posts today, published comments
  - open reports, reports resolved in the last 7 days
  - active countries and states
  - 5 recent signups, 5 recent posts, 5 recent reports
- **Who can use it:** Any admin (OWNER, ADMIN, MODERATOR).
- **Source files:** `src/app/admin/(dashboard)/page.tsx`
- **User flow:** The admin lands on `/admin`, sees the stat cards and recent lists, and taps through to Users, Posts or Reports.
- **Suggested mobile screen(s):** `AdminDashboard`: stat tiles (users, new this week with trend, posts, comments, open reports), "Recent signups", "Recent posts", "Recent reports" lists, plus the notification bell and reports badge.
- **API(s):** none dedicated. A partial substitute is `GET /api/admin/posts/stats` together with `GET /api/admin/posts/reports/count` (see Moderation), and `GET /api/admin/users?perPage=5` for recent signups.
- **Form fields:** none
- **Business rules:** "Unverified" means `emailVerifiedAt = null` and `createdAt` more than 3 days ago.
- **Edge cases / notes for the mobile app:** The user-growth and geography counters have no API.
- **Status:** ⚠️ Web-only (no API)

## Team → List admins
- **Description:** A paginated list of admin accounts with search, role and status filters.
- **Who can use it:** OWNER, ADMIN, MODERATOR (`requireAdmin`).
- **Source files:** `src/app/api/admin/admins/route.ts` (GET), `src/lib/admins-admin.ts` (`listAdmins`), `src/app/admin/(dashboard)/admins/page.tsx`
- **User flow:** 1. Open Team. 2. Search or filter. 3. Tap a row to open the admin's detail. An empty result shows an empty state.
- **Suggested mobile screen(s):** `AdminTeamList`: search bar, role chips (All/Owner/Admin/Moderator), status chips (All/Active/Inactive), list rows (name, email, role badge, active dot, last login), "Invite" FAB (owner only), paging.
- **API(s):**
  - `GET /api/admin/admins`
  - Auth required: yes — any admin role
  - Request — query:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | q | string | no | substring on email or displayName | "" | `sam` |
    | status | `all`\|`active`\|`inactive` | no | other values → all | all | `active` |
    | role | `all`\|`OWNER`\|`ADMIN`\|`MODERATOR` | no | other values → all | all | `MODERATOR` |
    | page | int | no | ≥1 | 1 | `1` |
    | perPage | int | no | clamped 5..100 | 25 | `25` |
  - Response (success):
    ```ts
    interface AdminTeamMember { id: string; email: string; displayName: string; role: "OWNER"|"ADMIN"|"MODERATOR"; isActive: boolean; lastLoginAt: string|null; createdAt: string; updatedAt: string }
    interface AdminTeamListResponse { items: AdminTeamMember[]; total: number; page: number; perPage: number; totalPages: number }
    ```
    ```json
    { "items": [{ "id": "clx1owner", "email": "owner@example.org", "displayName": "Priya Owner", "role": "OWNER", "isActive": true, "lastLoginAt": "2026-11-20T09:12:00.000Z", "createdAt": "2025-01-02T10:00:00.000Z", "updatedAt": "2026-11-20T09:12:00.000Z" }], "total": 1, "page": 1, "perPage": 25, "totalPages": 1 }
    ```
  - Errors: 401 — `Unauthorized`
- **Form fields:** search box, filter chips.
- **Business rules:** Sorted by role ascending (OWNER, ADMIN, MODERATOR), then displayName A→Z.
- **Edge cases / notes for the mobile app:** Page-based pagination; `totalPages` is at least 1.
- **Status:** ✅ Complete

## Team → Invite admin
- **Description:** An owner creates a new admin account. The plaintext password (supplied or generated) is returned **once** so it can be shared out of band. No email is sent.
- **Who can use it:** OWNER only (`requireAdmin` + `requireOwner`).
- **Source files:** `src/app/api/admin/admins/route.ts` (POST), `src/lib/admins-admin.ts` (`createAdmin`, `suggestPassword`), `src/app/admin/(dashboard)/admins/page.tsx`
- **User flow:**
  1. Tap "Invite".
  2. Enter email, display name and role, and optionally a password.
  3. Success: 201. Show `initialPassword` with a copy button and warn that it is shown only once.
  4. Failure: 400 for validation errors or a duplicate email; 403 if not an owner.
- **Suggested mobile screen(s):** `AdminInviteSheet`: email, display name, role picker, optional password with a "generate" toggle; a result dialog showing the one-time password and Copy.
- **API(s):**
  - `POST /api/admin/admins`
  - Auth required: yes — OWNER
  - Request — body:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | email | string | yes | trimmed, lower-cased, `^[^\s@]+@[^\s@]+\.[^\s@]+$`, unique | – | `mod@example.org` |
    | displayName | string | yes | trimmed, 2–60 chars | – | `Sam Moderator` |
    | password | string | no | ≥8 chars if given; blank → generated 16-char password | generated | `TempPass123` |
    | role | `OWNER`\|`ADMIN`\|`MODERATOR` | no | invalid → ADMIN | `ADMIN` | `MODERATOR` |
  - Response (success, 201):
    ```ts
    interface AdminTeamCreateResponse { item: AdminTeamMember; initialPassword: string }
    ```
    ```json
    { "item": { "id": "clx2mod", "email": "mod@example.org", "displayName": "Sam Moderator", "role": "MODERATOR", "isActive": true, "lastLoginAt": null, "createdAt": "2026-11-25T12:00:00.000Z", "updatedAt": "2026-11-25T12:00:00.000Z" }, "initialPassword": "q7Kx-9mZpTr2bWcE" }
    ```
  - Errors: 401 — `Unauthorized` · 403 — `Only an owner can manage admin accounts.` · 400 — `Valid email required.` · 400 — `Display name must be 2–60 characters.` · 400 — `Password must be at least 8 characters.` · 400 — `An admin with that email already exists.`
- **Form fields:**
  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | Email | email | yes | valid email, unique | – |
  | Display name | text | yes | 2–60 chars | – |
  | Role | select | no | – | OWNER, ADMIN, MODERATOR |
  | Password | password | no | ≥8 | – |
- **Business rules:** The password is hashed and never stored in plain text. Generated passwords are 12 random bytes base64url-encoded, with `I l 0 1 O` replaced by `x`. Audit log: `USER_CREATED` with meta `{kind:"admin", adminTargetId, email, role}`.
- **Edge cases / notes for the mobile app:** Never cache `initialPassword`.
- **Status:** ✅ Complete

## Team → View / edit admin
- **Description:** Read one admin and edit name, email or role.
- **Who can use it:** GET: any admin role. PUT: any admin may edit **their own** displayName and email. Editing another admin, or sending `role` at all (even for yourself), requires OWNER.
- **Source files:** `src/app/api/admin/admins/[id]/route.ts` (GET, PUT), `src/lib/admins-admin.ts` (`getAdmin`, `updateAdmin`), `src/app/admin/(dashboard)/admins/[id]/page.tsx`
- **User flow:** 1. Open an admin. 2. Edit fields and save. 3. Success returns the updated item. Failure gives 403 (not owner), 400 (last-owner guard, duplicate email) or 404 on GET.
- **Suggested mobile screen(s):** `AdminTeamDetail`: header (name, role badge, active state, last login, created), edit form (name, email, role picker for owners), action buttons (Reset password, Activate/Deactivate, Delete — owner only).
- **API(s):**
  - `GET /api/admin/admins/[id]`
  - Auth required: yes — any admin role
  - Request — path: `id` (string, admin id)
  - Response: `{ item: AdminTeamMember }`
    ```json
    { "item": { "id": "clx2mod", "email": "mod@example.org", "displayName": "Sam Moderator", "role": "MODERATOR", "isActive": true, "lastLoginAt": null, "createdAt": "2026-11-25T12:00:00.000Z", "updatedAt": "2026-11-25T12:00:00.000Z" } }
    ```
  - Errors: 401 — `Unauthorized` · 404 — `Not found`
  - `PUT /api/admin/admins/[id]`
  - Auth required: yes — self (no `role` field): any role; otherwise OWNER
  - Request — body:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | displayName | string | no | trimmed (no length check here) | – | `Sam M.` |
    | email | string | no | trimmed, lower-cased (no format check here) | – | `sam@example.org` |
    | role | `OWNER`\|`ADMIN`\|`MODERATOR` | no | invalid value is ignored, but its presence still triggers the owner check | – | `ADMIN` |
  - Response: `{ item: AdminTeamMember }`. If nothing changed, the current row is returned and no log entry is written.
  - Errors: 401 · 403 — `Only an owner can manage admin accounts.` · 400 — `Admin not found` · 400 — `Can't demote the last active owner. Promote someone else first.` · 400 — Prisma unique error message on a duplicate email
- **Form fields:**
  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | Display name | text | no | – | – |
  | Email | email | no | – | – |
  | Role | select | no | owner only | OWNER, ADMIN, MODERATOR |
- **Business rules:** At least one active OWNER must always remain. Audit log: `USER_UPDATED` with a `diff` of from/to values.
- **Edge cases / notes for the mobile app:** Hide the role picker for non-owners. Show the API error text verbatim.
- **Status:** ✅ Complete

## Team → Delete admin
- **Description:** Permanently deletes an admin account.
- **Who can use it:** OWNER only.
- **Source files:** `src/app/api/admin/admins/[id]/route.ts` (DELETE), `src/lib/admins-admin.ts` (`deleteAdmin`)
- **User flow:** 1. Tap "Delete" and confirm, optionally with a reason. 2. 200 `{ok:true}` → go back to the list. 3. Self-delete or deleting the last owner → 400.
- **Suggested mobile screen(s):** A destructive confirm dialog on `AdminTeamDetail` with an optional reason field.
- **API(s):**
  - `DELETE /api/admin/admins/[id]`
  - Auth required: yes — OWNER
  - Request — path `id`; JSON body (optional):
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | reason | string | no | stored in the audit log | – | `Left the team` |
  - Response: `{ "ok": true }` (also returned when the id doesn't exist; that delete is a silent no-op)
  - Errors: 401 · 403 — `Only an owner can manage admin accounts.` · 400 — `You can't delete your own account.` · 400 — `Can't delete the last active owner. Promote someone else first.`
- **Form fields:** Reason (text, optional).
- **Business rules:** Audit log: `USER_DELETED` with meta `{kind:"admin", adminTargetId, email, displayName, role}`. The admin's notifications cascade-delete with the account.
- **Edge cases / notes for the mobile app:** The DELETE carries a JSON body; make sure the HTTP client sends bodies on DELETE.
- **Status:** ✅ Complete

## Team → Reset admin password
- **Description:** An owner sets or generates a new password for any admin, including themselves. The new password is returned once.
- **Who can use it:** OWNER only.
- **Source files:** `src/app/api/admin/admins/[id]/reset-password/route.ts`, `src/lib/admins-admin.ts` (`resetAdminPassword`, `suggestPassword`)
- **User flow:** 1. Tap "Reset password". 2. Optionally type a password. 3. Show the returned `newPassword` once with Copy.
- **Suggested mobile screen(s):** A dialog with an optional password field and a result view with Copy.
- **API(s):**
  - `POST /api/admin/admins/[id]/reset-password`
  - Auth required: yes — OWNER
  - Request — body:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | password | string | no | trimmed; ≥8 chars; blank → generated | generated | `N3wPassw0rd!` |
  - Response:
    ```ts
    interface AdminTeamResetPasswordResponse { ok: true; newPassword: string }
    ```
    ```json
    { "ok": true, "newPassword": "Zr4x-pQ8wmKt2vHb" }
    ```
  - Errors: 401 · 403 — `Only an owner can manage admin accounts.` · 400 — `Password must be at least 8 characters.` · 400 — Prisma error (unknown id)
- **Form fields:** New password (password, optional, ≥8).
- **Business rules:** No email is sent. Audit log: `USER_PASSWORD_RESET_SENT` with meta `{kind:"admin", adminTargetId, via:"admin-set"}`. ⚠️ Existing sessions of the target admin are NOT revoked.
- **Edge cases / notes for the mobile app:** Non-owners have no way to change their own password (gap).
- **Status:** ✅ Complete

## Team → Activate / deactivate admin
- **Description:** Turns an admin account on or off. A deactivated admin is signed out on their next request, because `getCurrentAdmin` checks `isActive`.
- **Who can use it:** OWNER only.
- **Source files:** `src/app/api/admin/admins/[id]/status/route.ts`, `src/lib/admins-admin.ts` (`setActive`)
- **User flow:** 1. Tap Deactivate or Activate, optionally with a reason. 2. The updated item is returned. 3. Self-deactivation or deactivating the last owner → 400.
- **Suggested mobile screen(s):** A toggle on `AdminTeamDetail` with a confirm dialog and reason field.
- **API(s):**
  - `POST /api/admin/admins/[id]/status`
  - Auth required: yes — OWNER
  - Request — body:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | action | `activate`\|`deactivate` | yes | other values → 400 | – | `deactivate` |
    | reason | string | no | trimmed; audit only | – | `On leave` |
  - Response: `{ item: AdminTeamMember }`
  - Errors: 401 · 403 · 400 — `Unknown action` · 400 — `You can't deactivate your own account.` · 400 — `Can't deactivate the last active owner. Promote someone else first.`
- **Form fields:** Reason (text, optional).
- **Business rules:** Audit log: `USER_ACTIVATED` / `USER_DEACTIVATED` with meta `{kind:"admin", adminTargetId}`. Inactive admins don't receive new notification fan-outs (`createForAllAdmins` only targets `isActive`).
- **Edge cases / notes for the mobile app:** —
- **Status:** ✅ Complete

## Users → List users
- **Description:** A paginated list of member accounts with search, status filter and sorting.
- **Who can use it:** OWNER, ADMIN, MODERATOR.
- **Source files:** `src/app/api/admin/users/route.ts` (GET), `src/lib/users-admin.ts` (`listUsersAdmin`, `AdminUserDto`), `src/app/admin/(dashboard)/users/page.tsx`
- **User flow:** 1. Open Users. 2. Search, filter or sort. 3. Tap a row to open user detail.
- **Suggested mobile screen(s):** `AdminUsersList`: search bar, status chips (All, Active, Inactive, Banned, Unverified), a sort menu, rows (avatar, name, email, status badges: banned/inactive/unverified, last login), "Create user" FAB.
- **API(s):**
  - `GET /api/admin/users`
  - Auth required: yes — any admin role
  - Request — query:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | q | string | no | substring of email or displayName | "" | `maria` |
    | status | `all`\|`active`\|`inactive`\|`banned`\|`unverified` | no | other values → all | all | `banned` |
    | sort | `created_desc`\|`created_asc`\|`last_login`\|`name` | no | other values → created_desc | created_desc | `last_login` |
    | page | int | no | ≥1 | 1 | `2` |
    | perPage | int | no | 5..100 | 25 | `50` |
  - Response (success):
    ```ts
    interface AdminUser { id: string; email: string; displayName: string; avatarUrl: string|null; anonymousByDefault: boolean; isActive: boolean; bannedAt: string|null; banReason: string|null; emailVerifiedAt: string|null; lastLoginAt: string|null; createdAt: string; updatedAt: string; activityCount: number }
    interface AdminUserListResponse { items: AdminUser[]; total: number; page: number; perPage: number; totalPages: number }
    ```
    ```json
    { "items": [{ "id": "cluser01", "email": "maria@example.com", "displayName": "Maria", "avatarUrl": "/uploads/avatars/m1.webp", "anonymousByDefault": false, "isActive": true, "bannedAt": null, "banReason": null, "emailVerifiedAt": "2026-10-01T08:00:00.000Z", "lastLoginAt": "2026-11-24T18:30:00.000Z", "createdAt": "2026-10-01T07:55:00.000Z", "updatedAt": "2026-11-24T18:30:00.000Z", "activityCount": 14 }], "total": 1, "page": 1, "perPage": 25, "totalPages": 1 }
    ```
  - Errors: 401 — `Unauthorized`
- **Form fields:** search box, chips, sort menu.
- **Business rules:** Filters:
  - `active` = isActive and not banned
  - `inactive` = isActive=false (this includes banned users)
  - `banned` = bannedAt set
  - `unverified` = emailVerifiedAt null

  The `last_login` sort is descending.
- **Edge cases / notes for the mobile app:** Page-based pagination. Users who have never logged in have a null `lastLoginAt`.
- **Status:** ✅ Complete

## Users → Create user
- **Description:** An admin creates a member account directly, optionally pre-verified.
- **Who can use it:** OWNER, ADMIN, MODERATOR.
- **Source files:** `src/app/api/admin/users/route.ts` (POST), `src/lib/users-admin.ts` (`createUserAdmin`)
- **User flow:** 1. Tap "Create user". 2. Fill in email, name, password and the "email verified" toggle. 3. 201 → open the new user. 4. 400 on validation errors or a duplicate email.
- **Suggested mobile screen(s):** `AdminUserCreateSheet`: email, display name, password, "Mark email as verified" switch.
- **API(s):**
  - `POST /api/admin/users`
  - Auth required: yes — any admin role
  - Request — body:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | email | string | yes | trimmed, lower-cased, email regex, unique | – | `newmember@example.com` |
    | displayName | string | yes | trimmed, 2–40 chars | – | `New Member` |
    | password | string | yes | ≥8 chars | – | `Welcome2026` |
    | emailVerified | boolean | no | `true` → emailVerifiedAt=now | false | `true` |
  - Response (201): `{ item: AdminUser }`
  - Errors: 401 · 400 — `Valid email required.` · 400 — `Display name must be 2–40 characters.` · 400 — `Password must be at least 8 characters.` · 400 — `A user with that email already exists`
- **Form fields:**
  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | Email | email | yes | valid, unique | – |
  | Display name | text | yes | 2–40 | – |
  | Password | password | yes | ≥8 | – |
  | Email verified | switch | no | – | true/false |
- **Business rules:**
  - No welcome email is sent.
  - Audit log: `USER_CREATED` with meta `{email, displayName}`.
  - The member's activity feed gets `SIGNED_UP` "Account created by an admin."
  - The `USER_SIGNED_UP` admin notification is NOT fired; it only fires from the public signup route.
- **Edge cases / notes for the mobile app:** If unverified, the member must confirm their email before most `/api/*` calls will work.
- **Status:** ✅ Complete

## Users → View / edit / delete user
- **Description:** Read one member, edit their basic profile fields, or permanently delete the account.
- **Who can use it:** OWNER, ADMIN, MODERATOR, for all three methods. ⚠️ Hard delete has no role restriction.
- **Source files:** `src/app/api/admin/users/[id]/route.ts`, `src/lib/users-admin.ts` (`getUserAdmin`, `updateUserAdmin`, `deleteUserAdmin`), `src/app/admin/(dashboard)/users/[id]/page.tsx`
- **User flow:**
  1. Open the user.
  2. Edit and save; the response is the updated item.
  3. Delete: confirm with an optional reason → `{ok:true}` → go back to the list.
- **Suggested mobile screen(s):** `AdminUserDetail` with these parts:
  - header: avatar, name, email, status badges, verified state, created and last-login dates, activity count
  - tabs: Profile (edit form), Activity, Admin log
  - action bar: Activate/Deactivate, Ban/Unban, Send reset email, Send email, Block streaming, Delete
- **API(s):**
  - `GET /api/admin/users/[id]`
  - Auth required: yes — any admin role
  - Response: `{ item: AdminUser }`
  - Errors: 401 · 404 — `Not found`
  - `PUT /api/admin/users/[id]`
  - Auth required: yes — any admin role
  - Request — body (partial):
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | displayName | string | no | stored as sent (no length check in this route) | – | `Maria G.` |
    | email | string | no | trimmed and lower-cased; a change clears `emailVerifiedAt`; no format check | – | `maria.g@example.com` |
    | avatarUrl | string \| null | no | any string or null | – | `/uploads/avatars/new.webp` |
    | anonymousByDefault | boolean | no | – | – | `true` |
  - Response: `{ item: AdminUser }` (if nothing changed, the current row comes back and nothing is logged)
  - Errors: 401 · 400 — `User not found` · 400 — Prisma unique error on a duplicate email
  - `DELETE /api/admin/users/[id]`
  - Auth required: yes — any admin role
  - Request — optional body `{ reason?: string }`
  - Response: `{ "ok": true }` (also returned for an unknown id)
  - Errors: 401
- **Form fields:**
  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | Display name | text | no | – | – |
  | Email | email | no | changing it un-verifies the account | – |
  | Avatar | image (via POST /api/admin/upload) | no | – | – |
  | Anonymous by default | switch | no | – | – |
- **Business rules:**
  - Update: audit `USER_UPDATED` (meta = diff). The member's feed gets "Profile updated by an admin."
  - Delete: hard `prisma.user.delete`, so related rows cascade per the schema. Posts keep their author snapshots because authorId is nullable. Audit `USER_DELETED` with `targetUserId: null` and meta `{deletedUserId, email, displayName}`.
- **Edge cases / notes for the mobile app:** Use a strong confirmation for delete (type the email to confirm). Note that a removed avatar URL does not delete the file.
- **Status:** ✅ Complete

## Users → Activate / deactivate / ban / unban
- **Description:** One endpoint for the four moderation state changes on a member.
- **Who can use it:** OWNER, ADMIN, MODERATOR.
- **Source files:** `src/app/api/admin/users/[id]/status/route.ts`, `src/lib/users-admin.ts` (`setActiveAdmin`, `banUserAdmin`, `unbanUserAdmin`), `src/lib/user-auth.ts`
- **User flow:** 1. Choose an action. Ban requires a reason. 2. The updated item is returned and the badges refresh. 3. Missing ban reason or unknown action → 400.
- **Suggested mobile screen(s):** An action sheet on `AdminUserDetail` with a reason field (required for Ban).
- **API(s):**
  - `POST /api/admin/users/[id]/status`
  - Auth required: yes — any admin role
  - Request — body:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | action | `activate`\|`deactivate`\|`ban`\|`unban` | yes | – | – | `ban` |
    | reason | string | ban: yes; others: no | trimmed | – | `Repeated harassment` |
  - Response: `{ item: AdminUser }`
    ```json
    { "item": { "id": "cluser01", "email": "maria@example.com", "displayName": "Maria", "avatarUrl": null, "anonymousByDefault": false, "isActive": false, "bannedAt": "2026-11-25T13:00:00.000Z", "banReason": "Repeated harassment", "emailVerifiedAt": "2026-10-01T08:00:00.000Z", "lastLoginAt": "2026-11-24T18:30:00.000Z", "createdAt": "2026-10-01T07:55:00.000Z", "updatedAt": "2026-11-25T13:00:00.000Z", "activityCount": 15 } }
    ```
  - Errors: 401 · 400 — `Unknown action` · 400 — `A reason is required to ban an account.` · 400 — Prisma error (unknown id)
- **Form fields:** Reason (text; required for ban).
- **Business rules:**
  | Action | Effect | Audit log | Member feed message |
  |---|---|---|---|
  | ban | bannedAt=now, banReason, isActive=false | `USER_BANNED` | "Your account was banned." |
  | unban | clears ban fields, isActive=true | `USER_UNBANNED` | "Your ban was lifted." |
  | activate | isActive=true | `USER_ACTIVATED` | "Your account was reactivated." |
  | deactivate | isActive=false | `USER_DEACTIVATED` | "Your account was deactivated by an admin." |

  `getCurrentUser` returns null for banned or deactivated members, so they are signed out at once. The reason stays admin-side only.
- **Edge cases / notes for the mobile app:** Unban also re-activates the account. `activate` on a banned user sets isActive=true but leaves `bannedAt` set, so the member is still blocked.
- **Status:** ✅ Complete

## Users → Activity & audit feed
- **Description:** Two paginated timelines for a member, selected with `kind`:
  - `user` — the member's own activity: signup, logins, failed logins, password changes, admin actions
  - `admin` — AdminActionLog rows targeting this member, including which admin did it
- **Who can use it:** OWNER, ADMIN, MODERATOR.
- **Source files:** `src/app/api/admin/users/[id]/activity/route.ts`, `src/lib/users-admin.ts` (`getUserActivityAdmin`, `getAdminActionsForUser`), `src/lib/user-activity.ts`, `src/lib/admin-action-log.ts`
- **User flow:** Open the Activity or Admin log tab and page through the entries.
- **Suggested mobile screen(s):** Tabs inside `AdminUserDetail`: a timeline list (icon per type, message, relative time); the admin tab also shows the admin's name and the reason.
- **API(s):**
  - `GET /api/admin/users/[id]/activity`
  - Auth required: yes — any admin role
  - Request — query:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | kind | `user`\|`admin` | no | anything other than `admin` → user | user | `admin` |
    | page | int | no | ≥1 | 1 | `1` |
    | perPage | int | no | 5..100 | 25 | `25` |
  - Response (kind=user):
    ```ts
    interface AdminUserActivity { id: string; type: "SIGNED_UP"|"SIGNED_IN"|"SIGN_IN_FAILED"|"EMAIL_VERIFIED"|"PASSWORD_CHANGED"|"PROFILE_UPDATED"|"ADMIN_ACTION"; message: string; meta: unknown|null; createdAt: string }
    // { items: AdminUserActivity[]; total; page; perPage; totalPages }
    ```
    ```json
    { "items": [{ "id": "act1", "type": "SIGNED_IN", "message": "Signed in", "meta": null, "createdAt": "2026-11-24T18:30:00.000Z" }], "total": 1, "page": 1, "perPage": 25, "totalPages": 1 }
    ```
  - Response (kind=admin):
    ```ts
    interface AdminActionEntry { id: string; action: AdminActionType; reason: string|null; meta: unknown|null; createdAt: string; admin: { id: string; displayName: string; email: string } | null }
    ```
    ```json
    { "items": [{ "id": "log1", "action": "USER_BANNED", "reason": "Repeated harassment", "meta": null, "createdAt": "2026-11-25T13:00:00.000Z", "admin": { "id": "clx1owner", "displayName": "Priya Owner", "email": "owner@example.org" } }], "total": 1, "page": 1, "perPage": 25, "totalPages": 1 }
    ```
  - Errors: 401. An unknown user id returns an empty list.
- **Form fields:** none
- **Business rules:** Newest first. `AdminActionType` values are listed in `admin-core.ts` (USER_*, POST_*, COMMENT_*, REPORT_*, PAYOUT_*, PAYMENT_SETTINGS_UPDATED).
- **Edge cases / notes for the mobile app:** `meta` is free-form JSON; render it as key/value pairs.
- **Status:** ✅ Complete

## Users → Send password-reset email
- **Description:** Emails the member the `password_reset` template.
- **Who can use it:** OWNER, ADMIN, MODERATOR.
- **Source files:** `src/app/api/admin/users/[id]/reset-password/route.ts`, `src/lib/email.ts` (`sendEmail`), `src/lib/app-url.ts`
- **User flow:** 1. Tap "Send reset email". 2. `{ok:true}` → show a toast. 3. Send failure → 400 `{ok:false, error}`.
- **Suggested mobile screen(s):** Action on `AdminUserDetail`, with a confirm step and a toast.
- **API(s):**
  - `POST /api/admin/users/[id]/reset-password`
  - Auth required: yes — any admin role
  - Request: path `id`; no body
  - Response: `{ "ok": true }`
  - Errors: 401 · 404 — `Not found` · 400 — `{ ok:false, error }`, where error is one of `Template not found`, `Template is disabled`, `Email delivery is turned off in settings`, `Email API key is not configured`, `From address is not configured`, or a provider message
- **Form fields:** none
- **Business rules:** Template variables are `name`, `siteName` (setting `general.siteName`, default "WorldWeCare"), `appUrl` and `resetLink`. The attempt is recorded in `email_logs`. Audit `USER_PASSWORD_RESET_SENT` (meta {status, providerId}) is written even when the send fails. The member's feed gets "An admin triggered a password reset email."
- **Edge cases / notes for the mobile app:** ⚠️ `resetLink` is a hard-coded placeholder (`<appUrl>reset/admin-triggered`), not a real reset token. The email's link does not work.
- **Status:** ⚠️ Partial (placeholder reset link; no real token generation)

## Users → Send template email
- **Description:** Sends any email template (by slug) to the member. Default variables are filled in, and the admin can override any of them.
- **Who can use it:** OWNER, ADMIN, MODERATOR.
- **Source files:** `src/app/api/admin/users/[id]/send-email/route.ts`, `src/lib/email.ts`
- **User flow:** 1. Pick a template (from `GET /api/admin/email-templates`). 2. Optionally fill in variables. 3. Send → `{ok:true}`, or 400 with the reason.
- **Suggested mobile screen(s):** `AdminSendEmailSheet`: template picker, key/value variable editor (pre-filled from the template's `variables`), Send button.
- **API(s):**
  - `POST /api/admin/users/[id]/send-email`
  - Auth required: yes — any admin role
  - Request — body:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | templateSlug | string | yes | trimmed, non-empty | – | `welcome` |
    | variables | Record<string,string> | no | merged over the defaults | {} | `{ "name": "Maria" }` |
  - Response: `{ "ok": true }`
  - Errors: 401 · 400 — `templateSlug is required` · 404 — `Not found` (user) · 400 — `{ ok:false, error }` (same send errors as above)
- **Form fields:**
  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | Template | select | yes | – | existing template slugs |
  | Variables | key/value list | no | strings | – |
- **Business rules:** Default variables are:
  - `name`, `email`, `siteName`, `appUrl`
  - `supportEmail` (setting `general.supportEmail`, or `support@<host>`)
  - `confirmLink` = `<appUrl>confirm/admin-triggered` and `resetLink` = `<appUrl>reset/admin-triggered` (⚠️ placeholders)

  `{{var}}` placeholders with no value are left visible in the email. Audit `USER_EMAIL_SENT` (meta {templateSlug, status, providerId}). The member's feed gets `An admin sent you a "<slug>" email.`
- **Edge cases / notes for the mobile app:** Disabled templates fail with `Template is disabled`.
- **Status:** ✅ Complete

## Moderation → Posts list & stats
- **Description:** Browse every community-wall post in any status, with search and filters, plus a set of headline counters.
- **Who can use it:** OWNER, ADMIN, MODERATOR.
- **Source files:** `src/app/api/admin/posts/route.ts`, `src/app/api/admin/posts/stats/route.ts`, `src/lib/posts-admin.ts` (`listPosts`, `getPostStats`, `PostRow`), `src/lib/posts-feed.ts` (`parseVideo`), `src/app/admin/(dashboard)/posts/page.tsx`
- **User flow:**
  1. Open Posts. The stats tiles load first.
  2. Filter (All / Published / Pending / Removed / Reported) or search.
  3. Tap a row to open post detail.
- **Suggested mobile screen(s):** `AdminPostsList`
  - Stats row: total, published, removed, comments, open reports, resolved in the last 7 days.
  - Status chips and a "Featured only" toggle.
  - Search box.
  - Post cards: author, snippet, thumbnail or video poster, status and featured badges, counts.
- **API(s):**
  - `GET /api/admin/posts`
  - Auth required: yes — any admin role
  - Request — query:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | q | string | no | matches body, authorNameSnapshot, or an exact id | "" | `flood` |
    | status | `all`\|`published`\|`pending`\|`removed`\|`reported` | no | `reported` = reportCount>0 | all | `reported` |
    | authorId | string | no | exact | – | `cluser01` |
    | countryId | string | no | exact | – | `clcountryIN` |
    | featured | `1` | no | only `1` turns it on | – | `1` |
    | page / perPage | int | no | 5..100 | 1 / 25 | – |
  - Response:
    ```ts
    interface AdminPost { id: string; authorId: string|null; authorName: string; authorAvatar: string|null; authorEmail: string|null; body: string; images: {url: string; alt?: string|null}[]; video: { assetId: string; url: string; posterUrl: string|null; width: number|null; height: number|null; durationSec: number|null } | null; isAnonymous: boolean; status: "PUBLISHED"|"PENDING"|"REMOVED"|"DRAFT"; isFeatured: boolean; removedReason: string|null; likeCount: number; commentCount: number; saveCount: number; reportCount: number; countryId: string|null; countryName: string|null; createdAt: string; updatedAt: string }
    // { items: AdminPost[]; total; page; perPage; totalPages }
    ```
    ```json
    { "items": [{ "id": "clpost1", "authorId": "cluser01", "authorName": "Maria", "authorAvatar": null, "authorEmail": "maria@example.com", "body": "Volunteers needed at the shelter this weekend.", "images": [{ "url": "/uploads/posts/a1.webp", "alt": null }], "video": null, "isAnonymous": false, "status": "PUBLISHED", "isFeatured": false, "removedReason": null, "likeCount": 12, "commentCount": 3, "saveCount": 1, "reportCount": 0, "countryId": "clcountryIN", "countryName": "India", "createdAt": "2026-11-24T10:00:00.000Z", "updatedAt": "2026-11-24T10:00:00.000Z" }], "total": 1, "page": 1, "perPage": 25, "totalPages": 1 }
    ```
  - Errors: 401
  - `GET /api/admin/posts/stats`
  - Auth required: yes — any admin role
  - Response:
    ```ts
    interface AdminPostStats { postsTotal: number; postsPublished: number; postsRemoved: number; commentsTotal: number; reportsOpen: number; reportsResolvedLast7d: number }
    ```
    ```json
    { "postsTotal": 820, "postsPublished": 790, "postsRemoved": 21, "commentsTotal": 3410, "reportsOpen": 4, "reportsResolvedLast7d": 9 }
    ```
  - Errors: 401
- **Form fields:** search box and filter chips.
- **Business rules:**
  - Results are sorted newest first.
  - Admins see the real author name and email even on anonymous posts. `isAnonymous` tells you to treat that identity carefully.
  - `reportsResolvedLast7d` counts both RESOLVED and DISMISSED reports.
- **Edge cases / notes for the mobile app:**
  - Pagination is page-based.
  - `images` and `video` URLs are relative `/uploads/...` paths, or carry a CDN prefix if `storage.publicBaseUrl` is set.
- **Status:** ✅ Complete

## Moderation → Post detail & permanent delete
- **Description:** A single post with every comment, in any status. Owners can also delete a post permanently, including its media files.
- **Who can use it:**
  - GET: OWNER, ADMIN, MODERATOR.
  - DELETE: **OWNER only** (inline `auth.role !== "OWNER"` check).
- **Source files:** `src/app/api/admin/posts/[id]/route.ts`, `src/lib/posts-admin.ts` (`getPost`, `listComments`, `purgePost`), `src/lib/media.ts` (`deleteMediaByUrls`), `src/lib/video-status.ts` (`discardVideo`), `src/app/admin/(dashboard)/posts/[id]/page.tsx`
- **User flow:**
  1. Open a post to see its full body, media and comments with status badges.
  2. Moderate it (see Post actions and Comment actions).
  3. Owner only: "Delete permanently" → confirm → `{ok, bytesFreed}` → back to the list.
- **Suggested mobile screen(s):** `AdminPostDetail`
  - Post card with image gallery and video player.
  - Badges and counters.
  - Action bar: Remove/Restore, Feature/Unfeature, and Delete permanently (owner only).
  - Comment list, each with Remove/Restore.
- **API(s):**
  - `GET /api/admin/posts/[id]`
  - Auth required: yes — any admin role
  - Response:
    ```ts
    interface AdminPostComment { id: string; postId: string; authorId: string|null; authorName: string; authorAvatar: string|null; body: string; isAnonymous: boolean; status: "PUBLISHED"|"PENDING"|"REMOVED"|"DRAFT"; likeCount: number; reportCount: number; removedReason: string|null; createdAt: string }
    interface AdminPostDetailResponse { item: AdminPost; comments: AdminPostComment[] }
    ```
    ```json
    { "item": { "id": "clpost1", "authorId": "cluser01", "authorName": "Maria", "authorAvatar": null, "authorEmail": "maria@example.com", "body": "Volunteers needed…", "images": [], "video": null, "isAnonymous": false, "status": "PUBLISHED", "isFeatured": true, "removedReason": null, "likeCount": 12, "commentCount": 1, "saveCount": 1, "reportCount": 1, "countryId": null, "countryName": null, "createdAt": "2026-11-24T10:00:00.000Z", "updatedAt": "2026-11-24T10:00:00.000Z" }, "comments": [{ "id": "clcmt1", "postId": "clpost1", "authorId": "cluser02", "authorName": "Leo", "authorAvatar": null, "body": "I can help!", "isAnonymous": false, "status": "PUBLISHED", "likeCount": 2, "reportCount": 0, "removedReason": null, "createdAt": "2026-11-24T11:00:00.000Z" }] }
    ```
  - Errors: 401 · 404 — `Not found`
  - `DELETE /api/admin/posts/[id]`
  - Auth required: yes — OWNER
  - Response:
    ```ts
    interface AdminPostPurgeResponse { ok: true; bytesFreed: number }
    ```
    ```json
    { "ok": true, "bytesFreed": 482113 }
    ```
  - Errors:
    - 401 — not signed in.
    - 403 — `Only an owner can permanently delete a post. Use Remove instead — it can be undone.`
    - 400 — `Post not found`
- **Form fields:** none
- **Business rules:** A purge does all of the following:
  - Deletes the post row (its comments, likes and reports cascade per the schema).
  - Deletes local image files referenced by `images` and by inline body images (`allowAnyOwner`).
  - Discards the attached video asset.
  - Writes an audit entry `POST_REMOVED` with reason "Permanently deleted" and meta `{postId, authorId, filesDeleted, bytesFreed}`.
- **Edge cases / notes for the mobile app:**
  - Comments come back as a flat list sorted oldest first, with no pagination.
  - `bytesFreed` counts image files only. Video bytes are not included.
- **Status:** ✅ Complete

## Moderation → Post actions
- **Description:** Reversible moderation on a post: remove (hide), restore, feature, unfeature.
- **Who can use it:** OWNER, ADMIN, MODERATOR.
- **Source files:** `src/app/api/admin/posts/[id]/action/route.ts`, `src/lib/posts-admin.ts` (`removePost`, `restorePost`, `setPostFeatured`)
- **User flow:**
  1. Tap an action. Remove asks for an optional reason.
  2. Success returns `{ok:true}`; refresh the post.
  3. An unknown post returns 400 `Post not found`.
- **Suggested mobile screen(s):** Action bar on `AdminPostDetail`, plus swipe actions in `AdminPostsList`.
- **API(s):**
  - `POST /api/admin/posts/[id]/action`
  - Auth required: yes — any admin role
  - Request — body:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | action | `remove`\|`restore`\|`feature`\|`unfeature` | yes | – | – | `remove` |
    | reason | string | no | used only by remove; stored as `removedReason` and in the audit log | – | `Spam link` |
  - Response: `{ "ok": true }`
  - Errors: 401 · 400 — `Unknown action` · 400 — `Post not found`
- **Form fields:** Reason (text, optional; Remove only).
- **Business rules:**
  - All actions are idempotent: removing a post that is already REMOVED does nothing.
  - remove → status REMOVED. The author sees a "removed" chip.
  - restore → status PUBLISHED and `removedReason` is cleared.
  - feature → sets `isFeatured` and `featuredAt`.
  - Audit entries: `POST_REMOVED`, `POST_RESTORED`, `POST_FEATURED`, `POST_UNFEATURED` (meta {postId}).
  - The author is not notified.
- **Edge cases / notes for the mobile app:** Restoring a PENDING post publishes it, so this action also works as approval.
- **Status:** ✅ Complete

## Moderation → Comment actions
- **Description:** Remove or restore a single wall comment.
- **Who can use it:** OWNER, ADMIN, MODERATOR.
- **Source files:** `src/app/api/admin/posts/comments/[id]/action/route.ts`, `src/lib/posts-admin.ts` (`removeComment`, `restoreComment`)
- **User flow:** Tap Remove (optionally with a reason) or Restore on a comment → `{ok:true}`.
- **Suggested mobile screen(s):** Per-comment overflow menu in `AdminPostDetail`.
- **API(s):**
  - `POST /api/admin/posts/comments/[id]/action`
  - Auth required: yes — any admin role
  - Request — body:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | action | `remove`\|`restore` | yes | – | – | `remove` |
    | reason | string | no | remove only | – | `Abusive` |
  - Response: `{ "ok": true }`
  - Errors: 401 · 400 — `Unknown action` · 400 — `Comment not found`
- **Form fields:** Reason (optional).
- **Business rules:**
  - Removing decrements the post's `commentCount`; restoring increments it. Both happen in the same transaction as the status change.
  - Both actions are idempotent.
  - Audit entries: `COMMENT_REMOVED` / `COMMENT_RESTORED` (meta {commentId, postId}).
- **Edge cases / notes for the mobile app:** —
- **Status:** ✅ Complete

## Moderation → Reports queue
- **Description:** The queue of member reports against wall posts and comments. An admin closes each report with one of three outcomes. A separate tiny count endpoint drives the sidebar badge.
- **Who can use it:** OWNER, ADMIN, MODERATOR.
- **Source files:** `src/app/api/admin/posts/reports/route.ts`, `src/app/api/admin/posts/reports/[id]/route.ts`, `src/app/api/admin/posts/reports/count/route.ts`, `src/lib/posts-admin.ts` (`listReports`, `resolveReport`), `src/components/admin/reports-count-badge.tsx` (polls every 20s), `src/app/admin/(dashboard)/posts/reports/page.tsx`
- **User flow:**
  1. The badge shows the number of open reports.
  2. Open the queue (default filter: open).
  3. For each report, read the target preview and reason, then choose Remove content, Keep, or Dismiss, with an optional note.
  4. The report moves out of the open list.
  5. If someone else already closed it, the call is a silent no-op and still returns `{ok:true}`.
- **Suggested mobile screen(s):** `AdminReportsQueue`
  - Status chips (Open / Resolved / Dismissed / All) and a reason filter.
  - Cards showing: target type, preview (240 characters max), target author, reporter, reason, notes, time.
  - Three buttons plus a note field. Tapping a card opens the post.
  - A tab-bar badge driven by the count endpoint.
- **API(s):**
  - `GET /api/admin/posts/reports`
  - Auth required: yes — any admin role
  - Request — query:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | status | `all`\|`open`\|`resolved`\|`dismissed` | no | invalid → open | open | `open` |
    | reason | `SPAM`\|`HARASSMENT`\|`HATE_SPEECH`\|`SELF_HARM`\|`ADULT_CONTENT`\|`MISINFORMATION`\|`OFF_TOPIC`\|`OTHER` | no | ⚠️ not validated; an invalid value throws (500) | – | `SPAM` |
    | page / perPage | int | no | 5..100 | 1 / 25 | – |
  - Response:
    ```ts
    interface AdminReport { id: string; targetType: "POST"|"COMMENT"; postId: string; commentId: string|null; reporterId: string|null; reporterName: string|null; reason: AdminReportReason; notes: string|null; status: "OPEN"|"RESOLVED"|"DISMISSED"; resolvedByName: string|null; resolvedAt: string|null; resolution: string|null; createdAt: string; targetPreview: string; targetAuthorName: string }
    // { items: AdminReport[]; total; page; perPage; totalPages }
    ```
    ```json
    { "items": [{ "id": "clrep1", "targetType": "POST", "postId": "clpost9", "commentId": null, "reporterId": "cluser03", "reporterName": "Asha", "reason": "SPAM", "notes": "Same link posted 5 times", "status": "OPEN", "resolvedByName": null, "resolvedAt": null, "resolution": null, "createdAt": "2026-11-25T09:00:00.000Z", "targetPreview": "Buy cheap followers at …", "targetAuthorName": "Spammy" }], "total": 1, "page": 1, "perPage": 25, "totalPages": 1 }
    ```
  - Errors: 401
  - `POST /api/admin/posts/reports/[id]`
  - Auth required: yes — any admin role
  - Request — body:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | outcome | `remove`\|`keep`\|`dismiss` | yes | – | – | `remove` |
    | note | string | no | stored as `resolution`; for remove it is also the removed reason | – | `Confirmed spam` |
  - Response: `{ "ok": true }`
  - Errors: 401 · 400 — `Invalid outcome` · 400 — `Report not found`
  - `GET /api/admin/posts/reports/count`
  - Auth required: yes — any admin role
  - Response (`Cache-Control: no-store`):
    ```ts
    interface AdminReportCountResponse { openCount: number }
    ```
    ```json
    { "openCount": 4 }
    ```
  - Errors: 401
- **Form fields:** Note (text, optional).
- **Business rules:**
  - Sort order: status ascending (OPEN first), then newest.
  - remove → removes the post, or the comment if the report targets one, then marks the report RESOLVED.
  - keep → marks the report RESOLVED.
  - dismiss → marks the report DISMISSED.
  - Every outcome sets `resolvedById`, `resolvedAt` and `resolution`, and clears `openKey` so the same member can report the item again later.
  - Audit entries: `REPORT_RESOLVED` / `REPORT_DISMISSED` (meta {reportId, postId, commentId, outcome}), plus `POST_REMOVED` / `COMMENT_REMOVED` when the outcome is remove.
  - New reports fan out a `POST_REPORTED` admin notification (`src/lib/posts-user.ts:138`).
- **Edge cases / notes for the mobile app:**
  - `SELF_HARM` reports deserve a distinct, high-priority UI.
  - Poll the count endpoint about every 20s, or derive it from the notification stream.
  - Chat-message reports are not in this queue (see Chat → Message moderation).
- **Status:** ✅ Complete

## Moderation → Banned words
- **Description:** A curated word list. Matching words in member-generated text are masked with asterisks when the text is read. The stored text is never changed.
- **Who can use it:** OWNER, ADMIN, MODERATOR.
- **Source files:** `src/app/api/admin/banned-words/route.ts`, `src/app/api/admin/banned-words/[id]/route.ts`, `src/lib/banned-words.ts`, `src/app/admin/(dashboard)/banned-words/page.tsx`
- **User flow:**
  1. Open Banned words.
  2. Paste words separated by commas or new lines, then tap Add. The response says how many were new.
  3. Delete an individual word with the × on its chip.
- **Suggested mobile screen(s):** `AdminBannedWords`: a multiline input with an Add button, then an A→Z chip list where each chip has a delete action, plus a count.
- **API(s):**
  - `GET /api/admin/banned-words`
  - Auth required: yes — any admin role
  - Response:
    ```ts
    interface AdminBannedWordsResponse { words: { id: string; word: string; createdAt: string }[] }
    ```
    ```json
    { "words": [{ "id": "clbw1", "word": "badword", "createdAt": "2026-11-01T00:00:00.000Z" }] }
    ```
  - Errors: 401
  - `POST /api/admin/banned-words`
  - Auth required: yes — any admin role
  - Request — body:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | words | string | one of words/word | split on comma or newline, trimmed, lower-cased, de-duplicated; words longer than 60 chars are dropped | – | `foo, bar\nbaz` |
    | word | string | alt | same | – | `foo` |
  - Response:
    ```ts
    interface AdminBannedWordsAddResponse { ok: true; added: number }
    ```
    ```json
    { "ok": true, "added": 2 }
    ```
  - Errors: 401 · 400 — `Enter a word`
  - `DELETE /api/admin/banned-words/[id]`
  - Auth required: yes — any admin role
  - Response: `{ "ok": true }`
  - Errors: 401 · 400 — Prisma error message (unknown id)
- **Form fields:**
  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | Words | multiline text | yes | each ≤60 chars | – |
- **Business rules:**
  - Matching is case-insensitive and whole-word only (`\b…\b`), so innocent words that merely contain a banned word are not masked.
  - The compiled regex is cached for 60s per server process. Edits clear the local cache; other server instances pick up the change within 60s.
  - Words that are already on the list are silently skipped.
- **Edge cases / notes for the mobile app:** The list is unpaginated. Use client-side search for long lists.
- **Status:** ✅ Complete

## Chat → Categories
- **Description:** Chat room categories: create, rename, reorder, delete.
- **Who can use it:** OWNER, ADMIN, MODERATOR.
- **Source files:**
  - `src/app/api/admin/chat/categories/route.ts`
  - `src/app/api/admin/chat/categories/[id]/route.ts`
  - `src/lib/chat-admin.ts` (`listCategories`, `createCategory`, `updateCategory`, `deleteCategory`)
  - `src/app/admin/(dashboard)/chatrooms/categories/page.tsx`
- **User flow:**
  1. Open Chat → Categories.
  2. Add a name and an optional sort order, then save. You get 201 with the new `id`.
  3. Edit inline (PATCH) or delete. Deleting moves the category's rooms to "uncategorised".
- **Suggested mobile screen(s):** `AdminChatCategories`: a list showing name, slug, room count and sort order. Tap to edit; swipe to delete; "+" to add.
- **API(s):**
  - `GET /api/admin/chat/categories`
  - Auth required: yes — any admin role
  - Response:
    ```ts
    interface AdminChatCategoriesResponse { categories: { id: string; name: string; slug: string; sortOrder: number; roomCount: number }[] }
    ```
    ```json
    { "categories": [{ "id": "clcat1", "name": "Support", "slug": "support", "sortOrder": 0, "roomCount": 3 }] }
    ```
  - Errors: 401
  - `POST /api/admin/chat/categories`
  - Auth required: yes — any admin role
  - Request — body:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | name | string | yes | trimmed, non-empty; slug is generated and kept unique (`-2`, `-3`…) | – | `Support` |
    | sortOrder | number | no | – | 0 | `1` |
  - Response (201): `{ "ok": true, "id": "clcat1" }`
  - Errors: 401 · 400 `Name is required`
  - `PATCH /api/admin/chat/categories/[id]`
  - Auth required: yes — any admin role
  - Request — body: `name?` (string, non-empty; renaming regenerates the slug), `sortOrder?` (number)
  - Response: `{ "ok": true }`
  - Errors: 401 · 400 `Name is required` · 400 (Prisma error message for an unknown id)
  - `DELETE /api/admin/chat/categories/[id]`
  - Auth required: yes — any admin role
  - Response: `{ "ok": true }`
  - Errors: 401 · 400 (Prisma error message)
- **Form fields:**
  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | Name | text | yes | non-empty | – |
  | Sort order | number | no | – | – |
- **Business rules:**
  - Ordering is `sortOrder` ascending, then name.
  - Rooms in a deleted category get `categoryId = null` (onDelete SetNull).
  - Not audited.
- **Edge cases / notes for the mobile app:** Renaming changes the slug, so any deep link that uses the old slug breaks.
- **Status:** ✅ Complete

## Chat → Rooms
- **Description:** Full admin control of chat rooms of every tier: create, edit, archive, delete, list.
- **Who can use it:** OWNER, ADMIN, MODERATOR.
- **Source files:**
  - `src/app/api/admin/chat/rooms/route.ts`
  - `src/app/api/admin/chat/rooms/[id]/route.ts`
  - `src/lib/chat-admin.ts` (`listRooms`, `getRoomAdmin`, `createRoom`, `updateRoom`, `deleteRoom`)
  - `src/app/admin/(dashboard)/chatrooms/page.tsx`
  - `src/app/admin/(dashboard)/chatrooms/[id]/page.tsx`
- **User flow:**
  1. Open Chatrooms and filter by status or tier, or search.
  2. Create a room (name is required). You get the new `id` and `slug`.
  3. Open a room. The detail shows pending-message and pending-member counts.
  4. Edit any field, archive the room (status ARCHIVED), or delete it.
- **Suggested mobile screen(s):**
  - `AdminChatRooms`: filter chips (status, tier), category picker, search, room cards (emoji/colour, name, tier badge, members, messages, featured star).
  - `AdminChatRoomForm`: all the fields listed below.
  - `AdminChatRoomDetail`: tabs for Settings, Members and Messages, with pending badges.
- **API(s):**
  - `GET /api/admin/chat/rooms`
  - Auth required: yes — any admin role
  - Request — query:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | q | string | no | name or description contains | – | `grief` |
    | status | `all`\|`active`\|`archived` | no | – | all | `active` |
    | tier | `all`\|`PUBLIC`\|`SUPPORT`\|`CRISIS`\|`CAVALRY` | no | – | all | `SUPPORT` |
    | categoryId | string | no | exact | – | `clcat1` |
  - Response:
    ```ts
    interface AdminChatRoomListItem { id: string; slug: string; name: string; description: string|null; tier: "PUBLIC"|"SUPPORT"|"CRISIS"|"CAVALRY"; status: "ACTIVE"|"ARCHIVED"; categoryId: string|null; categoryName: string|null; emoji: string|null; color: string|null; allowAnonymous: boolean; isFeatured: boolean; sortOrder: number; memberCount: number; messageCount: number; createdAt: string }
    interface AdminChatRoomListResponse { rooms: AdminChatRoomListItem[] }
    ```
    ```json
    { "rooms": [{ "id": "clroom1", "slug": "grief-support", "name": "Grief support", "description": "A gentle space", "tier": "SUPPORT", "status": "ACTIVE", "categoryId": "clcat1", "categoryName": "Support", "emoji": "🕊️", "color": "#6b8afd", "allowAnonymous": true, "isFeatured": false, "sortOrder": 0, "memberCount": 42, "messageCount": 512, "createdAt": "2026-06-01T00:00:00.000Z" }] }
    ```
  - Errors: 401
  - `POST /api/admin/chat/rooms`
  - Auth required: yes — any admin role
  - Request — body:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | name | string | yes | trimmed, non-empty | – | `Grief support` |
    | slug | string | no | slugified, made unique; falls back to the name | from name | `grief-support` |
    | description | string | no | trimmed; empty → null | null | `A gentle space` |
    | tier | `PUBLIC`\|`SUPPORT`\|`CRISIS`\|`CAVALRY` | no | invalid → PUBLIC | PUBLIC | `SUPPORT` |
    | status | `ACTIVE`\|`ARCHIVED` | no | anything other than ARCHIVED → ACTIVE | ACTIVE | `ACTIVE` |
    | categoryId | string | no | – | null | `clcat1` |
    | countryId | string | no | – | null | `clcountryIN` |
    | emoji | string | no | – | null | `🕊️` |
    | color | string | no | free text (hex expected) | null | `#6b8afd` |
    | allowAnonymous | boolean | no | – | true | `true` |
    | isFeatured | boolean | no | – | false | `false` |
    | sortOrder | number | no | – | 0 | `0` |
    | slowModeSeconds | number | no | – | 0 | `10` |
    | rulesText | string | no | trimmed | null | `Be kind.` |
  - Response (201): `{ "ok": true, "id": "clroom1", "slug": "grief-support" }`
  - Errors: 401 · 400 `Name is required` · 400 (Prisma error message, e.g. a bad categoryId)
  - `GET /api/admin/chat/rooms/[id]`
  - Auth required: yes — any admin role
  - Response:
    ```ts
    interface AdminChatRoomDetail extends AdminChatRoomListItem { countryId: string|null; slowModeSeconds: number; rulesText: string|null; pendingMessages: number; pendingMembers: number }
    // { room: AdminChatRoomDetail }
    ```
    ```json
    { "room": { "id": "clroom1", "slug": "grief-support", "name": "Grief support", "description": "A gentle space", "tier": "SUPPORT", "status": "ACTIVE", "categoryId": "clcat1", "categoryName": "Support", "countryId": null, "emoji": "🕊️", "color": "#6b8afd", "allowAnonymous": true, "isFeatured": false, "sortOrder": 0, "slowModeSeconds": 10, "rulesText": "Be kind.", "memberCount": 42, "messageCount": 512, "pendingMessages": 2, "pendingMembers": 1, "createdAt": "2026-06-01T00:00:00.000Z" } }
    ```
  - Errors: 401 · 404 `Room not found`
  - `PATCH /api/admin/chat/rooms/[id]`
  - Auth required: yes — any admin role
  - Request — body: any subset of the POST fields. `description`, `categoryId`, `countryId`, `emoji`, `color` and `rulesText` accept `null` to clear. `slowModeSeconds` is clamped to ≥ 0.
  - Response: `{ "ok": true }`
  - Errors: 401 · 400 `Name is required` (empty name) · 400 (Prisma error message)
  - `DELETE /api/admin/chat/rooms/[id]`
  - Auth required: yes — any admin role
  - Response: `{ "ok": true }`
  - Errors: 401 · 400 (Prisma error message)
- **Form fields:**
  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | Name | text | yes | non-empty | – |
  | Slug | text | no | slugified | – |
  | Description | multiline | no | – | – |
  | Tier | select | no | – | PUBLIC, SUPPORT, CRISIS, CAVALRY |
  | Status | select | no | – | ACTIVE, ARCHIVED |
  | Category | select | no | – | categories |
  | Country | select | no | – | countries |
  | Emoji | text | no | – | – |
  | Colour | colour | no | – | – |
  | Allow anonymous | switch | no | – | – |
  | Featured | switch | no | – | – |
  | Sort order | number | no | – | – |
  | Slow mode (seconds) | number | no | ≥0 | – |
  | Rules | multiline | no | – | – |
- **Business rules:**
  - The list is sorted by `sortOrder` ascending, then newest.
  - Rooms created here record `createdByAdminId`.
  - Delete is a hard delete; memberships and messages cascade per the schema.
  - Not audited.
- **Edge cases / notes for the mobile app:**
  - The room list has no pagination.
  - ⚠️ Sending `slug` in a PATCH without `name` falls back to the slug itself (or "room").
- **Status:** ✅ Complete

## Chat → Members
- **Description:** View a room's memberships. Approve pending joiners, promote or demote room moderators, ban, toggle first-post approval, or remove a member.
- **Who can use it:** OWNER, ADMIN, MODERATOR.
- **Source files:**
  - `src/app/api/admin/chat/rooms/[id]/members/route.ts`
  - `src/app/api/admin/chat/rooms/[id]/members/[memberId]/route.ts`
  - `src/lib/chat-admin.ts` (`listMembers`, `updateMember`, `removeMember`)
- **User flow:**
  1. Open the Members tab and filter by status.
  2. For a member, choose Approve (status ACTIVE), Ban (with a reason), Make moderator / Make member, toggle "First post approved", or Remove.
- **Suggested mobile screen(s):** `AdminChatRoomDetail` → Members tab: status chips (All, Pending, Active, Banned); rows show avatar, name, role badge and joined date, with an action sheet per row.
- **API(s):**
  - `GET /api/admin/chat/rooms/[id]/members`
  - Auth required: yes — any admin role
  - Request — query: `status` = `all`\|`pending`\|`active`\|`banned` (case-insensitive; default all)
  - Response:
    ```ts
    interface AdminChatMember { id: string; userId: string; userName: string; userAvatar: string|null; role: "MEMBER"|"MODERATOR"; status: "PENDING"|"ACTIVE"|"BANNED"; firstPostApproved: boolean; joinedAt: string }
    // { members: AdminChatMember[] }
    ```
    ```json
    { "members": [{ "id": "clmem1", "userId": "cluser01", "userName": "Maria", "userAvatar": null, "role": "MEMBER", "status": "PENDING", "firstPostApproved": false, "joinedAt": "2026-11-25T08:00:00.000Z" }] }
    ```
  - Errors: 401
  - `PATCH /api/admin/chat/rooms/[id]/members/[memberId]`
  - Auth required: yes — any admin role
  - Request — body:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | role | `MEMBER`\|`MODERATOR` | no | invalid → ignored | – | `MODERATOR` |
    | status | `PENDING`\|`ACTIVE`\|`BANNED` | no | invalid → ignored | – | `BANNED` |
    | approveFirstPost | boolean | no | sets `firstPostApproved` | – | `true` |
    | reason | string | no | stored as `bannedReason` only when status=BANNED; any other status change clears it | – | `Spamming` |
  - Response: `{ "ok": true }`
  - Errors: 401 · 400 (Prisma error message, e.g. an unknown memberId)
  - `DELETE /api/admin/chat/rooms/[id]/members/[memberId]`
  - Auth required: yes — any admin role
  - Response: `{ "ok": true }`
  - Errors: 401 · 400 `Member not found`
- **Form fields:** Ban reason (text, optional).
- **Business rules:**
  - The list is sorted by role ascending (MEMBER before MODERATOR, in enum order), then joinedAt.
  - Removing an ACTIVE member decrements `memberCount`.
  - ⚠️ A PATCH that changes status does **not** adjust `memberCount`.
  - ⚠️ The room `[id]` in the path is not checked against the membership.
  - Not audited, and the member is not notified.
- **Edge cases / notes for the mobile app:** No pagination.
- **Status:** ✅ Complete

## Chat → Message moderation
- **Description:** Review a room's messages: approve pending messages, remove or restore, pin or unpin, or hard-delete.
- **Who can use it:** OWNER, ADMIN, MODERATOR.
- **Source files:**
  - `src/app/api/admin/chat/rooms/[id]/messages/route.ts`
  - `src/app/api/admin/chat/rooms/[id]/messages/[messageId]/route.ts`
  - `src/lib/chat-admin.ts` (`listMessagesAdmin`, `moderateMessage`, `hardDeleteMessage`)
  - `src/lib/chat-user.ts:604` (report fan-out)
- **User flow:**
  1. Open the Messages tab and filter (All, Published, Pending, Removed, Reported).
  2. Act on a message: Approve, Remove (with a reason), Restore, Pin, Unpin, or Delete forever.
- **Suggested mobile screen(s):** `AdminChatRoomDetail` → Messages tab: filter chips; message bubbles showing author (or "Anonymous" plus the real author for admins), body, status, pinned icon and report count, with a long-press action sheet.
- **API(s):**
  - `GET /api/admin/chat/rooms/[id]/messages`
  - Auth required: yes — any admin role
  - Request — query: `status` = `all`\|`published`\|`pending`\|`removed`\|`reported` (default all; `reported` means reportCount > 0)
  - Response:
    ```ts
    interface AdminChatMessage { id: string; authorId: string|null; authorName: string; isAnonymous: boolean; body: string; status: "PUBLISHED"|"PENDING"|"REMOVED"; isPinned: boolean; reportCount: number; removedReason: string|null; createdAt: string }
    // { messages: AdminChatMessage[] }
    ```
    ```json
    { "messages": [{ "id": "clmsg1", "authorId": "cluser01", "authorName": "Maria", "isAnonymous": true, "body": "Thank you all for listening.", "status": "PENDING", "isPinned": false, "reportCount": 0, "removedReason": null, "createdAt": "2026-11-25T08:05:00.000Z" }] }
    ```
  - Errors: 401
  - `PATCH /api/admin/chat/rooms/[id]/messages/[messageId]`
  - Auth required: yes — any admin role
  - Request — body:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | action | `approve`\|`remove`\|`restore`\|`pin`\|`unpin` | yes | – | – | `remove` |
    | reason | string | no | used by remove | – | `Harassment` |
  - Response: `{ "ok": true }`
  - Errors: 401 · 400 `Invalid action` · 400 `Message not found`
  - `DELETE /api/admin/chat/rooms/[id]/messages/[messageId]`
  - Auth required: yes — any admin role
  - Response: `{ "ok": true }`
  - Errors: 401 · 400 `Message not found`
- **Form fields:** Remove reason (optional).
- **Business rules:**
  - The list returns only the **latest 100** messages, newest first.
  - remove: sets status REMOVED and unpins the message. If it was PUBLISHED, `messageCount` is decremented. Every OPEN chat report on the message is closed as RESOLVED, and `openMessageId` is cleared.
  - approve / restore: sets status PUBLISHED and clears `removedReason`. If the message was not already published, `messageCount` is incremented.
  - pin / unpin: toggles `isPinned` only.
  - Hard delete: decrements `messageCount` if the message was published.
  - Not audited.
- **Edge cases / notes for the mobile app:**
  - There is no cursor or "load older" option.
  - There is no cross-room report queue. Reports arrive as `POST_REPORTED` admin notifications with actionUrl `/admin/chatrooms`.
- **Status:** ✅ Complete

## Live → Broadcast moderation
- **Description:** See every live broadcast (live ones first), force-end a stream, and block or unblock a member from going live.
- **Who can use it:** OWNER, ADMIN, MODERATOR.
- **Source files:**
  - `src/app/api/admin/live/route.ts`
  - `src/app/api/admin/live/[id]/end/route.ts`
  - `src/app/api/admin/live/owner/[userId]/route.ts`
  - `src/lib/live-streams.ts` (`listAdminStreams`, `endStream`, `setCanStream`)
  - `src/app/admin/(dashboard)/live/page.tsx`
- **User flow:**
  1. Open Live and filter by status, or search by title or owner.
  2. "End stream", with an optional reason → `{ok}`.
  3. "Block from streaming" sends `allowed:false`. This ends all of the member's IDLE and LIVE streams and returns how many were ended.
  4. "Allow streaming" sends `allowed:true`.
- **Suggested mobile screen(s):** `AdminLiveStreams`: status chips (All, Live, Idle, Ended), search, and cards showing title, owner, category, viewers, peak, started time, recording dot and ended-by/reason. Actions: End, Block/Allow owner, Watch.
- **API(s):**
  - `GET /api/admin/live`
  - Auth required: yes — any admin role
  - Request — query: `status` = `IDLE`\|`LIVE`\|`ENDED` (otherwise all); `q` = title or owner name contains
  - Response:
    ```ts
    interface AdminStream { id: string; slug: string; title: string; summary: string|null; status: "IDLE"|"LIVE"|"ENDED"; visibility: "PUBLIC"|"UNLISTED"; ownerUserId: string|null; ownerName: string; ownerAvatar: string|null; startedAt: string|null; endedAt: string|null; viewerCount: number; viewerPeak: number; isMine: boolean; recording: boolean; category: { id: string; name: string; slug: string; emoji: string|null; color: string|null } | null; countryId: string|null; createdAt: string; endedBy: "OWNER"|"ADMIN"|"LIMIT"|"STALE"|null; endReason: string|null; viewCount: number; path: string; ownerCanStream: boolean }
    // { streams: AdminStream[] }
    ```
    ```json
    { "streams": [{ "id": "clls1", "slug": "k3j9x2", "title": "Beach clean-up live", "summary": null, "status": "LIVE", "visibility": "PUBLIC", "ownerUserId": "cluser01", "ownerName": "Maria", "ownerAvatar": null, "startedAt": "2026-11-25T14:00:00.000Z", "endedAt": null, "viewerCount": 17, "viewerPeak": 25, "isMine": false, "recording": true, "category": { "id": "cllc1", "name": "Community", "slug": "community", "emoji": "🤝", "color": null }, "countryId": null, "createdAt": "2026-11-25T13:55:00.000Z", "endedBy": null, "endReason": null, "viewCount": 140, "path": "live/k3j9x2", "ownerCanStream": true }] }
    ```
  - Errors: 401
  - `POST /api/admin/live/[id]/end`
  - Auth required: yes — any admin role
  - Request — body: `reason?` (string; stored as `endReason`, truncated to 2000 chars)
  - Response: `{ "ok": true }`
  - Errors: 401 · 400 `That stream doesn't exist.`
  - `POST /api/admin/live/owner/[userId]`
  - Auth required: yes — any admin role
  - Request — body:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | allowed | boolean | yes (effectively) | only `true` allows; anything else, including a missing field, BLOCKS | – | `false` |
  - Response:
    ```ts
    interface AdminLiveOwnerResponse { ok: true; ended: number }
    ```
    ```json
    { "ok": true, "ended": 1 }
    ```
  - Errors: 401 · 400 (Prisma error message for an unknown user, or `Couldn't change that.`)
- **Form fields:** End reason (optional).
- **Business rules:**
  - Sort order: status ascending (IDLE, LIVE, ENDED in enum order), then startedAt descending. The list is capped at **50** rows with no paging.
  - Ending a stream is idempotent. It disables recording and kicks the MediaMTX path (if configured), revokes stream grants, then sets ENDED with `endedBy=ADMIN`, `viewerCount=0` and the recording stopped.
  - Blocking sets `User.canStream=false` and ends running streams with the reason "The owner's streaming access was withdrawn."
  - Not audited, and the owner is not notified.
- **Edge cases / notes for the mobile app:** ⚠️ Omitting `allowed` blocks the user, so always send the boolean explicitly.
- **Status:** ✅ Complete

## Notifications → Admin bell
- **Description:** Each admin has a personal inbox of system events (signups, reports, pending submissions). Each admin's read state is tracked separately. The web bell gets live updates over an SSE stream. Each admin's notifications are separate rows, so marking one as read only affects that admin.
- **Who can use it:** OWNER, ADMIN, MODERATOR (each sees only their own rows).
- **Source files:** `src/app/api/admin/notifications/route.ts`, `src/app/api/admin/notifications/read/route.ts`, `src/app/api/admin/notifications/stream/route.ts`, `src/lib/admin-notifications.ts`, `src/components/admin/notifications-bell.tsx`
- **User flow:**
  1. On load, the client opens an SSE connection and immediately gets a `bell` event with the unread count and the latest 20.
  2. Opening the dropdown re-fetches `GET /api/admin/notifications`.
  3. Tapping an item marks it read and opens its `actionUrl`.
  4. "Mark all read" sends `{all:true}`.
- **Suggested mobile screen(s):** `AdminNotificationsSheet`: a bell icon with an unread badge in the admin header, and a list with an icon per type, title, message, relative time and an unread dot. Includes a "Mark all read" button. Tapping an item deep-links to the matching admin screen.
- **API(s):**
  - `GET /api/admin/notifications`
  - Auth required: yes — any admin role
  - Response:
    ```ts
    interface AdminNotification { id: string; type: "USER_SIGNED_UP"|"USER_EMAIL_VERIFIED"|"USER_BANNED"|"USER_DELETED"|"POST_REPORTED"|"POST_REMOVED"|"CONFESSION_PENDING"|"EVENT_PENDING"|"PLACE_PENDING"|"PLACE_REPORTED"|"PETITION_PENDING"|"CAMPAIGN_PENDING"; title: string; message: string|null; actionUrl: string|null; readAt: string|null; createdAt: string }
    interface AdminBellPayload { unread: number; items: AdminNotification[] }
    ```
    ```json
    { "unread": 2, "items": [{ "id": "cln1", "type": "USER_SIGNED_UP", "title": "Maria joined", "message": "maria@example.com", "actionUrl": "/admin/users/cluser01", "readAt": null, "createdAt": "2026-11-25T08:00:00.000Z" }] }
    ```
  - Errors: 401
  - `POST /api/admin/notifications/read`
  - Auth required: yes — any admin role
  - Request — body:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | ids | string[] | one of ids/all | non-string entries dropped; only that admin's unread rows are updated | [] | `["cln1"]` |
    | all | `true` | one of ids/all | marks every unread row as read | – | `true` |
  - Response:
    ```ts
    interface AdminNotificationsReadResponse { updated: number }
    ```
    ```json
    { "updated": 1 }
    ```
  - Errors: 401
  - `GET /api/admin/notifications/stream`
  - Auth required: yes — any admin role (cookie; EventSource sends cookies on the same origin)
  - Response: `Content-Type: text/event-stream`. Events:
    ```
    event: bell
    data: {"unread":2,"items":[ …AdminNotification… ]}

    : keep-alive
    ```
    The server checks every 5s and pushes a `bell` event only when the unread count or the newest id changes. A `: keep-alive` comment is sent after 20s with no `bell` event. The stream closes when the client disconnects.
  - Errors: 401 (plain JSON, before the stream starts)
- **Form fields:** none
- **Business rules:**
  - Only the latest 20 items are returned (no paging).
  - Rows are created only for admins that are active at the moment of the event.
  - Current triggers:
    - signup — `USER_SIGNED_UP`
    - post or comment report and chat message report — `POST_REPORTED`
    - campaign, event, petition and place pending — `*_PENDING`
    - place report — `PLACE_REPORTED`

    See the module JSON for source lines. `USER_EMAIL_VERIFIED`, `USER_BANNED`, `USER_DELETED`, `POST_REMOVED` and `CONFESSION_PENDING` exist in the enum but are never emitted.
- **Edge cases / notes for the mobile app:**
  - `actionUrl` values are web admin paths (e.g. `/admin/users/<id>`, `/admin/events?status=PENDING`). Map them to native screens.
  - On mobile, either use an SSE client library with a cookie header or poll `GET /api/admin/notifications` instead.
  - There is no push notification channel for admins.
- **Status:** ✅ Complete

## Settings → General
- **Description:** Site identity settings: name, tagline, description, text logo, SVG logo, logo and favicon URLs, and support email.
- **Who can use it:** OWNER, ADMIN, MODERATOR (GET and PUT).
- **Source files:** `src/app/api/admin/settings/general/route.ts`, `src/lib/settings.ts` (`getGroup`, `setSettings`), `src/app/admin/(dashboard)/settings/general/page.tsx`
- **User flow:**
  1. Open Settings → General; current values load.
  2. Edit fields. Logos and favicon are uploaded through `POST /api/admin/upload` (category `logos` or `favicons`), and the returned URL is put into the field.
  3. Save. The response reports how many keys were saved.
- **Suggested mobile screen(s):** `AdminSettingsGeneral`: a text field for each key, image pickers for logo and favicon, a code field for the SVG logo, and Save.
- **API(s):**
  - `GET /api/admin/settings/general`
  - Auth required: yes — any admin role
  - Response: `{ values: Record<"general.*", unknown> }`
    ```json
    { "values": { "general.siteName": "WorldWeCare", "general.tagline": "Care, together", "general.supportEmail": "help@example.org", "general.logoUrl": "/uploads/logos/abc.webp" } }
    ```
  - `PUT /api/admin/settings/general`
  - Auth required: yes — any admin role
  - Request — body (only these keys are accepted; others are ignored):
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | general.siteName | string | no | ⚠️ any JSON is stored as-is | "WorldWeCare" (read fallback) | `WorldWeCare` |
    | general.tagline | string | no | – | – | `Care, together` |
    | general.description | string | no | – | – | `…` |
    | general.textLogo | string | no | – | – | `WWC` |
    | general.svgLogo | string | no | raw SVG markup | – | `<svg…>` |
    | general.logoUrl | string | no | – | – | `/uploads/logos/abc.webp` |
    | general.faviconUrl | string | no | – | – | `/uploads/favicons/f.ico` |
    | general.supportEmail | string | no | – | – | `help@example.org` |
  - Response: `{ "ok": true, "updated": 3 }` (`updated: 0` when no accepted keys were sent)
  - Errors: 401
- **Form fields:** see the table above (all text).
- **Business rules:**
  - Settings are stored in `platform_settings`, upserted by key; the group is inferred from the key prefix.
  - Writes clear this process's settings cache.
  - Not audited.
- **Edge cases / notes for the mobile app:** Keys contain dots; send them as literal JSON property names.
- **Status:** ✅ Complete

## Settings → Email delivery
- **Description:** Configures the transactional email provider (Resend HTTP API): API key, from and reply-to addresses, and a master on/off switch.
- **Who can use it:** OWNER, ADMIN, MODERATOR (GET and PUT). ⚠️ Moderators can replace the API key.
- **Source files:** `src/app/api/admin/settings/email/route.ts`, `src/lib/email.ts` (`loadConfig`), `src/app/admin/(dashboard)/settings/email/page.tsx`
- **User flow:**
  1. Open the screen. The key is shown masked; `hasKey` tells the UI a key is already set.
  2. Edit fields. Re-enter the key only to replace it.
  3. Save. To verify, use the "Send test" action on any template.
- **Suggested mobile screen(s):** `AdminSettingsEmail`: Enabled switch, provider (read-only "resend"), API key (masked, "Replace" button), from email, from name, reply-to, Save.
- **API(s):**
  - `GET /api/admin/settings/email`
  - Auth required: yes — any admin role
  - Response:
    ```ts
    interface AdminEmailSettingsResponse { values: { "email.provider"?: string; "email.resendApiKey"?: string; "email.fromEmail"?: string; "email.fromName"?: string; "email.replyToEmail"?: string; "email.enabled"?: boolean }; hasKey: boolean }
    ```
    ```json
    { "values": { "email.provider": "resend", "email.resendApiKey": "••••••••••••a1b2", "email.fromEmail": "no-reply@example.org", "email.fromName": "WorldWeCare", "email.replyToEmail": "", "email.enabled": true }, "hasKey": true }
    ```
  - `PUT /api/admin/settings/email`
  - Auth required: yes — any admin role
  - Request — body (accepted keys): `email.provider`, `email.resendApiKey`, `email.fromEmail`, `email.fromName`, `email.replyToEmail`, `email.enabled`. A key value containing `•` is ignored, so it is treated as unchanged. An empty string clears the key, which disables sending.
  - Response: `{ "ok": true, "updated": 2 }`
  - Errors: 401
- **Form fields:**
  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | Enabled | switch | no | – | true/false |
  | API key | password | no | omit to keep the current key | – |
  | From email | email | no | ⚠️ not validated | – |
  | From name | text | no | – | – |
  | Reply-to | email | no | – | – |
- **Business rules:** A send fails or is skipped when:
  - the template is disabled
  - `email.enabled` is false (default false)
  - the API key is empty
  - the from address is empty

  The masking rule shows the last 4 characters; values of 6 characters or fewer are fully masked.
- **Edge cases / notes for the mobile app:** Never echo the masked value back in a PUT. The server ignores it anyway.
- **Status:** ✅ Complete

## Settings → Email templates
- **Description:** Create, read, update and delete transactional email templates (subject, HTML/text bodies, `{{variable}}` placeholders, enabled flag), and send a real test email.
- **Who can use it:** OWNER, ADMIN, MODERATOR (all six endpoints).
- **Source files:** `src/app/api/admin/email-templates/route.ts`, `src/app/api/admin/email-templates/[id]/route.ts`, `src/app/api/admin/email-templates/[id]/test/route.ts`, `src/lib/email.ts` (`renderTemplate`, `sendEmail`), `src/app/admin/(dashboard)/settings/email-templates/page.tsx` (server-reads Prisma), `src/app/admin/(dashboard)/settings/email-templates/[id]/page.tsx`
- **User flow:**
  1. Open the list (sorted by name).
  2. Create a template (slug, name, subject, HTML required). A duplicate slug returns 409.
  3. Open the editor, change fields or flip enabled, and save.
  4. "Send test": enter a recipient and optional variables. The response is `{ok,status,providerId}` or 400 with the reason.
  5. Delete. Protected slugs are refused.
- **Suggested mobile screen(s):** `AdminEmailTemplates` (list: name, slug, subject, enabled badge, updated time). `AdminEmailTemplateEditor` (name, subject, preview text, description, variables chips, HTML editor/preview via WebView, text body, enabled switch, Send test sheet, Delete).
- **API(s):**
  - `GET /api/admin/email-templates`
  - Auth required: yes — any admin role
  - Response:
    ```ts
    interface AdminEmailTemplateSummary { id: string; slug: string; name: string; description: string|null; subject: string; enabled: boolean; updatedAt: string }
    // { items: AdminEmailTemplateSummary[] }
    ```
    ```json
    { "items": [{ "id": "clet1", "slug": "password_reset", "name": "Password reset", "description": "Sent when a member asks to reset", "subject": "Reset your {{siteName}} password", "enabled": true, "updatedAt": "2026-10-10T00:00:00.000Z" }] }
    ```
  - `POST /api/admin/email-templates`
  - Auth required: yes — any admin role
  - Request — body:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | slug | string | yes | trimmed, lower-cased, `^[a-z0-9_]+$`, unique | – | `event_reminder` |
    | name | string | yes | trimmed, non-empty | – | `Event reminder` |
    | subject | string | yes | trimmed, non-empty | – | `{{name}}, your event is tomorrow` |
    | htmlBody | string | yes | non-empty | – | `<p>Hi {{name}}</p>` |
    | textBody | string | no | – | null | `Hi {{name}}` |
    | previewText | string | no | – | null | `See you there` |
    | description | string | no | – | null | `Day-before reminder` |
    | variables | string[] | no | non-array → [] | [] | `["name","eventTitle"]` |
  - Response (201): `{ item: AdminEmailTemplate }` (full row; see below)
  - Errors: 401 · 400 — `Slug must be lowercase letters, numbers, and underscores.` · 400 — `Name, subject, and HTML body are required.` · 409 — `Template "<slug>" already exists.`
  - `GET /api/admin/email-templates/[id]`
  - Auth required: yes — any admin role
  - Response:
    ```ts
    interface AdminEmailTemplate { id: string; slug: string; name: string; description: string|null; subject: string; previewText: string|null; htmlBody: string; textBody: string|null; variables: string[]|null; enabled: boolean; createdAt: string; updatedAt: string }
    // { item: AdminEmailTemplate }
    ```
  - Errors: 401 · 404 — `Template not found`
  - `PUT /api/admin/email-templates/[id]`
  - Auth required: yes — any admin role
  - Request — body (partial): `name?`, `subject?`, `htmlBody?`, `textBody?` (string|null), `previewText?` (string|null), `description?` (string|null), `variables?` (string[]), `enabled?` (boolean). The slug cannot be changed. ⚠️ No non-empty check on name/subject/htmlBody.
  - Response: `{ item: AdminEmailTemplate }`
  - Errors: 401 · 404 — `Template not found`
  - `DELETE /api/admin/email-templates/[id]`
  - Auth required: yes — any admin role
  - Response: `{ "ok": true }`
  - Errors: 401 · 404 — `Template not found` · 400 — `"<slug>" is required by the app. Disable it from the editor if you need to stop sends.` (protected: `welcome`, `email_confirm`, `password_reset`, `password_reset_confirmed`)
  - `POST /api/admin/email-templates/[id]/test`
  - Auth required: yes — any admin role
  - Request — body:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | to | string | yes | email regex | – | `me@example.org` |
    | variables | Record<string,string> | no | merged over the sample defaults | {} | `{ "name": "Alex" }` |
  - Response (success):
    ```json
    { "ok": true, "status": "sent", "providerId": "re_123abc" }
    ```
  - Errors: 401 · 400 — `Enter a valid recipient email address.` · 404 — `Template not found` · 400 — `{ "ok": false, "status": "skipped"|"failed", "error": "Template is disabled" }` (or another send error)
- **Form fields:**
  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | Slug | text | yes (create) | `^[a-z0-9_]+$` | – |
  | Name | text | yes | – | – |
  | Subject | text | yes | supports `{{var}}` | – |
  | Preview text | text | no | – | – |
  | Description | text | no | – | – |
  | Variables | tag list | no | – | – |
  | HTML body | code/HTML | yes | – | – |
  | Text body | multiline | no | – | – |
  | Enabled | switch | no | – | – |
  | Test recipient | email | yes (test) | valid email | – |
- **Business rules:**
  - `renderTemplate` replaces `{{ key }}` (letters, digits, underscore). Unknown variables stay visible in the email.
  - Test default variables: `name`="Alex", `email`=to, `siteName`, `appUrl`, `supportEmail`, `confirmLink`/`resetLink` (`…/test-token`).
  - Every send (including tests) writes an `email_logs` row.
  - Slugs used by the app code: `welcome`, `email_confirm`, `password_reset`, `password_reset_confirmed`, `donation_receipt`.
  - Template edits are not audited.
- **Edge cases / notes for the mobile app:** The HTML preview needs a WebView with sample variables substituted on the client. `donation_receipt` is not in the protected list, so it can be deleted, which breaks receipts.
- **Status:** ✅ Complete

## Settings → Email logs
- **Description:** `sendEmail()` records every attempt (QUEUED → SENT/FAILED, error message, provider id) in `email_logs`. Code comments reference an "Email Logs page".
- **Who can use it:** n/a
- **Source files:** `src/lib/email.ts` (writes `prisma.emailLog`), `prisma/schema.prisma` (`EmailLog`, `EmailStatus`)
- **User flow:** none. No admin page or API reads `email_logs` (searched `emailLog.findMany`: no results).
- **Suggested mobile screen(s):** `AdminEmailLogs` (future): status filter, recipient search, rows with template, subject, status and error.
- **API(s):** none
- **Form fields:** none
- **Business rules:** Logs are written for every send, including test sends and skipped/failed ones.
- **Edge cases / notes for the mobile app:** Not buildable until an API exists.
- **Status:** ⚠️ Partial (data is written but there is no page or API to read it)

## Settings → Storage
- **Description:** File storage settings: provider label, local path, public CDN base URL, maximum image/file size, maximum video size and maximum video duration.
- **Who can use it:** OWNER, ADMIN, MODERATOR (GET and PUT).
- **Source files:** `src/app/api/admin/settings/storage/route.ts`, `src/lib/upload-limits.ts` (`BODY_LIMIT_MB`, `normaliseLimits`), `src/lib/upload.ts`, `src/lib/video-upload.ts`, `src/app/admin/(dashboard)/settings/storage/page.tsx`
- **User flow:** 1. Open the screen; values plus `bodyLimitMB` load. 2. Edit and save. 3. Out-of-range numbers return 400 with a message.
- **Suggested mobile screen(s):** `AdminSettingsStorage`: provider, local path, public base URL, max file MB (stepper), max video MB (stepper, max = bodyLimitMB), max video seconds (0 = unlimited).
- **API(s):**
  - `GET /api/admin/settings/storage`
  - Auth required: yes — any admin role
  - Response:
    ```ts
    interface AdminStorageSettingsResponse { values: { "storage.provider"?: string; "storage.localPath"?: string; "storage.publicBaseUrl"?: string; "storage.maxFileMB"?: number; "storage.maxVideoMB"?: number; "storage.maxVideoSeconds"?: number }; bodyLimitMB: number }
    ```
    ```json
    { "values": { "storage.provider": "local", "storage.maxFileMB": 8, "storage.maxVideoMB": 512, "storage.maxVideoSeconds": 0, "storage.publicBaseUrl": "" }, "bodyLimitMB": 2048 }
    ```
  - `PUT /api/admin/settings/storage`
  - Auth required: yes — any admin role
  - Request — body:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | storage.provider | string | no | String(), max 500 chars | – | `local` |
    | storage.localPath | string | no | max 500 chars | – | `public/uploads` |
    | storage.publicBaseUrl | string | no | max 500 chars; prefixes returned upload URLs | "" | `https://cdn.example.org` |
    | storage.maxFileMB | number\|string | no | integer 1..1024 | 8 | `10` |
    | storage.maxVideoMB | number\|string | no | integer 1..bodyLimitMB | 512 | `1024` |
    | storage.maxVideoSeconds | number\|string | no | integer 0..86400 (0 = no limit) | 0 | `600` |
  - Response: `{ "ok": true, "updated": 2 }`
  - Errors: 401 · 400 — `Max video size must be between 1 and <N> MB. The upper bound is this build's request body limit — raise MAX_UPLOAD_BODY_MB and rebuild to go higher.` · 400 — `<key> must be between <min> and <max>.`
- **Form fields:** as in the table above.
- **Business rules:**
  - `BODY_LIMIT_MB` comes from env `MAX_UPLOAD_BODY_MB` (valid range 16..65536, default 2048).
  - Validation stops at the first bad number; nothing is saved.
  - Not audited.
- **Edge cases / notes for the mobile app:** Read limits before uploading (also available via `GET /api/admin/upload/video`).
- **Status:** ✅ Complete

## Settings → Cache
- **Description:** Controls the in-process cache of platform settings (on/off and TTL), shows live cache stats, and can purge it.
- **Who can use it:** OWNER, ADMIN, MODERATOR (GET, PUT, DELETE).
- **Source files:** `src/app/api/admin/settings/cache/route.ts`, `src/lib/settings.ts` (`settingsCacheStatus`, `purgeSettingsCache`), `src/app/admin/(dashboard)/settings/cache/page.tsx`
- **User flow:** 1. Open the screen to see the stats card. 2. Change Enabled or TTL and save; the response includes the applied state. 3. "Purge cache" returns `{ok, purged}`.
- **Suggested mobile screen(s):** `AdminSettingsCache`: Enabled switch, TTL seconds stepper, stats card (enabled, TTL, warm, entries, age), Purge button.
- **API(s):**
  - `GET /api/admin/settings/cache`
  - Auth required: yes — any admin role
  - Response:
    ```ts
    interface AdminCacheSettingsResponse { values: { "cache.enabled"?: boolean; "cache.defaultTtlSeconds"?: number }; stats: { name: string; description: string; ttlSeconds: number; enabled: boolean; warm: boolean; entries: number; ageSeconds: number|null }[] }
    ```
    ```json
    { "values": { "cache.enabled": true, "cache.defaultTtlSeconds": 30 }, "stats": [{ "name": "Platform settings", "description": "In-process cache of PlatformSetting rows.", "ttlSeconds": 30, "enabled": true, "warm": true, "entries": 64, "ageSeconds": 12 }] }
    ```
  - `PUT /api/admin/settings/cache`
  - Auth required: yes — any admin role
  - Request — body: `cache.enabled?` (boolean expected; ⚠️ not type-checked), `cache.defaultTtlSeconds?` (number; clamped 5..3600 when read, default 30)
  - Response: `{ "ok": true, "updated": 1, "applied": { "enabled": true, "ttlSeconds": 30, "warm": false, "entries": 0, "ageSeconds": null } }` (`applied` is omitted when `updated` is 0)
  - `DELETE /api/admin/settings/cache`
  - Auth required: yes — any admin role
  - Response: `{ "ok": true, "purged": ["settings"] }`
  - Errors (all): 401
- **Form fields:** Enabled (switch), TTL seconds (number 5..3600).
- **Business rules:** The cache is per server process; with several instances, a purge only clears one. A missing `cache.enabled` means on. Not audited.
- **Edge cases / notes for the mobile app:** —
- **Status:** ✅ Complete

## Settings → Streaming server
- **Description:** Configures the MediaMTX live-streaming integration (URLs, path prefix, Control API credentials, IP allow-list, defaults, limits, recording) and runs a live health check.
- **Who can use it:** GET and POST (health check): OWNER, ADMIN, MODERATOR. PUT: **OWNER, ADMIN** (inline `auth.role === "MODERATOR"` → 403).
- **Source files:** `src/app/api/admin/settings/stream/route.ts`, `src/lib/mediamtx.ts` (`checkHealth`, `normalisePrefix`, `MediamtxHealth`), `src/app/admin/(dashboard)/settings/streaming/page.tsx`
- **User flow:** 1. Open the screen; values load with the password masked. 2. Edit and save. 3. "Test connection" (POST) shows a step-by-step check (host → api → prefix) with path and session counts.
- **Suggested mobile screen(s):** `AdminSettingsStreaming`, in four sections:
  - Server: public URL, API URL, API user/password, playback URL, path prefix, allowed IPs
  - Access: enabled, require verified email, default visibility
  - Limits: max duration, concurrent per user, max height
  - Recording: auto-record, retention days

  Plus a Test button and a results list.
- **API(s):**
  - `GET /api/admin/settings/stream`
  - Auth required: yes — any admin role
  - Response:
    ```json
    { "values": { "stream.enabled": true, "stream.publicUrl": "https://live.example.org", "stream.apiUrl": "http://127.0.0.1:9997", "stream.apiUser": "api", "stream.apiPass": "••••••••w0rd", "stream.pathPrefix": "live", "stream.maxDurationMin": 120, "stream.defaultVisibility": "PUBLIC" }, "hasPass": true }
    ```
  - `PUT /api/admin/settings/stream`
  - Auth required: yes — OWNER or ADMIN
  - Request — body:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | stream.publicUrl / apiUrl / apiUser / playbackUrl / allowedIps | string | no | trimmed; a non-string becomes "" | – | `https://live.example.org` |
    | stream.apiPass | string | no | a value starting with `•` is ignored (unchanged) | – | `s3cret` |
    | stream.pathPrefix | string | no | normalised via `normalisePrefix` | – | `live` |
    | stream.defaultVisibility | `PUBLIC`\|`UNLISTED` | no | anything else → PUBLIC | – | `UNLISTED` |
    | stream.enabled / requireEmailVerified / autoRecord | boolean | no | `=== true` | – | `true` |
    | stream.maxDurationMin | number | no | rounded, clamped 5..1440; non-finite values are skipped | – | `120` |
    | stream.maxConcurrentPerUser | number | no | clamped 1..10 | – | `1` |
    | stream.maxHeight | number | no | clamped 240..2160 | – | `1080` |
    | stream.recordingRetentionDays | number | no | clamped 0..3650 | – | `30` |
  - Response: `{ "ok": true }`
  - Errors: 401 · 403 — `Moderators can't change streaming settings.`
  - `POST /api/admin/settings/stream` (health check)
  - Auth required: yes — any admin role
  - Response:
    ```ts
    interface AdminStreamHealth { ok: boolean; configured: boolean; enabled: boolean; steps: { step: "host"|"api"|"prefix"; label: string; ok: boolean; detail: string|null }[]; pathCount: number|null; sessionCount: number|null; checkedAt: string }
    ```
    ```json
    { "ok": true, "configured": true, "enabled": true, "steps": [{ "step": "host", "label": "Server reachable", "ok": true, "detail": null }, { "step": "api", "label": "Control API", "ok": true, "detail": null }, { "step": "prefix", "label": "Path prefix", "ok": true, "detail": null }], "pathCount": 3, "sessionCount": 1, "checkedAt": "2026-11-25T15:00:00.000Z" }
    ```
  - Errors: 401
- **Form fields:** as in the table above.
- **Business rules:** Out-of-range numbers are clamped rather than rejected. Not audited.
- **Edge cases / notes for the mobile app:** Hide or disable Save for moderators. ⚠️ GET exposes `stream.apiUser` and the other non-secret values to moderators.
- **Status:** ✅ Complete

## Money → Payment & payout settings
- **Description:** Stripe configuration (mode, publishable/secret/webhook keys, currency) plus the donation and payout rules: fee, minimum, hold days, payout methods, donation min/max, and credit-recipient policy. Two web pages, `settings/payments` and `settings/payouts`, use the same API. Secrets are sealed with AES-256-GCM and only ever returned masked.
- **Who can use it:**
  - GET: **OWNER, ADMIN** (`requireMoneyAdmin`).
  - PUT and the test call: **OWNER only** (`requireMoneyAdmin(req,"owner")`).
  - MODERATOR gets 403 on all of them.
- **Source files:** `src/app/api/admin/payments/settings/route.ts`, `src/app/api/admin/payments/test/route.ts`, `src/lib/payments.ts` (`getPaymentSettings`, `savePaymentSettings`, `checkCredential`, `PAYMENT_DEFAULTS`), `src/lib/secret-box.ts` (`maskSecret`, `secretsConfigured`, `seal`), `src/lib/stripe.ts` (`testConnection`), `src/lib/money.ts` (`clampBp`), `src/app/admin/(dashboard)/settings/payments/page.tsx`, `src/app/admin/(dashboard)/settings/payouts/page.tsx`
- **User flow:**
  1. Open Payments settings. The form is read-only unless you are OWNER (`canEdit`).
  2. If `encryptionReady` is false, show a banner: the server is missing its encryption secret, and nothing can be saved.
  3. Optionally paste a secret key and tap "Test connection". This calls `POST /payments/test` with the typed key, and the result shows the account name and any mode mismatch.
  4. Save. Blank secret fields keep the stored values. An invalid key shape returns 400 with a precise message, and nothing is saved.
- **Suggested mobile screen(s):**
  - `AdminSettingsPayments`:
    - enabled switch and mode (test/live)
    - publishable key
    - secret key and webhook secret (masked, with a "Replace" control)
    - currency (read-only)
    - min/max donation
    - credit recipient (net/gross)
    - Test button and Save (owner only)
  - `AdminSettingsPayouts`:
    - payout fee % (shown from basis points)
    - minimum payout
    - hold days
    - allowed methods checklist
- **API(s):**
  - `GET /api/admin/payments/settings`
  - Auth required: yes — OWNER, ADMIN
  - Response:
    ```ts
    interface AdminPaymentSettingsResponse { settings: { enabled: boolean; mode: "test"|"live"; publishableKey: string; currency: string; creditRecipient: "net"|"gross"; payoutFeeBasisPoints: number; payoutMinCents: number; payoutHoldDays: number; payoutMethods: string[]; minDonationCents: number; maxDonationCents: number; secretKeyMasked: string|null; webhookSecretMasked: string|null; hasSecretKey: boolean; hasWebhookSecret: boolean }; encryptionReady: boolean }
    ```
    ```json
    { "settings": { "enabled": true, "mode": "test", "publishableKey": "pk_test_51Fake000", "currency": "usd", "creditRecipient": "net", "payoutFeeBasisPoints": 100, "payoutMinCents": 1000, "payoutHoldDays": 14, "payoutMethods": ["PAYPAL", "BANK"], "minDonationCents": 100, "maxDonationCents": 500000, "secretKeyMasked": "sk_test_51F…9xQm", "webhookSecretMasked": "whsec_abcde…7f2a", "hasSecretKey": true, "hasWebhookSecret": true }, "encryptionReady": true }
    ```
  - Errors: 401 · 403 — `Moderators can't work with payments or payouts.`
  - `PUT /api/admin/payments/settings`
  - Auth required: yes — OWNER
  - Request — body (all optional; fields that are missing or of the wrong type are left unchanged):
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | enabled | boolean | no | master switch for checkout and payouts | false | `true` |
    | mode | `test`\|`live` | no | – | test | `live` |
    | publishableKey | string | no | trimmed; if non-empty must start `pk_` and be ≥20 chars | "" | `pk_live_…` |
    | secretKey | string | no | blank = unchanged; must start `sk_`/`rk_`, ≥20 chars; sealed | – | `sk_live_…` |
    | webhookSecret | string | no | blank = unchanged; must start `whsec_`, ≥20 chars; sealed | – | `whsec_…` |
    | creditRecipient | `net`\|`gross` | no | – | net | `net` |
    | payoutFeeBasisPoints | number | no | rounded, clamped 0..10000 (100 = 1%) | 100 | `150` |
    | payoutMinCents | number | no | rounded; read back as ≥0 | 1000 | `2000` |
    | payoutHoldDays | number | no | rounded; ≥0 | 14 | `7` |
    | payoutMethods | string[] | no | non-strings dropped (UI uses PAYPAL, BANK, WISE, CHECK) | ["PAYPAL","BANK"] | `["PAYPAL","BANK","WISE"]` |
    | minDonationCents | number | no | read back as ≥50 | 100 | `500` |
    | maxDonationCents | number | no | read back as ≥100 | 500000 | `1000000` |
  - Response: `{ "ok": true }`
  - Errors:
    - 401
    - 403 — `Only an owner can change the payment credentials.` (or the moderator message)
    - 400 — `Set PAYMENTS_SECRET on the server before saving Stripe keys.`
    - 400 — credential messages, e.g. `That is a Stripe publishable key, not a secret key. Check you are pasting into the right field.` / `That secret key looks cut off — it is only N characters. …` / `That does not look like a Stripe webhook signing secret — they begin "whsec_…". Nothing was saved.`
  - `POST /api/admin/payments/test`
  - Auth required: yes — OWNER
  - Request — body: `secretKey?` (string; if blank, the stored key is tested)
  - Response (always 200, `ok` may be false):
    ```ts
    interface AdminPaymentTestResponse { ok: boolean; message: string; accountName?: string; accountId?: string; country?: string; defaultCurrency?: string; chargesEnabled?: boolean; payoutsEnabled?: boolean; livemode?: boolean; modeMismatch?: boolean }
    ```
    ```json
    { "ok": true, "message": "Connected to Example Charity.", "accountName": "Example Charity", "accountId": "acct_1Fake", "country": "US", "defaultCurrency": "usd", "chargesEnabled": true, "payoutsEnabled": true, "livemode": false, "modeMismatch": false }
    ```
  - Errors: 401 · 403
- **Form fields:** as in the PUT table. Show percentages and dollars in the UI, but send basis points and cents.
- **Business rules:**
  - Money is always integer cents and rates are basis points.
  - The payout fee is computed as `fee = round(amount*bp/10000)` and `net = amount - fee`.
  - `creditRecipient=net` credits recipients after Stripe fees.
  - All credentials are validated before anything is written, so one bad key leaves every other change unsaved too.
  - ⚠️ `PAYMENT_SETTINGS_UPDATED` exists in the AdminAction enum, but this route never writes it, so settings changes are not audited.
- **Edge cases / notes for the mobile app:**
  - The test endpoint returns 200 even when the key is wrong. Check `ok` and show `message`.
  - `currency` cannot be changed through the API.
- **Status:** ✅ Complete

## Money → Payout queue
- **Description:** The queue of member withdrawal requests. Admins review each request (which shows the member's decrypted payment details and balance), then approve, mark it paid, reject it, or reverse a payment that was marked paid.
- **Who can use it:** **OWNER, ADMIN** (`requireMoneyAdmin`). MODERATOR gets 403.
- **Source files:** `src/app/api/admin/payouts/route.ts`, `src/app/api/admin/payouts/[id]/route.ts`, `src/lib/payouts.ts` (`listAllPayouts`, `payoutTotals`, `revealPayoutDetails`, `approvePayout`, `markPaid`, `rejectPayout`, `reversePayout`), `src/lib/payments.ts` (`balanceFor`), `src/lib/payment-notify.ts` (`notifyPayout`), `src/app/admin/(dashboard)/payouts/page.tsx`
- **User flow:**
  1. Open Payouts. The default filter is REQUESTED, oldest first, with totals per status shown at the top.
  2. Open a payout. The response includes the full bank/PayPal/cheque details, but only while the status is REQUESTED or APPROVED. Viewing them writes a `PAYOUT_DETAILS_VIEWED` audit entry.
  3. Send the money outside the app.
  4. Mark it Paid with the external reference.
  5. Alternatively, Approve first; Reject with a reason (the member sees it); or Reverse a PAID payout with a reason.
  6. If the payout was already actioned by someone else, the call returns 409. Reload.
- **Suggested mobile screen(s):**
  - `AdminPayoutQueue`:
    - status chips (Requested, Approved, Paid, Rejected, Cancelled, All)
    - search
    - totals header (count and amount per status)
    - rows: member, amount/fee/net, method hint, requested date
  - `AdminPayoutDetail`:
    - amounts and member balance card
    - method details with copy buttons (sensitive; consider screenshot blocking)
    - admin note
    - buttons: Approve, Mark paid (needs external ref), Reject (needs reason), Reverse (needs reason)
- **API(s):**
  - `GET /api/admin/payouts`
  - Auth required: yes — OWNER, ADMIN
  - Request — query:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | status | `ALL`\|`REQUESTED`\|`APPROVED`\|`PAID`\|`REJECTED`\|`CANCELLED` | no | other values → 400 | REQUESTED | `ALL` |
    | q | string | no | matches user name/email snapshot or externalRef | – | `maria` |
    | take | int | no | max 200; 0 or non-numeric → 50 | 50 | `100` |
  - Response:
    ```ts
    interface AdminPayout { id: string; userId: string; userNameSnapshot: string; userEmailSnapshot: string|null; amountCents: number; feeBasisPoints: number; feeCents: number; netCents: number; currency: string; methodId: string|null; methodSnapshot: { type: "PAYPAL"|"BANK"|"WISE"|"CHECK"; label: string|null; displayHint: string }; status: "REQUESTED"|"APPROVED"|"PAID"|"REJECTED"|"CANCELLED"; requestedAt: string; reviewedAt: string|null; paidAt: string|null; reviewedByAdminId: string|null; adminNote: string|null; rejectionReason: string|null; externalRef: string|null; createdAt: string; updatedAt: string }
    interface AdminPayoutListResponse { payouts: AdminPayout[]; totals: Record<string, { count: number; amountCents: number; feeCents: number; netCents: number }> }
    ```
    ```json
    { "payouts": [{ "id": "clpo1", "userId": "cluser01", "userNameSnapshot": "Maria", "userEmailSnapshot": "maria@example.com", "amountCents": 5000, "feeBasisPoints": 100, "feeCents": 50, "netCents": 4950, "currency": "usd", "methodId": "clpm1", "methodSnapshot": { "type": "PAYPAL", "label": null, "displayHint": "PayPal · m…@example.com" }, "status": "REQUESTED", "requestedAt": "2026-11-20T10:00:00.000Z", "reviewedAt": null, "paidAt": null, "reviewedByAdminId": null, "adminNote": null, "rejectionReason": null, "externalRef": null, "createdAt": "2026-11-20T10:00:00.000Z", "updatedAt": "2026-11-20T10:00:00.000Z" }], "totals": { "REQUESTED": { "count": 1, "amountCents": 5000, "feeCents": 50, "netCents": 4950 } } }
    ```
  - Errors: 401 · 403 · 400 — `Unknown status.`
  - `GET /api/admin/payouts/[id]`
  - Auth required: yes — OWNER, ADMIN
  - Response:
    ```ts
    interface AdminPayoutDetailResponse { payout: AdminPayout; details: { type: "PAYPAL"|"BANK"|"WISE"|"CHECK"; details: Record<string, unknown> } | null; balance: { availableCents: number; onHoldCents: number; reservedCents: number; paidOutCents: number; lifetimeCents: number; currency: string } }
    ```
    ```json
    { "payout": { "id": "clpo1", "status": "REQUESTED", "amountCents": 5000, "feeCents": 50, "netCents": 4950, "currency": "usd", "userId": "cluser01", "userNameSnapshot": "Maria", "methodSnapshot": { "type": "BANK", "label": null, "displayHint": "Bank · ••••6789 · Example Bank" } }, "details": { "type": "BANK", "details": { "accountName": "Maria Example", "accountNumber": "000123456789", "routingNumber": "011000015", "iban": "", "swift": "", "bankName": "Example Bank", "country": "US" } }, "balance": { "availableCents": 1200, "onHoldCents": 3000, "reservedCents": 5000, "paidOutCents": 0, "lifetimeCents": 9200, "currency": "usd" } }
    ```
    The shape of `details` depends on the method type:
    - PAYPAL and WISE: `{email}`
    - BANK: `{accountName, accountNumber, routingNumber, iban, swift, bankName, country}`
    - CHECK: `{payeeName, line1, line2, city, state, postcode, country}`

    `details` is null when the payout is no longer open, the method was deleted, or decryption fails.
  - Errors: 401 · 403 · 404 — `Not found`
  - `PUT /api/admin/payouts/[id]`
  - Auth required: yes — OWNER, ADMIN
  - Request — body:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | action | `approve`\|`paid`\|`reject`\|`reverse` | yes | – | – | `paid` |
    | adminNote | string | no | ≤2000 chars; internal only (approve/paid) | – | `Sent via PayPal batch` |
    | externalRef | string | no | `paid` only; trimmed, ≤160 chars | – | `PP-7H2K9` |
    | rejectionReason | string | reject/reverse: yes | non-empty; reject ≤2000, reverse ≤500 chars; shown to the member | – | `Bank details invalid` |
  - Response: `{ "ok": true }`
  - Errors: 401 · 403 · 404 — `Not found` · 400 — `Unknown action.` · 400 — `Give a reason — the member sees it.` (reject) · 400 — `Say why it's being reversed — the member sees it.` (reverse) · 409 — `That payout has already been actioned — reload the page.`
- **Form fields:**
  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | Admin note | multiline | no | ≤2000 | – |
  | External reference | text | for Paid (recommended) | ≤160 | – |
  | Rejection / reversal reason | multiline | for Reject/Reverse | non-empty | – |
- **Business rules:**
  - Status transitions (guarded with an atomic `updateMany` on the current status):

    | Action | From | To |
    |---|---|---|
    | approve | REQUESTED | APPROVED |
    | paid | REQUESTED or APPROVED | PAID (sets paidAt) |
    | reject | REQUESTED or APPROVED | REJECTED |
    | reverse | PAID | REJECTED (paidAt cleared) |

    CANCELLED is set only by the member.
  - REQUESTED and APPROVED payouts reserve balance; PAID counts as spent; REJECTED returns the money to the member.
  - Side effects:
    - an in-app notification to the member (`PAYOUT_APPROVED`, `PAYOUT_PAID` or `PAYOUT_REJECTED`; a reversal uses PAYOUT_REJECTED with "came back" copy; actionUrl `/settings/payouts`)
    - an audit entry `PAYOUT_APPROVED` / `PAYOUT_PAID` / `PAYOUT_REJECTED` / `PAYOUT_REVERSED`, with meta {payoutId, amount/fee/net cents, externalRef}
  - No money is moved automatically. Payouts are sent manually outside the app.
- **Edge cases / notes for the mobile app:**
  - The list is capped (`take` max 200) and has no paging.
  - Show amounts as `netCents` (what the member receives) next to `amountCents`.
  - Treat `details` as highly sensitive: never cache it, and clear it from memory when the screen is left.
- **Status:** ✅ Complete

## Money → Donations ledger
- **Description:** A read-only ledger of donations coming in, with search and totals, including a "stranded" counter that signals a webhook outage.
- **Who can use it:** **OWNER, ADMIN** (`requireMoneyAdmin`).
- **Source files:** `src/app/api/admin/donations/route.ts`, `src/lib/donations.ts` (`listAllDonations`, `donationTotals`, `AdminDonationRow`), `src/app/admin/(dashboard)/donations/page.tsx`
- **User flow:**
  1. Open Donations. The default filter is SUCCEEDED.
  2. Change the status filter or search by donor, recipient, cause, or a Stripe session or payment-intent id.
  3. Inspect a row. Refunds and disputes are handled in Stripe, not here.
- **Suggested mobile screen(s):** `AdminDonations`:
  - totals header: collected, Stripe fees, fee-unknown count, stranded count (warning when above 0), per-status counts
  - status chips (Succeeded, Pending, Refunded, Disputed, Failed, All)
  - search
  - rows: donor (with an anonymous flag), recipient/cause, gross/net, status, date
  - a detail sheet with the Stripe ids
- **API(s):**
  - `GET /api/admin/donations`
  - Auth required: yes — OWNER, ADMIN
  - Request — query:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | status | `ALL`\|`PENDING`\|`SUCCEEDED`\|`REFUNDED`\|`DISPUTED`\|`FAILED` | no | other values → 400 | SUCCEEDED | `ALL` |
    | q | string | no | donor name/email, recipient, cause title, Stripe session/PI id | – | `cs_test_` |
    | take | int | no | max 200; 0 or non-numeric → 50 | 50 | `100` |
  - Response:
    ```ts
    interface AdminDonation { id: string; status: "PENDING"|"SUCCEEDED"|"REFUNDED"|"DISPUTED"|"FAILED"; grossCents: number; netCents: number; stripeFeeCents: number; refundedCents: number; feeUnknown: boolean; currency: string; message: string|null; isAnonymous: boolean; donorName: string|null; donorEmail: string|null; donorUserId: string|null; recipientName: string|null; recipientUserId: string|null; causeTitle: string|null; eventId: string|null; campaignId: string|null; stripeSessionId: string|null; stripePaymentIntentId: string|null; createdAt: string; succeededAt: string|null; availableAt: string|null; disputedAt: string|null }
    interface AdminDonationListResponse { donations: AdminDonation[]; totals: { byStatus: Record<string, { count: number; grossCents: number; netCents: number }>; collectedCents: number; stripeFeesCents: number; feeUnknownCount: number; strandedCount: number } }
    ```
    ```json
    { "donations": [{ "id": "cldon1", "status": "SUCCEEDED", "grossCents": 2500, "netCents": 2398, "stripeFeeCents": 102, "refundedCents": 0, "feeUnknown": false, "currency": "usd", "message": "Keep going!", "isAnonymous": true, "donorName": "Leo", "donorEmail": "leo@example.com", "donorUserId": "cluser02", "recipientName": "Maria", "recipientUserId": "cluser01", "causeTitle": "Beach clean-up", "eventId": "clev1", "campaignId": null, "stripeSessionId": "cs_test_abc", "stripePaymentIntentId": "pi_test_abc", "createdAt": "2026-11-24T09:00:00.000Z", "succeededAt": "2026-11-24T09:01:00.000Z", "availableAt": "2026-12-08T09:01:00.000Z", "disputedAt": null }], "totals": { "byStatus": { "SUCCEEDED": { "count": 1, "grossCents": 2500, "netCents": 2398 } }, "collectedCents": 2500, "stripeFeesCents": 102, "feeUnknownCount": 0, "strandedCount": 0 } }
    ```
  - Errors: 401 · 403 — `Moderators can't work with payments or payouts.` · 400 — `Unknown status.`
- **Form fields:** status chips and search.
- **Business rules:**
  - Sorted newest first.
  - `collectedCents` = sum over SUCCEEDED and REFUNDED of gross minus refunded.
  - `strandedCount` = PENDING rows that have a Stripe session.
  - Admins see the donor's identity even on anonymous gifts. The `isAnonymous` flag means it must never be shown to the recipient.
- **Edge cases / notes for the mobile app:** No paging (max 200). There are no refund or dispute actions in the API.
- **Status:** ✅ Complete

## Media → ffmpeg management
- **Description:** Video conversion needs ffmpeg and ffprobe on the server. This screen shows a readiness report (paths, version, checks including a test encode), installs a static ffmpeg build with one click from allow-listed hosts, and can forget a managed install.
- **Who can use it:**
  - GET (report): OWNER, ADMIN, MODERATOR.
  - DELETE (forget) and POST install: **OWNER only** (inline `auth.role !== "OWNER"` check).
- **Source files:** `src/app/api/admin/ffmpeg/route.ts`, `src/app/api/admin/ffmpeg/install/route.ts`, `src/lib/ffmpeg.ts` (`probeFfmpeg`, `installStaticFfmpeg`, `isInstalling`, `forgetManagedFfmpeg`, `ALLOWED_HOSTS`), `src/app/admin/(dashboard)/settings/ffmpeg/page.tsx` (passes `canInstall={role==="OWNER"}`)
- **User flow:**
  1. Open the screen. The report loads; the probe spawns processes, so expect a few seconds.
  2. If it is not ready and the platform is `installable`, an owner taps Install. They can optionally give a custom URL and an expected SHA-256.
  3. The install can take up to 300s. It returns `{ok, message, sha256, …}`. A 409 means an install is already running.
  4. An owner can "Forget managed install", which falls back to ffmpeg on the system PATH.
  5. Otherwise, copy the `manualCommand` and install by hand.
- **Suggested mobile screen(s):** `AdminSettingsFfmpeg`
  - status header showing "Ready" or "Not ready"
  - checks list with pass/warn/fail icons
  - paths, version, origin and platform
  - owner-only controls: Install form (URL and SHA-256 fields), Forget button
  - a manual command with a copy button
- **API(s):**
  - `GET /api/admin/ffmpeg`
  - Auth required: yes — any admin role
  - Response:
    ```ts
    interface AdminFfmpegStatus { ready: boolean; ffmpegPath: string|null; ffprobePath: string|null; origin: "env"|"managed"|"path"|null; version: string|null; checks: { id: string; label: string; state: "pass"|"fail"|"warn"; detail: string }[]; platform: { os: string; arch: string; node: string }; installable: boolean; manualCommand: string; managedRoot: string; installedAt: string|null; archiveSha256: string|null; source: string|null; installing: boolean }
    ```
    ```json
    { "ready": true, "ffmpegPath": "/srv/app/.ffmpeg/bin/ffmpeg", "ffprobePath": "/srv/app/.ffmpeg/bin/ffprobe", "origin": "managed", "version": "6.1", "checks": [{ "id": "encode", "label": "Test encode", "state": "pass", "detail": "1s H.264 encode OK" }], "platform": { "os": "linux", "arch": "x64", "node": "v20.11.0" }, "installable": true, "manualCommand": "sudo apt-get install -y ffmpeg", "managedRoot": "/srv/app/.ffmpeg", "installedAt": "2026-09-01T00:00:00.000Z", "archiveSha256": "3f…", "source": "https://johnvansickle.com/…", "installing": false }
    ```
  - Errors: 401
  - `DELETE /api/admin/ffmpeg`
  - Auth required: yes — OWNER
  - Response: `{ "ok": true }`
  - Errors: 401 · 403 — `Only an owner can change the ffmpeg install.`
  - `POST /api/admin/ffmpeg/install`
  - Auth required: yes — OWNER
  - Request — body:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | url | string | no | https only; host must be johnvansickle.com, www.gyan.dev or gyan.dev | the platform's default build | `https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz` |
    | expectedSha256 | string | no | 64 hex chars; a mismatch aborts before extraction (env `FFMPEG_SHA256` is also honoured) | – | `a3f5…` |
  - Response (200 on ok, 400 on failure — same shape):
    ```ts
    interface AdminFfmpegInstallResponse { ok: boolean; message: string; sha256?: string; ffmpegPath?: string; ffprobePath?: string; version?: string|null }
    ```
    ```json
    { "ok": true, "message": "Installed ffmpeg 6.1.", "sha256": "a3f5…", "ffmpegPath": "/srv/app/.ffmpeg/bin/ffmpeg", "ffprobePath": "/srv/app/.ffmpeg/bin/ffprobe", "version": "6.1" }
    ```
  - Errors:
    - 401
    - 403 — `{ ok:false, message:"Only an owner can install ffmpeg." }`
    - 409 — `{ ok:false, message:"An install is already running. Give it a moment." }`
    - 400 — `{ ok:false, message }`, e.g. `Downloads must use https.`, `<host> is not an allowed download host. …`, `The expected SHA-256 must be 64 hex characters.`, or `No static build is published for <os>/<arch>. Install it with: …`
- **Form fields:**
  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | Download URL | url | no | https and an allow-listed host | – |
  | Expected SHA-256 | text | no | 64 hex characters | – |
- **Business rules:**
  - Only one install can run at a time.
  - Only files named exactly ffmpeg and ffprobe are extracted.
  - An install only counts as successful if the full probe passes afterwards.
  - Installs are logged to the server console only, not to the AdminActionLog.
- **Edge cases / notes for the mobile app:**
  - Error shapes here use `message`, not `error`.
  - The install request is long-running, so use a timeout of at least 5 minutes.
- **Status:** ✅ Complete

## Media → Admin image upload
- **Description:** Generic multipart image upload for the admin UI: logos, favicons, avatars, and images for articles, events and campaigns. Images are re-encoded, and a `-thumb` sibling file is written alongside.
- **Who can use it:** OWNER, ADMIN, MODERATOR.
- **Source files:** `src/app/api/admin/upload/route.ts`, `src/lib/upload.ts` (`uploadFile`), `src/lib/image-variants.ts`, `src/lib/media.ts` (`recordUpload`), `src/components/admin/image-upload.tsx`, `src/components/admin/gallery-upload.tsx`
- **User flow:**
  1. Pick an image.
  2. Send it as multipart with a `category`.
  3. On success you get `{ok, url}`; put the URL into the form field.
  4. Failure returns 400 for an unsupported type, a file that is too large, or a refused decompression bomb.
- **Suggested mobile screen(s):** A reusable `ImagePickerField` component: preview, Change and Remove buttons, and a progress indicator.
- **API(s):**
  - `POST /api/admin/upload`
  - Auth required: yes — any admin role
  - Request — `multipart/form-data`:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | file | File | yes | MIME one of image/png, image/jpeg, image/webp, image/gif, image/svg+xml, image/x-icon, image/vnd.microsoft.icon; size ≤ `storage.maxFileMB` (default 8 MB) | – | `logo.png` |
    | category | string | no | sanitised to `[a-z0-9-]`, max 40 chars | `misc` | `logos` |
  - Response:
    ```ts
    interface AdminUploadResponse { ok: true; url: string }
    ```
    ```json
    { "ok": true, "url": "/uploads/logos/m3k2p9-4f1a2b3c4d5e6f70.webp" }
    ```
  - Errors:
    - 401
    - 400 — `Request must be multipart/form-data`
    - 400 — `Missing file`
    - 400 — `{ ok:false, error }`. The error is one of: `Unsupported file type: <mime>`, `File larger than <N> MB limit.`, a decompression-bomb refusal, or a write error.
- **Form fields:** File (image picker).
- **Business rules:**
  - Files are written under `public/uploads/<category>/<time36>-<hex>.<ext>`.
  - If `storage.publicBaseUrl` is set, the URL is prefixed with it.
  - Every stored file, including the thumbnail, gets an `UploadedFile` row with ownerKind ADMIN, so the files can be cleaned up later.
  - The response does not include `thumbUrl`, `width` or `height`, even though the library computes them.
- **Edge cases / notes for the mobile app:**
  - The size check is on the original upload, not on the re-encoded output.
  - ⚠️ SVG files are accepted and served as-is.
- **Status:** ✅ Complete

## Media → Admin video upload
- **Description:** Streams a video upload straight to disk (raw request body, not multipart). Conversion then runs in the background (ffmpeg); you poll for status and can discard the asset.
- **Who can use it:** OWNER, ADMIN, MODERATOR. An admin can read or discard **any** video asset, including members' assets.
- **Source files:** `src/app/api/admin/upload/video/route.ts`, `src/app/api/admin/upload/video/[id]/route.ts`, `src/lib/video-upload.ts` (`receiveVideoUpload`), `src/lib/video-status.ts` (`readVideoStatus`, `discardVideo`), `src/lib/video.ts` (`convertAsset`), `src/lib/upload-limits.ts`
- **User flow:**
  1. GET limits, then refuse an oversized file on the client.
  2. POST the raw bytes with `Content-Type: video/*` and an `x-filename` header. You get 201 `{ok, id}`.
  3. Poll `GET /upload/video/[id]` until the status is READY (giving `url` and `posterUrl`) or FAILED.
  4. Put the asset id or URL into the content form, or DELETE the asset to discard it.
- **Suggested mobile screen(s):** A `VideoUploadField` component: picker, upload progress bar, conversion progress (percent, stage, ETA), poster preview, and a Remove button.
- **API(s):**
  - `GET /api/admin/upload/video`
  - Auth required: yes — any admin role
  - Response:
    ```ts
    interface AdminVideoLimitsResponse { maxMB: number; maxSeconds: number }
    ```
    ```json
    { "maxMB": 512, "maxSeconds": 0 }
    ```
  - `POST /api/admin/upload/video`
  - Auth required: yes — any admin role
  - Request:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | header `Content-Type` | string | yes | `video/*`, `application/octet-stream` or `application/mp4` | – | `video/mp4` |
    | header `x-filename` | string | no | URI-decoded; CR/LF stripped; max 300 chars | `video` | `clip.mp4` |
    | header `Content-Length` | int | recommended | rejected early if it exceeds the cap | – | `10485760` |
    | query `category` | string | no | sanitised to `[a-z0-9-]`, max 40 chars | `clips` | `articles` |
    | body | binary | yes | at most `maxMB`; must not be empty | – | – |
  - Response (201): `{ "ok": true, "id": "clvid123" }`
  - Errors:
    - 401
    - 415 — `Unsupported file type: <mime>`
    - 413 — `That video is larger than the <N> MB limit.`
    - 400 — `No file was sent.`
    - 400 — `The upload did not finish. Please try again.`
    - 400 — `The uploaded file was empty.`
  - `GET /api/admin/upload/video/[id]`
  - Auth required: yes — any admin role
  - Response:
    ```ts
    interface AdminVideoStatus { id: string; status: "UPLOADING"|"QUEUED"|"PROCESSING"|"READY"|"FAILED"; percent: number; etaSeconds: number|null; stage: string; message: string; url: string|null; posterUrl: string|null; width: number|null; height: number|null; durationSec: number|null; error: string|null }
    ```
    ```json
    { "id": "clvid123", "status": "PROCESSING", "percent": 42, "etaSeconds": 18, "stage": "encode", "message": "Converting…", "url": null, "posterUrl": null, "width": null, "height": null, "durationSec": null, "error": null }
    ```
  - Errors: 401 · 404 — `Not found`
  - `DELETE /api/admin/upload/video/[id]`
  - Auth required: yes — any admin role
  - Response: `{ "ok": true }` (200), or `{ "ok": false }` with 404 for an unknown id
- **Form fields:** Video file.
- **Business rules:**
  - Asset status goes UPLOADING → QUEUED → PROCESSING → READY or FAILED.
  - Polling also restarts conversions that were interrupted (`nudge`).
  - A stalled heartbeat is reported as PROCESSING.
  - Discarding deletes the mp4, poster, partial files and the source file, then the database row.
  - The maximum duration (`maxSeconds`, 0 means unlimited) is enforced during conversion.
- **Edge cases / notes for the mobile app:**
  - Send the file as a raw body with a native uploader that reports progress.
  - Poll every 1–2 seconds.
  - The upload request can take up to 900s (`maxDuration`).
- **Status:** ✅ Complete

## Translations → Languages & Google key
- **Description:** Manage the languages the site supports and the Google Translate API key.
  - Sync the language list from Google.
  - Turn languages on or off and reorder them.
  - Set or clear the Google Translate API key. The key is write-only and is never returned.
  - Show or hide the language picker for members. Hiding it makes the whole site English-only.
- **Who can use it:** OWNER, ADMIN, MODERATOR (GET and POST). ⚠️ That includes setting or clearing the API key.
- **Source files:** `src/app/api/admin/translations/locales/route.ts`, `src/lib/translations-admin.ts` (`listLocalesWithProgress`, `translationKeyStatus`, `setTranslationKey`, `setPickerEnabled`, `syncSupportedLanguages`, `setLocaleEnabled`, `setLocaleOrder`), `src/lib/google-translate.ts` (`KEY_SETTING`=`translation.googleApiKey`, `keyHint`), `src/lib/i18n.ts` (`PICKER_SETTING`=`translation.showPicker`), `src/app/admin/(dashboard)/translations/settings/page.tsx`
- **User flow:**
  1. Open Translation settings to see key status (configured, source, last 4 characters), the picker switch, and the locale list with progress.
  2. Paste a key and save. An empty value clears it, so the environment key is used instead.
  3. "Sync languages" upserts Google's list and reports `added` and `total`.
  4. Toggle a language on or off, or change its sort order.
  5. Toggle the member language picker.
- **Suggested mobile screen(s):** `AdminTranslationSettings`:
  - key card: status, source, `••••7f2a` hint, Replace and Clear actions
  - "Show language picker" switch
  - Sync button
  - locale list: name, native name, RTL badge, enabled switch, drag to reorder, and translated/reviewed/stale counts against `totalStrings`
- **API(s):**
  - `GET /api/admin/translations/locales`
  - Auth required: yes — any admin role
  - Response:
    ```ts
    interface AdminLocalesResponse { locales: { code: string; name: string; nativeName: string; direction: "LTR"|"RTL"; isEnabled: boolean; sortOrder: number; translated: number; reviewed: number; stale: number }[]; totalStrings: number; configured: boolean; source: "database"|"environment"|"none"; hint: string|null; showPicker: boolean }
    ```
    ```json
    { "locales": [{ "code": "es", "name": "Spanish", "nativeName": "español", "direction": "LTR", "isEnabled": true, "sortOrder": 1, "translated": 610, "reviewed": 120, "stale": 4 }], "totalStrings": 623, "configured": true, "source": "database", "hint": "••••7f2a", "showPicker": true }
    ```
  - Errors: 401
  - `POST /api/admin/translations/locales`
  - Auth required: yes — any admin role
  - Request — body. Exactly one form; they are checked in this order:
    | Form | Fields | Rules | Response |
    |---|---|---|---|
    | Set key | `{ action:"key", apiKey: string }` | trimmed; `""` clears | `{ ok:true, configured, source, hint, showPicker }` |
    | Picker | `{ action:"picker", on: boolean }` | – | `{ ok:true, configured, source, hint, showPicker }` |
    | Sync | `{ action:"sync" }` | calls Google; "en" is skipped; an existing row's isEnabled, sortOrder and nativeName are kept | `{ ok:true, added: number, total: number }` |
    | Locale | `{ code: string, isEnabled?: boolean, sortOrder?: number }` | `code` required | `{ ok:true }` |
  - Errors:
    - 401
    - 400 — `No key given.` (apiKey is not a string)
    - 400 — `On or off?`
    - 400 — `Which language?` (no code)
    - 400 — the adapter or Prisma error message (missing key, disabled API, billing problem, unknown code)
- **Form fields:**
  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | Google API key | password | no | – | – |
  | Show language picker | switch | – | – | – |
  | Enabled (per locale) | switch | – | – | – |
  | Sort order (per locale) | number | – | – | – |
- **Business rules:**
  - A key saved in the database takes priority over the environment key.
  - Every write clears the settings cache and the i18n cache.
  - "Stale" means the English source text changed after the translation was saved.
  - Not audited.
- **Edge cases / notes for the mobile app:** The `source` value tells you whether the key comes from the database or the server environment.
- **Status:** ✅ Complete

## Translations → String catalogue
- **Description:** The catalogue of UI strings for one language. You can filter, edit a translation by hand (the edit is marked HUMAN and reviewed), or mark a machine translation as reviewed.
- **Who can use it:** OWNER, ADMIN, MODERATOR.
- **Source files:** `src/app/api/admin/translations/strings/route.ts`, `src/lib/translations-admin.ts` (`listStrings`, `saveTranslation`, `markReviewed`), `src/app/admin/(dashboard)/translations/page.tsx`
- **User flow:**
  1. Pick a language and a filter (Missing, Machine-unreviewed, Reviewed, Stale, All). You can also search.
  2. Edit a value and save. Or tap "Looks right" to mark it reviewed.
  3. Page through results with skip/take.
- **Suggested mobile screen(s):** `AdminTranslations`:
  - locale picker, filter chips, search
  - rows: key, English text, context, current value, GOOGLE/HUMAN badge, reviewed and stale markers
  - tap a row to open an editor sheet with Save and Mark reviewed
- **API(s):**
  - `GET /api/admin/translations/strings`
  - Auth required: yes — any admin role
  - Request — query:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | locale | string | yes | locale code | – | `es` |
    | filter | `all`\|`missing`\|`machine`\|`reviewed`\|`stale` | no | an unknown value behaves like all | all | `missing` |
    | q | string | no | matches key or English text | – | `donate` |
    | take | int | no | 1..200 | 50 | `50` |
    | skip | int | no | ≥0 | 0 | `50` |
  - Response:
    ```ts
    interface AdminStringsResponse { rows: { id: string; key: string; english: string; context: string|null; value: string|null; source: "GOOGLE"|"HUMAN"|null; reviewed: boolean; stale: boolean }[]; total: number }
    ```
    ```json
    { "rows": [{ "id": "clstr1", "key": "donate.button", "english": "Donate", "context": "Button on event page", "value": "Donar", "source": "GOOGLE", "reviewed": false, "stale": false }], "total": 1 }
    ```
  - Errors: 401 · 400 — `Which language?`
  - `POST /api/admin/translations/strings`
  - Auth required: yes — any admin role
  - Request — body:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | stringId | string | yes | – | – | `clstr1` |
    | locale | string | yes | – | – | `es` |
    | value | string | for save | trimmed; an empty value is allowed and stored as "" | "" | `Donar ahora` |
    | action | `review` | no | `review` marks reviewed and ignores `value` | – | `review` |
  - Response: `{ "ok": true }`
  - Errors: 401 · 400 — `Which string, and which language?` · 400 — `String not found` · 400 — Prisma error (reviewing a translation that doesn't exist)
- **Form fields:** Translation (multiline text).
- **Business rules:**
  - Saving sets source HUMAN, marks it reviewed (`reviewedAt` and `reviewedByAdminId`), and records the current `sourceHash`, so the translation is no longer stale.
  - Marking reviewed keeps the text and also refreshes `sourceHash`.
  - Every write clears the i18n cache.
- **Edge cases / notes for the mobile app:**
  - Filtering happens in memory after loading every string, so `total` counts the filtered results.
  - Keep `{placeholders}` intact. The machine-translate step treats a translation with missing placeholders as broken.
- **Status:** ✅ Complete

## Translations → Machine translate
- **Description:** Asks Google to fill in missing translations for one language, plus stale and broken ones. It never overwrites a human-written or reviewed translation.
- **Who can use it:** OWNER, ADMIN, MODERATOR.
- **Source files:** `src/app/api/admin/translations/translate/route.ts`, `src/lib/translations-admin.ts` (`machineTranslateMissing`), `src/lib/google-translate.ts` (`translateBatch`, `placeholdersIn`)
- **User flow:**
  1. On the catalogue screen, tap "Fill gaps with Google".
  2. Wait; it can take up to 300s.
  3. The response reports how many strings were translated and skipped.
  4. Errors such as a missing key or a billing problem return 400 with Google's message.
- **Suggested mobile screen(s):** A button on `AdminTranslations` with a confirm dialog ("include stale?") and a progress/result toast.
- **API(s):**
  - `POST /api/admin/translations/translate`
  - Auth required: yes — any admin role
  - Request — body:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | locale | string | yes | – | – | `es` |
    | includeStale | boolean | no | only an explicit `false` turns it off | true | `true` |
    | limit | number | no | caps how many strings are sent | all | `100` |
  - Response:
    ```ts
    interface AdminTranslateResponse { ok: true; translated: number; skipped: number }
    ```
    ```json
    { "ok": true, "translated": 13, "skipped": 610 }
    ```
  - Errors: 401 · 400 — `Which language?` · 400 — the Google or adapter error message
- **Form fields:** Include stale (switch), Limit (number, optional).
- **Business rules:** Strings to translate are:
  - ones with no translation yet
  - unreviewed GOOGLE translations whose `{placeholders}` don't match the English
  - stale GOOGLE translations, if `includeStale` is on

  A result that loses a placeholder is stored as the English text instead and counted as skipped. Rows that were machine-translated again are un-reviewed. The i18n cache is cleared.
- **Edge cases / notes for the mobile app:** This is a long-running request. Use a timeout of at least 5 minutes.
- **Status:** ✅ Complete

## Translations → Extract strings
- **Description:** Scans the server's `src/` tree for `t()` calls and thrown error strings, then updates the string catalogue. It is the same work as `npm run i18n:extract`. It is a dry run unless `apply:true` is sent; `prune:true` deletes strings the code no longer uses, along with their translations.
- **Who can use it:** OWNER, ADMIN, MODERATOR. With `prune:true` it is **OWNER and ADMIN only** (inline check: MODERATOR → 403).
- **Source files:** `src/app/api/admin/translations/extract/route.ts`, `src/lib/i18n-extract.ts` (`extractStrings`, `ExtractReport`), `src/lib/string-scan.ts` (`ScanProblem`), `src/lib/i18n.ts` (`clearI18nCache`)
- **User flow:**
  1. Tap "Scan code". This sends a dry run.
  2. Review the counts and lists: added, changed (whose translations will become stale), removed, collisions, problems.
  3. Tap "Apply" (`apply:true`).
  4. Optionally prune (`apply:true, prune:true`).
- **Suggested mobile screen(s):** `AdminTranslationExtract`: a summary card (files scanned, calls, strings, characters), expandable lists (added, changed, removed, collisions, problems), "Apply" and "Apply + prune" buttons (prune hidden for moderators), and a refusal banner.
- **API(s):**
  - `POST /api/admin/translations/extract`
  - Auth required: yes — any admin role; `prune:true` requires OWNER or ADMIN
  - Request — body:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | apply | boolean | no | only `true` writes | false | `true` |
    | prune | boolean | no | only `true` prunes | false | `false` |
  - Response:
    ```ts
    interface AdminExtractResponse { ok: true; sourceAvailable: boolean; scannedFiles: number; serverFiles: number; calls: number; strings: number; characters: number; added: string[]; changed: string[]; removed: string[]; collisions: { key: string; variants: { file: string; line: number; english: string }[] }[]; problems: { file: string; line: number; reason: string; excerpt: string }[]; wrote: number; pruned: number; refused: string|null }
    ```
    ```json
    { "ok": true, "sourceAvailable": true, "scannedFiles": 702, "serverFiles": 310, "calls": 1490, "strings": 623, "characters": 41200, "added": ["live.ended.title"], "changed": [], "removed": [], "collisions": [], "problems": [], "wrote": 0, "pruned": 0, "refused": null }
    ```
  - Errors: 401 · 403 — `Moderators can't remove strings — it deletes their translations too.` · 500 — the error message, or `Could not read the code.`
- **Form fields:** none (buttons only).
- **Business rules:**
  - Admin pages and components and the API folder are skipped in the first pass. The second pass deliberately walks `src/lib` and `src/app/api` to collect thrown error strings.
  - `sourceAvailable:false` means the deployed server has no `src/` folder.
  - Writing changed English text makes its existing translations stale.
  - The i18n cache is cleared after a write.
- **Edge cases / notes for the mobile app:** Long-running, up to 300s. This only affects the web catalogue, unless the mobile app also uses these strings.
- **Status:** ✅ Complete

## Translations → Content translation health
- **Description:** A diagnostic for automatic translation of member content (posts, chat, etc.). It reports:
  - whether the cache table exists
  - row counts by language and by content kind
  - whether a key is configured
  - optionally, the result of a real probe translation
- **Who can use it:** OWNER, ADMIN, MODERATOR.
- **Source files:** `src/app/api/admin/translations/content/route.ts`, `src/lib/content-translate.ts` (`contentTranslationHealth`, `ContentHealth`)
- **User flow:**
  1. Open the health card.
  2. Optionally tap "Probe" with a locale. This spends a few characters of Google quota.
  3. Read the status lines.
- **Suggested mobile screen(s):** A `ContentTranslationHealth` card on `AdminTranslationSettings`: table-ready indicator, total rows, per-locale and per-kind counts, a key-configured indicator, a Probe button with a locale input and the probe result.
- **API(s):**
  - `GET /api/admin/translations/content`
  - Auth required: yes — any admin role
  - Request — query: `probe?` (locale code; when present, a short test string is translated)
  - Response:
    ```ts
    interface AdminContentHealth { tableReady: boolean; rows: number; byLocale: { locale: string; rows: number }[]; byKind: { kind: string; rows: number }[]; configured: boolean; probe: { ok: boolean; message: string } | null; error: string|null }
    ```
    ```json
    { "tableReady": true, "rows": 5400, "byLocale": [{ "locale": "es", "rows": 3100 }], "byKind": [{ "kind": "post", "rows": 2900 }, { "kind": "chat", "rows": 0 }], "configured": true, "probe": { "ok": true, "message": "Привет" }, "error": null }
    ```
  - Errors: 401. Every other failure is reported in the response body (`error`, `tableReady:false`).
- **Form fields:** Probe locale (text, optional).
- **Business rules:** A content kind with 0 rows either has nothing to translate or is failing; the server log says which.
- **Edge cases / notes for the mobile app:** —
- **Status:** ✅ Complete

---

## Gaps & open questions

### Gaps (backend changes suggested)

1. **No "current admin" endpoint.** Nothing tells the app who is signed in or what their role is. → Add `GET /api/admin/auth/me` returning `{ id, email, displayName, role }`.
2. **Cookie-only auth.** Login returns only `{ok:true}` and sets an HttpOnly cookie. → Use a native cookie jar, or add bearer-token support to `getCurrentAdmin()`.
3. **No brute-force protection on admin login.** → Apply `src/lib/rate-limit.ts` per IP and per email, and log failed logins.
4. **Admin sessions can't be revoked.** Tokens are stateless. Logout and an owner's password reset do not kill existing sessions; only deactivation does. → Add a session version or `passwordChangedAt` check.
5. **Non-owners can't change their own password.** → Add `POST /api/admin/auth/password`.
6. **Moderators can change sensitive configuration.** All of these are allowed for MODERATOR:
   - email API key, storage, cache and general settings
   - email templates
   - Google Translate key
   - member creation and permanent deletion

   → Gate these to ADMIN or higher, the same way money and stream settings are gated.
7. **Admin-triggered password reset sends a placeholder link** (`/reset/admin-triggered`). → Generate a real reset token.
8. **Chat admin actions are not audited**, and member/message routes don't check that the `[memberId]`/`[messageId]` belongs to the room `[id]` in the path. Status changes made through member PATCH don't adjust `memberCount`.
9. **Email logs are written but never readable.** → Add `GET /api/admin/email-logs`.
10. **Several lists have no pagination:** live (fixed 50), chat rooms, members, messages (latest 100), banned words, notifications (20), payouts and donations (max 200).
11. **A non-numeric `page` or `perPage` causes a 500** (NaN is passed to Prisma). The `reason` filter on reports is not validated either.
12. **Settings PUTs for general, email and cache don't validate value types.**
13. **SVG uploads are accepted** and served from the site origin.
14. **ffmpeg installs and payment-settings changes are not written to the AdminActionLog**, even though `PAYMENT_SETTINGS_UPDATED` exists in the enum.
15. **`donation_receipt` can be deleted.** It is not in the protected template slugs, although the app sends it.
16. **The block-streaming endpoint blocks when `allowed` is missing.** It should require an explicit boolean.

### Open questions
- Should the admin area be built in the mobile app at all, or only a subset (moderation queue, notifications, user status)?
- Is it intended that MODERATORs can hard-delete members, create members, edit email templates, and change the email and Google API keys?
- Should the admin-triggered password reset generate a real token?
- Is a cross-room chat-message report queue wanted? Today there is only a per-room "reported" filter.
- Should ADMIN and MODERATOR accounts be able to change their own passwords?
