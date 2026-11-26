# Backend Code Audit – worldwecare.com

_Date: 25 November 2026_

**Total issues: 69** — Critical: 2 · High: 8 · Medium: 31 · Low: 28

Estimated fix effort: **73–222 hours**

| Category | Count |
|---|---|
| Security | 29 |
| Database | 9 |
| Bug | 13 |
| Error handling | 2 |
| Performance | 3 |
| Config & deployment | 6 |
| Code quality | 3 |
| Missing best practices | 4 |

## Security

### SEC-01 — "Anonymous" posts, comments and chat messages reveal who wrote them

- **Severity:** Critical  
- **Effort:** M  
- **Location:** `src/lib/posts-feed.ts:153-155`, `src/lib/comments.ts:112-114`, `src/lib/chat-user.ts:97-99`, `src/lib/articles.ts:333-335`, `src/lib/posts-write.ts:83`

**Problem:** When a member posts "anonymously", the website hides their name on screen, but the server still sends the real user ID, name and photo in the data it returns to the browser. The public feed endpoint does not even require sign-in.

**Impact:** Anyone (no account needed) can open the browser's developer tools and see who wrote every anonymous post or comment. On a wellbeing / support community this is a serious privacy breach and a reputational and legal risk.

**Recommended fix:** In every place that converts a database row into an API response, return authorId=null, authorName="Anonymous", authorAvatar=null when isAnonymous is true (gratitude-comments.ts already does this correctly). Compute "is this mine" on the server.

### SEC-02 — Live-streaming server's control panel is left open without a password

- **Severity:** High  
- **Effort:** S  
- **Location:** `deploy/mediamtx/mediamtx.yml:34-35`, `deploy/mediamtx/mediamtx.yml:93-108`

**Problem:** The streaming server (MediaMTX) listens for admin commands on port 9997 on every network interface. With authMethod: http, the 'api' action is excluded from the auth hook — in MediaMTX that means it is allowed with no check, so the 'wwc-api' user/password below is never actually asked for. The password itself is also the placeholder 'CHANGE-ME'.

**Impact:** If port 9997 is reachable from the internet, anyone can kick broadcasters, change the streaming configuration, or add path hooks that run commands on the server.

**Recommended fix:** Bind the API to localhost/private IP (apiAddress: 127.0.0.1:9997), remove 'action: api' from authHTTPExclude (the app's auth hook already denies it) or put the API behind an authenticated proxy, firewall ports 9996/9997, and set a real password.

### SEC-03 — Members can upload SVG images that run malicious code on the site

- **Severity:** High  
- **Effort:** M  
- **Location:** `src/lib/upload.ts:29-37`, `src/lib/image-variants.ts:77-82`, `src/app/api/user/upload/route.ts:40`

**Problem:** Any signed-in member can upload an .svg file. The file type is taken from what the browser claims, SVGs are stored unchanged, and they are served from the main website address. An SVG file can contain JavaScript.

**Impact:** An attacker uploads a booby-trapped image and sends the link to an admin. When the admin opens it, the script runs as the admin and can call admin APIs (delete users, change payment settings, etc.).

**Recommended fix:** Remove image/svg+xml from member uploads (or sanitise with DOMPurify/svgo). Detect file type from the file's actual bytes. Serve /uploads with 'Content-Security-Policy: sandbox' and 'X-Content-Type-Options: nosniff', ideally from a separate domain.

### SEC-04 — Lowest-level moderators can permanently delete any member or change their email

- **Severity:** High  
- **Effort:** S  
- **Location:** `src/app/api/admin/users/[id]/route.ts:28-61`, `src/lib/users-admin.ts:165-170`, `src/lib/users-admin.ts:301`

**Problem:** The member edit/delete endpoints only check 'is this any admin?' — they do not check the role. A MODERATOR (the lowest-trust role) can hard-delete any member, or change a member's email to one they control. The new email is also not validated or checked for duplicates.

**Impact:** A moderator (or anyone who steals a moderator's login) can take over any member account by changing its email and using 'forgot password', or wipe accounts. Ironically, deleting a single post is already restricted to OWNERs.

**Recommended fix:** Block MODERATOR from DELETE and from email changes (or make them OWNER/ADMIN-only); validate email format and uniqueness before saving.

### SEC-05 — Moderators can change email-provider, storage, site and translation-key settings

- **Severity:** High  
- **Effort:** S  
- **Location:** `src/app/api/admin/settings/email/route.ts:49-66`, `src/app/api/admin/settings/storage/route.ts:34-43`, `src/app/api/admin/settings/general/route.ts:29-31`, `src/app/api/admin/translations/locales/route.ts:51-55`

**Problem:** These settings pages accept changes from any admin, including MODERATOR. The stream-settings page already blocks moderators, so this is inconsistent.

**Impact:** A moderator could replace the email API key (all password-reset emails then go through their account or stop), point all new uploads at a server they control, rename the site, or swap the paid Google Translate key.

**Recommended fix:** Apply the same MODERATOR → 403 check used in settings/stream/route.ts (or requireOwner for credentials) to these PUT/POST handlers and to settings/cache.

### SEC-06 — Link-preview feature can be abused to make the server fetch internal addresses (SSRF)

- **Severity:** High  
- **Effort:** M  
- **Location:** `src/lib/link-preview.ts:17-29`, `src/lib/link-preview.ts:61-74`

**Problem:** The server fetches any URL a member pastes to build a preview. It blocks obvious private addresses by text only: it follows redirects without re-checking, doesn't resolve DNS (e.g. a domain pointing to 127.0.0.1), misses IPv6 forms like [::1], and reads the whole response into memory before trimming. No rate limit.

**Impact:** A member can make the server reach internal services or cloud metadata endpoints (which can hold credentials), use it as a port scanner, or exhaust memory with a huge response.

**Recommended fix:** Use redirect:'manual' and re-validate each hop; resolve DNS and reject private/loopback/link-local/IPv6-mapped ranges; stream the body with a byte cap and keep the timeout running; add per-user rate limiting.

### SEC-07 — Banned chat-room members can lift their own ban by leaving and re-joining

- **Severity:** High  
- **Effort:** S  
- **Location:** `src/lib/chat-user.ts:272-286`

**Problem:** A ban is stored only on the member's room-membership record. 'Leave room' deletes that record whatever its status — including BANNED. Re-joining then creates a fresh, active membership.

**Impact:** Moderator bans in chat rooms (including support/crisis rooms) are ineffective; a banned user is back in two clicks.

**Recommended fix:** If the membership is BANNED, refuse to leave (or keep the row with BANNED status). Add a test for this.

### SEC-08 — No protection against password guessing on admin and member login

- **Severity:** Medium  
- **Effort:** M  
- **Location:** `src/app/api/admin/auth/login/route.ts:16-68`, `src/app/api/user/auth/login/route.ts:12-99`

**Problem:** Neither login endpoint limits the number of attempts, and there is no account lockout or delay after failures (rate limiting exists in the project but is only used on signup/captcha/donations/translation).

**Impact:** Attackers can try unlimited passwords against admin and member accounts.

**Recommended fix:** Apply the existing rateLimit() per IP and per email on both login routes; add a per-account failure counter with backoff. Consider 2FA for admins.

### SEC-09 — Login timing protection is broken, so attackers can tell which emails have accounts

- **Severity:** Medium  
- **Effort:** S  
- **Location:** `src/app/api/user/auth/login/route.ts:34-37`, `src/app/api/admin/auth/login/route.ts:43-46`

**Problem:** To hide whether an email exists, the code checks the password against a fake hash. That fake hash is 63 characters long instead of 60, so the library rejects it instantly. Measured with the project's own bcryptjs: 1 ms for an unknown email versus ~200 ms for a real account.

**Impact:** Anyone can find out which email addresses (including admin emails) are registered, which helps targeted attacks and is a privacy leak for a sensitive community.

**Recommended fix:** Replace the constant with a real 60-character bcrypt hash (e.g. generated once at startup with bcrypt.hash).

### SEC-10 — Rate limiting and the streaming IP allow-list can be bypassed with a fake header

- **Severity:** Medium  
- **Effort:** S  
- **Location:** `src/lib/rate-limit.ts:87-95`, `src/app/api/mediamtx/auth/route.ts:69-75`, `src/app/api/mediamtx/auth/route.ts:98-99`

**Problem:** The caller's IP is taken from the left-most X-Forwarded-For value, which the caller can set to anything (a standard nginx setup appends to it rather than replacing it). The limiter is also in-memory, per process.

**Impact:** Signup/captcha/donation rate limits can be bypassed by sending a different fake IP each time; the MediaMTX allow-list check can be passed by claiming the media server's IP.

**Recommended fix:** Use the right-most IP added by your own proxy (or X-Real-IP set by nginx to $remote_addr), and configure nginx to overwrite rather than append. Move limits to Redis/DB if running multiple workers.

### SEC-11 — Built-in fallback secret keys; app starts even if secrets are missing

- **Severity:** Medium  
- **Effort:** S  
- **Location:** `src/lib/session.ts:44-56`, `src/lib/session.ts:73-77`

**Problem:** If ADMIN_SESSION_SECRET / USER_SESSION_SECRET are not set, the code silently uses fixed, publicly visible strings to sign login cookies. There is no startup check that required environment variables exist. (They are set in the supplied .env.)

**Impact:** One missed environment variable on a new server means anyone can forge an admin login cookie.

**Recommended fix:** Throw at startup when NODE_ENV=production and any required secret is missing (a small env.ts validated with zod).

### SEC-12 — Emails sent by the platform can be injected with attacker HTML/links

- **Severity:** Medium  
- **Effort:** S  
- **Location:** `src/lib/email.ts:66-75`, `src/lib/email.ts:107-108`, `src/app/api/admin/users/[id]/send-email/route.ts:54-56`, `src/app/api/admin/email-templates/[id]/test/route.ts:57-60`

**Problem:** Values such as the member's display name are inserted into email HTML without escaping. A display name can contain HTML such as a link. Separately, any admin (including moderators) can override the reset/confirm link variables when sending template emails.

**Impact:** Attackers can make the platform send genuine-looking emails (e.g. 'verify your email') containing their own phishing link, from the real domain.

**Recommended fix:** HTML-escape all variables when rendering the HTML body; don't allow request-supplied variables to override system link keys; restrict send-email/test-send to ADMIN+ and rate-limit them.

### SEC-13 — Open redirect after email verification

- **Severity:** Medium  
- **Effort:** S  
- **Location:** `src/app/api/user/auth/refresh-verified/route.ts:36-40`

**Problem:** The ?next= redirect target is checked only for leading '//' and '/\'. A value such as '/%09/evil.com' (a tab character) passes the check, and browsers strip the tab and go to evil.com.

**Impact:** A link that starts on the real site can bounce users to a phishing site — useful for credential theft.

**Recommended fix:** Parse with new URL(raw, 'http://x'), require the origin to be unchanged, and redirect to pathname+search only; reject control characters and backslashes.

### SEC-14 — Resetting an admin's password does not log out their existing sessions

- **Severity:** Medium  
- **Effort:** M  
- **Location:** `src/lib/admins-admin.ts:316-320`, `src/lib/admin-auth.ts:42-60`

**Problem:** Member accounts have a 'sessions valid from' timestamp that kills old logins after a password change; admin accounts do not. Admin login cookies stay valid for 30 days regardless of password resets.

**Impact:** If an admin's cookie or laptop is stolen, changing the password does not lock the attacker out.

**Recommended fix:** Add sessionsValidFrom to AdminUser, stamp it on password reset/deactivation, and compare the cookie's issue time in getCurrentAdmin (same as user-auth.ts).

### SEC-15 — Campaign donations can be redirected into the donor's own withdrawable balance

- **Severity:** Medium  
- **Effort:** S  
- **Location:** `src/lib/donations.ts:108`, `src/lib/donations.ts:118-128`, `src/app/api/user/donations/checkout/route.ts:49`

**Problem:** For events and live streams the server decides who receives the money, but for campaigns it keeps whatever recipientUserId the browser sends. A crafted request can file a donation under a campaign while crediting any member, including the donor.

**Impact:** Money intended for a campaign can be credited to a member's payout balance; combined with stolen cards this is a fraud/money-laundering path.

**Recommended fix:** When campaignId is set, force recipientUserId = null; refuse recipientUserId === donor; only accept a bare recipientUserId if a 'tip a member' feature truly exists.

### SEC-16 — Live chat/message streams keep delivering messages after a user is banned or removed

- **Severity:** Medium  
- **Effort:** M  
- **Location:** `src/app/api/user/chatrooms/[slug]/stream/route.ts:27-36`, `src/app/api/admin/notifications/stream/route.ts:31-51`

**Problem:** Real-time streams check permission once, when the connection opens. Removal from a private room, a ban, a new block, or a site-wide ban is not re-checked while the connection stays open. Same for the admin notification stream.

**Impact:** A removed or banned person keeps reading a private room (or admin notifications) for as long as their tab stays open.

**Recommended fix:** Re-check membership/ban/session every ~30 seconds inside the stream loop and close the stream when access is lost.

### SEC-17 — Anyone can send unlimited "crisis alerts" to any chat room's moderators

- **Severity:** Medium  
- **Effort:** S  
- **Location:** `src/lib/chat-user.ts:676-695`

**Problem:** The panic/crisis button does not check that the person is a member of the room, is not banned, or how often they press it.

**Impact:** A troll can flood moderators of every room (including private ones) with crisis alerts, causing alert fatigue on the platform's most safety-critical signal.

**Recommended fix:** Require active, non-banned membership and rate-limit (e.g. 1 alert per user per room per 10 minutes).

### SEC-18 — No spam limits on posting, comments, direct messages, reports and submissions

- **Severity:** Medium  
- **Effort:** M  
- **Location:** `src/app/api/user/posts/route.ts:43`, `src/lib/dm.ts:286-345`, `src/app/api/user/translate-content/route.ts:51`

**Problem:** Apart from signup, captcha, donations and translation-for-guests, no write endpoint has a rate limit: posts, comments, DMs, reports, follows, petitions/events/places/hero submissions (each notifies every admin), uploads, link previews. Signed-in users also skip the translation limit.

**Impact:** One account (or a script) can spam the community, flood strangers' message requests, bury admins in notifications, and run up the paid Google Translate bill.

**Recommended fix:** Add per-user rateLimit() keys on all write routes; allow only 1–3 DMs before the recipient accepts.

### SEC-19 — No security headers (CSP, HSTS, clickjacking, nosniff)

- **Severity:** Medium  
- **Effort:** M  
- **Location:** `next.config.ts:4-25`

**Problem:** next.config.ts defines no headers(), and middleware adds none. There is no Content-Security-Policy, Strict-Transport-Security, X-Frame-Options or X-Content-Type-Options. (No nginx config is included in the project, so it may be set there — see Needs Confirmation.)

**Impact:** Makes XSS (see SEC-03) and clickjacking much easier to exploit; browsers get no instruction to always use HTTPS.

**Recommended fix:** Add a headers() block in next.config.ts (or in nginx) with CSP, HSTS, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy.

### SEC-20 — Profile pictures and attachment URLs can point to any external server

- **Severity:** Medium  
- **Effort:** M  
- **Location:** `src/lib/profile.ts:66-67`, `src/lib/attached-media.ts:70-82`, `src/lib/chat-user.ts:381-384`

**Problem:** Avatar, cover, post-image and chat-attachment URLs are stored as any string, not restricted to the site's own uploads.

**Impact:** A member can set an image hosted on their own server and log the IP address and device of everyone (including admins) who views their profile or messages — a privacy problem on a mental-health community.

**Recommended fix:** Only accept URLs under the site's /uploads path that belong to the user (UploadedFile ownership), as is already done for videos.

### SEC-21 — Seed script creates an owner admin with a fixed, known password

- **Severity:** Medium  
- **Effort:** S  
- **Location:** `prisma/seed.ts:22-23`, `prisma/seed.ts:147`

**Problem:** The main seed creates an OWNER admin account with a hard-coded password (value withheld: ch*******3) and prints it; demo users share another fixed password. Seeds do not refuse to run in production and there is no forced password change.

**Impact:** If the seed was ever run on the live database and the password not changed, anyone who has seen the code can log in as the site owner.

**Recommended fix:** Read the initial admin password from an environment variable or generate a random one; block demo seeds when NODE_ENV=production; verify and rotate the live owner password now.

### SEC-22 — Password-reset and verification tokens stored in plain text

- **Severity:** Low  
- **Effort:** S  
- **Location:** `src/lib/verification.ts:64-71`

**Problem:** Tokens are strong, single-use and expire, but they are saved in the database as-is rather than hashed.

**Impact:** Anyone with read access to the database or a backup could use a live reset token to take over an account.

**Recommended fix:** Store sha256(token) and look up by hash.

### SEC-23 — Changing account email doesn't alert the old address or sign out other devices

- **Severity:** Low  
- **Effort:** S  
- **Location:** `src/lib/account.ts:105-114`

**Problem:** A password change notifies the user and logs out other sessions; an email change (a common account-takeover step) does neither.

**Impact:** A hijacker can change the email quietly and keep other sessions alive.

**Recommended fix:** Email the old address and stamp sessionsValidFrom on email change.

### SEC-24 — Login reveals that an account is banned/deactivated before checking the password

- **Severity:** Low  
- **Effort:** S  
- **Location:** `src/app/api/user/auth/login/route.ts:48-69`

**Problem:** The banned/deactivated messages are returned without verifying the password.

**Impact:** Lets anyone check whether a given email belongs to a banned or deactivated member.

**Recommended fix:** Verify the password first, then return the status-specific message.

### SEC-25 — Password hashing strength below the code's own production target

- **Severity:** Low  
- **Effort:** S  
- **Location:** `src/lib/password.ts:4-11`

**Problem:** bcrypt cost is 10; the file's own comment says 'bump to 12 before production'.

**Impact:** Stolen password hashes are about 4× cheaper to crack than intended.

**Recommended fix:** Set COST = 12 (existing hashes keep working).

### SEC-26 — Chat reactions and message reports ignore room access

- **Severity:** Low  
- **Effort:** S  
- **Location:** `src/lib/chat-user.ts:528-566`

**Problem:** Reacting to or reporting a chat message looks it up by ID only, without checking the person can read that room or is not banned.

**Impact:** Non-members/banned users who know a message ID can react to (and notify) people in private rooms.

**Recommended fix:** Load the room, require canRead (and not banned) and check the message belongs to the room in the URL.

### SEC-27 — Formatted-text links allow '/\evil.com' style off-site links

- **Severity:** Low  
- **Effort:** S  
- **Location:** `src/lib/rich-text.tsx:41`

**Problem:** Links starting with '/\' are treated as internal but browsers open them as another website.

**Impact:** Phishing links can be disguised as internal links in posts.

**Recommended fix:** Reject URLs matching ^/[\\/].

### SEC-28 — Blocked users can still comment on and react to the blocker's posts

- **Severity:** Low  
- **Effort:** S  
- **Location:** `src/lib/comments.ts:134-183`, `src/lib/posts-feed.ts:438-505`

**Problem:** Comment and like actions don't check user blocks (direct messages do).

**Impact:** Blocking doesn't stop harassment on a member's own posts; the blocker still receives notifications.

**Recommended fix:** Refuse when either party has blocked the other (reuse areBlocked from dm.ts).

### SEC-29 — Logout can be triggered by other websites

- **Severity:** Low  
- **Effort:** S  
- **Location:** `src/app/api/user/auth/logout/route.ts:9-15`

**Problem:** The logout endpoint has no origin check; a cross-site form can sign users out.

**Impact:** Nuisance only (forced logout).

**Recommended fix:** Check the Origin header matches the site.

## Database

### DB-01 — "Delete my account" leaves personal data behind

- **Severity:** High  
- **Effort:** L  
- **Location:** `src/lib/account.ts:297`, `src/lib/account.ts:486-511`, `prisma/schema.prisma:1265-1310`

**Problem:** Many tables store a user ID without a database relation (petition signatures and reactions, confessions and their comments, gratitude/live comments, hero hearts, reactions). The delete routine assumes the database removes these automatically — it doesn't. Petitions, campaigns, hero nominations and live streams also stay linked to the deleted ID.

**Impact:** After deleting their account, a member's name and signing comment stay public under petitions and their confessions survive. This conflicts with the promise of account deletion and with privacy laws such as GDPR.

**Recommended fix:** Add deleteMany/anonymise steps for every loose user-ID table (or add real relations with onDelete: Cascade) and recount affected counters. Add a test that a deleted user leaves no rows behind.

### DB-02 — Admin "delete user" skips all clean-up

- **Severity:** High  
- **Effort:** M  
- **Location:** `src/lib/users-admin.ts:301`

**Problem:** Admin deletion is a single delete statement, unlike the member self-delete routine which cleans up follows, blocks, DMs, RSVPs, counters, etc.

**Impact:** Leaves orphan data pointing at a non-existent user and inflated follower/RSVP/supporter counts; same privacy issue as DB-01.

**Recommended fix:** Reuse the deleteAccount clean-up steps (and the recount library) for admin deletion.

### DB-03 — No database migration history

- **Severity:** Medium  
- **Effort:** M  
- **Location:** `package.json:16`, `prisma/ (no migrations folder)`

**Problem:** Schema changes are applied with 'prisma db push' and there is no prisma/migrations folder. The only SQL change script (rename-fanbase-to-library.sql) is manual.

**Impact:** No reliable, repeatable way to update the live database; risk of accidental data loss when the schema changes; impossible to know whether production matches the code.

**Recommended fix:** Baseline the current production schema with 'prisma migrate diff' / 'migrate resolve', then use 'prisma migrate deploy' in deployments.

### DB-04 — Account deletion is not all-or-nothing, and the error message is wrong

- **Severity:** Medium  
- **Effort:** M  
- **Location:** `src/lib/account.ts:385-541`, `src/app/api/user/settings/delete/route.ts:55`

**Problem:** Deletion runs ~10 separate steps without a transaction. If the final step fails, posts and messages are already permanently gone, yet the user is told 'Nothing was lost — try again'.

**Impact:** Half-deleted accounts and misleading information to users.

**Recommended fix:** Wrap in prisma.$transaction (or make steps idempotent) and correct the message.

### DB-05 — Events can be over-booked; RSVPs allowed after an event has ended

- **Severity:** Medium  
- **Effort:** S  
- **Location:** `src/lib/events.ts:241-261`

**Problem:** Capacity is read, then the RSVP is created separately, so simultaneous RSVPs for the last seat all succeed. Only status is checked, not the event date.

**Impact:** Events exceed capacity; RSVPs on past events.

**Recommended fix:** Use a conditional update (rsvpCount < capacity) or a row lock in a transaction; reject past events.

### DB-06 — Chat member counters drift when admins ban/approve members

- **Severity:** Low  
- **Effort:** S  
- **Location:** `src/lib/chat-admin.ts:276-293`

**Problem:** Changing a member's status (e.g. ACTIVE→BANNED) doesn't update the room's memberCount.

**Impact:** Room member counts shown to users become wrong until a manual recount script is run.

**Recommended fix:** Adjust the counter in the same transaction based on old/new status.

### DB-07 — Duplicate place reports possible (no unique constraint)

- **Severity:** Low  
- **Effort:** S  
- **Location:** `src/lib/place-reports.ts:52`, `prisma/schema.prisma:2841-2867`

**Problem:** Duplicate check is 'find then create' with no database constraint (post reports do have one).

**Impact:** Duplicate reports; a clean-up script already exists for this.

**Recommended fix:** Mirror PostReport's @@unique([reporterId, openKey]).

### DB-08 — Redundant and missing indexes

- **Severity:** Low  
- **Effort:** S  
- **Location:** `prisma/schema.prisma:200`, `prisma/schema.prisma:1499`, `prisma/schema.prisma:1513`, `prisma/schema.prisma:1865-1878`

**Problem:** Several indexes duplicate a unique key (e.g. User.email); DirectMessage.senderId has no index although it is filtered on during deletion.

**Impact:** Slightly slower writes; slow deletes as message volume grows.

**Recommended fix:** Drop duplicates; add @@index([senderId]).

### DB-09 — Settings are saved piece by piece (partial saves possible)

- **Severity:** Low  
- **Effort:** S  
- **Location:** `src/lib/settings.ts:124-133`

**Problem:** Multiple setting values are written with Promise.all, not a transaction, and values are not type-checked.

**Impact:** A failure can leave half-updated configuration (e.g. new API key with old sender).

**Recommended fix:** Use prisma.$transaction([...]) and validate each key's type.

## Bug

### BUG-01 — Admin "send password reset" emails a link to a page that doesn't exist

- **Severity:** Medium  
- **Effort:** S  
- **Location:** `src/app/api/admin/users/[id]/reset-password/route.ts:38-44`, `src/app/api/admin/users/[id]/send-email/route.ts:54-55`

**Problem:** The admin button sends '/reset/admin-triggered' (marked in a comment as a placeholder). No such page exists; the real token-based reset flow exists elsewhere but isn't used here.

**Impact:** Members who ask support for a reset receive a broken link (404).

**Recommended fix:** Call sendPasswordResetEmail() from lib/verification.ts instead.

### BUG-02 — Digest emails stop reaching members beyond the first 500

- **Severity:** Medium  
- **Effort:** S  
- **Location:** `src/lib/digest.ts:144-174`

**Problem:** Each run loads the same 500 opted-in users (no ordering, no paging) and only then filters by delivery hour.

**Impact:** Once more than 500 members opt in, the rest silently never get their digest.

**Recommended fix:** Filter by digestHour in the query and page through all candidates.

### BUG-03 — Places list is sorted by distance from the middle of the ocean

- **Severity:** Medium  
- **Effort:** S  
- **Location:** `src/app/api/user/places/route.ts:29-46`, `src/lib/places.ts:233-246`

**Problem:** When no location is sent, Number(null) becomes 0, so the server treats every list request as 'near latitude 0, longitude 0' and re-sorts by that distance.

**Impact:** Directory order is wrong (overrides donor/alphabetical order) and bogus distances may be shown.

**Recommended fix:** Only build 'near' when lat, lng and km are all present and valid.

### BUG-04 — Members can delete an entire DM conversation, including the other person's evidence

- **Severity:** Medium  
- **Effort:** S  
- **Location:** `src/lib/dm.ts:293-300`

**Problem:** 'Decline request' deletes the whole conversation for both people and works for any participant, even on accepted conversations — including the sender.

**Impact:** A harasser can erase their messages before the victim reports them.

**Recommended fix:** Allow decline only on the recipient's pending request; otherwise hide/archive for that participant only.

### BUG-05 — Admin deleting an event/campaign can delete other people's files

- **Severity:** Medium  
- **Effort:** S  
- **Location:** `src/lib/media.ts:124`, `src/lib/events.ts:538-541`

**Problem:** When removing an event, every uploaded file referenced in its description/photos is deleted regardless of who owns it. A member can reference someone else's image (or the site logo).

**Impact:** Images belonging to other members or the site can disappear (data loss).

**Recommended fix:** Only delete files owned by the content's author.

### BUG-06 — Live-comment stream may keep querying the database after the viewer leaves

- **Severity:** Medium  
- **Effort:** S  
- **Location:** `src/app/api/user/live/[slug]/comments/stream/route.ts:69-78`

**Problem:** The code comment says a write to a closed connection stops the loop, but the error handler never sets the stop flag. If the browser's disconnect signal isn't delivered (common behind proxies), the loop polls the DB every 1.5 s forever. None of the streams has a maximum lifetime.

**Impact:** Leaked background loops accumulate and slow the database over time.

**Recommended fix:** Set cancelled = true on enqueue failure, add a cancel() callback and a max connection lifetime.

### BUG-07 — Invalid page/limit values crash list endpoints (HTTP 500)

- **Severity:** Low  
- **Effort:** S  
- **Location:** `src/app/api/user/profile/posts/route.ts:18`, `src/lib/posts-feed.ts:238`, `src/lib/users-admin.ts:77-78`, `src/lib/admins-admin.ts:95-96`

**Problem:** Non-numeric values become NaN, which slips through Math.min/max and makes the database query throw.

**Impact:** Unhandled server errors (noise in logs, poor API behaviour).

**Recommended fix:** Use Number.isFinite(n) ? n : default before clamping (best: a zod schema for query params).

### BUG-08 — Double-clicking Sign / RSVP / Support returns a server error

- **Severity:** Low  
- **Effort:** S  
- **Location:** `src/lib/petitions.ts:292-325`, `src/lib/events.ts:245-261`, `src/lib/campaigns.ts:261-264`

**Problem:** Toggles do 'find, then create/delete' outside a transaction; the second concurrent request hits the unique key and throws (no try/catch on the sign route).

**Impact:** Users see errors on double-taps; counters can briefly go wrong.

**Recommended fix:** Treat Prisma P2002/P2025 as idempotent or use upsert/deleteMany.

### BUG-09 — Email-change confirmation can confirm the wrong address

- **Severity:** Low  
- **Effort:** S  
- **Location:** `src/lib/account.ts:61-65`, `src/lib/account.ts:86-108`

**Problem:** The confirmation token is linked to the account, not to the address it was emailed to; two quick change requests can swap which address gets confirmed.

**Impact:** An address can be marked verified without its owner confirming it.

**Recommended fix:** Store the target email on the token row and confirm that value.

### BUG-10 — Malformed filename header crashes video upload

- **Severity:** Low  
- **Effort:** S  
- **Location:** `src/lib/video-upload.ts:52`

**Problem:** decodeURIComponent throws on malformed input and isn't caught.

**Impact:** HTTP 500 instead of a clear error.

**Recommended fix:** Wrap in try/catch with a fallback name.

### BUG-11 — Likes/saves allowed on unpublished articles, clips and unapproved places

- **Severity:** Low  
- **Effort:** S  
- **Location:** `src/lib/articles.ts:275-307`, `src/lib/library.ts:178-221`, `src/lib/places.ts:306`

**Problem:** These actions don't check the item is published/approved (posts do).

**Impact:** Interactions on hidden content; raw database errors for bad IDs.

**Recommended fix:** Look up the parent with a published/approved filter first.

### BUG-12 — Like/unlike and follow/unfollow repeatedly spams notifications

- **Severity:** Low  
- **Effort:** S  
- **Location:** `src/lib/posts-feed.ts:494-503`, `src/lib/follows.ts:62-67`

**Problem:** Each new like/follow creates a new notification, with no de-duplication.

**Impact:** Harassment vector and notification noise.

**Recommended fix:** Skip if an identical notification exists within the last few hours.

### BUG-13 — Signup captcha can be reused by parallel requests

- **Severity:** Low  
- **Effort:** S  
- **Location:** `src/app/api/user/auth/signup/route.ts:126`, `src/app/api/user/auth/signup/route.ts:202`

**Problem:** The solved captcha is only marked as used at the end of signup, after database work.

**Impact:** Several accounts per captcha (still capped by the IP limit).

**Recommended fix:** Mark the captcha used immediately after verification.

## Error handling

### ERR-01 — Internal error details (database errors, server paths) are shown to users

- **Severity:** Medium  
- **Effort:** M  
- **Location:** `src/app/api/admin/daily-reflections/route.ts:33`, `src/app/api/user/petitions/route.ts:63-64`, `src/lib/payouts.ts:325-329`, `src/lib/upload.ts:118-122`, `src/lib/video.ts:402`

**Problem:** About 60 admin handlers and many member handlers return err.message directly. Intended friendly messages and raw Prisma/file-system/ffmpeg errors go through the same path, usually with status 400 even for 'not found' or 'conflict'.

**Impact:** Leaks table/column names and server file paths to attackers; confusing messages for users; wrong status codes for API clients.

**Recommended fix:** Introduce a UserFacingError class (some modules already do this, e.g. DonationRefused); map Prisma P2002→409, P2025→404; log everything else and return a generic message.

### ERR-02 — Some delete/update handlers have no error handling

- **Severity:** Low  
- **Effort:** S  
- **Location:** `src/app/api/admin/petitions/[id]/route.ts:15-20`, `src/app/api/admin/users/[id]/route.ts:60`, `src/app/api/admin/email-templates/[id]/route.ts:63-77`

**Problem:** Deleting an already-deleted item or sending a wrong type throws straight out of the handler.

**Impact:** Generic 500 errors instead of 404/400.

**Recommended fix:** Wrap in try/catch and type-check bodies.

## Performance

### PERF-01 — Message inbox runs one database query per conversation, every few seconds

- **Severity:** Medium  
- **Effort:** M  
- **Location:** `src/lib/dm.ts:361-367`

**Problem:** Unread counts are computed with a separate, sequential count query per conversation, and the header polls this every 25–30 s (the messages page every 8 s).

**Impact:** Database load grows with users × conversations × open tabs; slow pages as the community grows.

**Recommended fix:** Use a single groupBy query or store an unread counter on the participant row.

### PERF-02 — Video conversion has no time limit; no upload quotas

- **Severity:** Medium  
- **Effort:** M  
- **Location:** `src/lib/video.ts:65`, `src/lib/video.ts:204`, `src/lib/upload-limits.ts:41-42`

**Problem:** Only 2 videos convert at a time, there is no timeout on ffmpeg, and the default maximum video length is 'unlimited'. Members can upload unlimited 512 MB videos and 8 MB images.

**Impact:** Two crafted long videos block everyone's uploads for hours; disk can be filled.

**Recommended fix:** Set a default max duration, kill ffmpeg after a wall-clock timeout, add per-user upload quotas/rate limits.

### PERF-03 — Several lists have no paging (return everything at once)

- **Severity:** Medium  
- **Effort:** M  
- **Location:** `src/lib/articles.ts:323-341`, `src/lib/clip-comments.ts:62-80`, `src/lib/campaigns.ts:72`, `src/lib/chat-admin.ts:254`, `src/lib/posts-admin.ts:229`, `src/lib/follows.ts:84-101`

**Problem:** Article and clip comments (public, no sign-in), campaigns, admin room members and post comments are loaded in full; follower lists are hard-capped at 200 with no way to see more. Article/clip comments also don't check the parent is published.

**Impact:** Slow responses and memory spikes as content grows; followers beyond 200 are unreachable.

**Recommended fix:** Add cursor pagination with a capped page size to each.

## Config & deployment

### CFG-01 — Next.js version has a known critical security advisory

- **Severity:** Critical  
- **Effort:** S  
- **Location:** `package.json:63 (next ^15.1.6 → installed 15.5.24)`

**Problem:** npm audit flags the installed Next.js (15.5.24) as CRITICAL (cache poisoning of SSG/ISR pages in self-hosted apps). A patched 15.5.x release is available within the current version range.

**Impact:** Attackers may be able to poison cached pages served to other visitors.

**Recommended fix:** Upgrade to the latest 15.5.x (e.g. 15.5.29) and re-test; plan the Next 16 upgrade separately.

### CFG-02 — 49 other known-vulnerable packages (9 high, 40 moderate)

- **Severity:** Medium  
- **Effort:** M  
- **Location:** `package.json / package-lock.json`

**Problem:** npm audit: 50 advisories in total. Most of the moderate ones come from the accidentally installed 'npm' package (CFG-03). High-rated ones include prisma (via @prisma/config), sharp (librsvg — relevant to image uploads), postcss, undici, brace-expansion, source-map-js.

**Impact:** Known weaknesses in the toolchain and image processing.

**Recommended fix:** Remove the accidental packages, then 'npm audit fix' and update sharp/prisma/postcss; re-run audit.

### CFG-05 — No .gitignore, .env.example or README

- **Severity:** Medium  
- **Effort:** S  
- **Location:** `project root`

**Problem:** The project has no .gitignore (so .env with real secrets and 63 uploaded media files would be committed), no .env.example listing required variables, no README/setup or deployment instructions, and is not under version control.

**Impact:** High risk of leaking secrets; slow and error-prone onboarding and deployment.

**Recommended fix:** Add .gitignore (.env, node_modules, .next, public/uploads, *.tsbuildinfo), .env.example with key names only, and a README with setup/deploy steps; initialise git.

### CFG-03 — Accidental packages installed ('and', 'i', 'npm')

- **Severity:** Low  
- **Effort:** S  
- **Location:** `package.json:72-81`

**Problem:** devDependencies include 'and', 'i' and 'npm' — clearly from a mistyped 'npm i and …' command.

**Impact:** Bloat and ~35 of the audit warnings.

**Recommended fix:** Remove them.

### CFG-04 — Map libraries listed as dev-only but used by the live site

- **Severity:** Low  
- **Effort:** S  
- **Location:** `package.json:79`, `package.json:83`

**Problem:** leaflet and react-leaflet are in devDependencies but are imported by src/components/site/place-map.tsx.

**Impact:** A production install that skips dev packages ('npm ci --omit=dev') breaks the build.

**Recommended fix:** Move both to dependencies.

### CFG-06 — Type-check fails on a fresh install (Prisma client not generated)

- **Severity:** Low  
- **Effort:** S  
- **Location:** `package.json:12 (typecheck script)`

**Problem:** After 'npm ci', 'npm run typecheck' reports 580 errors because the Prisma client is only generated by the build script. After 'prisma generate', TypeScript reports 0 errors.

**Impact:** Confusing for new developers/CI; looks broken when it isn't.

**Recommended fix:** Add "postinstall": "prisma generate".

## Code quality

### CFG-07 — Linting not configured; 17 lint errors and 49 warnings

- **Severity:** Low  
- **Effort:** S  
- **Location:** `project root (no eslint config)`, `src/lib/chat-user.ts:410`, `src/app/admin/login/page.tsx:47`

**Problem:** There is no ESLint config, so 'npm run lint' would stop to ask for setup. Running Next's standard rules: 17 errors (14 unescaped quotes in JSX, 2 prefer-const, 1 <a> instead of <Link>) and 49 warnings (29 unused variables, 13 stale eslint-disable comments, 6 hook dependency warnings).

**Impact:** Quality problems are not caught automatically.

**Recommended fix:** Add eslint.config.mjs extending next/core-web-vitals + next/typescript, fix the errors, run lint in CI.

### CFG-08 — Leftover junk files in the project

- **Severity:** Low  
- **Effort:** S  
- **Location:** `src/_to_delete/original-name.tsx`, `tsconfig.check.tsbuildinfo`, `tsconfig.evcheck.tsbuildinfo`, `.sweep-colours.pl`, `src/**/.DS_Store`

**Problem:** A '_to_delete' folder, 12 macOS .DS_Store files, build-cache files for tsconfigs that no longer exist, and a one-off Perl script that rewrites source files in place.

**Impact:** Clutter; risk that someone runs the rewrite script by accident.

**Recommended fix:** Delete them and add to .gitignore.

### BP-05 — Several very large files

- **Severity:** Low  
- **Effort:** L  
- **Location:** `src/lib/theming.ts (1074 lines)`, `src/lib/live-streams.ts (945)`, `src/lib/donations.ts (871)`, `src/lib/geography-admin.ts (811)`

**Problem:** A handful of library files mix many responsibilities.

**Impact:** Harder to review and change safely.

**Recommended fix:** Split by responsibility when they are next modified.

## Missing best practices

### BP-01 — No automated tests

- **Severity:** Medium  
- **Effort:** XL  
- **Location:** `entire project`

**Problem:** There are no unit, integration or end-to-end tests (no *.test.*, *.spec.* or __tests__).

**Impact:** Every change risks silently breaking payments, privacy or moderation; several issues in this report (e.g. SEC-01, SEC-07) would have been caught by simple tests.

**Recommended fix:** Add Vitest for lib/ logic and Playwright for key flows (signup, login, post anonymously, donate, payout, delete account). Start with the money and privacy paths.

### BP-02 — No input-validation schemas

- **Severity:** Medium  
- **Effort:** L  
- **Location:** `src/app/api/** (all 252 route handlers)`

**Problem:** Request bodies and query strings are checked by hand with typeof checks, inconsistently. Several crashes and data issues in this report come from unchecked input (NaN paging, invalid dates, over-long strings).

**Impact:** Inconsistent behaviour and avoidable 500 errors.

**Recommended fix:** Adopt zod schemas per route (shared helper that returns 400 with field errors).

### BP-03 — No structured logging or error monitoring

- **Severity:** Low  
- **Effort:** M  
- **Location:** `entire project (console.warn/console.error only)`

**Problem:** Errors are written with console.* only; no request IDs, log levels or error tracking service.

**Impact:** Production problems are hard to notice and diagnose.

**Recommended fix:** Add a logger (pino) and an error tracker (e.g. Sentry).

### BP-04 — No API documentation

- **Severity:** Low  
- **Effort:** L  
- **Location:** `src/app/api/**`

**Problem:** 252 API endpoints with no OpenAPI spec or endpoint list (individual files do have good header comments).

**Impact:** Slower onboarding; harder for a mobile app or third party to integrate.

**Recommended fix:** Generate an OpenAPI document (e.g. from zod schemas).

## Needs confirmation

- **Firewall on the streaming server:** Is port 9997 (MediaMTX API) and 9996 (playback) blocked from the internet on the live server, and does the live mediamtx.yml match deploy/mediamtx/mediamtx.yml? This decides whether SEC-02 is exploitable today.
- **Web server (nginx) configuration:** No nginx config is included. Please share it: we need to know whether it sets security headers (SEC-19), overwrites X-Forwarded-For (SEC-10), and how /uploads is served (SEC-03).
- **Production secrets:** Confirm the live server sets ADMIN_SESSION_SECRET, USER_SESSION_SECRET, PAYMENTS_SECRET and APP_URL, each unique and different from local development values (SEC-11). If APP_URL were unset, reset links would trust the request's Host header.
- **Was the seed script run in production?:** If prisma/seed.ts was run on the live database, the owner password must be changed immediately (SEC-21).
- **Petition signatures after account deletion:** Is it intended that a deleted member's signature stays on a petition? The code comment suggests not (DB-01).
- **First-message approval in support rooms:** src/lib/chat-user.ts describes holding a member's first message in SUPPORT/CRISIS rooms for approval, but the switch is never turned on (line ~410). Is this feature meant to be active?
- **Translation of private chat messages:** The public translate endpoint appears able to return the text of a chat message from a non-public room if its ID is known (src/lib/content-translate.ts). Needs a runtime test to confirm.
- **Email link scanners:** Verification and email-change tokens are consumed when the page is opened (app/verify/page.tsx:35, app/verify-email-change/page.tsx:27). Corporate mail scanners that pre-open links could confirm an email change without the person clicking.
- **ffmpeg version:** Uploaded videos are processed without restricting ffmpeg's input protocols. Recent ffmpeg versions mitigate playlist tricks; confirm the installed version or add -protocol_whitelist file.
- **Stripe disputes arriving early:** If a dispute webhook arrives before the payment-completed webhook, it may not be applied to the recipient's balance (src/lib/donations.ts ~462-478). Low likelihood; confirm with Stripe logs.
- **ffmpeg auto-installer:** The owner-only ffmpeg installer runs a downloaded binary without a checksum unless one is supplied (src/lib/ffmpeg.ts ~465-515). Confirm whether this feature is used in production.
- **Admin list visible to moderators:** Moderators can list every admin's email and role. Confirm whether this is intended.
- **Blocked users on public profiles:** Public profile pages (u/[id]) do not hide content from users you have blocked, unlike the members list. Confirm intended behaviour.

## What is already done well

- TypeScript strict mode is on and the code type-checks with 0 errors (after Prisma generation); only 2 uses of 'any' and 1 ts-comment in the whole codebase.
- Every admin and member API route checks the login session (only intentionally public routes don't).
- Passwords are hashed with bcrypt; sessions are HMAC-signed, HttpOnly, SameSite=Lax cookies; member sessions are revoked on password change.
- The Stripe webhook verifies signatures correctly and payment handling is idempotent; money is stored as integer cents.
- Payout withdrawals use a database row lock inside a transaction (no double-withdrawal), and payout details and the Stripe key are encrypted (AES-256-GCM).
- Only one raw SQL query in the app, and it is parameterised (no SQL injection found).
- A single shared Prisma client (no connection leaks); like/follow/signature tables have composite keys preventing duplicates.
- Code is extensively commented, which will make fixes faster.
