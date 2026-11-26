# Admin: Content & Catalog Management

This module covers the admin console's **editorial and catalog** tools: magazine articles and their categories, awareness campaigns (plus attaching articles and events to them), events and their categories, petition moderation, the places directory (review, geocoding, user reports), the geography hierarchy (Region → Sub-region → Country → State), gratitude-wall moderation and categories, Town Heroes nominations and categories, the video Library (themes, clips, reordering, clip comment moderation), live-stream categories, and the Daily Reflection quote/question calendar.

**Auth for the whole module:** every endpoint uses the admin cookie `wwc-admin-session` (HMAC-signed, HttpOnly, SameSite=Lax, 30 days) via `requireAdmin` (`src/lib/admin-auth.ts`). There are no bearer tokens. `requireAdmin` accepts any **active** admin with role `OWNER`, `ADMIN` or `MODERATOR`; a missing/invalid/expired cookie, a deleted admin, or an admin with `isActive=false` gets `401 { "error": "Unauthorized" }`. Three DELETE endpoints also refuse `MODERATOR` with a 403 (marked below). Middleware does not apply the member email-verification gate to `/api/admin/*`.

**Common conventions (all endpoints here):**
- Request bodies are JSON. An unparsable body is treated as `{}` (the handler then fails validation with a 400 instead of throwing).
- Errors are `{ "error": string }`. Most write handlers return the thrown error's message with status **400** (a few map a "not found" message to 404).
- Dates come back as ISO 8601 strings (Prisma `DateTime` serialised by `NextResponse.json`). Date-only fields (Daily Reflections `displayDate`) come back as `"YYYY-MM-DDT00:00:00.000Z"`.
- Image fields (`coverUrl`, `photoUrl`, gallery `photos[].url`) are URLs returned by the admin upload endpoint `POST /api/admin/upload` (documented in another module); Library uploads use `POST /api/admin/upload/video`.
- Slugs are generated server-side from the title/name by `slugify()` (`src/lib/geography-admin.ts`: lowercases, strips accents, `&`→`and`, non-alphanumerics removed, spaces→`-`) and de-duplicated with `-2`, `-3`… suffixes.
- Search (`q`) uses MySQL `contains` (case-insensitive under the default collation).
- Deleting content frees its uploaded files through `deleteMediaByUrls(..., { allowAnyOwner: true })` (`src/lib/media.ts`): only files that have an `UploadedFile` record and live under `public/uploads` are deleted (plus their derived thumbnails); external URLs are skipped.
- Notifications triggered here are **in-app only** (`UserNotification` rows via `src/lib/notifications.ts`); no emails are sent by this module.

## Table of contents
1. [Articles → List & search articles](#articles--list--search-articles)
2. [Articles → Create, view, edit & delete an article](#articles--create-view-edit--delete-an-article)
3. [Articles → Article categories](#articles--article-categories)
4. [Campaigns → List campaigns](#campaigns--list-campaigns)
5. [Campaigns → Create, view, edit & delete a campaign](#campaigns--create-view-edit--delete-a-campaign)
6. [Campaigns → Review a submitted campaign](#campaigns--review-a-submitted-campaign)
7. [Campaigns → Attach articles & events (attachments, reorder, picker search)](#campaigns--attach-articles--events-attachments-reorder-picker-search)
8. [Campaigns → Uncategorised backlog filter](#campaigns--uncategorised-backlog-filter)
9. [Events → List, create, view, edit & delete events](#events--list-create-view-edit--delete-events)
10. [Events → Review (approve / reject / cancel) an event](#events--review-approve--reject--cancel-an-event)
11. [Events → Event categories](#events--event-categories)
12. [Petitions → Moderation queue, view & delete](#petitions--moderation-queue-view--delete)
13. [Petitions → Review / close a petition](#petitions--review--close-a-petition)
14. [Places → List, create, view, edit & delete places](#places--list-create-view-edit--delete-places)
15. [Places → Review a submitted place](#places--review-a-submitted-place)
16. [Places → Re-geocode a place](#places--re-geocode-a-place)
17. [Places → Place reports queue](#places--place-reports-queue)
18. [Geography → Overview stats & picker options](#geography--overview-stats--picker-options)
19. [Geography → Regions](#geography--regions)
20. [Geography → Sub-regions](#geography--sub-regions)
21. [Geography → Countries](#geography--countries)
22. [Geography → States (US only)](#geography--states-us-only)
23. [Gratitude → Moderation queue](#gratitude--moderation-queue)
24. [Gratitude → Gratitude categories](#gratitude--gratitude-categories)
25. [Town Heroes → Nomination review queue, edit & delete](#town-heroes--nomination-review-queue-edit--delete)
26. [Town Heroes → Town Hero categories](#town-heroes--town-hero-categories)
27. [Library → Themes](#library--themes)
28. [Library → Clips](#library--clips)
29. [Library → Reorder themes & clips](#library--reorder-themes--clips)
30. [Library → Clip comment moderation](#library--clip-comment-moderation)
31. [Live → Live-stream categories](#live--live-stream-categories)
32. [Daily Reflections → Quote & question calendar](#daily-reflections--quote--question-calendar)
33. [Campaign & Petition categories (no admin management)](#campaign--petition-categories-no-admin-management)
34. [Article comment moderation (no admin API)](#article-comment-moderation-no-admin-api)

## Endpoints in this module

| Method | Path | Feature | Auth |
|---|---|---|---|
| GET | /api/admin/articles | Articles → List & search | Admin (any role) |
| POST | /api/admin/articles | Articles → Create | Admin (any role) |
| GET | /api/admin/articles/[id] | Articles → View | Admin (any role) |
| PATCH | /api/admin/articles/[id] | Articles → Edit | Admin (any role) |
| DELETE | /api/admin/articles/[id] | Articles → Delete | Admin (any role) |
| GET | /api/admin/article-categories | Article categories | Admin (any role) |
| POST | /api/admin/article-categories | Article categories | Admin (any role) |
| PATCH | /api/admin/article-categories/[id] | Article categories | Admin (any role) |
| DELETE | /api/admin/article-categories/[id] | Article categories | Admin (any role) |
| GET | /api/admin/campaigns | Campaigns → List | Admin (any role) |
| POST | /api/admin/campaigns | Campaigns → Create | Admin (any role) |
| GET | /api/admin/campaigns/[id] | Campaigns → View | Admin (any role) |
| PATCH | /api/admin/campaigns/[id] | Campaigns → Edit | Admin (any role) |
| DELETE | /api/admin/campaigns/[id] | Campaigns → Delete | Admin: OWNER, ADMIN (MODERATOR → 403) |
| POST | /api/admin/campaigns/[id]/review | Campaigns → Review | Admin (any role) |
| POST | /api/admin/campaigns/[id]/attachments | Campaigns → Attachments | Admin (any role) |
| GET | /api/admin/campaigns/attachables | Campaigns → Attachments picker | Admin (any role) |
| GET | /api/admin/events | Events → List | Admin (any role) |
| POST | /api/admin/events | Events → Create | Admin (any role) |
| GET | /api/admin/events/[id] | Events → View | Admin (any role) |
| PATCH | /api/admin/events/[id] | Events → Edit | Admin (any role) |
| DELETE | /api/admin/events/[id] | Events → Delete | Admin (any role) |
| POST | /api/admin/events/[id]/review | Events → Review / cancel | Admin (any role) |
| GET | /api/admin/event-categories | Event categories | Admin (any role) |
| POST | /api/admin/event-categories | Event categories | Admin (any role) |
| PATCH | /api/admin/event-categories/[id] | Event categories | Admin (any role) |
| DELETE | /api/admin/event-categories/[id] | Event categories | Admin (any role) |
| GET | /api/admin/petitions | Petitions → Queue | Admin (any role) |
| GET | /api/admin/petitions/[id] | Petitions → View | Admin (any role) |
| DELETE | /api/admin/petitions/[id] | Petitions → Delete | Admin (any role) |
| POST | /api/admin/petitions/[id]/review | Petitions → Review / close | Admin (any role) |
| GET | /api/admin/places | Places → List | Admin (any role) |
| POST | /api/admin/places | Places → Create | Admin (any role) |
| GET | /api/admin/places/[id] | Places → View | Admin (any role) |
| PATCH | /api/admin/places/[id] | Places → Edit | Admin (any role) |
| DELETE | /api/admin/places/[id] | Places → Delete | Admin: OWNER, ADMIN (MODERATOR → 403) |
| POST | /api/admin/places/[id]/geocode | Places → Re-geocode | Admin (any role) |
| POST | /api/admin/places/[id]/review | Places → Review | Admin (any role) |
| GET | /api/admin/places/reports | Places → Reports queue | Admin (any role) |
| POST | /api/admin/places/reports/[id] | Places → Resolve report | Admin (any role) |
| GET | /api/admin/geography/stats | Geography → Stats | Admin (any role) |
| GET | /api/admin/geography/options | Geography → Picker options | Admin (any role) |
| GET | /api/admin/geography/regions | Geography → Regions | Admin (any role) |
| POST | /api/admin/geography/regions | Geography → Regions | Admin (any role) |
| PUT | /api/admin/geography/regions/[id] | Geography → Regions | Admin (any role) |
| DELETE | /api/admin/geography/regions/[id] | Geography → Regions | Admin (any role) |
| GET | /api/admin/geography/sub-regions | Geography → Sub-regions | Admin (any role) |
| POST | /api/admin/geography/sub-regions | Geography → Sub-regions | Admin (any role) |
| PUT | /api/admin/geography/sub-regions/[id] | Geography → Sub-regions | Admin (any role) |
| DELETE | /api/admin/geography/sub-regions/[id] | Geography → Sub-regions | Admin (any role) |
| GET | /api/admin/geography/countries | Geography → Countries | Admin (any role) |
| POST | /api/admin/geography/countries | Geography → Countries | Admin (any role) |
| GET | /api/admin/geography/countries/[id] | Geography → Countries | Admin (any role) |
| PUT | /api/admin/geography/countries/[id] | Geography → Countries | Admin (any role) |
| DELETE | /api/admin/geography/countries/[id] | Geography → Countries | Admin (any role) |
| GET | /api/admin/geography/states | Geography → States | Admin (any role) |
| POST | /api/admin/geography/states | Geography → States | Admin (any role) |
| PUT | /api/admin/geography/states/[id] | Geography → States | Admin (any role) |
| DELETE | /api/admin/geography/states/[id] | Geography → States | Admin (any role) |
| GET | /api/admin/gratitude | Gratitude → Queue | Admin (any role) |
| POST | /api/admin/gratitude/[id] | Gratitude → Approve / reject | Admin (any role) |
| GET | /api/admin/gratitude-categories | Gratitude categories | Admin (any role) |
| POST | /api/admin/gratitude-categories | Gratitude categories | Admin (any role) |
| PATCH | /api/admin/gratitude-categories/[id] | Gratitude categories | Admin (any role) |
| DELETE | /api/admin/gratitude-categories/[id] | Gratitude categories | Admin (any role) |
| GET | /api/admin/town-heroes | Town Heroes → Queue | Admin (any role) |
| POST | /api/admin/town-heroes/[id] | Town Heroes → Approve / reject | Admin (any role) |
| PATCH | /api/admin/town-heroes/[id] | Town Heroes → Edit | Admin (any role) |
| DELETE | /api/admin/town-heroes/[id] | Town Heroes → Delete | Admin (any role) |
| GET | /api/admin/town-hero-categories | Town Hero categories | Admin (any role) |
| POST | /api/admin/town-hero-categories | Town Hero categories | Admin (any role) |
| PATCH | /api/admin/town-hero-categories/[id] | Town Hero categories | Admin (any role) |
| DELETE | /api/admin/town-hero-categories/[id] | Town Hero categories | Admin (any role) |
| GET | /api/admin/library | Library → Themes | Admin (any role) |
| POST | /api/admin/library | Library → Themes | Admin (any role) |
| GET | /api/admin/library/[id] | Library → Theme + clips | Admin (any role) |
| PATCH | /api/admin/library/[id] | Library → Themes | Admin (any role) |
| DELETE | /api/admin/library/[id] | Library → Themes | Admin: OWNER, ADMIN (MODERATOR → 403) |
| POST | /api/admin/library/clips | Library → Clips | Admin (any role) |
| PATCH | /api/admin/library/clips/[id] | Library → Clips | Admin (any role) |
| DELETE | /api/admin/library/clips/[id] | Library → Clips | Admin (any role) |
| GET | /api/admin/library/clips/[id]/comments | Library → Clip comments | Admin (any role) |
| POST | /api/admin/library/comments/[id] | Library → Clip comments | Admin (any role) |
| POST | /api/admin/library/reorder | Library → Reorder | Admin (any role) |
| GET | /api/admin/live-categories | Live categories | Admin (any role) |
| POST | /api/admin/live-categories | Live categories | Admin (any role) |
| PATCH | /api/admin/live-categories/[id] | Live categories | Admin (any role) |
| DELETE | /api/admin/live-categories/[id] | Live categories | Admin (any role) |
| GET | /api/admin/daily-reflections | Daily Reflections | Admin (any role) |
| POST | /api/admin/daily-reflections | Daily Reflections | Admin (any role) |
| PUT | /api/admin/daily-reflections | Daily Reflections | Admin (any role) |
| DELETE | /api/admin/daily-reflections | Daily Reflections | Admin (any role) |

92 endpoints across 47 route files.

---

## Articles → List & search articles
- **Description:** Paginated admin list of magazine articles (all statuses), with search and status/category filters.
- **Who can use it:** Any admin (OWNER, ADMIN, MODERATOR).
- **Source files:** `src/app/api/admin/articles/route.ts` (GET), `src/lib/articles-admin.ts` (`listArticles`), page `src/app/admin/(dashboard)/articles/page.tsx`, `.../articles/client.tsx`.
- **User flow:**
  1. Admin opens Articles. App calls `GET /api/admin/articles?page=1`.
  2. Admin types in search / picks a status tab or category → refetch with `q`, `status`, `categoryId`.
  3. Success: table of rows with `pageCount` for pagination. Empty result → `articles: []`, `total: 0`, `pageCount: 1`.
  4. Failure: 401 if the admin session expired → send to admin login.
- **Suggested mobile screen(s):** `AdminArticleList` — search bar, status segmented control (All / Draft / Published / Archived), category filter chip, list cells (cover thumb, title, status badge, featured star, views/likes/comments, author), pager, FAB "New article".
- **API(s):**
  - `GET /api/admin/articles`
  - Auth required: yes — any admin role.
  - Request — query:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | q | string | no | matched against `title` and `excerpt` (contains) | — | `kindness` |
    | status | `DRAFT`\|`PUBLISHED`\|`ARCHIVED`\|`ALL` | no | not validated; an unknown value is passed to Prisma and will error (500) | `ALL` | `PUBLISHED` |
    | categoryId | string | no | exact match | — | `clx1cat...` |
    | page | number | no | `Number()`; 0/NaN → 1; min 1 | 1 | `2` |
    | perPage | number | no | clamped 1–100 | 20 | `20` |

  - Response (success, 200):
    ```ts
    interface AdminArticleListResponse {
      articles: Array<{
        id: string; slug: string; title: string; excerpt: string | null; coverUrl: string | null;
        status: "DRAFT" | "PUBLISHED" | "ARCHIVED"; isFeatured: boolean; publishedAt: string | null;
        readMinutes: number; viewCount: number; likeCount: number; commentCount: number;
        authorName: string; category: { id: string; name: string; slug: string } | null;
        createdAt: string; updatedAt: string;
      }>;
      total: number; page: number; perPage: number; pageCount: number;
    }
    ```
    ```json
    { "articles": [{ "id": "clart01", "slug": "small-acts", "title": "Small acts", "excerpt": "Why tiny gestures matter", "coverUrl": "/uploads/articles/a1.webp", "status": "PUBLISHED", "isFeatured": true, "publishedAt": "2026-10-02T09:00:00.000Z", "readMinutes": 4, "viewCount": 210, "likeCount": 18, "commentCount": 3, "authorName": "Editorial Team", "category": { "id": "clcat1", "name": "Wellbeing", "slug": "wellbeing" }, "createdAt": "2026-10-01T12:00:00.000Z", "updatedAt": "2026-10-02T09:00:00.000Z" }], "total": 1, "page": 1, "perPage": 20, "pageCount": 1 }
    ```
  - Errors: 401 — `Unauthorized` — no/invalid admin session.
- **Form fields:** n/a (filters only).
- **Business rules:** Sorted by `createdAt` desc. Includes all statuses unless filtered.
- **Edge cases / notes for the mobile app:** Page-based pagination (`page`, `perPage`, max 100). Send only valid `status` values.
- **Status:** ✅ Complete

## Articles → Create, view, edit & delete an article
- **Description:** Admin-authored magazine articles (Markdown body rendered by `src/lib/rich-text.tsx`) with cover image, optional video URL, category, status lifecycle DRAFT → PUBLISHED → ARCHIVED, and a "featured" flag.
- **Who can use it:** Any admin (OWNER, ADMIN, MODERATOR) — including delete.
- **Source files:** `src/app/api/admin/articles/route.ts` (POST), `src/app/api/admin/articles/[id]/route.ts` (GET/PATCH/DELETE), `src/lib/articles-admin.ts` (`createArticle`, `getArticle`, `updateArticle`, `deleteArticle`), `src/lib/articles.ts` (`RESERVED_ARTICLE_SLUGS`), pages `src/app/admin/(dashboard)/articles/new/page.tsx`, `.../articles/[id]/page.tsx`, `.../articles/editor.tsx`.
- **User flow:**
  1. New: admin fills the editor (title, body, excerpt, cover, category, status, featured) → `POST /api/admin/articles` → 201 `{ ok, id, slug }` → navigate to edit screen.
  2. Edit: load `GET /api/admin/articles/{id}` → change fields → `PATCH` with only the changed keys → `{ ok: true }`.
  3. Publish: PATCH `{ status: "PUBLISHED" }` — the first publish stamps `publishedAt`.
  4. Delete: confirm dialog → `DELETE` → `{ ok: true }`; cover, gallery and inline `/uploads/` images in the body are deleted from disk.
  5. Failures: 400 "Title and body are required" / "Title is required" / "Body is required"; 404 "Not found" (GET) / "Article not found" (PATCH); 400 "Delete failed".
- **Suggested mobile screen(s):** `AdminArticleEditor` — title input, Markdown body editor with image insert, excerpt textarea, cover picker + alt text, video URL, category picker, status picker, featured toggle, Save / Delete buttons.
- **API(s):**
  - `POST /api/admin/articles`
  - Auth required: yes — any admin role.
  - Request — body:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | title | string | yes | must be a string (else 400 "Title and body are required"); trimmed, non-empty; stored max 200 chars | — | `Small acts` |
    | body | string | yes | Markdown; must be non-blank | — | `## Why\nBecause…` |
    | excerpt | string | no | trimmed; max 400 chars; blank → null | null | `Why tiny gestures matter` |
    | coverUrl | string | no | blank → null | null | `/uploads/articles/a1.webp` |
    | coverAlt | string | no | blank → null | null | `Hands holding a cup` |
    | videoUrl | string | no | blank → null; not validated | null | `https://youtu.be/xyz` |
    | categoryId | string | no | blank → null; FK to ArticleCategory (invalid id → Prisma error → 400) | null | `clcat1` |
    | status | `DRAFT`\|`PUBLISHED`\|`ARCHIVED` | no | not validated by the route | `DRAFT` | `PUBLISHED` |
    | isFeatured | boolean | no | only `true` counts | false | `true` |

  - Response (201): `{ ok: true; id: string; slug: string }` — e.g. `{ "ok": true, "id": "clart01", "slug": "small-acts" }`
  - Errors: 400 — `Title and body are required` (non-string title/body); 400 — `Title is required` / `Body is required` / Prisma message; 401.

  - `GET /api/admin/articles/[id]`
  - Auth required: yes — any admin role.
  - Request — path `id` (string, article id).
  - Response (200): `{ article: AdminArticle }` — the full `Article` row plus `category`:
    ```ts
    interface AdminArticle {
      id: string; slug: string; title: string; excerpt: string | null; body: string;
      coverUrl: string | null; coverAlt: string | null; photos: Array<{ url: string; alt: string | null }> | null;
      videoUrl: string | null; categoryId: string | null; status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
      isFeatured: boolean; featuredAt: string | null; publishedAt: string | null; readMinutes: number;
      authorAdminId: string | null; authorNameSnapshot: string; authorAvatarSnapshot: string | null;
      viewCount: number; likeCount: number; saveCount: number; commentCount: number;
      createdAt: string; updatedAt: string;
      category: { id: string; name: string; slug: string } | null;
    }
    ```
  - Errors: 404 — `Not found`; 401.

  - `PATCH /api/admin/articles/[id]`
  - Auth required: yes — any admin role.
  - Request — body (all optional; only keys present are applied): `title`, `body`, `excerpt`, `coverUrl`, `coverAlt`, `videoUrl`, `categoryId` (same rules as POST; `null`/`""` clears the optional ones; `categoryId: null` disconnects the category), `status`, `isFeatured` (`=== true` → true, any other value present → false).
  - Response (200): `{ "ok": true }`
  - Errors: 404 — `Article not found`; 400 — `Title is required` / `Body is required` / Prisma message; 401.

  - `DELETE /api/admin/articles/[id]`
  - Auth required: yes — any admin role.
  - Response (200): `{ "ok": true }`
  - Errors: 400 — `Delete failed` (e.g. unknown id); 401.
- **Form fields:**

  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | Title | text | yes | ≤200 chars | — |
  | Body | Markdown | yes | non-blank | — |
  | Excerpt | textarea | no | ≤400 chars | — |
  | Cover image | image upload | no | URL from upload endpoint | — |
  | Cover alt text | text | no | — | — |
  | Video URL | url | no | — | — |
  | Category | picker | no | from `GET /api/admin/article-categories` | — |
  | Status | select | no | — | DRAFT, PUBLISHED, ARCHIVED |
  | Featured | toggle | no | — | true/false |
  | Gallery photos | multi-image | no | ⚠️ ignored by the API (see notes) | up to 10 |

- **Business rules:**
  - Slug is generated from the title and **regenerated on every title change**; reserved slugs (`RESERVED_ARTICLE_SLUGS` in `src/lib/articles.ts`) get `-article` appended.
  - `readMinutes` recomputed from the body (`estimateReadMinutes`).
  - `publishedAt` stamped the first time status becomes PUBLISHED; never moved afterwards.
  - `featuredAt` stamped on the false→true flip; cleared when unfeatured.
  - Author is the calling admin (`authorAdminId`, `authorNameSnapshot` = admin displayName).
  - Delete cascades comments, likes and saves; frees cover, gallery and inline `/uploads/` images.
- **Edge cases / notes for the mobile app:**
  - ⚠️ **Gallery photos are never saved through the API.** The web editor sends `photos`, and `createArticle`/`updateArticle` support it, but both route handlers drop the key (POST builds an explicit object; PATCH whitelists keys without `photos`). Do not offer a gallery until the backend is fixed.
  - No status validation: send only the three enum values.
- **Status:** ⚠️ Partial (gallery `photos` silently dropped by the routes)

## Articles → Article categories
- **Description:** CRUD for the article category taxonomy (name, description, single emoji, hex colour, sort order).
- **Who can use it:** Any admin.
- **Source files:** `src/app/api/admin/article-categories/route.ts`, `src/app/api/admin/article-categories/[id]/route.ts`, `src/lib/articles-admin.ts` (`listArticleCategories`, `createArticleCategory`, `updateArticleCategory`, `deleteArticleCategory`), pages `src/app/admin/(dashboard)/articles/categories/page.tsx`, `.../categories/client.tsx`.
- **User flow:**
  1. Open Article categories → `GET /api/admin/article-categories`.
  2. Add → `POST` with name (+ optional fields) → 201 `{ ok, id }`; refresh list.
  3. Edit inline → `PATCH /{id}` → `{ ok: true }`.
  4. Delete → `DELETE /{id}` → `{ ok: true }`. Articles in it become uncategorised (FK `SetNull`).
  5. Failures: 400 `Name is required`; 400 `Update failed`/`Delete failed`/Prisma message.
- **Suggested mobile screen(s):** `AdminArticleCategories` — list (emoji, colour dot, name, article count), add/edit bottom sheet, swipe-to-delete with confirmation.
- **API(s):**
  - `GET /api/admin/article-categories` — Auth: any admin. Response:
    ```ts
    interface ArticleCategoriesResponse { categories: Array<{ id: string; name: string; slug: string; description: string | null; emoji: string | null; color: string | null; sortOrder: number; articleCount: number }> }
    ```
    ```json
    { "categories": [{ "id": "clcat1", "name": "Wellbeing", "slug": "wellbeing", "description": null, "emoji": "🌿", "color": "#3a7d44", "sortOrder": 0, "articleCount": 12 }] }
    ```
  - `POST /api/admin/article-categories` — Auth: any admin. Body:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | name | string | yes | trimmed, non-empty | — | `Wellbeing` |
    | description | string | no | trimmed; blank → null | null | `Mind and body` |
    | emoji | string | no | only the first character (grapheme by code point) kept | null | `🌿` |
    | color | string | no | `#abc` or `#aabbcc` only, lowercased; anything else silently → null | null | `#3a7d44` |
    | sortOrder | number | no | — | 0 | `2` |

    Response 201: `{ "ok": true, "id": "clcat1" }`. Errors: 400 `Name is required`, 400 Prisma message, 401.
  - `PATCH /api/admin/article-categories/[id]` — Auth: any admin. Body: any of `name` (string; renaming regenerates the slug), `description`/`emoji`/`color` (present key incl. `null` clears), `sortOrder` (number). Response `{ "ok": true }`. Errors: 400 `Name is required` / Prisma message (unknown id), 401.
  - `DELETE /api/admin/article-categories/[id]` — Auth: any admin. Response `{ "ok": true }`. Errors: 400 `Delete failed`, 401.
- **Form fields:** Name (text, required), Description (text), Emoji (single emoji), Colour (hex `#rgb`/`#rrggbb`), Sort order (int).
- **Business rules:** Slug unique, from name. Sorted by `sortOrder` asc then `name`. No `isActive` flag for article categories. Deleting never deletes articles.
- **Edge cases / notes for the mobile app:** Invalid colours are stored as null without an error — validate client-side.
- **Status:** ✅ Complete

## Campaigns → List campaigns
- **Description:** Admin list of all awareness campaigns (admin drafts and member submissions), with a status filter.
- **Who can use it:** Any admin.
- **Source files:** `src/app/api/admin/campaigns/route.ts` (GET), `src/lib/campaigns-admin.ts` (`listAdminCampaigns`, `countPendingCampaigns`), page `src/app/admin/(dashboard)/campaigns/page.tsx` (server component that calls the lib directly).
- **User flow:**
  1. Open Campaigns → `GET /api/admin/campaigns?status=ALL`.
  2. Filter by status tab. PENDING (member submissions waiting for review) always sorts first.
  3. Tap a row → campaign detail/edit.
- **Suggested mobile screen(s):** `AdminCampaignList` — status tabs (All, Pending, Draft, Published, Rejected, Archived), cards (emoji/cover, title, category chip, status badge, supporters, #articles / #events, submitter name, review note).
- **API(s):**
  - `GET /api/admin/campaigns`
  - Auth required: yes — any admin.
  - Request — query:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | status | `PENDING`\|`DRAFT`\|`PUBLISHED`\|`REJECTED`\|`ARCHIVED`\|`ALL` | no | not validated (bad value → Prisma error 500) | `ALL` | `PENDING` |

  - Response (200):
    ```ts
    interface AdminCampaignListResponse {
      campaigns: Array<{
        id: string; slug: string; title: string; summary: string | null; coverUrl: string | null; emoji: string | null;
        status: "PENDING" | "DRAFT" | "PUBLISHED" | "REJECTED" | "ARCHIVED";
        startsAt: string | null; endsAt: string | null; supporterCount: number; updatedAt: string; createdAt: string;
        reviewNote: string | null; submittedByUserId: string | null; submitterNameSnapshot: string | null;
        category: { id: string; name: string; slug: string; emoji: string | null } | null;
        _count: { articles: number; events: number };
      }>;
    }
    ```
    ```json
    { "campaigns": [{ "id": "clcmp1", "slug": "clean-rivers", "title": "Clean Rivers", "summary": "Weekend clean-ups", "coverUrl": null, "emoji": "🌊", "status": "PENDING", "startsAt": "2026-12-01T00:00:00.000Z", "endsAt": null, "supporterCount": 0, "updatedAt": "2026-11-20T10:00:00.000Z", "createdAt": "2026-11-20T10:00:00.000Z", "reviewNote": null, "submittedByUserId": "clusr9", "submitterNameSnapshot": "Asha", "category": { "id": "clcc1", "name": "Environment", "slug": "environment", "emoji": "🌍" }, "_count": { "articles": 0, "events": 0 } }] }
    ```
  - Errors: 401.
- **Form fields:** n/a.
- **Business rules:** Order: `status` asc (enum order PENDING, DRAFT, PUBLISHED, REJECTED, ARCHIVED), then `updatedAt` desc.
- **Edge cases / notes for the mobile app:** **No pagination** — returns every campaign. `countPendingCampaigns` (sidebar badge) is not exposed via API; count PENDING rows client-side or call with `status=PENDING`.
- **Status:** ✅ Complete

## Campaigns → Create, view, edit & delete a campaign
- **Description:** Campaigns pull together a story (summary/body/cover/gallery), a call-to-action link, an optional date range, a country, a category, an optional chatroom and optional petition, plus attached articles and events.
- **Who can use it:** Create/view/edit: any admin. **Delete: OWNER or ADMIN only** (MODERATOR → 403 "Moderators can't delete a campaign.").
- **Source files:** `src/app/api/admin/campaigns/route.ts` (POST), `src/app/api/admin/campaigns/[id]/route.ts`, `src/lib/campaigns-admin.ts` (`normalise`, `assertCategory`, `createCampaign`, `getAdminCampaign`, `updateCampaign`, `deleteCampaign`), `src/lib/campaign-categories.ts` (`isSelectableCategory`), `src/lib/attached-media.ts` (`sanitiseImages`, `MAX_GALLERY_PHOTOS = 10`), pages `src/app/admin/(dashboard)/campaigns/new/page.tsx`, `.../campaigns/[id]/page.tsx`, `.../campaigns/form.tsx` (category options from `GET /api/public/campaign-categories`).
- **User flow:**
  1. New: fill form → `POST /api/admin/campaigns` → 201 `{ ok, id, slug }`.
  2. Edit: `GET /api/admin/campaigns/{id}` (includes attached articles/events and linked room) → `PATCH` → `{ ok, id, slug }`.
  3. Publishing (status PUBLISHED) requires an active campaign category.
  4. Delete (OWNER/ADMIN) → `{ ok: true }`.
  5. Failures: 400 with the validation sentence (see Business rules); 404 `Not found` on GET; 403 for moderators on DELETE.
- **Suggested mobile screen(s):** `AdminCampaignEditor` — title, category picker (required), summary, Markdown body, cover + gallery (≤10), emoji, CTA label + CTA URL, start/end date pickers, country picker, chatroom picker, petition id, status picker; sections "Attached articles" / "Attached events" (see Attachments feature); Delete (hidden for moderators).
- **API(s):**
  - `POST /api/admin/campaigns` — Auth: any admin. Body (`CampaignWriteInput`):

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | title | string | yes | trimmed non-empty; ≤200 | — | `Clean Rivers` |
    | categoryId | string | **yes on create** | must be an **active** CampaignCategory | — | `clcc1` |
    | summary | string\|null | no | ≤400 | null | `Weekend clean-ups` |
    | body | string\|null | no | Markdown, ≤40,000 | null | `…` |
    | coverUrl | string\|null | no | ≤500 | null | `/uploads/campaigns/c.webp` |
    | photos | `{url,alt?}[]`\|null | no | entries without a string `url` dropped; max 10 | null | `[{"url":"/uploads/x.webp","alt":"River"}]` |
    | emoji | string\|null | no | ≤8 chars | null | `🌊` |
    | callToAction | string\|null | no | ≤120 | null | `Join a clean-up` |
    | ctaUrl | string\|null | no | must start with `http://`, `https://` or `/`; ≤500 | null | `https://example.org/join` |
    | status | `PENDING`\|`DRAFT`\|`PUBLISHED`\|`REJECTED`\|`ARCHIVED` | no | PUBLISHED requires category | `DRAFT` | `PUBLISHED` |
    | startsAt | ISO string\|null | no | unparsable → null | null | `2026-12-01T00:00:00Z` |
    | endsAt | ISO string\|null | no | must not be before startsAt | null | `2026-12-31T00:00:00Z` |
    | countryId | string\|null | no | ≤60 | null | `clctryUS` |
    | chatRoomId | string\|null | no | ≤60; not validated | null | `clroom1` |
    | petitionId | string\|null | no | ≤60; not validated | null | `clpet1` |

    Response 201: `{ "ok": true, "id": "clcmp1", "slug": "clean-rivers" }`.
    Errors (400): `Title is required`; `The end date is before the start date.`; `The action link must start with https:// or be a path beginning with /`; `Choose what this campaign is about.` (no category on create); `That category is no longer available. Pick another.`; 401.
  - `GET /api/admin/campaigns/[id]` — Auth: any admin. Response `{ campaign }` = full `Campaign` row + `articles` + `events` + `room`:
    ```ts
    interface AdminCampaignDetail {
      id: string; slug: string; title: string; summary: string | null; body: string | null; coverUrl: string | null;
      photos: Array<{ url: string; alt: string | null }> | null; emoji: string | null; callToAction: string | null; ctaUrl: string | null;
      status: CampaignStatus; publishedAt: string | null; startsAt: string | null; endsAt: string | null;
      countryId: string | null; categoryId: string | null; submittedByUserId: string | null; submitterNameSnapshot: string | null;
      submitterAvatarSnapshot: string | null; reviewNote: string | null; reviewedAt: string | null; reviewedByAdminId: string | null;
      chatRoomId: string | null; petitionId: string | null; supporterCount: number; createdByAdminId: string | null;
      createdAt: string; updatedAt: string;
      articles: Array<{ sortOrder: number; article: { id: string; title: string; slug: string; status: string; coverUrl: string | null } }>;
      events: Array<{ sortOrder: number; event: { id: string; title: string; slug: string; status: string; startsAt: string; coverUrl: string | null } }>;
      room: { id: string; name: string; slug: string } | null;
    }
    ```
    Errors: 404 `Not found`; 401.
  - `PATCH /api/admin/campaigns/[id]` — Auth: any admin. Body: any subset of the POST fields. The **merged** row is re-validated. Response `{ "ok": true, "id": "clcmp1", "slug": "clean-rivers" }`. Errors: 400 `Campaign not found` (note: 400, not 404), the validation messages above, and `Choose a category before publishing — otherwise it won't appear under any tile.` when the merged status is PUBLISHED without a category.
  - `DELETE /api/admin/campaigns/[id]` — Auth: OWNER/ADMIN. Response `{ "ok": true }`. Errors: 403 `Moderators can't delete a campaign.`; 401; unknown id → unhandled Prisma error (500).
- **Form fields:** as POST table.
- **Business rules:**
  - Slug from title at creation only; **not** changed on edit.
  - Category rules (`assertCategory`): required on create; required whenever the saved status is PUBLISHED; must be `isActive`.
  - `publishedAt` stamped on first publish only.
  - `createdByAdminId` = calling admin.
  - Delete: join rows (attachments) and supports cascade; the attached articles, events and chatroom are **not** deleted; cover, gallery and inline body images are freed.
  - `photos: []` or `null` clears the gallery (stored as DB NULL).
- **Edge cases / notes for the mobile app:** Hide Delete for MODERATOR. `chatRoomId`/`petitionId` are not checked for existence. Dates are UTC instants.
- **Status:** ✅ Complete

## Campaigns → Review a submitted campaign
- **Description:** Approve (which publishes immediately) or reject a member-submitted campaign (status PENDING). The reviewer can set/fix the category at the same time.
- **Who can use it:** Any admin (OWNER, ADMIN, MODERATOR).
- **Source files:** `src/app/api/admin/campaigns/[id]/review/route.ts`, `src/lib/campaigns-admin.ts` (`reviewCampaign`, `assertCategory`), `src/lib/notifications.ts`, UI `src/app/admin/(dashboard)/campaigns/review-actions.tsx`.
- **User flow:**
  1. Admin opens a PENDING campaign, optionally picks a category, types an optional note.
  2. Approve → `POST .../review { action: "approve", categoryId?, reason? }` → `{ ok: true, status: "PUBLISHED" }`; the submitter gets an in-app notification "Your campaign is live".
  3. Reject → `{ action: "reject", reason }` → `{ ok: true, status: "REJECTED" }`; the submitter is told the reason (or "It didn't meet our community guidelines.").
  4. Failures: 400 `Unknown action`; 404 `Campaign not found`; 400 `Choose a category before publishing — otherwise it won't appear under any tile.` / `That category is no longer available. Pick another.`
- **Suggested mobile screen(s):** `AdminCampaignReview` — submission preview, submitter name, category picker, note textarea, Approve / Reject buttons.
- **API(s):**
  - `POST /api/admin/campaigns/[id]/review`
  - Auth required: yes — any admin.
  - Request — body:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | action | `approve`\|`reject` | yes | anything else → 400 | — | `approve` |
    | reason | string | no | trimmed, ≤2000; stored as `reviewNote` on **both** approve and reject | null | `Dates confirmed with organiser` |
    | categoryId | string\|null | no | if present, overrides the campaign's category (≤60); approve requires an active category | current | `clcc1` |

  - Response (200):
    ```ts
    interface CampaignReviewResponse { ok: true; status: "PUBLISHED" | "REJECTED" }
    ```
    ```json
    { "ok": true, "status": "PUBLISHED" }
    ```
  - Errors: 400 `Unknown action`; 404 `Campaign not found`; 400 category messages; 401.
- **Form fields:**

  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | Category | picker | to approve | active campaign category | from `GET /api/public/campaign-categories` |
  | Note | textarea | no | ≤2000 chars | — |

- **Business rules:** PENDING → PUBLISHED (approve) or REJECTED (reject). Not restricted to PENDING rows — any campaign can be re-reviewed. Stamps `reviewedAt`, `reviewedByAdminId`; `publishedAt` only on first publication. Rejected rows are kept (the submitter can still read the reason on their copy). Notification only if `submittedByUserId` is set (admin-created campaigns get none). In-app notification types `CAMPAIGN_APPROVED` / `CAMPAIGN_REJECTED`, actionUrl `/campaigns/{slug}`.
- **Edge cases / notes for the mobile app:** Sending `categoryId: null` explicitly clears the category, which blocks approval.
- **Status:** ✅ Complete

## Campaigns → Attach articles & events (attachments, reorder, picker search)
- **Description:** A campaign can point to articles and events (join tables `CampaignArticle`, `CampaignEvent` with `sortOrder`). One endpoint attaches, detaches or reorders; a search endpoint feeds the pickers (and also returns chatrooms for the campaign's `chatRoomId` picker).
- **Who can use it:** Any admin.
- **Source files:** `src/app/api/admin/campaigns/[id]/attachments/route.ts`, `src/app/api/admin/campaigns/attachables/route.ts`, `src/lib/campaigns-admin.ts` (`attachArticle`, `attachEvent`, `detachArticle`, `detachEvent`, `reorderAttachments`, `searchAttachables`), UI `src/app/admin/(dashboard)/campaigns/form.tsx`.
- **User flow:**
  1. On the campaign editor, admin taps "Attach article" → search box calls `GET /api/admin/campaigns/attachables?q=…`.
  2. Picks a result → `POST .../attachments { action: "attach", kind: "articles", targetId }` → `{ ok: true }`; refresh the campaign detail.
  3. Remove → `{ action: "detach", kind, targetId }`.
  4. Drag to reorder → `{ action: "reorder", kind, ids: [...] }`.
  5. Failures: 400 `Nothing to attach` / `Nothing to detach` / `Nothing to reorder` / `Unknown action` / `Article not found` / `Event not found`.
- **Suggested mobile screen(s):** `AdminCampaignAttachments` — two reorderable lists (Articles, Events) with remove buttons; `AttachPickerSheet` — search field + results (title, status badge, cover/date).
- **API(s):**
  - `POST /api/admin/campaigns/[id]/attachments`
  - Auth required: yes — any admin.
  - Request — body:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | action | `attach`\|`detach`\|`reorder` | yes | else 400 `Unknown action` | — | `attach` |
    | kind | `articles`\|`events` | no | anything other than `events` is treated as `articles` | `articles` | `events` |
    | targetId | string | for attach/detach | article or event id; must exist for attach | — | `clevt1` |
    | ids | string[] | for reorder | non-strings dropped; must be non-empty; array index = new `sortOrder` | — | `["clart2","clart1"]` |

  - Response (200): `{ "ok": true }`
  - Errors: 400 messages above; 401. The campaign id itself is not checked — attaching to an unknown campaign fails at the DB (400 with a Prisma message).

  - `GET /api/admin/campaigns/attachables`
  - Auth required: yes — any admin.
  - Request — query: `q` (string, optional; title/name contains).
  - Response (200):
    ```ts
    interface AttachablesResponse {
      articles: Array<{ id: string; title: string; slug: string; status: "DRAFT"|"PUBLISHED"|"ARCHIVED"; coverUrl: string | null }>;
      events: Array<{ id: string; title: string; slug: string; status: "PENDING"|"APPROVED"|"REJECTED"|"CANCELLED"; startsAt: string; coverUrl: string | null }>;
      rooms: Array<{ id: string; name: string; slug: string }>;
    }
    ```
    ```json
    { "articles": [{ "id": "clart01", "title": "Small acts", "slug": "small-acts", "status": "PUBLISHED", "coverUrl": null }], "events": [], "rooms": [{ "id": "clroom1", "name": "Rivers", "slug": "rivers" }] }
    ```
  - Errors: 401.
- **Form fields:** search text; selection.
- **Business rules:** Attach is idempotent (upsert) and appends at max(sortOrder)+1. Detaching something not attached silently succeeds. Reorder runs in one transaction; ids that are not attached are ignored. Items in any status (including drafts) can be attached. Max 12 results per type; articles ordered by `updatedAt` desc, events by `startsAt` desc, rooms by name.
- **Edge cases / notes for the mobile app:** Debounce search. Empty `q` returns the 12 most recent of each.
- **Status:** ✅ Complete

## Campaigns → Uncategorised backlog filter
- **Description:** The web admin's Campaigns page has an "Uncategorised" filter (`?status=UNCATEGORISED`) listing campaigns with no category — these cannot be published until a category is set.
- **Who can use it:** Any admin, web only.
- **Source files:** `src/app/admin/(dashboard)/campaigns/page.tsx` (server component calling `listAdminCampaigns({ uncategorised: true })` directly), `src/lib/campaigns-admin.ts`.
- **User flow:** 1. Web admin picks the "Uncategorised" tab. 2. The server renders the list straight from the DB. There is no API equivalent.
- **Suggested mobile screen(s):** Filter chip on `AdminCampaignList` — implement client-side by filtering `GET /api/admin/campaigns` results where `category === null`.
- **API(s):** none. `GET /api/admin/campaigns` has no uncategorised flag (`status=UNCATEGORISED` would be passed to Prisma and fail with 500).
- **Form fields:** n/a.
- **Business rules:** see `assertCategory` in the Create/Edit feature.
- **Edge cases / notes for the mobile app:** Client-side filtering works because the list endpoint is unpaginated.
- **Status:** ⚠️ Web-only (no API)

## Events → List, create, view, edit & delete events
- **Description:** Admin management of real-world events (in person or online). Admin-created events skip review (saved as APPROVED) and get an event chatroom automatically.
- **Who can use it:** Any admin (OWNER, ADMIN, MODERATOR), including delete.
- **Source files:** `src/app/api/admin/events/route.ts`, `src/app/api/admin/events/[id]/route.ts`, `src/lib/events.ts` (`listAdminEvents`, `createEventAsAdmin`, `getAdminEvent`, `updateEvent`, `deleteEvent`, `ensureEventRoom`, `normalise`), pages `src/app/admin/(dashboard)/events/page.tsx`, `.../events/client.tsx`, `.../events/new/page.tsx`, `.../events/[id]/page.tsx`, `.../events/event-form.tsx` (countries from `GET /api/public/geo/countries`).
- **User flow:**
  1. List: `GET /api/admin/events?status=PENDING&page=1` → table with `pendingCount` badge.
  2. Create: fill form → `POST /api/admin/events` → 201 `{ ok, id, slug }`; event is live immediately with a chatroom.
  3. Edit: `GET /api/admin/events/{id}` → `PATCH` → `{ ok: true }`.
  4. Delete: confirm → `DELETE` → `{ ok: true }`.
  5. Failures: 400 validation sentences (below); 404 `Not found` / `Event not found`; 400 `Delete failed`.
- **Suggested mobile screen(s):** `AdminEventList` — status tabs (All/Pending/Approved/Rejected/Cancelled), search, cards (date in event timezone, title, city/online, RSVPs/capacity, status, rejection reason). `AdminEventEditor` — title, summary, description (Markdown), cover + gallery (≤12), start/end datetime + IANA timezone picker, Online toggle (join URL) or venue/address/city, country picker, capacity.
- **API(s):**
  - `GET /api/admin/events` — Auth: any admin. Query:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | status | `PENDING`\|`APPROVED`\|`REJECTED`\|`CANCELLED`\|`ALL` | no | not validated (bad value → 500) | `ALL` | `PENDING` |
    | q | string | no | title / city / venueName contains | — | `park` |
    | page | number | no | min 1 | 1 | `1` |
    | perPage | number | no | 1–100 | 20 | `20` |

    Response:
    ```ts
    interface AdminEventListResponse {
      events: Array<{ id: string; slug: string; title: string; summary: string | null; coverUrl: string | null; startsAt: string; endsAt: string | null;
        timezone: string; isOnline: boolean; venueName: string | null; city: string | null; countryId: string | null; capacity: number | null;
        rsvpCount: number; status: "PENDING"|"APPROVED"|"REJECTED"|"CANCELLED"; hostNameSnapshot: string; hostAvatarSnapshot: string | null;
        category: { id: string; name: string; slug: string; emoji: string | null; color: string | null } | null;
        rejectionReason: string | null; chatRoomId: string | null; createdAt: string }>;
      total: number; pendingCount: number; page: number; perPage: number; pageCount: number;
    }
    ```
    ```json
    { "events": [{ "id": "clevt1", "slug": "park-clean-up", "title": "Park clean-up", "summary": "Bring gloves", "coverUrl": null, "startsAt": "2026-12-06T15:00:00.000Z", "endsAt": "2026-12-06T18:00:00.000Z", "timezone": "America/New_York", "isOnline": false, "venueName": "Riverside Park", "city": "New York", "countryId": "clctryUS", "capacity": 40, "rsvpCount": 12, "status": "PENDING", "hostNameSnapshot": "Asha", "hostAvatarSnapshot": null, "category": { "id": "clec1", "name": "Volunteering", "slug": "volunteering", "emoji": "🤝", "color": "#2266aa" }, "rejectionReason": null, "chatRoomId": null, "createdAt": "2026-11-20T10:00:00.000Z" }], "total": 1, "pendingCount": 1, "page": 1, "perPage": 20, "pageCount": 1 }
    ```
  - `POST /api/admin/events` — Auth: any admin. Body (`EventWriteInput`):

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | title | string | yes | trimmed non-empty; ≤200 | — | `Park clean-up` |
    | description | string | yes | non-blank (Markdown) | — | `We meet at…` |
    | summary | string\|null | no | ≤400 | null | `Bring gloves` |
    | coverUrl | string\|null | no | — | null | `/uploads/events/e.webp` |
    | startsAt | ISO string | yes | must parse | — | `2026-12-06T15:00:00Z` |
    | endsAt | ISO string\|null | no | must parse and be **after** startsAt | null | `2026-12-06T18:00:00Z` |
    | timezone | string\|null | no | IANA zone (not validated) | `UTC` | `America/New_York` |
    | isOnline | boolean | no | — | false | `false` |
    | joinUrl | string\|null | if online | required when online; dropped when in-person | null | `https://meet.example/abc` |
    | venueName | string\|null | in-person: venue or address | dropped when online | null | `Riverside Park` |
    | addressLine | string\|null | in-person: venue or address | dropped when online | null | `1 River Rd` |
    | city | string\|null | no | — | null | `New York` |
    | countryId | string\|null | no | — | null | `clctryUS` |
    | capacity | number\|null | no | positive → floored; ≤0 or non-number → null (unlimited) | null | `40` |
    | photos | `{url,alt?}[]`\|null | no | blank urls dropped; max **12** | `[]` | `[{"url":"/uploads/events/p1.webp"}]` |
    | categoryId | string\|null | no | stored as given; **not** validated for admins | null | `clec1` |

    Response 201: `{ "ok": true, "id": "clevt1", "slug": "park-clean-up" }`. Errors (400): `Title is required`, `Description is required`, `Start time is invalid`, `End time is invalid`, `The end time must be after the start time`, `Add a venue or address, or mark the event as online`, `Online events need a join link`; a non-string `title` crashes `.trim()` → 400 with a TypeError message.
  - `GET /api/admin/events/[id]` — Auth: any admin. Response `{ event }` (full `Event` row: all fields in the table above plus `status`, `rejectionReason`, `reviewedAt`, `reviewedBy`, `hostUserId`, `hostNameSnapshot`, `hostAvatarSnapshot`, `createdByAdminId`, `chatRoomId`, `rsvpCount`, `createdAt`, `updatedAt`). Errors: 404 `Not found`.
  - `PATCH /api/admin/events/[id]` — Auth: any admin. Body: any subset of the POST fields; the merged event is re-validated. Response `{ "ok": true }`. Errors: 404 `Event not found`; 400 validation messages.
  - `DELETE /api/admin/events/[id]` — Auth: any admin. Response `{ "ok": true }`. Errors: 400 `Delete failed`.
- **Form fields:** as POST table.
- **Business rules:**
  - Admin create: status APPROVED, `reviewedAt` now, `reviewedBy` = admin, `hostNameSnapshot` = admin displayName, `createdByAdminId` set; `ensureEventRoom` creates a PUBLIC chatroom (`slug: event-{slug}`, emoji 📅) — failures are logged, never fatal.
  - Slug from title; regenerated when the title changes on PATCH.
  - Delete: RSVPs cascade; the chatroom is **kept**; cover, gallery and inline description images are freed.
  - Times: `startsAt` is a UTC instant; render in the event's `timezone`.
- **Edge cases / notes for the mobile app:**
  - ⚠️ **PATCH wipes the category.** `updateEvent` builds the merged input without `categoryId`, so `normalise` returns `categoryId: null` and every admin edit (even one that sends `categoryId`) un-files the event. The web admin form has no category field at all.
  - Status changes are not done via PATCH — use the review endpoint.
- **Status:** ⚠️ Partial (PATCH clears `categoryId`)

## Events → Review (approve / reject / cancel) an event
- **Description:** Moderate member-submitted events (PENDING) and cancel events that will no longer happen. Approval creates the event's chatroom; cancellation notifies everyone who RSVP'd.
- **Who can use it:** Any admin (OWNER, ADMIN, MODERATOR).
- **Source files:** `src/app/api/admin/events/[id]/review/route.ts`, `src/lib/events.ts` (`reviewEvent`, `cancelEvent`, `ensureEventRoom`), `src/lib/notifications.ts`, UI `src/app/admin/(dashboard)/events/client.tsx`.
- **User flow:**
  1. Admin opens the Pending tab (member submissions also raise an admin notification `EVENT_PENDING` linking to `/admin/events?status=PENDING`).
  2. Approve → `POST .../review { action: "approve" }` → `{ ok: true, status: "APPROVED" }`; chatroom created; host notified.
  3. Reject → `{ action: "reject", reason }` → `{ ok: true, status: "REJECTED" }`; host notified with the reason.
  4. Cancel → `{ action: "cancel" }` → `{ ok: true, cancelled: <number of RSVPs notified> }`.
  5. Failures: 400 `Unknown action`; 404 `Event not found`.
- **Suggested mobile screen(s):** `AdminEventReview` — event preview (date in its timezone, venue/online, host), reason textarea, Approve / Reject; on approved events a destructive "Cancel event" button with confirmation showing the RSVP count.
- **API(s):**
  - `POST /api/admin/events/[id]/review`
  - Auth required: yes — any admin.
  - Request — body:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | action | `approve`\|`reject`\|`cancel` | yes | else 400 | — | `reject` |
    | reason | string | no | used only for reject; trimmed; blank → null; no length cap | null | `Duplicate of an existing event` |

  - Response (200):
    ```ts
    type EventReviewResponse = { ok: true; status: "APPROVED" | "REJECTED" } | { ok: true; cancelled: number };
    ```
    ```json
    { "ok": true, "status": "APPROVED" }
    ```
    ```json
    { "ok": true, "cancelled": 12 }
    ```
  - Errors: 400 `Unknown action`; 404 `Event not found`; 401.
- **Form fields:** Rejection reason (textarea, optional).
- **Business rules:**
  - Transitions: any → APPROVED / REJECTED (approve/reject); any → CANCELLED (cancel). The current status is **not** checked (a PENDING or REJECTED event can be "cancelled").
  - Approve clears `rejectionReason`; reject stores it. Both stamp `reviewedAt` and `reviewedBy`.
  - Approve calls `ensureEventRoom` (idempotent; one room per event).
  - In-app notifications: host (`hostUserId`, member submissions only) gets `EVENT_APPROVED` ("Your event was approved", actionUrl `/events/{slug}`) or `EVENT_REJECTED` ("Your event wasn't approved", body `Reason: …` or "It didn't meet our community guidelines.", actionUrl `/events`). Cancel sends `EVENT_CANCELLED` ("An event you're going to was cancelled") to every RSVP'd member.
  - Cancelled events remain readable publicly (status CANCELLED).
- **Edge cases / notes for the mobile app:** Show "Cancel" only for APPROVED events to avoid odd transitions. No un-cancel action exists other than approving again.
- **Status:** ✅ Complete

## Events → Event categories
- **Description:** Admin-managed closed taxonomy for events (name, description, emoji, colour, sort order, active flag). Members must pick an active category when submitting an event.
- **Who can use it:** Any admin.
- **Source files:** `src/app/api/admin/event-categories/route.ts`, `src/app/api/admin/event-categories/[id]/route.ts`, `src/lib/event-categories.ts`, pages `src/app/admin/(dashboard)/events/categories/page.tsx`, `.../categories/client.tsx`.
- **User flow:**
  1. `GET /api/admin/event-categories` → list with counts.
  2. Add → `POST` → 201 `{ ok, id }`. Edit/retire → `PATCH` (`isActive: false` hides it from submission forms). Delete → only when no event uses it.
  3. Failures: 400 `Name is required.`, `Keep the name under 80 characters.`, `N event(s) still use this category. Retire it instead, or move them first.`
- **Suggested mobile screen(s):** `AdminEventCategories` — list (emoji, colour, name, total events, upcoming count, Active switch), add/edit sheet, delete (disabled when `eventCount > 0`).
- **API(s):**
  - `GET /api/admin/event-categories` — Auth: any admin. Response:
    ```ts
    interface EventCategoriesResponse { categories: Array<{ id: string; name: string; slug: string; description: string | null; emoji: string | null; color: string | null; sortOrder: number; isActive: boolean; eventCount: number; upcomingCount: number }> }
    ```
    ```json
    { "categories": [{ "id": "clec1", "name": "Volunteering", "slug": "volunteering", "description": "Hands-on help", "emoji": "🤝", "color": "#2266aa", "sortOrder": 0, "isActive": true, "eventCount": 14, "upcomingCount": 3 }] }
    ```
    `upcomingCount` = APPROVED events with `startsAt >= now`.
  - `POST /api/admin/event-categories` — Auth: any admin. Body:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | name | string | yes | trimmed, 1–80 chars | — | `Volunteering` |
    | description | string | no | ≤300; blank → null | null | `Hands-on help` |
    | emoji | string | no | first character only | null | `🤝` |
    | color | string | no | `#rgb`/`#rrggbb`, else silently null | null | `#2266aa` |
    | sortOrder | number | no | — | 0 | `1` |
    | isActive | boolean | no | — | true | `true` |

    Response 201 `{ "ok": true, "id": "clec1" }`. Errors 400 as above; 401.
  - `PATCH /api/admin/event-categories/[id]` — Auth: any admin. Body: any field above; for `description`/`emoji`/`color` omit = keep, `null` = clear. Slug regenerated only when the name actually changes. Response `{ "ok": true }`. Errors: 400 validation / Prisma (unknown id).
  - `DELETE /api/admin/event-categories/[id]` — Auth: any admin. Response `{ "ok": true }`. Errors: 400 `N events still use this category. Retire it instead, or move them first.`; Prisma message for unknown id.
- **Form fields:** Name (≤80, required), Description (≤300), Emoji, Colour (hex), Sort order, Active.
- **Business rules:** Reserved slugs `all`, `category`, `new` get `-events` appended. Sorted by sortOrder then name. Delete blocked while any event (any status) references it.
- **Edge cases / notes for the mobile app:** Prefer "retire" (isActive=false) over delete.
- **Status:** ✅ Complete

## Petitions → Moderation queue, view & delete
- **Description:** List of member petitions for moderation (PENDING first), full petition view, and hard delete for content that should not exist.
- **Who can use it:** Any admin (OWNER, ADMIN, MODERATOR), including delete.
- **Source files:** `src/app/api/admin/petitions/route.ts`, `src/app/api/admin/petitions/[id]/route.ts`, `src/lib/petitions-admin.ts` (`listAdminPetitions`, `getAdminPetition`, `deletePetition`), `src/lib/video-status.ts` (`discardVideo`), pages `src/app/admin/(dashboard)/petitions/page.tsx`, `.../petitions/client.tsx`.
- **User flow:**
  1. `GET /api/admin/petitions?status=PENDING&q=…` → list.
  2. Tap → `GET /api/admin/petitions/{id}` → full petition (body, media, target, goal).
  3. Delete (confirm: destroys signatures) → `DELETE` → `{ ok: true }`.
- **Suggested mobile screen(s):** `AdminPetitionQueue` — status tabs (All/Pending/Approved/Rejected/Closed), search, rows (title, target, creator, signatures/goal, status). `AdminPetitionDetail` — full content incl. cover, gallery, video player; actions Approve / Reject / Close / Delete.
- **API(s):**
  - `GET /api/admin/petitions` — Auth: any admin. Query: `status` (`PENDING`|`APPROVED`|`REJECTED`|`CLOSED`|`ALL`, default ALL, not validated), `q` (title / target / creator name contains). Response:
    ```ts
    interface AdminPetitionListResponse { petitions: Array<{ id: string; slug: string; title: string; target: string; status: "PENDING"|"APPROVED"|"REJECTED"|"CLOSED"; signatureCount: number; goal: number | null; creatorUserId: string | null; creatorNameSnapshot: string; createdAt: string; reviewedAt: string | null }> }
    ```
    ```json
    { "petitions": [{ "id": "clpet1", "slug": "safer-crossings", "title": "Safer crossings", "target": "City Council", "status": "PENDING", "signatureCount": 0, "goal": 500, "creatorUserId": "clusr9", "creatorNameSnapshot": "Asha", "createdAt": "2026-11-21T08:00:00.000Z", "reviewedAt": null }] }
    ```
  - `GET /api/admin/petitions/[id]` — Auth: any admin. Response `{ petition }`: full `Petition` row — `id, slug, title, summary, body, coverUrl, photos ({url,alt}[] | null), video ({assetId,url,posterUrl,width,height,durationSec} | null), target, goal, countryId, categoryId, status, rejectionReason, reviewedAt, reviewedBy, closesAt, creatorUserId, creatorNameSnapshot, creatorAvatarSnapshot, createdByAdminId, signatureCount, reactionCount, createdAt, updatedAt`. Errors: 404 `Not found`.
  - `DELETE /api/admin/petitions/[id]` — Auth: any admin. Response `{ "ok": true }`. Errors: unknown id → unhandled Prisma error (500).
- **Form fields:** n/a.
- **Business rules:** Order: status asc (PENDING first), then newest. Max **200** rows, no pagination. Delete cascades signatures, frees cover/gallery/inline images and discards the attached video asset.
- **Edge cases / notes for the mobile app:** Admins cannot create or edit petitions via API. Prefer Close over Delete.
- **Status:** ✅ Complete

## Petitions → Review / close a petition
- **Description:** Approve (opens for signatures), reject with a reason, or close (stop new signatures but keep the record).
- **Who can use it:** Any admin.
- **Source files:** `src/app/api/admin/petitions/[id]/review/route.ts`, `src/lib/petitions-admin.ts` (`reviewPetition`, `closePetitionAsAdmin`).
- **User flow:**
  1. From the detail screen: Approve → `{ action: "approve" }` → `{ ok, status: "APPROVED" }`; creator notified "Your petition is live".
  2. Reject → `{ action: "reject", reason }` → `{ ok, status: "REJECTED" }`; creator notified with the reason.
  3. Close → `{ action: "close" }` → `{ ok, status: "CLOSED" }` (no notification).
  4. Failures: 400 `Unknown action`; 404 `Petition not found` (approve/reject); close on an unknown id → 400 with a raw Prisma message.
- **Suggested mobile screen(s):** Action bar on `AdminPetitionDetail`; reject sheet with reason textarea.
- **API(s):**
  - `POST /api/admin/petitions/[id]/review`
  - Auth required: yes — any admin.
  - Request — body:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | action | `approve`\|`reject`\|`close` | yes | else 400 | — | `approve` |
    | reason | string | no | reject only; trimmed; ≤2000 | null | `Targets a private individual` |

  - Response (200): `{ "ok": true, "status": "APPROVED" | "REJECTED" | "CLOSED" }`
  - Errors: 400 `Unknown action`; 404 `Petition not found`; 401.
- **Form fields:** Rejection reason (optional, ≤2000).
- **Business rules:** No from-state checks. Approve/reject stamp `reviewedAt`, `reviewedBy`, and set/clear `rejectionReason`. In-app notifications `PETITION_APPROVED` (actionUrl `/petitions/{slug}`) / `PETITION_REJECTED` (actionUrl `/petitions`) to `creatorUserId` when present. Close only sets status CLOSED.
- **Edge cases / notes for the mobile app:** Show Close only for APPROVED petitions.
- **Status:** ✅ Complete

## Places → List, create, view, edit & delete places
- **Description:** The map & directory of helpful places (clinics, food banks, shelters, churches, donating businesses…). Admin-created places are geocoded on save and default to APPROVED; edits re-geocode only when the address changes.
- **Who can use it:** List/create/view/edit: any admin. **Delete: OWNER or ADMIN** (MODERATOR → 403 "Moderators can't delete a place. Mark it closed instead.").
- **Source files:** `src/app/api/admin/places/route.ts`, `src/app/api/admin/places/[id]/route.ts`, `src/lib/places-admin.ts` (`listAdminPlaces`, `createPlaceAsAdmin`, `getAdminPlace`, `updatePlace`, `deletePlace`, `normalise`, `normaliseHours`, `geocodeFields`, `ensurePlaceRoom`), `src/lib/geocode.ts`, pages `src/app/admin/(dashboard)/places/page.tsx`, `.../places/client.tsx`, `.../places/new/page.tsx`, `.../places/[id]/page.tsx`, `.../places/form.tsx` (country/state pickers from `GET /api/public/geo/countries` and `GET /api/public/geo/states`).
- **User flow:**
  1. List: `GET /api/admin/places?status=PENDING&type=ALL&page=1` → items + `pending` badge. Rows with `geocodeError` show "no pin".
  2. Create: fill form → `POST` (may take a few seconds — geocoder is rate-limited to ~1 req/s; route `maxDuration` 60 s) → 201 `{ ok, id, slug, status }`.
  3. Edit: `GET /{id}` → `PATCH` → `{ ok, id, slug, status }`. To fix a pin manually, send both `latitude` and `longitude`.
  4. Delete (OWNER/ADMIN) → `{ ok: true }`. Moderators should PATCH `status: "CLOSED"` instead.
  5. Failures: 400 `Name is required` / `The website must start with http:// or https://` / `Place not found`; 404 `Not found` (GET); 403 moderator delete.
- **Suggested mobile screen(s):** `AdminPlaceList` — status tabs, type filter, search, rows (name, type, city, status, pin/no-pin indicator, donor badge, saves, submitter). `AdminPlaceEditor` — name, type picker, summary, about (Markdown), address/city/postcode/country/state, manual lat/lng, phone/email/website, weekly hours editor, needs, cover + gallery (≤10), donor toggle, status; map preview; "Re-geocode" button.
- **API(s):**
  - `GET /api/admin/places` — Auth: any admin. Query:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | status | `PENDING`\|`APPROVED`\|`REJECTED`\|`CLOSED`\|`ALL` | no | not validated | `ALL` | `PENDING` |
    | type | PlaceType \| `ALL` | no | not validated | `ALL` | `FOOD_BANK` |
    | q | string | no | name / city / addressLine contains | — | `bank` |
    | page | number | no | min 1 | 1 | `1` |
    | perPage | number | no | 1–100 | 25 | `25` |

    Response:
    ```ts
    interface AdminPlaceListResponse {
      items: Array<{ id: string; slug: string; name: string; type: PlaceType; status: "PENDING"|"APPROVED"|"REJECTED"|"CLOSED"; city: string | null;
        addressLine: string | null; latitude: number | null; longitude: number | null; geocodeError: string | null; isDonor: boolean;
        coverUrl: string | null; saveCount: number; submitterSnapshot: string | null; updatedAt: string }>;
      total: number; page: number; perPage: number; pageCount: number; pending: number;
    }
    ```
    ```json
    { "items": [{ "id": "clpl1", "slug": "eastside-food-bank", "name": "Eastside Food Bank", "type": "FOOD_BANK", "status": "APPROVED", "city": "Leeds", "addressLine": "12 Mill St", "latitude": 53.8, "longitude": -1.54, "geocodeError": null, "isDonor": false, "coverUrl": null, "saveCount": 4, "submitterSnapshot": null, "updatedAt": "2026-11-18T12:00:00.000Z" }], "total": 1, "page": 1, "perPage": 25, "pageCount": 1, "pending": 2 }
    ```
  - `POST /api/admin/places` — Auth: any admin. Body (`PlaceWriteInput`):

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | name | string | yes | trimmed non-empty; ≤200 | — | `Eastside Food Bank` |
    | type | PlaceType | no | `RECOVERY_PROGRAM, CLINIC, COUNSELLING, CHURCH, FOOD_BANK, ANIMAL_SHELTER, SHELTER, COMMUNITY_CENTRE, DONATING_BUSINESS, OTHER` | `OTHER` | `FOOD_BANK` |
    | summary | string\|null | no | ≤400 | null | `Free groceries weekly` |
    | about | string\|null | no | Markdown ≤20,000 | null | `…` |
    | addressLine | string\|null | no | ≤300 | null | `12 Mill St` |
    | city | string\|null | no | ≤120 | null | `Leeds` |
    | postcode | string\|null | no | ≤30 | null | `LS1 1AA` |
    | countryId | string\|null | no | ≤60 (country name is used for geocoding) | null | `clctryGB` |
    | stateId | string\|null | no | ≤60 | null | `clstCA` |
    | latitude / longitude | number\|null | no | both valid numbers (−90..90 / −180..180, not 0,0) → trusted over the geocoder | geocoded | `53.8`, `-1.54` |
    | phone | string\|null | no | ≤40 | null | `+44 113 000 0000` |
    | email | string\|null | no | ≤200 (format not checked) | null | `hello@example.org` |
    | website | string\|null | no | must start with http(s)://; ≤500 | null | `https://example.org` |
    | hours | `{day,opens?,closes?,closed?}[]`\|null | no | day 0–6 integer; times `H:MM`/`HH:MM`; rows with missing times dropped unless `closed:true` | null | `[{"day":1,"opens":"09:00","closes":"17:00"}]` |
    | needs | string\|null | no | ≤4000 | null | `Tinned food, nappies` |
    | coverUrl | string\|null | no | ≤500 | null | `/uploads/places/p.webp` |
    | photos | `{url,alt?}[]`\|null | no | max 10; empty clears | null | `[]` |
    | isDonor | boolean | no | — | false | `false` |
    | status | `PENDING`\|`APPROVED`\|`REJECTED`\|`CLOSED` | no | — | `APPROVED` | `APPROVED` |

    Response 201: `{ "ok": true, "id": "clpl1", "slug": "eastside-food-bank", "status": "APPROVED" }`. Errors: 400 messages above; 401.
  - `GET /api/admin/places/[id]` — Auth: any admin. Response `{ place }` (full Place row: all fields above plus `geocodedAt`, `geocodeError`, `reviewNote`, `reviewedAt`, `reviewedByAdminId`, `submittedByUserId`, `submitterSnapshot`, `chatRoomId`, `saveCount`, `viewCount`, `createdAt`, `updatedAt`). Errors: 404 `Not found`.
  - `PATCH /api/admin/places/[id]` — Auth: any admin. Body: any subset of POST fields; merged row re-validated. Response `{ "ok": true, "id": "…", "slug": "…", "status": "APPROVED" }`. Errors: 400 `Place not found` (note 400), validation messages.
  - `DELETE /api/admin/places/[id]` — Auth: OWNER/ADMIN. Response `{ "ok": true }`. Errors: 403 `Moderators can't delete a place. Mark it closed instead.`; unknown id → 500.
- **Form fields:** as POST table.
- **Business rules:**
  - Geocoding (Nominatim via `src/lib/geocode.ts`, env `NOMINATIM_URL`, `GEOCODER_CONTACT`, `GEOCODING_DISABLED`): runs on create (unless manual coords), and on PATCH only when `addressLine|city|postcode|countryId` changed (unless manual coords). A failed lookup is **not** an error: the place is saved with `latitude/longitude = null` and `geocodeError` explaining why (e.g. `No match for "…"`, `The lookup timed out.`, `Geocoding is switched off (GEOCODING_DISABLED=1).`). Global queue: one request per ~1.1 s; 15 s timeout.
  - Create: `reviewedAt` now, `reviewedByAdminId` = admin; if APPROVED a PUBLIC chatroom (`place-{slug}`, 📍) is created.
  - Slug from name at creation only.
  - Delete frees cover, gallery and inline `about` images; reports/saves cascade.
- **Edge cases / notes for the mobile app:** Show a spinner — create/edit can block while the geocoder queue drains. PATCHing status to APPROVED does **not** create the chatroom (only create/review do). `hours` stored as JSON array; days 0–6 (0 = Sunday assumed by the reader — confirm).
- **Status:** ✅ Complete

## Places → Review a submitted place
- **Description:** Approve or reject a member-submitted place (members' submissions are geocoded on the way in so the reviewer sees the pin).
- **Who can use it:** Any admin.
- **Source files:** `src/app/api/admin/places/[id]/review/route.ts`, `src/lib/places-admin.ts` (`reviewPlace`, `ensurePlaceRoom`, `submitPlace` for context).
- **User flow:**
  1. Admin gets an admin notification `PLACE_PENDING` (actionUrl `/admin/places?status=PENDING`) when a member submits.
  2. Approve → `{ action: "approve" }` → `{ status: "APPROVED" }`; chatroom created; submitter notified "Your place was added".
  3. Reject → `{ action: "reject", note }` → `{ status: "REJECTED" }`; submitter notified with the reason.
  4. Failures: 400 `Unknown action`; 400 `Place not found`.
- **Suggested mobile screen(s):** `AdminPlaceReview` — map pin preview, submitted fields, submitter, note textarea, Approve / Reject.
- **API(s):**
  - `POST /api/admin/places/[id]/review`
  - Auth required: yes — any admin.
  - Request — body: `action` (`approve`|`reject`, required), `note` (string, optional; reject only; ≤2000; stored as `reviewNote`).
  - Response (200): `{ "status": "APPROVED" }` or `{ "status": "REJECTED" }` (no `ok` key).
  - Errors: 400 `Unknown action`; 400 `Place not found`; 401.
- **Form fields:** Note (textarea, optional, ≤2000).
- **Business rules:** No from-state check. Approve clears `reviewNote`. In-app notifications `PLACE_APPROVED` (actionUrl `/places/{slug}`) / `PLACE_REJECTED` ("Your place wasn't added", body `Reason: …` or "It didn't meet our directory guidelines.", actionUrl `/places`) to `submittedByUserId` when present.
- **Edge cases / notes for the mobile app:** Response shape differs from other review endpoints (no `ok`).
- **Status:** ✅ Complete

## Places → Re-geocode a place
- **Description:** Re-run the address lookup for one place (e.g. after a transient geocoder failure). Deliberately one place at a time — there is no bulk geocode.
- **Who can use it:** Any admin.
- **Source files:** `src/app/api/admin/places/[id]/geocode/route.ts`, `src/lib/places-admin.ts` (`regeocodePlace`, `geocodeFields`), `src/lib/geocode.ts`.
- **User flow:** 1. Tap "Re-geocode" on the place editor. 2. `POST .../geocode` → `{ ok: true, latitude, longitude, … }` → update the map. 3. If `ok: false`, show `geocodeError`. 4. 400 `Place not found`.
- **Suggested mobile screen(s):** Button + result toast on `AdminPlaceEditor`.
- **API(s):**
  - `POST /api/admin/places/[id]/geocode`
  - Auth required: yes — any admin. No body.
  - Response (200, even when the lookup fails):
    ```ts
    interface PlaceGeocodeResponse { ok: boolean; latitude: number | null; longitude: number | null; geocodedAt: string | null; geocodeError: string | null }
    ```
    ```json
    { "ok": true, "latitude": 53.7997, "longitude": -1.5492, "geocodedAt": "2026-11-25T10:00:00.000Z", "geocodeError": null }
    ```
    ```json
    { "ok": false, "latitude": null, "longitude": null, "geocodedAt": null, "geocodeError": "No match for \"12 Mill St, Leeds\"." }
    ```
  - Errors: 400 `Place not found`; 401.
- **Form fields:** none.
- **Business rules:** Uses the stored address + country name; overwrites lat/lng (a failure **clears** existing coordinates). Rate-limited queue; up to 60 s.
- **Edge cases / notes for the mobile app:** Warn that a failed re-geocode removes a previously good pin; manual coordinates via PATCH are the fallback.
- **Status:** ✅ Complete

## Places → Place reports queue
- **Description:** Members flag a place as wrong (closed down, moved, wrong details, duplicate, not appropriate, other). Admins review and resolve or dismiss.
- **Who can use it:** Any admin.
- **Source files:** `src/app/api/admin/places/reports/route.ts`, `src/app/api/admin/places/reports/[id]/route.ts`, `src/lib/place-reports.ts` (`listPlaceReports`, `resolvePlaceReport`), `src/lib/place-report-kinds.ts`, UI `src/app/admin/(dashboard)/places/client.tsx` (`?reports=1`).
- **User flow:**
  1. Admin notification `PLACE_REPORTED` links to `/admin/places?reports=1`.
  2. `GET /api/admin/places/reports?status=OPEN` → reports + `open` count.
  3. Fix the place (edit/close), then `POST /reports/{id} { action: "resolve", resolution }`, or dismiss.
  4. Failures: 400 `Unknown action`; 400 `Report not found`.
- **Suggested mobile screen(s):** `AdminPlaceReports` — status tabs (Open/Resolved/Dismissed/All), cards (place name + city + status, report kind, notes, reporter, date), actions Resolve / Dismiss with optional resolution note, link to place editor.
- **API(s):**
  - `GET /api/admin/places/reports` — Auth: any admin. Query `status`: `OPEN`|`RESOLVED`|`DISMISSED`|`ALL`; invalid/missing → `OPEN`. Response:
    ```ts
    interface PlaceReportsResponse {
      reports: Array<{ id: string; kind: "CLOSED_DOWN"|"MOVED"|"WRONG_DETAILS"|"DUPLICATE"|"NOT_APPROPRIATE"|"OTHER"; notes: string | null;
        status: "OPEN"|"RESOLVED"|"DISMISSED"; reporterSnapshot: string | null; createdAt: string; resolvedAt: string | null; resolution: string | null;
        place: { id: string; slug: string; name: string; city: string | null; status: "PENDING"|"APPROVED"|"REJECTED"|"CLOSED" } }>;
      open: number;
    }
    ```
    ```json
    { "reports": [{ "id": "clrep1", "kind": "MOVED", "notes": "Now at 40 High St", "status": "OPEN", "reporterSnapshot": "Ben", "createdAt": "2026-11-24T09:00:00.000Z", "resolvedAt": null, "resolution": null, "place": { "id": "clpl1", "slug": "eastside-food-bank", "name": "Eastside Food Bank", "city": "Leeds", "status": "APPROVED" } }], "open": 1 }
    ```
  - `POST /api/admin/places/reports/[id]` — Auth: any admin. Body: `action` (`resolve`|`dismiss`, required), `resolution` (string, optional, ≤2000). Response `{ "status": "RESOLVED" }` / `{ "status": "DISMISSED" }`. Errors: 400 `Unknown action`, 400 `Report not found`, 401.
- **Form fields:** Resolution note (optional, ≤2000).
- **Business rules:** Newest first; at most **50** returned (no paging param exposed). Resolving stamps `resolvedByAdminId`, `resolvedAt`. Does not change the place itself; no notification to the reporter. One OPEN report per member per place (a repeat updates the existing report).
- **Edge cases / notes for the mobile app:** Use `open` for a badge.
- **Status:** ✅ Complete

## Geography → Overview stats & picker options
- **Description:** The geography hierarchy is **Region → Sub-region → Country → State** (UN M49 regions/sub-regions, ISO 3166 countries, US states only). This feature covers the hub page's counters and the slim option lists the editor modals use for parent pickers.
- **Who can use it:** Any admin.
- **Source files:** `src/app/api/admin/geography/stats/route.ts`, `src/app/api/admin/geography/options/route.ts`, `src/lib/geography-admin.ts` (`getGeographyStats`, `listRegionOptions`, `listSubRegionOptions`, `listCountryOptions`), pages `src/app/admin/(dashboard)/geography/page.tsx`, `.../geography/client.tsx`, `.../geography/tabs/*.tsx`. Schema: `Region`, `SubRegion`, `Country`, `State` in `prisma/schema.prisma`.
- **User flow:** 1. Open Geography → `GET /stats` → four tiles. 2. Opening a create/edit modal loads parents via `GET /options?level=…`.
- **Suggested mobile screen(s):** `AdminGeographyHub` — four stat tiles (total / active) + tabs Regions, Sub-regions, Countries, States.
- **API(s):**
  - `GET /api/admin/geography/stats` — Auth: any admin. Response:
    ```ts
    interface GeographyStats { regions: { total: number; active: number }; subRegions: { total: number; active: number }; countries: { total: number; active: number }; states: { total: number; active: number } }
    ```
    ```json
    { "regions": { "total": 5, "active": 5 }, "subRegions": { "total": 17, "active": 17 }, "countries": { "total": 249, "active": 249 }, "states": { "total": 51, "active": 51 } }
    ```
  - `GET /api/admin/geography/options` — Auth: any admin. Query:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | level | `regions`\|`sub-regions`\|`countries` | yes | anything else → 400 `Unknown level` | — | `sub-regions` |
    | regionId | string | no | only for `sub-regions` | — | `clreg1` |

    Responses: `regions` → `{ items: Array<{ id; name; slug }> }`; `sub-regions` → `{ items: Array<{ id; name; regionId; regionName }> }`; `countries` → `{ items: Array<{ id; name; code }> }`.
    ```json
    { "items": [{ "id": "clsub1", "name": "Northern Europe", "regionId": "clreg3", "regionName": "Europe" }] }
    ```
  - Errors: 400 `Unknown level`; 401.
- **Form fields:** n/a.
- **Business rules:** Options include inactive rows. Regions/sub-regions ordered by sortOrder then name; countries by name.
- **Edge cases / notes for the mobile app:** Cache options for the session.
- **Status:** ✅ Complete

## Geography → Regions
- **Description:** CRUD for top-level regions (e.g. Africa, code "002").
- **Who can use it:** Any admin.
- **Source files:** `src/app/api/admin/geography/regions/route.ts`, `src/app/api/admin/geography/regions/[id]/route.ts`, `src/lib/geography-admin.ts` (`listRegions`, `createRegion`, `updateRegion`, `deleteRegion`), UI `.../geography/tabs/regions.tsx`.
- **User flow:** list (with search) → add / edit modal → save; delete blocked while it has sub-regions (400 `Can't delete — this region has N sub-region(s). Move or delete them first.`).
- **Suggested mobile screen(s):** `AdminRegions` tab — searchable list (name, code, slug, #sub-regions, #countries, active badge), edit sheet.
- **API(s):**
  - `GET /api/admin/geography/regions?q=` — Auth: any admin. `q` matches name/code/slug. Response:
    ```ts
    interface RegionsResponse { items: Array<{ id: string; slug: string; name: string; code: string; sortOrder: number; isActive: boolean; subRegionCount: number; countryCount: number; createdAt: string; updatedAt: string }> }
    ```
    ```json
    { "items": [{ "id": "clreg1", "slug": "africa", "name": "Africa", "code": "002", "sortOrder": 0, "isActive": true, "subRegionCount": 2, "countryCount": 58, "createdAt": "2026-01-01T00:00:00.000Z", "updatedAt": "2026-01-01T00:00:00.000Z" }] }
    ```
  - `POST /api/admin/geography/regions` — Body:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | name | string | yes | non-blank | — | `Africa` |
    | code | string | yes | non-blank; unique | — | `002` |
    | slug | string | no | slugified; unique; empty → 400 `Slug can't be empty.` | slug of name | `africa` |
    | sortOrder | number | no | — | 0 | `0` |
    | isActive | boolean | no | — | true | `true` |

    Response 201 `{ "ok": true }` (no id returned — refetch). Errors 400: `Name is required`, `Code is required`, `Another region already uses the slug "…".`, `A region with code "…" already exists.`
  - `PUT /api/admin/geography/regions/[id]` — Body: any of the fields above (partial). Response `{ "ok": true }`. Errors 400: `Region not found`, slug/code clash messages.
  - `DELETE /api/admin/geography/regions/[id]` — Response `{ "ok": true }`. Errors 400: dependents message, Prisma message for unknown id.
- **Form fields:** Name, Code (UN M49), Slug, Sort order, Active.
- **Business rules:** Unique `slug` and `code`. Deactivating does not cascade to children.
- **Edge cases / notes for the mobile app:** PUT is partial despite the verb.
- **Status:** ✅ Complete

## Geography → Sub-regions
- **Description:** CRUD for sub-regions under a region (e.g. Northern Africa, code "015").
- **Who can use it:** Any admin.
- **Source files:** `src/app/api/admin/geography/sub-regions/route.ts`, `.../sub-regions/[id]/route.ts`, `src/lib/geography-admin.ts` (`listSubRegions`, `createSubRegion`, `updateSubRegion`, `deleteSubRegion`), UI `.../geography/tabs/sub-regions.tsx`.
- **User flow:** list filtered by region → add/edit (pick parent region) → delete blocked while it has countries (400 `Can't delete — this sub-region has N countr(y|ies). Move or delete them first.`).
- **Suggested mobile screen(s):** `AdminSubRegions` tab — region filter, search, list (name, code, region, #countries, active), edit sheet with region picker.
- **API(s):**
  - `GET /api/admin/geography/sub-regions?q=&regionId=` — Response:
    ```ts
    interface SubRegionsResponse { items: Array<{ id: string; slug: string; name: string; code: string; regionId: string; regionName: string; regionSlug: string; sortOrder: number; isActive: boolean; countryCount: number; createdAt: string; updatedAt: string }> }
    ```
  - `POST /api/admin/geography/sub-regions` — Body: `regionId` (required; must exist, else 400 `Parent region not found.`), `name` (required), `code` (required, unique), `slug?`, `sortOrder?` (0), `isActive?` (true). Response 201 `{ "ok": true }`. Errors 400: `Region is required`, `Name is required`, `Code is required`, slug/code clash.
  - `PUT /api/admin/geography/sub-regions/[id]` — partial; `regionId` moves it to another region. Response `{ "ok": true }`. Errors 400: `Sub-region not found`, `Parent region not found.`, clash messages.
  - `DELETE /api/admin/geography/sub-regions/[id]` — Response `{ "ok": true }`. Errors 400 dependents message.
- **Form fields:** Region (picker, required), Name, Code, Slug, Sort order, Active.
- **Business rules:** Unique slug & code globally.
- **Edge cases / notes for the mobile app:** No pagination (≈17 rows in practice).
- **Status:** ✅ Complete

## Geography → Countries
- **Description:** Paginated CRUD for countries under a sub-region, with ISO codes, flag, phone code, currency, language.
- **Who can use it:** Any admin.
- **Source files:** `src/app/api/admin/geography/countries/route.ts`, `.../countries/[id]/route.ts`, `src/lib/geography-admin.ts` (`listCountries`, `getCountry`, `createCountry`, `updateCountry`, `deleteCountry`), UI `.../geography/tabs/countries.tsx`.
- **User flow:** list with search + region/sub-region/active filters and paging → view/edit → delete blocked while it has states (400 `Can't delete — this country has N state(s). Move or delete them first.`).
- **Suggested mobile screen(s):** `AdminCountries` tab — search, filters, paged list (flag emoji, name, ISO2/ISO3, sub-region, active), detail/edit sheet.
- **API(s):**
  - `GET /api/admin/geography/countries` — Query:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | q | string | no | name / code / code3 / slug contains | — | `uni` |
    | regionId | string | no | ignored when subRegionId given | — | `clreg3` |
    | subRegionId | string | no | — | — | `clsub1` |
    | status | `all`\|`active`\|`inactive` | no | other → all | `all` | `active` |
    | page | int | no | min 1 | 1 | `1` |
    | perPage | int | no | clamped **10–200** | 50 | `50` |

    Response:
    ```ts
    interface CountriesResponse { items: CountryDto[]; total: number; page: number; perPage: number; totalPages: number }
    interface CountryDto { id: string; slug: string; name: string; code: string; code3: string | null; numericCode: string | null; flagUrl: string | null; emojiFlag: string | null; phoneCode: string | null; currency: string | null; language: string | null; subRegionId: string; subRegionName: string; subRegionSlug: string; regionId: string; regionName: string; regionSlug: string; sortOrder: number; isActive: boolean; stateCount: number; createdAt: string; updatedAt: string }
    ```
    ```json
    { "items": [{ "id": "clctryGB", "slug": "united-kingdom", "name": "United Kingdom", "code": "GB", "code3": "GBR", "numericCode": "826", "flagUrl": null, "emojiFlag": "🇬🇧", "phoneCode": "+44", "currency": "GBP", "language": "English", "subRegionId": "clsub1", "subRegionName": "Northern Europe", "subRegionSlug": "northern-europe", "regionId": "clreg3", "regionName": "Europe", "regionSlug": "europe", "sortOrder": 0, "isActive": true, "stateCount": 0, "createdAt": "2026-01-01T00:00:00.000Z", "updatedAt": "2026-01-01T00:00:00.000Z" }], "total": 1, "page": 1, "perPage": 50, "totalPages": 1 }
    ```
  - `POST /api/admin/geography/countries` — Body: `subRegionId` (required, must exist), `name` (required), `code` (required; uppercased; unique ISO alpha-2), `slug?`, `code3?` (uppercased; unique), `numericCode?`, `flagUrl?`, `emojiFlag?`, `phoneCode?`, `currency?` (uppercased), `language?`, `sortOrder?` (0), `isActive?` (true). Non-string optional values are ignored. Response 201 `{ "ok": true }`. Errors 400: `Sub-region is required`, `Name is required`, `Code is required`, `Parent sub-region not found.`, `Another country already uses the slug "…".`, `A country with code "…" already exists.`, `A country with alpha-3 code "…" already exists.`
  - `GET /api/admin/geography/countries/[id]` — Response `{ item: CountryDto }`. Errors 404 `Not found`.
  - `PUT /api/admin/geography/countries/[id]` — partial; same fields; empty strings clear optional fields. The body is passed unfiltered — a non-string value for a string field causes a TypeError → 400. Response `{ "ok": true }`. Errors 400: `Country not found`, clash messages.
  - `DELETE /api/admin/geography/countries/[id]` — Response `{ "ok": true }`. Errors 400 dependents.
- **Form fields:** Sub-region (picker), Name, ISO-2 code, ISO-3 code, Numeric code, Slug, Flag URL, Emoji flag, Phone code, Currency, Language, Sort order, Active.
- **Business rules:** Countries are referenced by posts, events, places, campaigns etc. (`countryId`). Sorted by name.
- **Edge cases / notes for the mobile app:** Page-based; totals key is `totalPages` (not `pageCount`).
- **Status:** ✅ Complete

## Geography → States (US only)
- **Description:** CRUD for states. Only the United States (country code `US`) may have states.
- **Who can use it:** Any admin.
- **Source files:** `src/app/api/admin/geography/states/route.ts`, `.../states/[id]/route.ts`, `src/lib/geography-admin.ts` (`listStates`, `createState`, `updateState`, `deleteState`, `getUsCountryId`, `assertUsCountry`), UI `.../geography/tabs/states.tsx`.
- **User flow:** list (defaults to US) → add/edit → delete (no dependents check).
- **Suggested mobile screen(s):** `AdminStates` tab — search, active filter, list (name, code, capital, active), edit sheet.
- **API(s):**
  - `GET /api/admin/geography/states?q=&countryId=&status=all|active|inactive` — `countryId` defaults to the US row id. Response:
    ```ts
    interface StatesResponse { items: Array<{ id: string; slug: string; name: string; code: string; capital: string | null; countryId: string; countryName: string; countryCode: string; countrySlug: string; sortOrder: number; isActive: boolean; createdAt: string; updatedAt: string }>; countryId: string | null }
    ```
    ```json
    { "items": [{ "id": "clstCA", "slug": "california", "name": "California", "code": "CA", "capital": "Sacramento", "countryId": "clctryUS", "countryName": "United States", "countryCode": "US", "countrySlug": "united-states", "sortOrder": 0, "isActive": true, "createdAt": "2026-01-01T00:00:00.000Z", "updatedAt": "2026-01-01T00:00:00.000Z" }], "countryId": "clctryUS" }
    ```
    If no US row exists and no `countryId` given, all states are returned and `countryId` is `null`.
  - `POST /api/admin/geography/states` — Body: `countryId?` (defaults to US), `name` (required), `code` (required; uppercased; unique per country), `slug?` (unique per country), `capital?`, `sortOrder?`, `isActive?`. Response 201 `{ "ok": true }`. Errors 400: `United States row missing — seed geography first.`, `Name is required`, `Code is required`, `Country not found`, `States are only supported for the United States. "X" (XX) can't have states.`, slug/code clash.
  - `PUT /api/admin/geography/states/[id]` — partial (body unfiltered); target country must be US. Response `{ "ok": true }`. Errors 400: `State not found`, US-only message, clash messages.
  - `DELETE /api/admin/geography/states/[id]` — Response `{ "ok": true }`. Errors 400 Prisma message for unknown id.
- **Form fields:** Name, USPS code (2 letters), Slug, Capital, Sort order, Active.
- **Business rules:** Places reference `stateId`; deleting a state does not check references.
- **Edge cases / notes for the mobile app:** No pagination (~51 rows).
- **Status:** ✅ Complete

## Gratitude → Moderation queue
- **Description:** Every gratitude-wall entry is held PENDING until a moderator approves it. This queue lists entries (with author identity even when anonymous, image and video) and approves or rejects them.
- **Who can use it:** Any admin.
- **Source files:** `src/app/api/admin/gratitude/route.ts`, `src/app/api/admin/gratitude/[id]/route.ts`, `src/lib/gratitude.ts` (`listGratitudeAdmin`, `countPendingGratitude`, `moderateGratitude`), `src/lib/attached-media.ts` (`readVideo`), pages `src/app/admin/(dashboard)/gratitude/page.tsx`, `.../gratitude/client.tsx`.
- **User flow:**
  1. `GET /api/admin/gratitude?status=PENDING` → `items`, `nextCursor`, `pendingCount`.
  2. Scroll → `GET …&cursor={nextCursor}` until `nextCursor` is null.
  3. Approve → `POST /api/admin/gratitude/{id} { action: "approve" }` → `{ item }` (updated). Author notified "Your gratitude post was approved".
  4. Reject → `{ action: "reject", reason }` → `{ item }`; author notified with the reason.
  5. Failures: 400 `Invalid action`; 400 `Entry not found.`
- **Suggested mobile screen(s):** `AdminGratitudeQueue` — status tabs (Pending default / Approved / Rejected / All), pending badge, cards (author avatar+name, "anonymous" tag, body, image, inline video player, hearts, date), Approve / Reject (reason sheet).
- **API(s):**
  - `GET /api/admin/gratitude` — Auth: any admin. Query:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | status | `PENDING`\|`APPROVED`\|`REJECTED`\|`ALL` | no | case-insensitive; invalid → PENDING | `PENDING` | `ALL` |
    | cursor | string | no | opaque cursor from `nextCursor` | — | `eyJ…` |

    Response:
    ```ts
    interface AdminGratitudeListResponse {
      items: Array<{ id: string; authorId: string; authorName: string; authorAvatar: string | null; isAnonymous: boolean; body: string; imageUrl: string | null;
        video: { assetId: string; url: string; posterUrl: string | null; width: number | null; height: number | null; durationSec: number | null } | null;
        status: "PENDING"|"APPROVED"|"REJECTED"; rejectionReason: string | null; heartCount: number; createdAt: string; reviewedAt: string | null }>;
      nextCursor: string | null; pendingCount: number;
    }
    ```
    ```json
    { "items": [{ "id": "clgr1", "authorId": "clusr9", "authorName": "Asha", "authorAvatar": null, "isAnonymous": true, "body": "Grateful for my neighbour's soup.", "imageUrl": null, "video": null, "status": "PENDING", "rejectionReason": null, "heartCount": 0, "createdAt": "2026-11-25T07:00:00.000Z", "reviewedAt": null }], "nextCursor": null, "pendingCount": 1 }
    ```
  - `POST /api/admin/gratitude/[id]` — Auth: any admin. Body: `action` (`approve`|`reject`, required), `reason` (string, optional; reject only; trimmed; no length cap). Response `{ item }` (same item shape). Errors: 400 `Invalid action`, 400 `Entry not found.`, 401.
- **Form fields:** Rejection reason (optional).
- **Business rules:** Page size 30 (fixed; lib clamps 5–50), newest first, cursor = (createdAt, id). `authorName`/`authorAvatar` use the live user profile, falling back to snapshots. Reject stores `rejectionReason`; approve clears it; both stamp `reviewedAt`/`reviewedBy`. Notification type `SYSTEM`, actionUrl `/gratitude`, always sent to the author.
- **Edge cases / notes for the mobile app:** Cursor pagination (unlike most admin lists). Anonymous entries reveal the real author to moderators — never show that outside admin screens.
- **Status:** ✅ Complete

## Gratitude → Gratitude categories
- **Description:** Optional categories members can file a gratitude entry under (readers can filter by them).
- **Who can use it:** Any admin.
- **Source files:** `src/app/api/admin/gratitude-categories/route.ts`, `.../gratitude-categories/[id]/route.ts`, `src/lib/post-categories.ts` (kind `"gratitude"`), page `src/app/admin/(dashboard)/gratitude/categories/page.tsx` using `src/components/admin/category-manager.tsx`.
- **User flow:** list → add → edit/toggle active → delete (entries become uncategorised; the response says how many).
- **Suggested mobile screen(s):** `AdminGratitudeCategories` — list (emoji, name, #entries, active switch), add/edit sheet, delete confirmation "N entries will become uncategorised".
- **API(s):**
  - `GET /api/admin/gratitude-categories` — Response:
    ```ts
    interface GratitudeCategoriesResponse { categories: Array<{ id: string; name: string; slug: string; description: string | null; emoji: string | null; sortOrder: number; isActive: boolean; count: number }> }
    ```
    ```json
    { "categories": [{ "id": "clgc1", "name": "Small wins", "slug": "small-wins", "description": null, "emoji": "✨", "sortOrder": 0, "isActive": true, "count": 42 }] }
    ```
  - `POST /api/admin/gratitude-categories` — Body:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | name | string | yes | trimmed, 1–60 chars (cut at 60) | — | `Small wins` |
    | description | string | no | ≤500 | null | `Everyday victories` |
    | emoji | string | no | ≤8 chars | null | `✨` |
    | sortOrder | number | no | finite | 0 | `1` |

    Response 201 `{ "ok": true, "id": "clgc1", "slug": "small-wins" }`. Errors 400 `Give the category a name.`; 401. (`isActive` is not accepted on create — always true.)
  - `PATCH /api/admin/gratitude-categories/[id]` — Body: `name?`, `description?` (null clears), `emoji?` (null clears), `sortOrder?`, `isActive?`. Response `{ "ok": true }`. Errors 400 `Give the category a name.` / Prisma message.
  - `DELETE /api/admin/gratitude-categories/[id]` — Response `{ "ok": true, "orphaned": 42 }`. Errors 400 `Delete failed`.
- **Form fields:** Name (≤60), Description (≤500), Emoji, Sort order, Active.
- **Business rules:** Slug ≤50 chars, unique. `count` = all entries in any status. Delete sets entries' `categoryId` to null.
- **Edge cases / notes for the mobile app:** none.
- **Status:** ✅ Complete

## Town Heroes → Nomination review queue, edit & delete
- **Description:** Members nominate local heroes; nominations are PENDING until reviewed. Admins can approve/reject, tidy up text/photo, feature, or delete.
- **Who can use it:** Any admin (including delete).
- **Source files:** `src/app/api/admin/town-heroes/route.ts`, `src/app/api/admin/town-heroes/[id]/route.ts`, `src/lib/town-heroes.ts` (`listTownHeroesAdmin`, `reviewTownHero`, `updateTownHero`, `deleteTownHero`), pages `src/app/admin/(dashboard)/town-heroes/page.tsx`, `.../town-heroes/client.tsx`.
- **User flow:**
  1. `GET /api/admin/town-heroes?status=PENDING&q=` → `heroes` + `pendingCount`.
  2. Approve / reject → `POST /api/admin/town-heroes/{id} { action, reason? }` → `{ status }`; nominator notified.
  3. Edit → `PATCH` → `{ ok: true }`. Feature → `PATCH { isFeatured: true }`.
  4. Delete → `{ ok: true }`.
  5. Failures: 400 `Invalid action`; 400 `That nomination is gone.`
- **Suggested mobile screen(s):** `AdminTownHeroQueue` — status tabs (Pending default), search, cards (photo, hero name, town, category chip, summary, full body expandable, nominator real name + "anonymous" tag, hearts), Approve / Reject / Edit / Feature / Delete.
- **API(s):**
  - `GET /api/admin/town-heroes` — Query: `status` (`PENDING`|`APPROVED`|`REJECTED`|`ALL`, default `PENDING`, not validated), `q` (heroName / town contains). Response:
    ```ts
    interface AdminTownHeroListResponse {
      heroes: Array<{ id: string; slug: string; heroName: string; town: string | null; countryId: string | null; photoUrl: string | null; photoAlt: string; summary: string | null;
        category: { id: string; name: string; slug: string; emoji: string | null; color: string | null }; body: string;
        nominatorName: string | null; nominatorRealName: string | null; nominatedByUserId: string | null; isAnonymous: boolean;
        status: "PENDING"|"APPROVED"|"REJECTED"; rejectionReason: string | null; heartCount: number; isFeatured: boolean;
        approvedAt: string | null; reviewedAt: string | null; createdAt: string }>;
      pendingCount: number;
    }
    ```
    ```json
    { "heroes": [{ "id": "clth1", "slug": "maria-lopez", "heroName": "Maria Lopez", "town": "Fresno", "countryId": "clctryUS", "photoUrl": null, "photoAlt": "", "summary": "Runs the Saturday soup kitchen", "category": { "id": "clhc1", "name": "Feeding people", "slug": "feeding-people", "emoji": "🍲", "color": "#cc6600" }, "body": "Every Saturday…", "nominatorName": null, "nominatorRealName": "Ben", "nominatedByUserId": "clusr7", "isAnonymous": true, "status": "PENDING", "rejectionReason": null, "heartCount": 0, "isFeatured": false, "approvedAt": null, "reviewedAt": null, "createdAt": "2026-11-23T12:00:00.000Z" }], "pendingCount": 1 }
    ```
  - `POST /api/admin/town-heroes/[id]` — Body: `action` (`approve`|`reject`), `reason` (string, reject only, ≤2000). Response `{ "status": "APPROVED" }` / `{ "status": "REJECTED" }`. Errors 400 `Invalid action`, `That nomination is gone.`
  - `PATCH /api/admin/town-heroes/[id]` — Body (strings only; non-strings ignored):

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | heroName | string | no | ≤120; blank ignored; rename re-slugs | — | `María López` |
    | town | string | no | ≤120; `""` clears | — | `Fresno` |
    | countryId | string | no | ≤40; `""` clears | — | `clctryUS` |
    | photoUrl | string | no | ≤500; `""` clears | — | `/uploads/heroes/m.webp` |
    | photoAlt | string | no | ≤300 | — | `Maria at the kitchen` |
    | summary | string | no | ≤400; `""` clears | — | `Runs the soup kitchen` |
    | body | string | no | ≤8000; blank ignored | — | `…` |
    | isFeatured | boolean | no | `featuredAt` stamped on false→true | — | `true` |

    Response `{ "ok": true }`. Errors 400 `That nomination is gone.`
  - `DELETE /api/admin/town-heroes/[id]` — Response `{ "ok": true }`. Errors 400 Prisma message for unknown id.
- **Form fields:** as PATCH table; Rejection reason.
- **Business rules:** Queue ordered by status asc then **oldest first**; max **50**. `approvedAt` stamped on first approval only. In-app notifications to the nominator: `TOWN_HERO_APPROVED` "Your nomination is up" (actionUrl `/town-heroes/{slug}`) / `TOWN_HERO_REJECTED` "Your nomination wasn't published" (actionUrl `/town-heroes`). Delete does not free the uploaded photo.
- **Edge cases / notes for the mobile app:** ⚠️ The category cannot be changed: `updateTownHero` supports `categoryId` but the PATCH route doesn't forward it. Only 50 rows returned with no paging.
- **Status:** ⚠️ Partial (category change not exposed; queue capped at 50)

## Town Heroes → Town Hero categories
- **Description:** Closed taxonomy for heroes ("what kind of quiet work"): every hero must be filed under one.
- **Who can use it:** Any admin.
- **Source files:** `src/app/api/admin/town-hero-categories/route.ts`, `.../town-hero-categories/[id]/route.ts`, `src/lib/town-hero-categories.ts`, pages `src/app/admin/(dashboard)/town-heroes/categories/page.tsx`, `.../categories/client.tsx`.
- **User flow:** list → add → edit / switch off → delete only if no hero uses it (400 `N hero(es) is/are filed under this. Turn it off instead.`).
- **Suggested mobile screen(s):** `AdminTownHeroCategories` — list (emoji, colour, name, total heroes, public count, active switch), add/edit sheet.
- **API(s):**
  - `GET /api/admin/town-hero-categories` — Response:
    ```ts
    interface HeroCategoriesResponse { categories: Array<{ id: string; name: string; slug: string; description: string | null; emoji: string | null; color: string | null; sortOrder: number; isActive: boolean; heroCount: number; publicCount: number }> }
    ```
    `publicCount` = APPROVED heroes.
  - `POST /api/admin/town-hero-categories` — Body: `name` (required, ≤80), `description?` (≤300), `emoji?` (first char), `color?` (`#rgb`/`#rrggbb`, else null), `sortOrder?` (0). `isActive` not accepted (defaults true). Response 201 `{ "id": "clhc1" }` (no `ok`). Errors 400 `A category needs a name.`
  - `PATCH /api/admin/town-hero-categories/[id]` — Body: `name?`, `description?`, `emoji?`, `color?` (strings only — send `""` to clear; `null` is ignored), `sortOrder?`, `isActive?`. Response `{ "ok": true }`. Errors 400 Prisma message.
  - `DELETE /api/admin/town-hero-categories/[id]` — Response `{ "ok": true }`. Errors 400 in-use message.
- **Form fields:** Name (≤80), Description (≤300), Emoji, Colour, Sort order, Active.
- **Business rules:** Reserved slugs `all`, `category`, `new`, `nominate` get `-heroes` appended. Renaming regenerates the slug.
- **Edge cases / notes for the mobile app:** Create response lacks `ok`.
- **Status:** ✅ Complete

## Library → Themes
- **Description:** The Library is a curated set of themes (e.g. Movement, Stillness, Nature), each holding short video clips. Themes have name, tagline, about text, cover, emoji, active flag and sort order.
- **Who can use it:** List/create/view/edit: any admin. **Delete: OWNER or ADMIN** (MODERATOR → 403 "Moderators can't delete a theme — it takes its clips with it.").
- **Source files:** `src/app/api/admin/library/route.ts`, `src/app/api/admin/library/[id]/route.ts`, `src/lib/library-admin.ts` (`listAdminLibraryThemes`, `createLibraryTheme`, `getAdminLibraryTheme`, `listAdminClips`, `updateLibraryTheme`, `deleteLibraryTheme`), pages `src/app/admin/(dashboard)/library/page.tsx`, `.../library/list.tsx`, `.../library/new/page.tsx`, `.../library/[id]/page.tsx`, `.../library/form.tsx`.
- **User flow:**
  1. `GET /api/admin/library` → themes (drag handles for reorder — see Reorder feature).
  2. New → `POST` → 201 `{ ok, id, slug }`.
  3. Open → `GET /api/admin/library/{id}` → `{ theme, clips }`. Edit → `PATCH` → `{ ok, id, slug }`.
  4. Delete (OWNER/ADMIN) → `{ ok: true }` — removes all clips and their uploaded videos.
  5. Failures: 400 `Name is required` / `Theme not found`; 404 `Not found`; 403 moderator delete.
- **Suggested mobile screen(s):** `AdminLibraryThemes` — reorderable list (emoji, name, tagline, clips, followers, active). `AdminLibraryThemeDetail` — theme form (name, tagline, about, cover, emoji, active) + clips section.
- **API(s):**
  - `GET /api/admin/library` — Response:
    ```ts
    interface LibraryThemesResponse { themes: Array<{ id: string; slug: string; name: string; tagline: string | null; coverUrl: string | null; emoji: string | null; isActive: boolean; sortOrder: number; followerCount: number; clipCount: number; updatedAt: string }> }
    ```
    ```json
    { "themes": [{ "id": "clth01", "slug": "stillness", "name": "Stillness", "tagline": "Five quiet minutes", "coverUrl": "/uploads/library/s.webp", "emoji": "🕊️", "isActive": true, "sortOrder": 0, "followerCount": 120, "clipCount": 8, "updatedAt": "2026-11-10T10:00:00.000Z" }] }
    ```
  - `POST /api/admin/library` — Body:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | name | string | yes | trimmed; ≤120 | — | `Stillness` |
    | tagline | string\|null | no | ≤240 | null | `Five quiet minutes` |
    | about | string\|null | no | Markdown ≤20,000 | null | `…` |
    | coverUrl | string\|null | no | ≤500 | null | `/uploads/library/s.webp` |
    | emoji | string\|null | no | ≤8 chars | null | `🕊️` |
    | isActive | boolean | no | — | true | `true` |
    | sortOrder | number\|null | no | finite | 0 | `3` |

    Response 201 `{ "ok": true, "id": "clth01", "slug": "stillness" }`. Errors 400 `Name is required`.
  - `GET /api/admin/library/[id]` — Response:
    ```ts
    interface LibraryThemeDetailResponse {
      theme: { id: string; slug: string; name: string; tagline: string | null; about: string | null; coverUrl: string | null; emoji: string | null; isActive: boolean; sortOrder: number; followerCount: number; clipCount: number; createdAt: string; updatedAt: string };
      clips: AdminClip[]; // see Library → Clips
    }
    ```
    Errors 404 `Not found`.
  - `PATCH /api/admin/library/[id]` — partial body; merged row re-validated. Response `{ "ok": true, "id": "…", "slug": "…" }`. Errors 400 `Theme not found`, `Name is required`.
  - `DELETE /api/admin/library/[id]` — Auth: OWNER/ADMIN. Response `{ "ok": true }`. Errors 403; unknown id → 500.
- **Form fields:** as POST table.
- **Business rules:** Slug from name at creation; **renaming keeps the old slug**. `clipCount` counts published clips only. Delete cascades clips, follows, likes, saves; discards uploaded clip videos; frees cover and inline `about` images.
- **Edge cases / notes for the mobile app:** Hide Delete for moderators.
- **Status:** ✅ Complete

## Library → Clips
- **Description:** Clips inside a theme: either an **EMBED** (YouTube, Vimeo, Loom, Dailymotion, Spotify, SoundCloud link) or an **UPLOAD** (a `VideoAsset` uploaded via `POST /api/admin/upload/video` and finished processing).
- **Who can use it:** Any admin (including delete).
- **Source files:** `src/app/api/admin/library/clips/route.ts`, `.../library/clips/[id]/route.ts`, `src/lib/library-admin.ts` (`createClip`, `updateClip`, `deleteClip`, `resolveClipMedia`, `refreshClipCount`), `src/lib/embeds.ts` (`toEmbed`, `EMBED_PROVIDERS`), UI `src/app/admin/(dashboard)/library/clips.tsx`.
- **User flow:**
  1. On the theme, "Add clip" → choose Link or Upload. For Upload, upload first and wait until the asset is READY.
  2. `POST /api/admin/library/clips` → 201 `{ ok, id }`; new clip appears at the **top**.
  3. Edit → `PATCH /clips/{id}` → `{ ok, id, themeId }`. Toggle published → `PATCH { isPublished }`.
  4. Delete → `{ ok: true }`.
  5. Failures (400): `Title is required`, `Theme not found`, `Paste a video link`, `That link can't be embedded. Supported: YouTube, Vimeo, Loom, Dailymotion, Spotify, SoundCloud.`, `Upload a video first`, `That upload could not be found`, `That video is still being processed — wait for it to finish.`, `Clip not found`.
- **Suggested mobile screen(s):** Clips section on `AdminLibraryThemeDetail` — reorderable list (poster/thumbnail, title, kind, duration, published toggle, likes/views/comments), `AdminClipEditor` sheet (title, caption, Link vs Upload segmented control, URL field or video uploader with processing state, published toggle).
- **API(s):**
  - `POST /api/admin/library/clips` — Body:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | themeId | string | yes | must exist | — | `clth01` |
    | title | string | yes | trimmed; ≤200 | — | `Box breathing` |
    | caption | string\|null | no | ≤4000 | null | `Four counts in…` |
    | kind | `EMBED`\|`UPLOAD` | yes | anything not `EMBED` is treated as UPLOAD | — | `EMBED` |
    | embedUrl | string | EMBED | must be embeddable by `toEmbed` | — | `https://www.youtube.com/watch?v=abc123` |
    | videoAssetId | string | UPLOAD | VideoAsset with status READY | — | `clva1` |
    | isPublished | boolean | no | — | true | `true` |
    | sortOrder | number\|null | no | default = current min − 1 (top) | top | `0` |

    Response 201 `{ "ok": true, "id": "clclip1" }`.
  - `PATCH /api/admin/library/clips/[id]` — partial body (same fields, `themeId` ignored). Media is re-resolved only when the kind or source changed. Response `{ "ok": true, "id": "clclip1", "themeId": "clth01" }`.
  - `DELETE /api/admin/library/clips/[id]` — Response `{ "ok": true }`. Unknown id → 500.
  - Clip shape (from `GET /api/admin/library/[id]`):
    ```ts
    interface AdminClip { id: string; title: string; caption: string | null; kind: "EMBED" | "UPLOAD"; embedUrl: string | null; videoUrl: string | null; posterUrl: string | null; width: number | null; height: number | null; durationSec: number | null; isPublished: boolean; sortOrder: number; likeCount: number; saveCount: number; viewCount: number; commentCount: number; createdAt: string }
    ```
    ```json
    { "id": "clclip1", "title": "Box breathing", "caption": null, "kind": "UPLOAD", "embedUrl": null, "videoUrl": "/uploads/video/clva1.mp4", "posterUrl": "/uploads/video/clva1.jpg", "width": 1080, "height": 1920, "durationSec": 62.4, "isPublished": true, "sortOrder": -1, "likeCount": 5, "saveCount": 2, "viewCount": 80, "commentCount": 1, "createdAt": "2026-11-12T09:00:00.000Z" }
    ```
- **Form fields:** as POST table.
- **Business rules:** `publishedAt` stamped first time published; unpublishing sets it to null. Theme `clipCount` recomputed after every create/update/delete. Deleting an UPLOAD clip discards its video asset. Clips listed by sortOrder asc then newest.
- **Edge cases / notes for the mobile app:** Poll the upload status before enabling Save for UPLOAD clips.
- **Status:** ✅ Complete

## Library → Reorder themes & clips
- **Description:** Persist a drag-and-drop order for all themes, or for the clips of one theme.
- **Who can use it:** Any admin.
- **Source files:** `src/app/api/admin/library/reorder/route.ts`, `src/lib/library-admin.ts` (`reorderLibraryThemes`, `reorderClips`).
- **User flow:** drag rows → on drop send the full ordered id list → `{ ok: true }`; on error revert and show "Could not save the order".
- **Suggested mobile screen(s):** Drag handles on `AdminLibraryThemes` and the clips list.
- **API(s):**
  - `POST /api/admin/library/reorder`
  - Auth required: yes — any admin.
  - Request — body: `ids` (string[], required, non-empty; non-strings dropped), `themeId` (string, optional — present = reorder that theme's clips; absent = reorder themes).
  - Response (200): `{ "ok": true }`
  - Errors: 400 `Nothing to reorder`; 400 `Could not save the order` (e.g. an unknown theme id in a theme reorder); 401.
- **Form fields:** n/a.
- **Business rules:** Array index becomes `sortOrder` (0..n-1), in one transaction. Clip ids not belonging to `themeId` are ignored.
- **Edge cases / notes for the mobile app:** Always send the complete list.
- **Status:** ✅ Complete

## Library → Clip comment moderation
- **Description:** Moderators see every comment on a clip (including removed ones and the real authors of anonymous comments) and can remove or restore comments. Removal is a status change, not a delete.
- **Who can use it:** Any admin.
- **Source files:** `src/app/api/admin/library/clips/[id]/comments/route.ts` (direct Prisma query), `src/app/api/admin/library/comments/[id]/route.ts`, `src/lib/clip-comments.ts` (`setClipCommentStatus`), UI `src/app/admin/(dashboard)/library/clip-comments-panel.tsx`.
- **User flow:** 1. Open a clip's comments → `GET /clips/{clipId}/comments`. 2. Remove (with reason) / Restore → `POST /comments/{commentId}` → `{ ok, status, commentCount }`. 3. Failure: 400 `Unknown action` / `Couldn't update that.`
- **Suggested mobile screen(s):** `AdminClipComments` — threaded list (parentId), author name + "anonymous" tag, status badge, removed reason, likes, date; Remove (reason sheet) / Restore buttons.
- **API(s):**
  - `GET /api/admin/library/clips/[id]/comments` — Response:
    ```ts
    interface ClipCommentsResponse { comments: Array<{ id: string; parentId: string | null; authorId: string | null; authorName: string; body: string; isAnonymous: boolean; status: "PUBLISHED" | "REMOVED"; removedReason: string | null; likeCount: number; createdAt: string }> }
    ```
    ```json
    { "comments": [{ "id": "clcc9", "parentId": null, "authorId": "clusr9", "authorName": "Asha", "body": "This helped today.", "isAnonymous": false, "status": "PUBLISHED", "removedReason": null, "likeCount": 2, "createdAt": "2026-11-20T08:00:00.000Z" }] }
    ```
    Oldest first; all comments, no pagination; unknown clip → empty list.
  - `POST /api/admin/library/comments/[id]` — Body: `action` (`remove`|`restore`, required), `reason` (string, optional, ≤2000; used on remove). Response `{ "ok": true, "status": "REMOVED", "commentCount": 3 }`. Errors: 400 `Unknown action`, 400 `Couldn't update that.`
- **Form fields:** Removal reason (optional, ≤2000).
- **Business rules:** Restore clears the reason. The clip's `commentCount` is recomputed from PUBLISHED comments. No notification to the author.
- **Edge cases / notes for the mobile app:** Never surface anonymous authors' names outside admin screens.
- **Status:** ✅ Complete

## Live → Live-stream categories
- **Description:** Admin-managed taxonomy for live streams (same shape and rules as event categories).
- **Who can use it:** Any admin.
- **Source files:** `src/app/api/admin/live-categories/route.ts`, `.../live-categories/[id]/route.ts`, `src/lib/live-categories.ts`, pages `src/app/admin/(dashboard)/live/categories/page.tsx`, `.../live/categories/client.tsx`.
- **User flow:** list → add → edit / retire (`isActive: false`) → delete only when unused (400 `N broadcast(s) still use this category. Retire it instead, or move them first.`).
- **Suggested mobile screen(s):** `AdminLiveCategories` — list (emoji, colour, name, total streams, live now, active switch), add/edit sheet.
- **API(s):**
  - `GET /api/admin/live-categories` — Response:
    ```ts
    interface LiveCategoriesResponse { categories: Array<{ id: string; name: string; slug: string; description: string | null; emoji: string | null; color: string | null; sortOrder: number; isActive: boolean; streamCount: number; liveCount: number }> }
    ```
    ```json
    { "categories": [{ "id": "cllc1", "name": "Meditation", "slug": "meditation", "description": null, "emoji": "🧘", "color": "#6644aa", "sortOrder": 0, "isActive": true, "streamCount": 31, "liveCount": 1 }] }
    ```
    `liveCount` = streams with status LIVE.
  - `POST /api/admin/live-categories` — Body: `name` (required, 1–80), `description?` (≤300), `emoji?` (first char), `color?` (`#rgb`/`#rrggbb`), `sortOrder?` (0), `isActive?` (true). Response 201 `{ "ok": true, "id": "cllc1" }`. Errors 400 `Name is required.`, `Keep the name under 80 characters.`
  - `PATCH /api/admin/live-categories/[id]` — any field; `null` clears description/emoji/color; omit = keep. Response `{ "ok": true }`. Errors 400.
  - `DELETE /api/admin/live-categories/[id]` — Response `{ "ok": true }`. Errors 400 in-use message.
- **Form fields:** Name (≤80), Description (≤300), Emoji, Colour, Sort order, Active.
- **Business rules:** Slug from name (no reserved list); regenerated only when the name changes.
- **Edge cases / notes for the mobile app:** none.
- **Status:** ✅ Complete

## Daily Reflections → Quote & question calendar
- **Description:** Admins schedule one **quote** and one **question** per calendar date (UTC). Members see today's active quote/question and can write a private reflection to the question (member side lives in `src/lib/daily-reflection.ts`).
- **Who can use it:** Any admin.
- **Source files:** `src/app/api/admin/daily-reflections/route.ts` (direct Prisma), `src/lib/daily-reflection.ts` (member read path, for context), pages `src/app/admin/(dashboard)/daily-reflections/page.tsx`, `.../daily-reflections/client.tsx`. Models `DailyQuote`, `DailyQuestion` (`displayDate` unique, `@db.Date`).
- **User flow:**
  1. `GET /api/admin/daily-reflections` → latest 60 quotes + 60 questions (with reflection counts).
  2. Add → `POST { kind, body, displayDate, attribution?, isActive? }` → 201 `{ item }`.
  3. Edit → `PUT { kind, id, body, displayDate, attribution?, isActive? }` → `{ item }`.
  4. Delete → `DELETE` with JSON body `{ kind, id }` → `{ ok: true }`.
  5. Failures: 400 `Quotes must be between 1 and 500 characters.` / `Questions must be between 1 and 800 characters.`, `Choose a valid date.`, `This date already has content.` (or a raw Prisma unique-constraint message), `Invalid content length.`, `Could not update this item.`, `Invalid item.`
- **Suggested mobile screen(s):** `AdminDailyReflections` — two tabs (Quotes / Questions), list by date desc (date, body, attribution, active, #reflections for questions), add/edit sheet with date picker.
- **API(s):**
  - `GET /api/admin/daily-reflections` — Response:
    ```ts
    interface DailyReflectionsAdminResponse {
      quotes: Array<{ id: string; body: string; attribution: string | null; displayDate: string; isActive: boolean; createdAt: string; updatedAt: string }>;
      questions: Array<{ id: string; body: string; displayDate: string; isActive: boolean; createdAt: string; updatedAt: string; _count: { reflections: number } }>;
    }
    ```
    ```json
    { "quotes": [{ "id": "cldq1", "body": "Be kind whenever possible.", "attribution": "Dalai Lama", "displayDate": "2026-11-26T00:00:00.000Z", "isActive": true, "createdAt": "2026-11-01T00:00:00.000Z", "updatedAt": "2026-11-01T00:00:00.000Z" }], "questions": [{ "id": "cldqn1", "body": "Who helped you this week?", "displayDate": "2026-11-26T00:00:00.000Z", "isActive": true, "createdAt": "2026-11-01T00:00:00.000Z", "updatedAt": "2026-11-01T00:00:00.000Z", "_count": { "reflections": 14 } }] }
    ```
  - `POST /api/admin/daily-reflections` — Body:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | kind | `quote`\|`question` | yes | else 400 | — | `quote` |
    | body | string | yes | trimmed; 1–500 (quote) / 1–800 (question) | — | `Be kind whenever possible.` |
    | displayDate | string | yes | `YYYY-MM-DD`; stored as UTC midnight; unique per kind | — | `2026-11-26` |
    | attribution | string | no | quote only; blank → null | null | `Dalai Lama` |
    | isActive | boolean | no | anything but `false` → true | true | `true` |

    Response 201 `{ item }` (the created row, without `_count`).
  - `PUT /api/admin/daily-reflections` — Body: same fields plus `id` (required). All fields are rewritten (not partial: omitting `attribution` clears it; omitting `isActive` sets true). Response `{ item }`. Errors 400 `Invalid content length.` (also used for missing kind/id), `Could not update this item.` (also covers an invalid date or a date clash).
  - `DELETE /api/admin/daily-reflections` — JSON body `{ kind: "quote"|"question", id }`. Response `{ "ok": true }` even if the id doesn't exist. Errors 400 `Invalid item.`
- **Form fields:** Kind, Body, Date, Attribution (quotes), Active.
- **Business rules:** One quote and one question per date. Members only see rows where `displayDate` = today (UTC) and `isActive`. Deleting a question keeps members' reflections but detaches them (`DailyReflection.questionId` is `onDelete: SetNull`, `prisma/schema.prisma:925`) — the UI shows reflection counts so the admin knows.
- **Edge cases / notes for the mobile app:** DELETE carries a JSON body — make sure the HTTP client sends it. Lists are capped at 60 each with no paging. Dates are UTC; format the picker value as `YYYY-MM-DD`.
- **Status:** ✅ Complete

## Campaign & Petition categories (no admin management)
- **Description:** Campaigns and petitions are filed under `CampaignCategory` / `PetitionCategory`. The admin console reads them (campaign form uses `GET /api/public/campaign-categories`; the campaigns page calls `src/lib/campaign-categories.ts` directly) but there is **no admin API or page to create, edit or retire them** — rows come from `prisma/seed-campaign-categories.ts` and `prisma/seed-petition-categories.ts`.
- **Who can use it:** nobody via the app (database/seed only).
- **Source files:** `src/lib/campaign-categories.ts`, `src/lib/petition-categories.ts` (read-only helpers: `listPublicCategories`, `isSelectableCategory`, `listSelectableCategories`, …), `src/app/api/public/campaign-categories/route.ts`, `src/app/api/public/petition-categories/route.ts`.
- **User flow:** n/a.
- **Suggested mobile screen(s):** none until a backend exists; use the public endpoints for pickers.
- **API(s):** none in the admin namespace.
- **Form fields:** n/a.
- **Business rules:** Only `isActive` categories are selectable (campaign create/publish/approve enforce this).
- **Edge cases / notes for the mobile app:** If a category is deactivated in the DB, campaigns under it cannot be (re)published until moved.
- **Status:** ⚠️ Partial / Unclear (no admin CRUD; seed-only)

## Article comment moderation (no admin API)
- **Description:** `src/lib/articles-admin.ts` contains `listArticleComments` (admin view including removed comments) and `setArticleCommentStatus` (remove/restore with reason, recounting `commentCount`), but no route under `/api/admin/**` calls them and no admin page uses them.
- **Who can use it:** nobody (helpers are unused by any admin route).
- **Source files:** `src/lib/articles-admin.ts`.
- **User flow:** n/a.
- **Suggested mobile screen(s):** none until an API exists.
- **API(s):** none.
- **Form fields:** n/a.
- **Business rules:** (as written in the lib) remove stores `removedReason`; restore clears it; `Article.commentCount` = PUBLISHED comments.
- **Edge cases / notes for the mobile app:** Article comment moderation may be handled by another module's report queue — check the moderation docs.
- **Status:** ⚠️ Partial / Unclear (lib helpers exist, no route)
