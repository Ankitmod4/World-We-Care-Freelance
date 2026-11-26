# Platform — configuration, jobs, integrations, notifications, media, i18n

This file covers the parts of WorldWeCare that are not one product feature but that every feature relies on: environment variables, settings stored in the DB, scripts and scheduled jobs, external services (Stripe, MediaMTX, Resend, Google Translate, Nominatim, ffmpeg/sharp, link previews), middleware, email templates, in-app notifications, file uploads, and translations. Data models are documented separately in [data-models.md](./data-models.md).

> This module has no endpoints of its own. The routes it touches (settings, uploads, notifications, webhooks, MediaMTX, translations) are documented in the module files that own them. They are cross-referenced here.

## Table of contents
- [A. Environment variables & DB settings](#a-environment-variables--db-settings)
- [B. Background jobs, cron & scripts](#b-background-jobs-cron--scripts)
- [C. Webhooks & external integrations](#c-webhooks--external-integrations)
- [D. Middleware behaviour](#d-middleware-behaviour)
- [E. Email templates](#e-email-templates)
- [F. In-app notification types](#f-in-app-notification-types)
- [G. File uploads & media](#g-file-uploads--media)
- [H. i18n](#h-i18n)
- [Gaps & questions](#gaps--questions)

---

## A. Environment variables & DB settings

### A.1 Environment variables
These names come from a grep of `process.env.*` across `src/`, `prisma/`, `scripts/` and `next.config.ts`, plus `env()` in `prisma/schema.prisma`. **Only names are listed. Values are never documented.** None of these variables are visible to the mobile app.

| Name | Purpose | Where used |
|---|---|---|
| `DATABASE_URL` | MySQL connection string | `prisma/schema.prisma` (datasource) |
| `ADMIN_SESSION_SECRET` | HMAC key for the `wwc-admin-session` cookie. ⚠️ If unset, falls back to a hard-coded dev string | `src/lib/session.ts` |
| `USER_SESSION_SECRET` | HMAC key for `wwc-user-session`. It also derives the `wwc-user-verified` claim key, and is the fallback key for captcha and secret-box | `src/lib/session.ts`, `src/lib/captcha.ts`, `src/lib/secret-box.ts` |
| `CAPTCHA_SECRET` | Signs captcha challenges. Fallback order: `USER_SESSION_SECRET`, then a random key per process | `src/lib/captcha.ts` |
| `PAYMENTS_SECRET` | AES key that seals Stripe secret/webhook keys and payout details. The admin payments settings PUT refuses to save without it (or `USER_SESSION_SECRET`) | `src/lib/secret-box.ts` |
| `APP_URL` | Canonical public origin used to build links in emails and redirects. Required by the digest runner | `src/lib/app-url.ts`, `prisma/send-digests.ts` |
| `GOOGLE_TRANSLATE_API_KEY` | Google Translate key. Used only when the DB setting `translation.googleApiKey` is empty (the DB setting wins) | `src/lib/google-translate.ts` |
| `NOMINATIM_URL` | Overrides the Nominatim endpoint | `src/lib/geocode.ts` |
| `GEOCODER_CONTACT` | Contact address sent in the geocoder User-Agent | `src/lib/geocode.ts` |
| `GEOCODING_DISABLED` | Set to `"1"` to turn geocoding off | `src/lib/geocode.ts` |
| `FFMPEG_PATH` / `FFPROBE_PATH` | Explicit paths to the binaries. These win over a managed install and over PATH | `src/lib/ffmpeg.ts` (`process.env[envKey]`), `prisma/backfill-posters.ts` |
| `FFMPEG_HOME` | Install directory for the admin-managed ffmpeg (default `./.ffmpeg`) | `src/lib/ffmpeg.ts`, `prisma/backfill-posters.ts` |
| `FFMPEG_SHA256` | Expected archive digest for the managed install | `src/lib/ffmpeg.ts` |
| `MAX_UPLOAD_BODY_MB` | **Build-time** request body ceiling. Allowed range 16–65536, default 2048. next.config sets Next's limit to this value +256 MB | `src/lib/upload-limits.ts`, `next.config.ts` |
| `NODE_ENV` | `production` turns on `Secure` cookies. `development` turns on Prisma warn logs | `src/lib/session.ts`, `src/lib/db.ts` |

Total: **16** variables.

### A.2 DB settings (`PlatformSetting` table, `platform_settings`)
Settings are key/value JSON rows. The group is the prefix before the first `.` (`src/lib/settings.ts#setSettings`). Reads go through an in-process cache. The TTL comes from `cache.defaultTtlSeconds` (default 30 s, clamped to 5–3600). Every write clears the cache. Starting values are seeded by `prisma/seed.ts`. Each route accepts only the keys on its own allow-list.

| Key | Meaning | Default (code / seed) | Edited by |
|---|---|---|---|
| `general.siteName` | Site name used in emails and metadata | "WorldWeCare" | `PUT /api/admin/settings/general` (any admin) |
| `general.tagline`, `general.description`, `general.textLogo`, `general.svgLogo`, `general.logoUrl` | Branding | seed | same |
| `general.faviconUrl` | Favicon (`src/lib/site-metadata.ts`) | "" | same |
| `general.supportEmail` | Support address in emails | "" | same |
| `general.appUrl` | Read by `payment-notify.ts` to build receipt links. ⚠️ Not on the allow-list and not seeded | "" | ⚠️ nobody |
| `email.provider` | Always `resend` | "resend" | `PUT /api/admin/settings/email` |
| `email.resendApiKey` | Resend API key. The GET returns it masked; a masked value sent back is ignored | "" | same |
| `email.fromEmail`, `email.fromName`, `email.replyToEmail` | Sender headers | seed | same |
| `email.enabled` | Master switch. When off, every send is logged FAILED/"skipped" | false | same |
| `storage.provider`, `storage.localPath` | Stored but only `local` is implemented | "local", "/uploads" | `PUT /api/admin/settings/storage` |
| `storage.maxFileMB` | Image size cap (1–1024) | 8 | same |
| `storage.maxVideoMB` | Video size cap (1–BODY_LIMIT_MB) | 512 | same |
| `storage.maxVideoSeconds` | Video duration cap (0 = none, max 86400) | 0 | same |
| `storage.publicBaseUrl` | Optional CDN prefix added to returned upload URLs | "" | same |
| `cache.enabled`, `cache.defaultTtlSeconds` | Settings cache switch and TTL | true / 300 (seed) | `PUT /api/admin/settings/cache`. `DELETE` purges the cache |
| `stream.enabled`, `stream.publicUrl`, `stream.pathPrefix`, `stream.apiUrl`, `stream.apiUser`, `stream.apiPass` (masked), `stream.playbackUrl`, `stream.allowedIps`, `stream.defaultVisibility` (PUBLIC/UNLISTED), `stream.requireEmailVerified`, `stream.autoRecord` | MediaMTX live streaming config | `src/lib/mediamtx.ts` | `PUT /api/admin/settings/stream` (**not MODERATOR**). `POST` runs a health check |
| `stream.maxDurationMin` (5–1440), `stream.maxConcurrentPerUser` (1–10), `stream.maxHeight` (240–2160), `stream.recordingRetentionDays` (0–3650, default 7) | Live limits. Values are clamped when written | `mediamtx.ts` | same |
| `payments.enabled`, `payments.mode` (test/live), `payments.publishableKey`, `payments.secretKey` (sealed), `payments.webhookSecret` (sealed), `payments.currency` ("usd"), `payments.creditRecipient` (net/gross), `payments.payoutFeeBasisPoints` (100), `payments.payoutMinCents` (1000), `payments.payoutHoldDays` (14), `payments.payoutMethods` (["PAYPAL","BANK"]), `payments.minDonationCents` (100), `payments.maxDonationCents` (500000) | Stripe and payout policy. Defaults are `PAYMENT_DEFAULTS` in `src/lib/payments.ts` | code | GET: any money admin. PUT: **OWNER only**, via `/api/admin/payments/settings`. Key prefixes are validated |
| `translation.googleApiKey` | Google Translate key (wins over the env var) | "" | admin translations routes (`src/lib/translations-admin.ts`) |
| `translation.showPicker` | Shows the language picker in the web UI | true | admin translations routes |
| `media.ffmpegPath`, `media.ffprobePath`, `media.ffmpegInstalledAt`, `media.ffmpegArchiveSha256`, `media.ffmpegSource` | Written by the admin managed-ffmpeg installer | "" | `src/lib/ffmpeg.ts` (admin media tools) |

**Mobile relevance:** mobile only sees the effects of these settings: upload limits (`GET /api/user/upload/video` returns `maxMB`/`maxSeconds`), donation config (`/api/public/donations/config`), and stream limits.

---
## B. Background jobs, cron & scripts

Sources: `package.json` scripts, `prisma/*.ts`, `prisma/*.sql`, `scripts/*.ts`, `.sweep-colours.pl`. **The repo has no scheduler.** It has no cron config, no queue, and no Vercel cron (`deploy/` holds only MediaMTX systemd/yml files). Only the digest needs a schedule (see B.2).

### B.1 All jobs
| # | npm script / file | Command | Schedule | Destructive | Mobile impact |
|---|---|---|---|---|---|
| 1 | `dev` | `next dev` | manual (development) | no | none |
| 2 | `build` | `prisma generate && next build` | deploy | no | API availability; MAX_UPLOAD_BODY_MB is baked in at build time |
| 3 | `start` | `next start` | always-on server | no | serves the API |
| 4 | `lint` | `next lint` | manual/CI | no | none |
| 5 | `typecheck` | `tsc --noEmit` | manual/CI | no | none |
| 6 | `db:generate` | `prisma generate` | deploy | no | none |
| 7 | `db:push` | `prisma db push` | on schema change | ⚠️ yes | schema changes alter API shapes; can drop renamed tables/columns |
| 8 | `db:seed` | `tsx prisma/seed.ts` | once on new install | no | creates owner admin, default settings, 4 core email templates |
| 9 | `db:seed-geo` | `tsx prisma/seed-geography.ts` | once | no | country picker / signup country list |
| 10 | `db:seed-posts` | `tsx prisma/seed-posts.ts` | demo only | no | sample feed; exits if any post exists |
| 11 | `db:seed-chat` | `tsx prisma/seed-chat.ts` | once | no | chat categories + rooms (rooms only if none exist) |
| 12 | `db:studio` | `prisma studio` | manual | no | none (DB GUI) |
| 13 | `db:seed-articles` | `tsx prisma/seed-articles.ts` | demo only | ⚠️ yes | upserts by slug - overwrites edits to seeded articles |
| 14 | `db:seed-events` | `tsx prisma/seed-events.ts` | demo only | ⚠️ yes | upserts seeded events by slug (overwrites edits) |
| 15 | `db:seed-library` | `tsx prisma/seed-library.ts` | demo only | ⚠️ yes | upserts themes/clips (overwrites seeded clip edits) |
| 16 | `db:backfill-posters` | `tsx prisma/backfill-posters.ts` | one-off repair | no | fills missing video posterUrl in clips/posts; no dry-run flag (writes immediately) |
| 17 | `media:refs` | `tsx scripts/check-media-refs.ts` | CI/manual | no | none |
| 18 | `media:sweep` | `tsx prisma/sweep-media.ts` | manual (dry run) | no | none |
| 19 | `media:sweep:apply` | `tsx prisma/sweep-media.ts --apply [--hours=N]` | manual/periodic (no cron defined) | ⚠️ yes | deletes unreferenced uploads older than grace (24h default) - mobile must attach uploaded media promptly |
| 20 | `db:seed-campaigns` | `tsx prisma/seed-campaigns.ts` | demo only | no | sample campaigns |
| 21 | `db:seed-petition-categories` | `tsx prisma/seed-petition-categories.ts` | once (required) | no | petition submit requires a category |
| 22 | `db:seed-campaign-categories` | `tsx prisma/seed-campaign-categories.ts` | once (required) | no | campaign submit requires a category |
| 23 | `db:seed-petitions` | `tsx prisma/seed-petitions.ts` | demo only | no | creates sample petitions and filler users |
| 24 | `db:seed-places` | `tsx prisma/seed-places.ts` | demo only | no | sample map places (own coordinates) + rooms |
| 25 | `db:seed-post-categories` | `tsx prisma/seed-post-categories.ts` | once | no | seeds GratitudeCategory (despite the name) |
| 26 | `db:seed-live-categories` | `tsx prisma/seed-live-categories.ts` | once (required) | no | going live requires a category |
| 27 | `media:thumbs` | `tsx prisma/backfill-thumbs.ts` | one-off (dry run) | no | none |
| 28 | `media:thumbs:apply` | `tsx prisma/backfill-thumbs.ts --apply` | one-off | no | creates -thumb image variants for old uploads |
| 29 | `theme:check` | `tsx scripts/check-theme-contrast.ts` | CI/manual | no | none (web palettes) |
| 30 | `counters:check` | `tsx prisma/recount-counters.ts` | manual | no | none |
| 31 | `counters:fix` | `tsx prisma/recount-counters.ts --apply` | manual repair | no | corrects like/save/member counters returned by APIs |
| 32 | `reports:check` | `tsx prisma/fix-report-duplicates.ts` | one-off after db push | no | none |
| 33 | `reports:fix` | `tsx prisma/fix-report-duplicates.ts --apply` | one-off after db push | ⚠️ yes | closes duplicate open reports |
| 34 | `donations:check` | `tsx prisma/diagnose-donations.ts` | manual diagnostics | no | none |
| 35 | `donations:sweep` | `tsx prisma/diagnose-donations.ts --apply` | manual | ⚠️ yes | marks stale PENDING donations FAILED |
| 36 | `db:seed-payment-emails` | `tsx prisma/seed-payment-emails.ts` | once | no | donation_receipt template |
| 37 | `db:seed-event-categories` | `tsx prisma/seed-event-categories.ts` | once (required) | no | event submit requires a category |
| 38 | `db:seed-gallery-placeholders` | `tsx prisma/seed-gallery-placeholders.ts [--only=..] [--clear]` | demo only | ⚠️ yes | writes placeholder photos into galleries; --clear removes them |
| 39 | `db:seed-town-heroes` | `tsx prisma/seed-town-heroes.ts` | demo only | no | categories + sample heroes |
| 40 | `db:seed-town-hero-categories` | `tsx prisma/seed-town-heroes.ts --categories-only` | once (required) | no | nomination requires a category |
| 41 | `heroes:check` | `tsx prisma/check-hero-categories.ts` | one-off migration | no | none |
| 42 | `heroes:fix` | `tsx prisma/check-hero-categories.ts --apply` | one-off migration | no | assigns a category to uncategorised heroes |
| 43 | `db:seed-digest-email` | `tsx prisma/seed-digest-email.ts` | once | no | daily_digest template |
| 44 | `digest:dry` | `tsx prisma/send-digests.ts --dry-run` | manual check | no | none |
| 45 | `digest:send` | `tsx prisma/send-digests.ts` | HOURLY cron (0 * * * *) - operator must wire it; no scheduler in repo | no | digest settings (PATCH /api/user/settings/digest) only take effect if cron runs |
| 46 | `follows:recount` | `tsx prisma/recount-followers.ts` | manual repair | no | fixes User.followerCount |
| 47 | `follows:check` | `tsx prisma/recount-followers.ts --dry` | manual | no | none |
| 48 | `i18n:extract` | `tsx scripts/extract-strings.ts [--apply] [--prune]` | after UI string changes | ⚠️ yes | --prune deletes catalogue strings no longer in web source (mobile-only keys would be removed) |
| 49 | `i18n:status` | `tsx scripts/i18n-status.ts` | manual | no | none |
| 50 | `check:boundary` | `tsx scripts/check-client-boundary.ts` | CI/manual | no | none |
| 51 | `whats-in-the-db (no npm script)` | `npx tsx prisma/whats-in-the-db.ts` | manual | no | none (row counts) |
| 52 | `rename-fanbase-to-library.sql (no npm script)` | `run in MySQL BEFORE prisma db push` | one-off migration | ⚠️ yes | renames fanbase tables to library_* in place |
| 53 | `.sweep-colours.pl (no npm script)` | `perl .sweep-colours.pl <files>` | one-off codemod | ⚠️ yes | none (rewrites Tailwind classes in source files in place) |
| 54 | `sweepStreams() (not wired)` | `src/lib/live-streams.ts sweepStreams - no caller` | intended periodic, never invoked | no | over-limit/abandoned live streams are not auto-ended |

### B.2 Notes on the jobs that matter
- **Daily digest (`digest:send`).** Needs an **hourly** cron: `0 * * * * cd <app> && npx tsx prisma/send-digests.ts` (from the header of `prisma/send-digests.ts`). It sends to members with `digestEnabled=true` whose local hour (`timezone`, or UTC when unset) equals `digestHour`, and whose `digestLastSentOn` is not already today's local date. The send date is claimed before the email goes out, so running the job twice is safe. A missed hour is not caught up. Without `APP_URL` the links in the email break. Use `--dry-run` (`digest:dry`) to select and build without sending. Sources: `src/lib/digest.ts`, `prisma/send-digests.ts`. ⚠️ Partial: the cron line is only documented in a code comment. Mobile impact: the digest toggle and hour (`PATCH /api/user/settings/digest`) have no effect until the operator sets up the cron.
- **Dry-run conventions.** These scripts change nothing unless given `--apply`: `media:sweep`, `media:thumbs`, `counters:*`, `reports:*`, `donations:*`, `heroes:*`, `i18n:extract`. `follows:recount` writes by default; `--dry` (`follows:check`) only reports. `digest` uses `--dry-run`. `db:backfill-posters` has **no** dry-run flag.
- **Media sweep.** `prisma/sweep-media.ts --apply [--hours=N]` deletes abandoned video uploads and any `UploadedFile` that `collectReferencedUrls` (`src/lib/media.ts`) does not find referenced, once it is older than the grace period (default 24 h). The same functions back the admin "Media cleanup" page. Mobile: attach uploaded media to content promptly.
- **Seeds.** Most seeds only create missing rows. The exceptions overwrite seeded rows by slug: `seed-articles`, `seed-events`, `seed-library`, `seed-places` (upsert), and `seed-petitions` (also creates filler users). **Required before members can submit:** event, live, petition, campaign and town-hero categories. `seed.ts` creates the OWNER admin with a fixed password in `prisma/seed.ts` (value withheld).
- **Live stream sweeper.** ⚠️ Partial / Unclear: `sweepStreams()` in `src/lib/live-streams.ts` ends LIVE streams past `maxDurationMin` and IDLE streams older than 6 h, and reconciles stuck broadcasts. **Nothing calls it.** The only reconciliation runs when an owner creates a stream (`reconcileStuck(userId)`). Recording retention is enforced by MediaMTX `deleteAfter`, and `LiveStream.recordingDeletedAt` is never written.
- **Verification token cleanup.** The schema comment says the `@@index([expiresAt])` is "for a periodic cleanup job", but no such job exists. ⚠️ Unclear.

---

## C. Webhooks & external integrations

### C.1 Stripe — `POST /api/webhooks/stripe`
Source: `src/app/api/webhooks/stripe/route.ts`, `src/lib/donations.ts#applyStripeEvent`, `src/lib/stripe-events.ts`.
- No cookie auth. Security comes from the `stripe-signature` header, verified against the raw body with the sealed `payments.webhookSecret`. Runtime: Node.
- Responses: missing signature gives 400. No secret configured gives 500 (so Stripe retries). Bad signature gives 400. Handler error gives 500 (retry). Success returns `{ received: true, handled, note }`.
- Middleware exempts `/api/webhooks`, so the email-verification gate never redirects Stripe.
- Every write is a conditional `updateMany` on the expected prior status, so a replayed event is a no-op.

| Event | Effect |
|---|---|
| `checkout.session.completed`, `checkout.session.async_payment_succeeded` | Only acts if `payment_status === "paid"`. Reads the real Stripe fee from the balance transaction (if it can't, sets `feeUnknown=true` and fee 0). `netCents = gross − fee` when `creditRecipient="net"`, otherwise gross. Sets `availableAt = now + payoutHoldDays`. Moves the donation (`metadata.donationId`) from PENDING/FAILED to SUCCEEDED, then sends the `donation_receipt` email and the `DONATION_RECEIVED` in-app notification. A session with no metadata is recorded as an unattributed donation |
| `checkout.session.async_payment_failed`, `checkout.session.expired` | PENDING becomes FAILED (`failedAt`) |
| `charge.refunded` | Sets `refundedCents` to the proportional clawback of net. Status becomes REFUNDED, unless the donation is DISPUTED |
| `charge.refund.updated` | Re-reads the charge and reapplies the refund logic, which restores the credit if a refund failed |
| `charge.dispute.created` | SUCCEEDED/REFUNDED becomes DISPUTED (`disputedAt`). The credit leaves the recipient's balance |
| `charge.dispute.closed` | If won, the donation returns to SUCCEEDED (or REFUNDED if it had refunds). Otherwise it stays DISPUTED |
| anything else | `{ handled: false, note: "Ignored <type>" }` |

Mobile: never call this endpoint. After Stripe Checkout, the "thanks" redirect credits nothing; donation history updates only when the webhook arrives.

### C.2 MediaMTX auth hook — `POST /api/mediamtx/auth` (also `GET`)
Source: `src/app/api/mediamtx/auth/route.ts`, `src/lib/live-streams.ts#authoriseStream`, `deploy/mediamtx/mediamtx.yml` (`authHTTPAddress: https://worldwecare.com/api/mediamtx/auth`).
MediaMTX calls this for every publish or read request. It returns a bare **200 (allow)** or **401 (deny)**. It denies when: streaming is disabled; the caller IP is not in `stream.allowedIps` (if that list is set); the body is unparseable; the action is `api`/`metrics`/`pprof`; the path is not `<pathPrefix><slug>`; or `authoriseStream` refuses. Publishing requires a valid `LiveStreamGrant` token, passed as MediaMTX `token`/`password`. Reading is authorised by the stream's visibility. Grant use is recorded (`useCount`, `lastIp`). Mobile: viewers play HLS from `stream.playbackUrl`, and the broadcaster publishes over WHIP with the grant token (see the messaging-live module).

### C.3 Resend email
`src/lib/email.ts` makes one REST POST to `https://api.resend.com/emails` (no SDK). Config comes from the `email.*` settings. Templates use `{{var}}` substitution. Every attempt writes an `EmailLog` row (QUEUED, then SENT/FAILED, with `providerId` and `errorMessage`). A send is skipped or failed when the template is disabled, `email.enabled` is false, or the API key or from address is missing. There is no retry queue.

### C.4 Google Translate
`src/lib/google-translate.ts` calls `translation.googleapis.com/language/translate/v2` with the key from the DB setting, falling back to the env var. It is used for (a) admin UI string translation (`/api/admin/translations/translate`) and (b) on-demand member-content translation, `POST /api/user/translate-content`. That route takes `{ refs: [{kind,id,field}] }` (IDs only, never free text), works signed out, and is rate-limited per IP. Results are cached in `ContentTranslation`, keyed by `(kind, refId, field, localeCode)`, and invalidated by `sourceHash`.

### C.5 Nominatim geocoding
`src/lib/geocode.ts` (used by `src/lib/places-admin.ts`) geocodes a Place's address **once when it is saved or re-geocoded**, never when a page renders. Requests are throttled to about 1/s through an internal scheduler and carry the User-Agent `WorldWeCare/1.0 (+GEOCODER_CONTACT)`. The result is stored in `latitude`/`longitude`/`geocodedAt`, and failures in `geocodeError`. Can be disabled with `GEOCODING_DISABLED=1`.

### C.6 ffmpeg / sharp
- **sharp** (`src/lib/image-variants.ts`) re-encodes raster uploads. It auto-rotates, caps the long edge at 1600 px, and writes a 480 px `-thumb` variant. Images over 50 MP are refused as decompression bombs. SVG/ICO are passed through unchanged.
- **ffmpeg/ffprobe** (`src/lib/ffmpeg.ts`, `src/lib/video.ts`) convert uploaded video. The binary is found in this order: `FFMPEG_PATH` env, then the managed install (`media.ffmpegPath`), then `FFMPEG_HOME`, then PATH. Admins can install a managed ffmpeg from an allow-listed URL, with SHA-256 verification.

### C.7 Link previews
`GET /api/user/link-preview` (`src/lib/link-preview.ts#fetchLinkPreview`) fetches only http(s) URLs, with a short timeout and a response-size cap, and blocks localhost and private ranges (SSRF guard). It returns `{ title, description, image, siteName, ... }` built from `og:*`/`<title>` tags, or null.

### C.8 Embeds
Library clips of kind EMBED store the pasted URL. `src/lib/embeds.ts` turns it into an allow-listed iframe src (YouTube, Vimeo, Spotify) at render time. Mobile needs its own player mapping.

---

## D. Middleware behaviour
Source: `src/middleware.ts` (edge runtime, no DB access).
1. **Matcher:** runs on everything except `_next/static`, `_next/image`, `favicon.ico`, `uploads/`, and paths ending in a static extension (png, jpg, jpeg, gif, webp, svg, ico, css, js, map, txt, xml, json, woff, woff2, ttf).
2. **Admin pages** (`/admin`, `/admin/*` except `/admin/login`): without a valid `wwc-admin-session` signature, redirects to `/admin/login?next=<path>`. Note: `/api/admin/*` is **not** checked here; the route handlers check it themselves.
3. **Unverified members:** exempt prefixes are `/verify-email`, `/verify`, `/verify-email-change`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/terms`, `/privacy`, `/contact`, `/api/user/auth`, `/api/public`, `/admin`, `/api/admin`, `/api/webhooks`. For any other path: no session cookie, or an invalid one, passes through. A valid session whose `wwc-user-verified` claim is missing or belongs to a different user id gets **403 `{ error: "Confirm your email address first.", needsVerification: true }`** on `/api/*`, or a redirect to `/verify-email` for pages.
4. The real enforcement is `getCurrentUser()` / `getCurrentAdmin()` inside each route. Middleware is only signature checks.

Mobile: send both cookies (`wwc-user-session`, `wwc-user-verified`). Treat `needsVerification: true` as "go to the verify-email screen".

---
## E. Email templates
Templates live in the `EmailTemplate` table. Admins edit them at `/admin/settings/email-templates` (`/api/admin/email-templates*`). The first four slugs are protected from deletion (`PROTECTED_SLUGS` in `src/app/api/admin/email-templates/[id]/route.ts`). Seeds only create missing templates, so admin edits are never overwritten. Links in emails point at **web** URLs, so a mobile app needs deep links or universal links for `/verify`, `/reset-password` and `/verify-email-change`.

| Slug | Seeded by | Trigger (sender) | Recipient | Variables | Subject (seed) |
|---|---|---|---|---|---|
| `welcome` | `prisma/seed.ts` | ⚠️ **Never sent by code.** Only available through admin "send email" or "test" | — | name, email, siteName, appUrl | "Welcome to {{siteName}}, {{name}}" |
| `email_confirm` | `prisma/seed.ts` | Signup and `POST /api/user/auth/resend-verification` (`sendConfirmationEmail`). Also reused for an email-change request (`sendEmailChangeEmail`, sent to the **new** address) | Member | name, siteName, appUrl, confirmLink (`<app>/verify?token=…`, 24 h; email change: `<app>/verify-email-change?token=…`, 1 h) | "Confirm your email on {{siteName}}" |
| `password_reset` | `prisma/seed.ts` | `POST /api/user/auth/forgot-password` (`sendPasswordResetEmail`). Also admin `POST /api/admin/users/[id]/reset-password` (⚠️ placeholder link `<app>reset/admin-triggered`, no token) | Member | name, siteName, appUrl, resetLink (`<app>/reset-password?token=…`), minutes (=10) | "Reset your {{siteName}} password" |
| `password_reset_confirmed` | `prisma/seed.ts` | After a password reset (`/api/user/auth/reset-password`) and after a settings password change (`/api/user/settings/password`), via `sendPasswordChangedEmail` | Member | name, supportEmail, siteName, appUrl | "Your {{siteName}} password was changed" |
| `donation_receipt` | `prisma/seed-payment-emails.ts` | Stripe webhook, on a donation's first transition to SUCCEEDED (`src/lib/payment-notify.ts#sendDonationReceipt`) | Donor email from Stripe | name, amount (formatted gross), cause, date, siteName, appUrl | "Your {{amount}} donation to {{cause}}" |
| `daily_digest` | `prisma/seed-digest-email.ts` | Hourly digest runner (`src/lib/digest.ts#runDigest`) | Opted-in members at their local hour | name, siteName, appUrl, quote, attribution, question, streakLine, suggestion, settingsUrl | "{{siteName}} — your morning" (preview text `{{suggestion}}`) |

Admin tools: `POST /api/admin/users/[id]/send-email` sends any template to a user. Default variables are name, email, siteName, appUrl, supportEmail and placeholder confirm/reset links, and the request body can override them. `POST /api/admin/email-templates/[id]/test` sends a test. Every send is logged in `EmailLog`.

---

## F. In-app notification types
`UserNotification` rows are created by `createUserNotification` / `createManyUserNotifications` (`src/lib/notifications.ts`). Both are best-effort and never throw. Members read them with `GET /api/user/notifications?cursor=&limit=` (limit 10–50, default 25; keyset cursor `<ISO>_<id>`; response `{items,nextCursor,unread}`) and mark them read with `POST /api/user/notifications/read` (`ids?`; omit to mark all). **No push and no SSE for member notifications. Mobile must poll.** `actionUrl` values are web paths that mobile has to map to screens.

### F.1 UserNotifType (member)
| Type | Created by | Recipient | Title / body |
|---|---|---|---|
| `CHAT_REPLY` | `src/lib/chat-user.ts#postMessage` (published reply) | Parent message author | "<sender\|Someone> replied to you" / first 120 chars or "Sent an image" → `/chatrooms/<slug>` |
| `CHAT_MENTION` | `chat-user.ts#postMessage` (`mentions[]`) | Mentioned ACTIVE members | "<sender> mentioned you in <room>" → `/chatrooms/<slug>` |
| `CHAT_REACTION` | `chat-user.ts#toggleReaction` (on add) | Message author | "Someone reacted <emoji> to your message" |
| `CRISIS_ALERT` | `chat-user.ts#panicAlert` | Room MODERATOR members | "Crisis alert in <room>" / "A member asked for urgent help…" |
| `POST_LIKE` | `src/lib/posts-feed.ts` (new reaction) | Post author | "<name> <reaction verb> your post" → `/post/<id>` |
| `POST_COMMENT` | `src/lib/comments.ts` | Post author | "<name\|Someone> commented on your post" → `/post/<id>` |
| `FOLLOW` | `src/lib/follows.ts#followUser` | Followed user | "<name> started following you" → `/u/<followerId>` |
| `DIRECT_MESSAGE` | ⚠️ **never created** | — | — |
| `EVENT_APPROVED` / `EVENT_REJECTED` | `src/lib/events.ts#reviewEvent` | Host | "Your event was approved" / "…wasn't approved" + "Reason: …" |
| `EVENT_CANCELLED` | `events.ts#cancelEvent` | All RSVPs | "An event you're going to was cancelled" |
| `PLACE_APPROVED` / `PLACE_REJECTED` | `src/lib/places-admin.ts#reviewPlace` | Submitter | "Your place was added" / "…wasn't added" |
| `PETITION_APPROVED` / `PETITION_REJECTED` | `src/lib/petitions-admin.ts` | Creator | "Your petition is live" / "…wasn't approved" |
| `CAMPAIGN_APPROVED` / `CAMPAIGN_REJECTED` | `src/lib/campaigns-admin.ts` | Submitter | "Your campaign is live" / "…wasn't approved" |
| `DONATION_RECEIVED` | `src/lib/payment-notify.ts#notifyDonationReceived` (webhook) | Recipient | "<donor\|Someone> donated $X" / "Towards <cause>. It can be withdrawn from <date>." → `/settings/donations` |
| `PAYOUT_APPROVED` / `PAYOUT_PAID` / `PAYOUT_REJECTED` | `payment-notify.ts#notifyPayout` (from `/api/admin/payouts/[id]`). REVERSED also uses `PAYOUT_REJECTED` ("…withdrawal came back") | Requester | "Your $X withdrawal was approved" / "$X is on its way" / "…wasn't sent" → `/settings/payouts` |
| `TOWN_HERO_APPROVED` / `TOWN_HERO_REJECTED` | `src/lib/town-heroes.ts` (review) | Nominator | "Your nomination is up" / "…wasn't published" |
| `SYSTEM` | `src/lib/gratitude.ts#moderateGratitude`, `src/lib/gratitude-comments.ts` | Gratitude author | "Your gratitude post was approved/wasn't approved"; "<name> replied to your gratitude post" → `/gratitude` |

No notifications are sent for confession moderation, confession comments, article/clip comment replies, petition signatures, or DMs.

### F.2 AdminNotifType (admin inbox)
`createForAllAdmins` (`src/lib/admin-notifications.ts`) writes one row per **active** admin. Admins read them through `GET /api/admin/notifications`, `POST /api/admin/notifications/read`, and SSE `GET /api/admin/notifications/stream` (bell payload `{unread, items}`).

| Type | Created by | Title / message → actionUrl |
|---|---|---|
| `USER_SIGNED_UP` | `src/app/api/user/auth/signup/route.ts` | "<name> joined" / email → `/admin/users/<id>` |
| `POST_REPORTED` | `src/lib/posts-user.ts` (post/comment report); `chat-user.ts#reportMessage` | "Post reported (<reason>)", "Comment reported (…)", "Chat message reported" → `/admin/posts/reports` or `/admin/chatrooms` |
| `EVENT_PENDING` | `events.ts#submitEvent` | "An event is waiting for review" → `/admin/events?status=PENDING` |
| `PLACE_PENDING` | `places-admin.ts#submitPlace` | "A place is waiting for review" |
| `PLACE_REPORTED` | `src/lib/place-reports.ts` | "A place was reported" → `/admin/places?reports=1` |
| `PETITION_PENDING` | `src/lib/petitions.ts` | "A petition is waiting for review" |
| `CAMPAIGN_PENDING` | `src/lib/campaigns.ts` | "A campaign is waiting for review" |
| `USER_EMAIL_VERIFIED`, `USER_BANNED`, `USER_DELETED`, `POST_REMOVED`, `CONFESSION_PENDING` | ⚠️ **never created** (the enum values exist; only the AdminAction log uses the same names) | — |

### F.3 SSE streams (real-time)
`/api/admin/notifications/stream`, `/api/user/chatrooms/[slug]/stream`, `/api/user/messages/conversations/[id]/stream`, `/api/user/live/[slug]/comments/stream`. These are documented in their own modules.

---
## G. File uploads & media

### G.1 Storage
- Files are stored on local disk under `public/uploads/<category>/` and served by Next as `/uploads/<category>/<file>` (`src/lib/upload.ts`). If `storage.publicBaseUrl` is set, it is prepended to the returned URL (CDN). `storage.provider` is only ever `local`. ⚠️ No S3 support.
- File names: `<base36 timestamp>-<16 hex>.<ext>`. The category is sanitised to `[a-z0-9-]`, at most 40 chars, default `misc`.
- Every file, and every thumbnail, gets an `UploadedFile` row (`url` unique, `relPath`, `category`, `bytes`, `mime`, `ownerId`, `ownerKind` USER/ADMIN/SYSTEM) through `recordUpload` in `src/lib/media.ts`.

### G.2 Image uploads
| | Member: `POST /api/user/upload` | Admin: `POST /api/admin/upload` |
|---|---|---|
| Body | `multipart/form-data`, field `file` | `file` + `category` (e.g. `logos`, `favicons`, `avatars`; default `misc`) |
| Category | always `posts` | from the form |
| Response | `{ ok: true, url }` or 400 `{ ok:false, error }` | `{ ok, url, thumbUrl?, width?, height? }` |

- **Allowed MIME:** `image/png`, `image/jpeg`, `image/webp`, `image/gif`, `image/svg+xml`, `image/x-icon`, `image/vnd.microsoft.icon`. Anything else returns "Unsupported file type: <mime>".
- **Size limit:** `storage.maxFileMB` (default 8 MB, admin range 1–1024). It is checked against the uploaded bytes.
- **Variants** (`src/lib/image-variants.ts`): raster images are auto-rotated and re-encoded with the long edge ≤ **1600 px**. A **thumbnail** with long edge ≤ **480 px** is saved as `<stem>-thumb<ext>`; `thumbUrlFor(url)` derives its URL. Inputs over **50 megapixels** are refused. SVG and ICO pass through unchanged.

### G.3 Video uploads & processing
Source: `src/lib/video-upload.ts`, `src/lib/video.ts`, `src/lib/video-status.ts`, routes `/api/user/upload/video` and `/api/admin/upload/video`.
1. `GET /api/user/upload/video` returns the limits `{ maxMB, maxSeconds, … }`.
2. `POST /api/user/upload/video`: the request body is the **raw file bytes** (not multipart). Send `Content-Type: video/*` (also accepted: `application/octet-stream`, `application/mp4`) and the header `X-Filename` (URI-encoded). Members must have a **verified email** (otherwise 403). Errors: 415 wrong type; 413 if larger than `storage.maxVideoMB` (default 512 MB; `Content-Length` is checked before streaming); 400 for empty or interrupted uploads. Success: **201 `{ ok: true, id }`**. Category is `clips` for members; admins set it with `?category=`.
3. Status flow (`VideoStatus`): `UPLOADING` → `QUEUED` → `PROCESSING` → `READY` | `FAILED`. The in-process converter uses ffmpeg to produce H.264/AAC MP4 (`-crf 23`, `+faststart`, even dimensions, long edge ≤ 1920) plus a JPEG poster frame. `storage.maxVideoSeconds` is enforced (0 = unlimited). A PROCESSING row whose heartbeat is older than 90 s counts as stale and is nudged back into the queue.
4. Poll `GET /api/user/upload/video/[id]` for `{ id, status, percent, etaSeconds, stage, message, url, posterUrl, width, height, durationSec, error }`. `DELETE` on the same path discards the video (`{ ok }`).
5. Final URLs: `/uploads/videos/<assetId>.mp4` and `/uploads/videos/<assetId>.jpg` (with the CDN prefix if set). Content rows (posts, petitions, confessions, gratitude) store `{ assetId, url, posterUrl, width, height, durationSec }`, resolved server-side from a READY asset the uploader owns (`src/lib/attached-media.ts#resolveAttachedVideo`). Clients send the `assetId`, never a URL.

### G.4 Deletion rules
- `deleteMediaByUrls(urls, { ownerId | allowAnyOwner })` (`src/lib/media.ts`) only deletes files that have an `UploadedFile` row, and only when the owner matches, unless an admin purge sets `allowAnyOwner`. A URL with no row is never deleted. Deleting an image also deletes its `-thumb`.
- Orphans (files nothing references, older than a 24 h grace period) are removed only by `media:sweep --apply` or the admin Media cleanup page. `scripts/check-media-refs.ts` checks that every upload column is covered.

---

## H. i18n
- **Locales:** the `Locale` table (BCP-47 `code`, `name`, `nativeName`, `direction` LTR/RTL, `isEnabled`, `sortOrder`). English (`en`, `DEFAULT_LOCALE`) is the source language and always enabled.
- **UI strings:** `TranslationString` (dotted `key`, `english`, `sourceHash`, `context`) and `Translation` (per locale; `source` GOOGLE/HUMAN; `reviewedAt`). `scripts/extract-strings.ts` (`i18n:extract`) loads keys from the source code. Admins manage them under `/api/admin/translations/*` (locales, strings, extract, translate, content). Machine translation uses Google.
- **How clients get them:** `src/app/layout.tsx` reads the `wwc-locale` cookie, resolves it to an enabled locale (unknown codes fall back to `en`), loads that locale's messages with `getMessages()` (per-process cache, 60 s TTL, cleared on admin save), and passes them to `<LocaleProvider>`. The web picker sets the cookie client-side (`max-age` 1 year). The picker is shown only when `translation.showPicker` is on.
- ⚠️ **Web-only (no API).** There is **no** public endpoint that returns the enabled locales or a locale's message catalogue. A mobile app cannot fetch UI translations today.
- **Member content:** `POST /api/user/translate-content` `{ refs:[{kind,id,field}] }` translates content on demand into the viewer's locale. It works signed out, is rate-limited per IP, and caches results in `ContentTranslation`.

---

## Gaps & questions
**Gaps**
1. The digest has no scheduler; the operator must add an hourly cron.
2. `sweepStreams()` is never called, and `recordingDeletedAt` is never set.
3. No push notifications and no device-token model; member notifications must be polled.
4. Unused enum values: `UserNotifType.DIRECT_MESSAGE`; `AdminNotifType` `USER_EMAIL_VERIFIED`, `USER_BANNED`, `USER_DELETED`, `POST_REMOVED`, `CONFESSION_PENDING`. New confessions and gratitude posts do not alert admins.
5. Gratitude notifications use the `SYSTEM` type.
6. No API for the UI translation catalogue or the locale list.
7. The admin reset-password email carries a placeholder link with no token.
8. The `welcome` template is never sent.
9. `general.appUrl` is read but cannot be edited or seeded.
10. The member image upload response drops `thumbUrl`, `width` and `height`.
11. The verification-token cleanup job referenced in the schema does not exist.

**Questions**
- Who runs the digest cron and the media sweep in production, and how often?
- Should DMs create notifications and push?
- Will mobile need translation keys that are not in the web source? `i18n:extract --prune` would delete them.
- Is S3/CDN storage planned?
