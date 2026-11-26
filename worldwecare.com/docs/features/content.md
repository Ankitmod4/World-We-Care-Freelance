# Articles, Video Library, Events, Petitions & Campaigns

Module key: `content`

This module covers the long-form and community-action content: the **magazine** (articles), the **Video Library** (themed clips that members follow, react to, save and discuss), the **events calendar** (member-submitted gatherings with RSVP and capacity), **petitions** (start, sign, react, close) and **awareness campaigns** (submit and support). Members can submit events, petitions and campaigns. Each one lands `PENDING` and an admin approves or rejects it. Admin tooling is covered in the admin modules. This file shows the workflow only from the member's side.

Shared conventions in this module:
- **Reactions** are the same everywhere: `LIKE | HEART | CARE | STRENGTH | PROUD | SAME` (`src/lib/reactions.ts`). Send `{ "type": "<one>" }`. A missing or unknown type means `LIKE`. Sending the type you already left **removes** it. Sending a different type **changes** it, and the count does not move (`src/lib/reaction-toggle.ts`). Every counter is recounted from rows, never incremented.
- **Comments** (articles and clips) come back as a **flat list, oldest first**, each with a `parentId`. Threads are capped at one level: a reply to a reply is re-parented to the top-level comment. The client builds the tree.
- **Uploads**: forms upload images first via `POST /api/user/upload` (see the uploads module) and send the returned URLs. The first photo is the `coverUrl` and the rest go in `photos[]`. Petition video uses `POST /api/user/upload/video` and sends only the `videoAssetId`.
- **Middleware**: a signed-in but unverified member gets `403 { error: "Confirm your email address first.", needsVerification: true }` on every `/api/user/*` route here, including the open GETs. Signed-out callers can use the open GETs.
- `requireUser` failures return `401 { error: "Unauthorized" }`.

## Table of contents

- Articles
  - [Articles → Browse & search magazine](#articles--browse--search-magazine)
  - [Articles → Category tiles](#articles--category-tiles)
  - [Articles → Article detail](#articles--article-detail)
  - [Articles → React to article](#articles--react-to-article)
  - [Articles → Save (bookmark)](#articles--save-bookmark)
  - [Articles → Comments](#articles--comments)
  - [Articles → Delete own comment](#articles--delete-own-comment)
  - [Articles → React to comment](#articles--react-to-comment)
- Video Library
  - [Library → Themes & clip feeds](#library--themes--clip-feeds)
  - [Library → Follow theme](#library--follow-theme)
  - [Library → Theme detail page](#library--theme-detail-page)
  - [Library → Clip detail page](#library--clip-detail-page)
  - [Library → React to clip](#library--react-to-clip)
  - [Library → Save clip](#library--save-clip)
  - [Library → Clip comments](#library--clip-comments)
  - [Library → Delete own clip comment](#library--delete-own-clip-comment)
  - [Library → React to clip comment](#library--react-to-clip-comment)
- Events
  - [Events → Categories](#events--categories)
  - [Events → Browse calendar](#events--browse-calendar)
  - [Events → Event detail & attendees](#events--event-detail--attendees)
  - [Events → Submit an event](#events--submit-an-event)
  - [Events → RSVP](#events--rsvp)
  - [Events → My submissions & moderation status](#events--my-submissions--moderation-status)
- Petitions
  - [Petitions → Categories](#petitions--categories)
  - [Petitions → Browse](#petitions--browse)
  - [Petitions → Detail & signers](#petitions--detail--signers)
  - [Petitions → Start a petition](#petitions--start-a-petition)
  - [Petitions → Sign / withdraw](#petitions--sign--withdraw)
  - [Petitions → React](#petitions--react)
  - [Petitions → Close own petition](#petitions--close-own-petition)
  - [Petitions → My petitions](#petitions--my-petitions)
- Campaigns
  - [Campaigns → Categories](#campaigns--categories)
  - [Campaigns → Browse](#campaigns--browse)
  - [Campaigns → Campaign detail](#campaigns--campaign-detail)
  - [Campaigns → Submit a campaign](#campaigns--submit-a-campaign)
  - [Campaigns → Support](#campaigns--support)
  - [Campaigns → My submitted campaigns](#campaigns--my-submitted-campaigns)
- Shared
  - [Shared → Gratitude categories](#shared--gratitude-categories)

## Endpoints in this module

| Method | Path | Feature | Auth |
|---|---|---|---|
| GET | /api/user/articles | Articles → Browse & search magazine | Optional |
| GET | /api/user/articles/[id]/comments | Articles → Comments | Optional |
| POST | /api/user/articles/[id]/comments | Articles → Comments | Member |
| POST | /api/user/articles/[id]/like | Articles → React to article | Member |
| POST | /api/user/articles/[id]/save | Articles → Save (bookmark) | Member |
| DELETE | /api/user/articles/comments/[commentId] | Articles → Delete own comment | Member (author) |
| POST | /api/user/articles/comments/[commentId]/like | Articles → React to comment | Member |
| GET | /api/user/library | Library → Themes & clip feeds | Member |
| POST | /api/user/library/[id]/follow | Library → Follow theme | Member |
| GET | /api/user/library/clips/[id]/comments | Library → Clip comments | Optional |
| POST | /api/user/library/clips/[id]/comments | Library → Clip comments | Member |
| DELETE | /api/user/library/comments/[commentId] | Library → Delete own clip comment | Member (author) |
| POST | /api/user/library/comments/[commentId]/like | Library → React to clip comment | Member |
| POST | /api/user/clips/[id]/like | Library → React to clip | Member |
| POST | /api/user/clips/[id]/save | Library → Save clip | Member |
| GET | /api/public/event-categories | Events → Categories | Public |
| GET | /api/user/events | Events → Browse calendar | Optional |
| POST | /api/user/events | Events → Submit an event | Member (verified) |
| POST | /api/user/events/[id]/rsvp | Events → RSVP | Member |
| GET | /api/public/petition-categories | Petitions → Categories | Public |
| GET | /api/user/petitions | Petitions → Browse | Optional |
| POST | /api/user/petitions | Petitions → Start a petition | Member |
| GET | /api/user/petitions/[slug] | Petitions → Detail & signers | Optional |
| DELETE | /api/user/petitions/[slug] | Petitions → Close own petition | Member (creator) |
| POST | /api/user/petitions/[slug]/react | Petitions → React | Member |
| POST | /api/user/petitions/[slug]/sign | Petitions → Sign / withdraw | Member |
| GET | /api/public/campaign-categories | Campaigns → Categories | Public |
| GET | /api/user/campaigns | Campaigns → Browse | Member |
| POST | /api/user/campaigns | Campaigns → Submit a campaign | Member |
| POST | /api/user/campaigns/[id]/support | Campaigns → Support | Member |
| GET | /api/public/categories | Shared → Gratitude categories | Public |

---

## Articles → Browse & search magazine
- **Description:** A paged list of **published** articles, newest first. It can be filtered by category slug and searched by text. The response also carries the categories that have at least one published article, for a filter row.
- **Who can use it:** Anyone. Signed-out callers are allowed. A signed-in member must be verified (middleware).
- **Source files:** `src/app/api/user/articles/route.ts`, `src/lib/articles.ts` (`listPublishedArticles`, `listReaderCategories`), `src/components/site/articles-browse-client.tsx`, `src/app/articles/page.tsx`, `src/app/articles/category/[slug]/page.tsx` (redirects to `/articles?category=<slug>`).
- **User flow:**
  1. The user opens Articles. The app calls `GET /api/user/articles?page=1`.
  2. The user taps a category chip, and the app re-queries with `category=<slug>`.
  3. The user types in search, and the app re-queries with `q=` (matches title or excerpt).
  4. The user taps "Load more", and the app sends `page=n`. Stop when `page >= pageCount`.
  5. Failure: an unknown category slug returns an empty list (no error). A network error shows a retry.
- **Suggested mobile screen(s):** `ArticlesList`: search bar, horizontal category chips (name + count), article cards (cover, category, title, excerpt, read minutes, author, published date, like/comment counts), and infinite scroll.
- **API(s):**
  - `GET /api/user/articles`
  - Auth required: no (verified if signed in)
  - Request — query:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | category | string | no | ArticleCategory slug (exact) | none | `wellbeing` |
    | q | string | no | trimmed; `contains` on title OR excerpt | none | `sleep` |
    | page | number | no | ≥1; non-numeric → 1 | 1 | `2` |
    | perPage | number | no | clamped 1..48 | 12 | `12` |

  - Response (success) 200:
    ```ts
    interface ArticlesListResponse {
      articles: ArticleCard[];
      total: number; page: number; perPage: number; pageCount: number;
      categories: { id: string; name: string; slug: string; count: number }[];
    }
    interface ArticleCard {
      id: string; slug: string; title: string; excerpt: string | null;
      coverUrl: string | null; coverAlt: string | null; videoUrl: string | null;
      readMinutes: number | null; publishedAt: string | null;
      viewCount: number; likeCount: number; saveCount: number; commentCount: number;
      authorNameSnapshot: string | null; authorAvatarSnapshot: string | null;
      category: { id: string; name: string; slug: string } | null;
    }
    ```
    ```json
    {
      "articles": [{
        "id": "clx1art0001", "slug": "small-habits-that-help", "title": "Small habits that help",
        "excerpt": "Five things readers told us made a difference.", "coverUrl": "/uploads/articles/cover1.jpg",
        "coverAlt": "A cup of tea by a window", "videoUrl": null, "readMinutes": 6,
        "publishedAt": "2026-11-20T09:00:00.000Z", "viewCount": 412, "likeCount": 37, "saveCount": 12,
        "commentCount": 5, "authorNameSnapshot": "Editorial Team", "authorAvatarSnapshot": null,
        "category": { "id": "clxcat01", "name": "Wellbeing", "slug": "wellbeing" }
      }],
      "total": 31, "page": 1, "perPage": 12, "pageCount": 3,
      "categories": [{ "id": "clxcat01", "name": "Wellbeing", "slug": "wellbeing", "count": 14 }]
    }
    ```
  - Errors: 403 — "Confirm your email address first." — signed in but unverified (middleware). No other handled errors.
- **Form fields:**

  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | Search | text | no | trimmed | any |
  | Category | chip (single) | no | — | slugs from `categories` |
- **Business rules:** Only `status = PUBLISHED` is returned (`DRAFT`/`ARCHIVED` are admin-only). Order is `publishedAt desc, createdAt desc`. `categories` excludes empty categories and is sorted by admin `sortOrder`, then name.
- **Edge cases / notes for the mobile app:** Offset paging (`page`/`perPage`, max 48). `videoUrl` is a raw provider URL. The web converts it with `src/lib/embeds.ts` `toEmbed` (YouTube, Vimeo, Loom, Dailymotion, Spotify, SoundCloud). Empty state: "No articles yet". Dates are ISO strings.
- **Status:** ✅ Complete

## Articles → Category tiles
- **Description:** The web `/articles` page shows a tile grid of **every** article category, including empty ones, with description, emoji, colour, published count and latest publish date.
- **Who can use it:** Anyone on the web.
- **Source files:** `src/app/articles/page.tsx`, `src/lib/articles.ts` (`listCategoryTiles`, `getCategoryBySlug`).
- **User flow:**
  1. The server component calls `listCategoryTiles()` directly and renders the tiles.
  2. Tapping a tile goes to `/articles?category=<slug>`.
- **Suggested mobile screen(s):** `ArticleCategories` grid (emoji, name, description, count, "updated X ago").
- **API(s):** None. The closest is `categories` in `GET /api/user/articles`, which has only `id, name, slug, count` and omits empty categories.
- **Form fields:** none
- **Business rules:** Sorted by `sortOrder`, then name. `count` = published articles. `latestAt` = max `publishedAt` (ISO) or null.
- **Edge cases / notes for the mobile app:** Mobile can build a simpler chip row from the list endpoint. Full tiles need a new endpoint (e.g. `GET /api/public/article-categories`).
- **Status:** ⚠️ Web-only (no API)

## Articles → Article detail
- **Description:** The full article: markdown `body`, photo gallery, embedded video, the viewer's `liked`/`myReaction`/`saved` state, three related articles, and a view counter that goes up once per page view.
- **Who can use it:** Anyone (signed-in members also get their own flags).
- **Source files:** `src/app/articles/[slug]/page.tsx`, `src/lib/articles.ts` (`getPublishedArticle`, `listRelatedArticles`, `recordArticleView`), `src/components/site/article-engagement.tsx`, `src/lib/attached-media.ts` (`readGallery`), `src/lib/embeds.ts`.
- **User flow:**
  1. `/articles/<slug>` is server-rendered straight from the DB. A missing or unpublished slug gives 404.
  2. The view count goes up (fire-and-forget, not deduplicated).
  3. The engagement bar and comments call the APIs in the sections below.
- **Suggested mobile screen(s):** `ArticleDetail`: cover, title, category, author, read time, markdown body, gallery carousel, video player, reaction button, save button, comment count → `ArticleComments`, and a "Related" row.
- **API(s):** **None for fetching a single article.** Reactions, save and comments have APIs, but they need the article `id`, which mobile can only get from the list endpoint.
- **Form fields:** none
- **Business rules:** Only `PUBLISHED`. `photos` is JSON `[{url, alt?}]`. The related list has 3 items: same category first, then the newest from anywhere, excluding the current article.
- **Edge cases / notes for the mobile app:** Until an API exists, mobile can show only card data (no `body`). Suggested backend: `GET /api/user/articles/[slug]`.
- **Status:** ⚠️ Web-only (no API)

## Articles → React to article
- **Description:** Leave, change or take back a reaction on an article.
- **Who can use it:** Signed-in, verified members.
- **Source files:** `src/app/api/user/articles/[id]/like/route.ts`, `src/lib/articles.ts` (`toggleArticleLike`), `src/lib/reaction-toggle.ts`, `src/lib/reactions.ts`, `src/components/site/article-engagement.tsx`.
- **User flow:**
  1. Tap reacts with LIKE. Long-press opens a picker with six reactions.
  2. `POST` with `{type}`. Update the UI optimistically, then reconcile with the returned `likeCount`/`myReaction`.
  3. Tapping the same reaction again removes it (`liked: false`).
  4. Failure: 401 → prompt login. 400 → revert.
- **Suggested mobile screen(s):** Reaction button + long-press picker on `ArticleDetail`.
- **API(s):**
  - `POST /api/user/articles/[id]/like`
  - Auth required: yes (member)
  - Request:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | id (path) | string | yes | article id (not slug) | — | `clx1art0001` |
    | type (body) | ReactionType | no | LIKE/HEART/CARE/STRENGTH/PROUD/SAME; unknown → LIKE | LIKE | `"CARE"` |

  - Response (success) 200:
    ```ts
    interface ArticleLikeResponse { ok: true; liked: boolean; likeCount: number; myReaction: ReactionType | null }
    ```
    ```json
    { "ok": true, "liked": true, "likeCount": 38, "myReaction": "CARE" }
    ```
  - Errors: 401 — "Unauthorized" — not signed in. 403 — verification (middleware). 400 — thrown message (raw DB error) — nonexistent article id.
- **Form fields:** none
- **Business rules:** One reaction row per (article, user). `likeCount` is recounted across all reaction types. No notification is sent.
- **Edge cases / notes for the mobile app:** ⚠️ The lib does not check that the article is `PUBLISHED`. Do not show raw 400 messages to users.
- **Status:** ✅ Complete

## Articles → Save (bookmark)
- **Description:** Toggle a bookmark on an article. Saved articles are listed by `GET /api/user/saved/articles` (saved/profile module).
- **Who can use it:** Signed-in, verified members.
- **Source files:** `src/app/api/user/articles/[id]/save/route.ts`, `src/lib/articles.ts` (`toggleArticleSave`, `listSavedArticles`).
- **User flow:**
  1. Tap the bookmark icon to `POST`.
  2. The icon fills or empties based on `saved`.
  3. Failure: 401 → login. 400 → revert.
- **Suggested mobile screen(s):** Bookmark icon on `ArticleDetail` and article cards.
- **API(s):**
  - `POST /api/user/articles/[id]/save`
  - Auth required: yes (member)
  - Request — path `id` (article id). No body.
  - Response (success) 200:
    ```ts
    interface ArticleSaveResponse { ok: true; saved: boolean; saveCount: number }
    ```
    ```json
    { "ok": true, "saved": true, "saveCount": 13 }
    ```
  - Errors: 401 — "Unauthorized". 400 — error message — nonexistent article.
- **Form fields:** none
- **Business rules:** This is a toggle. `saveCount` is recounted.
- **Edge cases / notes for the mobile app:** Same unpublished/invalid-id caveat as reactions.
- **Status:** ✅ Complete

## Articles → Comments
- **Description:** Read the comment thread under an article, and post a comment or a one-level reply, optionally anonymously.
- **Who can use it:** Anyone can read. Posting needs a signed-in, verified member.
- **Source files:** `src/app/api/user/articles/[id]/comments/route.ts`, `src/lib/articles.ts` (`listArticleComments`, `addArticleComment`), `src/lib/blocks.ts` (`getBlockedIds`), `src/components/site/article-engagement.tsx`.
- **User flow:**
  1. Open comments. `GET /api/user/articles/{id}/comments` returns a flat list. Group by `parentId` (null = top level).
  2. Write a comment, optionally switch on "Post anonymously", and send. The API returns `201` with the new row and the fresh `commentCount`.
  3. To reply, send `parentId` = the comment's id. A reply to a reply is re-attached to its top-level parent.
  4. Failure: empty body → 400 "Comment cannot be empty". Article missing or unpublished → 404 "Article not found". Parent missing, removed or on another article → 400 "Comment not found".
- **Suggested mobile screen(s):** `ArticleComments`: list of top-level comments with indented replies, author avatar and name ("Anonymous member" when `isAnonymous`), relative time, reaction button + count, Reply, Delete (own only), and a composer with an anonymous toggle.
- **API(s):**
  - `GET /api/user/articles/[id]/comments`
  - Auth required: no (a signed-in viewer gets `liked`/`myReaction`, and authors they blocked are hidden)
  - Request — path `id` (article id).
  - Response (success) 200:
    ```ts
    interface ArticleCommentsResponse { comments: ArticleComment[] }
    interface ArticleComment {
      id: string; parentId: string | null;
      authorId: string; authorNameSnapshot: string; authorAvatarSnapshot: string | null;
      body: string; isAnonymous: boolean; likeCount: number; createdAt: string;
      liked: boolean; myReaction: ReactionType | null;
    }
    ```
    ```json
    { "comments": [
      { "id": "clxcm01", "parentId": null, "authorId": "clxusr01", "authorNameSnapshot": "Priya",
        "authorAvatarSnapshot": "/uploads/avatars/p.jpg", "body": "This helped me a lot.", "isAnonymous": false,
        "likeCount": 2, "createdAt": "2026-11-21T10:02:00.000Z", "liked": true, "myReaction": "HEART" },
      { "id": "clxcm02", "parentId": "clxcm01", "authorId": "clxusr02", "authorNameSnapshot": "Sam",
        "authorAvatarSnapshot": null, "body": "Same here.", "isAnonymous": true,
        "likeCount": 0, "createdAt": "2026-11-21T11:15:00.000Z", "liked": false, "myReaction": null }
    ] }
    ```
  - Errors: 403 — verification (middleware, signed-in unverified only). An unknown article id returns `{ comments: [] }`.

  - `POST /api/user/articles/[id]/comments`
  - Auth required: yes (member)
  - Request — body:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | body | string | yes | non-empty after trim; silently cut to 4000 chars | — | `"Thank you for this."` |
    | isAnonymous | boolean | no | only literal `true` counts | false | `true` |
    | parentId | string | no | must be a PUBLISHED comment on this article | null | `"clxcm01"` |

  - Response (success) 201:
    ```ts
    interface CreateArticleCommentResponse {
      ok: true;
      comment: { id: string; articleId: string; authorId: string; authorNameSnapshot: string;
        authorAvatarSnapshot: string | null; body: string; isAnonymous: boolean;
        status: "PUBLISHED" | "REMOVED"; removedReason: string | null; parentId: string | null;
        likeCount: number; createdAt: string };
      commentCount: number;
    }
    ```
    ```json
    { "ok": true, "comment": { "id": "clxcm03", "articleId": "clx1art0001", "authorId": "clxusr01",
      "authorNameSnapshot": "Priya", "authorAvatarSnapshot": null, "body": "Thank you for this.",
      "isAnonymous": false, "status": "PUBLISHED", "removedReason": null, "parentId": null,
      "likeCount": 0, "createdAt": "2026-11-26T08:00:00.000Z" }, "commentCount": 6 }
    ```
  - Errors: 401 — "Unauthorized". 400 — "Comment cannot be empty" — missing or blank body. 404 — "Article not found" — not published. 400 — "Comment not found" — bad `parentId`.
- **Form fields:**

  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | Comment | multiline text | yes | 1–4000 chars | any |
  | Post anonymously | switch | no | — | true/false |

- **Business rules:** Only `PUBLISHED` comments are listed (admins can set `REMOVED`). Order is `createdAt asc`. `commentCount` on the article is recounted after each write. Author name and avatar are snapshots taken at posting time. No notification goes to the author or the parent commenter.
- **Edge cases / notes for the mobile app:** ⚠️ **Anonymous comments are not masked by the server.** `authorId`, `authorNameSnapshot` and `authorAvatarSnapshot` are real even when `isAnonymous` is true. The app MUST hide them, as the web does. There is no `isOwn` field: compare `authorId` with the signed-in user's id. No pagination: the whole thread comes back in one response.
- **Status:** ⚠️ Partial / Unclear (anonymous author identity is exposed in the API response; see gaps)

## Articles → Delete own comment
- **Description:** The author removes their own article comment. This is a hard delete, and replies under it are deleted too (DB cascade).
- **Who can use it:** The comment's author (signed-in, verified).
- **Source files:** `src/app/api/user/articles/comments/[commentId]/route.ts`, `src/lib/articles.ts` (`deleteOwnArticleComment`).
- **User flow:**
  1. On their own comment (`authorId === me`) the user taps Delete and confirms ("Replies will be removed too").
  2. `DELETE`. Remove the comment and its replies locally, then update the count with `commentCount`.
  3. Failure: 404 "Not found" when the comment is missing or not the user's.
- **Suggested mobile screen(s):** Action sheet on a comment in `ArticleComments`, with a confirm dialog.
- **API(s):**
  - `DELETE /api/user/articles/comments/[commentId]`
  - Auth required: yes (author)
  - Request — path `commentId`.
  - Response (success) 200:
    ```ts
    interface ArticleCommentDeleteResponse { ok: true; commentCount: number }
    ```
    ```json
    { "ok": true, "commentCount": 4 }
    ```
  - Errors: 401 — "Unauthorized". 404 — "Not found" — the comment doesn't exist or belongs to someone else.
- **Form fields:** none
- **Business rules:** Ownership is checked against the real `authorId`, so anonymous comments can still be deleted by their author. The article's `commentCount` is recounted.
- **Edge cases / notes for the mobile app:** Deletion cannot be undone. Keep the confirm dialog.
- **Status:** ✅ Complete

## Articles → React to comment
- **Description:** Leave, change or take back a reaction on an article comment.
- **Who can use it:** Signed-in, verified members.
- **Source files:** `src/app/api/user/articles/comments/[commentId]/like/route.ts`, `src/lib/articles.ts` (`toggleArticleCommentLike`), `src/lib/reaction-toggle.ts` (`commentReactionResult`).
- **User flow:**
  1. Tap or long-press the reaction on a comment and `POST {type}`.
  2. Update `liked`, `likeCount` and `myReaction` from the response.
  3. Failure: 404 when the comment was removed or deleted → drop it from the list.
- **Suggested mobile screen(s):** Small reaction button on each comment row.
- **API(s):**
  - `POST /api/user/articles/comments/[commentId]/like`
  - Auth required: yes (member)
  - Request:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | commentId (path) | string | yes | PUBLISHED article comment | — | `clxcm01` |
    | type (body) | ReactionType | no | unknown → LIKE; same as current → removes | LIKE | `"SAME"` |

  - Response (success) 200:
    ```ts
    interface ArticleCommentLikeResponse { ok: true; liked: boolean; likeCount: number; myReaction: ReactionType | null }
    ```
    ```json
    { "ok": true, "liked": true, "likeCount": 3, "myReaction": "SAME" }
    ```
  - Errors: 401 — "Unauthorized". 404 — "Comment not found" — missing or REMOVED comment. 400 — other error message.
- **Form fields:** none
- **Business rules:** One reaction per (comment, user). The count is recounted. No notification.
- **Edge cases / notes for the mobile app:** Reacting to your own comment is allowed.
- **Status:** ✅ Complete

---

## Library → Themes & clip feeds
- **Description:** The Video Library is a set of admin-curated themes (for example Movement, Stillness, Nature), each holding short positive clips: embeds (YouTube, Vimeo and so on) or uploaded videos. One endpoint serves three views: the theme list with follow state, the clips of one theme, and a "Following" feed of clips from every followed theme.
- **Who can use it:** Signed-in, verified members only (the web redirects signed-out visitors to login).
- **Source files:** `src/app/api/user/library/route.ts`, `src/lib/library.ts` (`listLibraryThemes`, `listClips`), `src/lib/clip-view.ts` (`ClipView`, `clipHref`), `src/lib/embeds.ts`, `src/components/site/library-client.tsx`, `src/components/site/clip-grid.tsx`, `src/app/library/page.tsx`.
- **User flow:**
  1. Open Library. `GET /api/user/library` returns `themes` (with `following`).
  2. Tap a theme. `GET /api/user/library?scope=clips&themeId=<id>&page=1` returns the grid of clips.
  3. Open the "Following" tab. `GET /api/user/library?scope=following` returns the newest clips across followed themes. With no follows, `clips` is empty and the app should prompt "Follow a theme".
  4. Failure: `scope=clips` without `themeId` → 400 "themeId required". Not signed in → 401.
- **Suggested mobile screen(s):** `LibraryHome` (theme cards: cover, emoji, name, tagline, clip/follower counts, Follow button, and a "Following" tab); `ThemeClips` (grid of posters with duration, react/save buttons, infinite scroll).
- **API(s):**
  - `GET /api/user/library`
  - Auth required: yes (member)
  - Request — query:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | scope | `"clips"` \| `"following"` | no | anything else → themes list | themes list | `clips` |
    | themeId | string | when scope=clips | theme **id** (not slug) | — | `clxthm01` |
    | page | number | no | ≥1 | 1 | `1` |
    | perPage | number | no | clamped 1..48 | 24 | `24` |

  - Response (success) 200, themes mode:
    ```ts
    interface LibraryThemesResponse { themes: {
      id: string; slug: string; name: string; tagline: string | null; coverUrl: string | null;
      emoji: string | null; followerCount: number; clipCount: number; sortOrder: number; following: boolean }[] }
    ```
    ```json
    { "themes": [{ "id": "clxthm01", "slug": "stillness", "name": "Stillness", "tagline": "Five calm minutes",
      "coverUrl": "/uploads/library/stillness.jpg", "emoji": "🌿", "followerCount": 120, "clipCount": 18,
      "sortOrder": 1, "following": true }] }
    ```
  - Response (success) 200, clips and following modes:
    ```ts
    interface LibraryClipsResponse {
      clips: {
        id: string; themeId: string; title: string; caption: string | null; kind: "EMBED" | "UPLOAD";
        embedUrl: string | null; videoUrl: string | null; posterUrl: string | null;
        width: number | null; height: number | null; durationSec: number | null;
        likeCount: number; saveCount: number; commentCount: number;
        publishedAt: string | null; createdAt: string;
        theme: { slug: string; name: string; emoji: string | null };
        liked: boolean; myReaction: ReactionType | null; saved: boolean;
      }[];
      total: number; page: number; perPage: number; pageCount: number;
    }
    ```
    ```json
    { "clips": [{ "id": "clxclp01", "themeId": "clxthm01", "title": "Rain on a lake", "caption": "Two minutes of rain.",
      "kind": "UPLOAD", "embedUrl": null, "videoUrl": "/uploads/videos/rain.mp4", "posterUrl": "/uploads/videos/rain.jpg",
      "width": 1080, "height": 1920, "durationSec": 124, "likeCount": 40, "saveCount": 9, "commentCount": 3,
      "publishedAt": "2026-11-01T12:00:00.000Z", "createdAt": "2026-10-30T12:00:00.000Z",
      "theme": { "slug": "stillness", "name": "Stillness", "emoji": "🌿" },
      "liked": false, "myReaction": null, "saved": true }],
      "total": 18, "page": 1, "perPage": 24, "pageCount": 1 }
    ```
  - Errors: 401 — "Unauthorized". 403 — verification (middleware). 400 — "themeId required" — `scope=clips` without `themeId`.
- **Form fields:** none
- **Business rules:** Only active themes (`isActive`) and published clips (`isPublished`) in active themes are shown. Theme order is `sortOrder`, then name. Clip order is `sortOrder, publishedAt desc, createdAt desc` for one theme and `publishedAt desc, createdAt desc` for Following. Content is admin-curated, so members cannot upload clips.
- **Edge cases / notes for the mobile app:** `kind = EMBED` → `embedUrl` is the **raw** provider URL. The web turns it into an iframe URL with `toEmbed()` (YouTube, Vimeo, Loom, Dailymotion, Spotify, SoundCloud whitelist), so mobile needs equivalent logic or a WebView. `kind = UPLOAD` → play `videoUrl` (`/uploads/...`, prefix the site origin) with `posterUrl`. Use `width`/`height` for the aspect ratio (often portrait). Offset paging, max 48. The theme `about` text and slug lookup are not in this API (see Theme detail page).
- **Status:** ✅ Complete

## Library → Follow theme
- **Description:** Follow or unfollow a library theme. Followed themes feed the "Following" clip feed.
- **Who can use it:** Signed-in, verified members.
- **Source files:** `src/app/api/user/library/[id]/follow/route.ts`, `src/lib/library.ts` (`toggleThemeFollow`), `src/components/site/library-client.tsx`, `src/components/site/library-detail-client.tsx`.
- **User flow:**
  1. Tap Follow / Following on a theme and `POST`.
  2. Update the button and follower count from the response.
  3. Failure: 400 "Could not update" → revert.
- **Suggested mobile screen(s):** Follow button on theme cards and the theme header.
- **API(s):**
  - `POST /api/user/library/[id]/follow`
  - Auth required: yes (member)
  - Request — path `id` = theme id. No body.
  - Response (success) 200:
    ```ts
    interface LibraryFollowResponse { following: boolean; followerCount: number }
    ```
    ```json
    { "following": true, "followerCount": 121 }
    ```
  - Errors: 401 — "Unauthorized". 400 — "Could not update" — any failure (for example an unknown theme id).
- **Form fields:** none
- **Business rules:** This is a toggle. `followerCount` is recounted. No notification. The lib does not check `isActive`, so a retired theme can still be followed if the id is known.
- **Edge cases / notes for the mobile app:** Note the response has no `ok` field.
- **Status:** ✅ Complete

## Library → Theme detail page
- **Description:** The web page `/library/<slug>` shows one theme with its long `about` text, follow state and clip grid.
- **Who can use it:** Signed-in members (web).
- **Source files:** `src/app/library/[slug]/page.tsx`, `src/lib/library.ts` (`getLibraryThemeBySlug`), `src/components/site/library-detail-client.tsx`.
- **User flow:**
  1. The server reads the theme by slug from the DB. An inactive or missing theme gives 404.
  2. The clip grid then calls `GET /api/user/library?scope=clips&themeId=<id>`.
- **Suggested mobile screen(s):** `ThemeClips` header with name, emoji, tagline, about text and Follow.
- **API(s):** None for the theme itself. Mobile can use the `themes` entry from `GET /api/user/library` (no `about`) and then the clips call.
- **Form fields:** none
- **Business rules:** Only active themes.
- **Edge cases / notes for the mobile app:** Deep links like `/library/<slug>` need a slug → id lookup. Fetch the theme list and match on `slug`.
- **Status:** ⚠️ Web-only (no API) — partly covered by the theme list (missing `about`)

## Library → Clip detail page
- **Description:** A clip on its own page `/library/<themeSlug>/<clipId>`: the player, the viewer's reaction and save state, the position ("3 of 12"), prev/next arrows, a "next up" strip of 6 clips (wrapping around the theme), comments, and a view counter.
- **Who can use it:** Signed-in members (web).
- **Source files:** `src/app/library/[slug]/[clipId]/page.tsx`, `src/lib/library.ts` (`getClipPage`, `recordClipView`), `src/components/site/clip-detail-client.tsx`, `src/components/site/threaded-comments.tsx`.
- **User flow:**
  1. The server loads the theme and all its published clips, finds the clip, and builds `prev`/`next`/`position`/`total`/`more`. A clip that isn't in that theme gives 404.
  2. `viewCount` goes up (not deduplicated).
  3. Reactions, save and comments use the APIs in this module.
- **Suggested mobile screen(s):** `ClipPlayer`: full-width or vertical player, title, caption, theme chip, react/save buttons, "3 of 12" with prev/next, a "Next up" carousel, and comments.
- **API(s):** None for one clip or its neighbours. Mobile can do the paging itself from the theme clip list (same ordering), but cannot increment `viewCount`.
- **Form fields:** none
- **Business rules:** The arrows do not wrap. The "more" strip does wrap.
- **Edge cases / notes for the mobile app:** Build prev/next from the already-loaded `ThemeClips` list (same sort). View counting needs a new endpoint.
- **Status:** ⚠️ Web-only (no API)

## Library → React to clip
- **Description:** Leave, change or take back a reaction on a clip.
- **Who can use it:** Signed-in, verified members.
- **Source files:** `src/app/api/user/clips/[id]/like/route.ts`, `src/lib/library.ts` (`toggleClipLike`), `src/lib/reaction-toggle.ts`.
- **User flow:**
  1. Tap or long-press the reaction on a clip card or the player, and `POST {type}`.
  2. Reconcile with the response. Failure → revert and show "Could not update".
- **Suggested mobile screen(s):** Reaction button on `ThemeClips` cards and `ClipPlayer`.
- **API(s):**
  - `POST /api/user/clips/[id]/like`
  - Auth required: yes (member)
  - Request:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | id (path) | string | yes | clip id | — | `clxclp01` |
    | type (body) | ReactionType | no | unknown → LIKE; same → remove | LIKE | `"STRENGTH"` |

  - Response (success) 200:
    ```ts
    interface ClipLikeResponse { liked: boolean; likeCount: number; myReaction: ReactionType | null }
    ```
    ```json
    { "liked": true, "likeCount": 41, "myReaction": "STRENGTH" }
    ```
  - Errors: 401 — "Unauthorized". 400 — "Could not update" — any failure (unknown clip).
- **Form fields:** none
- **Business rules:** The count is recounted. No `isPublished` check (see gaps). No notification.
- **Edge cases / notes for the mobile app:** No `ok` field in the response.
- **Status:** ✅ Complete

## Library → Save clip
- **Description:** Toggle saving a clip. Saved clips are listed by `GET /api/user/saved/clips` (saved module), which hides unpublished clips and clips in inactive themes.
- **Who can use it:** Signed-in, verified members.
- **Source files:** `src/app/api/user/clips/[id]/save/route.ts`, `src/lib/library.ts` (`toggleClipSave`, `listSavedClips`), `src/components/site/saved-client.tsx`.
- **User flow:**
  1. Tap the bookmark and `POST`.
  2. Update the icon from `saved`. On failure, revert.
- **Suggested mobile screen(s):** Bookmark on clip cards and `ClipPlayer`. The Saved tab lists them.
- **API(s):**
  - `POST /api/user/clips/[id]/save`
  - Auth required: yes (member)
  - Request — path `id` (clip id). No body.
  - Response (success) 200:
    ```ts
    interface ClipSaveResponse { saved: boolean; saveCount: number }
    ```
    ```json
    { "saved": true, "saveCount": 10 }
    ```
  - Errors: 401 — "Unauthorized". 400 — "Could not update".
- **Form fields:** none
- **Business rules:** This is a toggle. `saveCount` is recounted.
- **Edge cases / notes for the mobile app:** No `ok` field.
- **Status:** ✅ Complete

## Library → Clip comments
- **Description:** A comment thread under each clip. It has the same shape and rules as article comments (flat list, one level of replies, anonymous option), but anonymous authors are **masked by the server**, live author names are shown, and an `isOwn` flag is included.
- **Who can use it:** Anyone can read. Posting needs a signed-in, verified member.
- **Source files:** `src/app/api/user/library/clips/[id]/comments/route.ts`, `src/lib/clip-comments.ts` (`listClipComments`, `addClipComment`), `src/lib/blocks.ts`, `src/components/site/threaded-comments.tsx`.
- **User flow:**
  1. Open the comments on `ClipPlayer` and `GET` the thread. Group replies by `parentId`.
  2. Write a comment or reply (`parentId`), optionally anonymous, and `POST`. The response is `201` with the comment and `commentCount`.
  3. Failure: 400 with a message such as "Write something first.", "Keep it under 4000 characters.", "Clip not found" or "That comment is no longer there."
- **Suggested mobile screen(s):** Comments sheet on `ClipPlayer`: rows with avatar, name ("Anonymous"), time, reaction, Reply, and Delete when `isOwn`. Composer with an anonymous switch.
- **API(s):**
  - `GET /api/user/library/clips/[id]/comments`
  - Auth required: no (a signed-in viewer gets `liked`, `myReaction`, `isOwn`, and blocked authors are hidden)
  - Request — path `id` (clip id).
  - Response (success) 200:
    ```ts
    interface ClipCommentsResponse { comments: ClipComment[] }
    interface ClipComment {
      id: string; parentId: string | null;
      authorId: string | null;      // null when anonymous
      authorName: string;           // "Anonymous" when anonymous; else live display name
      authorAvatar: string | null;  // null when anonymous
      body: string; isAnonymous: boolean; likeCount: number;
      liked: boolean; myReaction: ReactionType | null; isOwn: boolean; createdAt: string;
    }
    ```
    ```json
    { "comments": [{ "id": "clxcc01", "parentId": null, "authorId": null, "authorName": "Anonymous",
      "authorAvatar": null, "body": "Watched this three times today.", "isAnonymous": true, "likeCount": 4,
      "liked": false, "myReaction": null, "isOwn": false, "createdAt": "2026-11-24T19:30:00.000Z" }] }
    ```
  - Errors: 403 — verification (middleware, signed-in unverified). An unknown clip returns `{ comments: [] }`.

  - `POST /api/user/library/clips/[id]/comments`
  - Auth required: yes (member)
  - Request — body:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | body | string | yes | trimmed, 1–4000 chars (over 4000 → error, not truncated) | — | `"Lovely."` |
    | isAnonymous | boolean | no | only literal `true` | false | `false` |
    | parentId | string | no | PUBLISHED comment on the same clip; reply-to-reply flattened | null | `"clxcc01"` |

  - Response (success) 201:
    ```ts
    interface CreateClipCommentResponse { comment: ClipComment; commentCount: number }
    ```
    ```json
    { "comment": { "id": "clxcc02", "parentId": "clxcc01", "authorId": "clxusr01", "authorName": "Priya",
      "authorAvatar": null, "body": "Lovely.", "isAnonymous": false, "likeCount": 0, "liked": false,
      "myReaction": null, "isOwn": true, "createdAt": "2026-11-26T08:10:00.000Z" }, "commentCount": 4 }
    ```
  - Errors: 401 — "Unauthorized". 400 — "Write something first." (empty), "Keep it under 4000 characters.", "Clip not found" (unpublished or missing), "That comment is no longer there." (bad parent), or another error message.
- **Form fields:**

  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | Comment | multiline text | yes | 1–4000 chars | any |
  | Post anonymously | switch | no | — | true/false |

- **Business rules:** Only `PUBLISHED` comments are listed (admins may set `REMOVED`, which is kept for audit). `commentCount` on the clip is recounted. No notifications.
- **Edge cases / notes for the mobile app:** No pagination: the whole thread at once, oldest first. `createdAt` is ISO.
- **Status:** ✅ Complete

## Library → Delete own clip comment
- **Description:** The author deletes their own clip comment. This is a hard delete, and replies cascade.
- **Who can use it:** The comment author (signed-in, verified).
- **Source files:** `src/app/api/user/library/comments/[commentId]/route.ts`, `src/lib/clip-comments.ts` (`deleteOwnClipComment`).
- **User flow:**
  1. Where `isOwn` is true, tap Delete, confirm, then `DELETE`.
  2. Remove the comment and its replies, and update the count.
  3. Failure: 400 "Comment not found" / "Not your comment".
- **Suggested mobile screen(s):** Action sheet in the clip comments sheet.
- **API(s):**
  - `DELETE /api/user/library/comments/[commentId]`
  - Auth required: yes (author)
  - Request — path `commentId`.
  - Response (success) 200:
    ```ts
    interface ClipCommentDeleteResponse { ok: true; commentCount: number }
    ```
    ```json
    { "ok": true, "commentCount": 3 }
    ```
  - Errors: 401 — "Unauthorized". 400 — "Comment not found" — missing. 400 — "Not your comment" — someone else's.
- **Form fields:** none
- **Business rules:** Ownership uses the real author id, so anonymous comments can be deleted by their author. The clip's count is recounted.
- **Edge cases / notes for the mobile app:** Unlike articles (404), errors here are 400.
- **Status:** ✅ Complete

## Library → React to clip comment
- **Description:** Leave, change or take back a reaction on a clip comment.
- **Who can use it:** Signed-in, verified members.
- **Source files:** `src/app/api/user/library/comments/[commentId]/like/route.ts`, `src/lib/clip-comments.ts` (`toggleClipCommentLike`).
- **User flow:**
  1. Tap or long-press the reaction on a comment and `POST {type}`.
  2. Reconcile. On error, revert and show "Couldn't update that."
- **Suggested mobile screen(s):** Reaction on each row in the clip comments sheet.
- **API(s):**
  - `POST /api/user/library/comments/[commentId]/like`
  - Auth required: yes (member)
  - Request:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | commentId (path) | string | yes | PUBLISHED clip comment | — | `clxcc01` |
    | type (body) | ReactionType | no | unknown → LIKE; same → remove | LIKE | `"HEART"` |

  - Response (success) 200:
    ```ts
    interface ClipCommentLikeResponse { liked: boolean; likeCount: number; myReaction: ReactionType | null }
    ```
    ```json
    { "liked": true, "likeCount": 5, "myReaction": "HEART" }
    ```
  - Errors: 401 — "Unauthorized". 400 — "Couldn't update that." — any failure (including a missing or removed comment).
- **Form fields:** none
- **Business rules:** The count is recounted. No notification.
- **Edge cases / notes for the mobile app:** No `ok` field.
- **Status:** ✅ Complete

---

## Events → Categories
- **Description:** The admin-managed list of active event categories (for example Fundraisers, Meetups), each with a count of **upcoming approved** events. Empty categories are included on purpose. It feeds the calendar's filter chips and the submit form's category picker.
- **Who can use it:** Anyone (public, no auth, not affected by middleware).
- **Source files:** `src/app/api/public/event-categories/route.ts`, `src/lib/event-categories.ts` (`listPublicCategories`), `src/components/site/events-client.tsx`, `src/components/site/event-new-client.tsx`.
- **User flow:**
  1. The calendar loads `GET /api/public/event-categories?countryId=<current>` and shows chips "Name · N".
  2. The submit form loads it without `countryId` for the picker.
- **Suggested mobile screen(s):** Chip row on `EventsCalendar`. Picker on `SubmitEvent`.
- **API(s):**
  - `GET /api/public/event-categories`
  - Auth required: no
  - Request — query:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | countryId | string | no | narrows `upcomingCount` to that country | all countries | `clxctyIN` |

  - Response (success) 200:
    ```ts
    interface EventCategoriesResponse { categories: {
      id: string; name: string; slug: string; description: string | null;
      emoji: string | null; color: string | null; upcomingCount: number }[] }
    ```
    ```json
    { "categories": [{ "id": "clxec01", "name": "Community meetups", "slug": "community-meetups",
      "description": "Gatherings in person.", "emoji": "🤝", "color": "#2f855a", "upcomingCount": 3 }] }
    ```
  - Errors: none handled (500 on server failure).
- **Form fields:** none
- **Business rules:** Only `isActive` categories. Order is `sortOrder`, then name. Counts include only `APPROVED` events with `startsAt >= now`. `color` is a `#rgb`/`#rrggbb` hex. `emoji` is one character. Reserved slugs: `all`, `category`, `new`.
- **Edge cases / notes for the mobile app:** A chip's count can be 0, so show it as "Nothing yet". Filter the calendar by the category **slug** (`category=` on `GET /api/user/events`), but submit with the category **id**.
- **Status:** ✅ Complete

## Events → Browse calendar
- **Description:** The events calendar: **approved** events that are upcoming (not yet finished) or past, with filters for country, category and text search, and paging.
- **Who can use it:** The API is open (signed-out allowed; signed-in members must be verified). The web page requires login.
- **Source files:** `src/app/api/user/events/route.ts` (GET), `src/lib/events.ts` (`listEvents`), `src/lib/event-categories.ts` (`categoryIdForSlug`), `src/components/site/events-client.tsx`, `src/components/site/home-sections.tsx`, `src/app/events/page.tsx`, `src/app/events/category/[slug]/page.tsx` (redirects to `/events?category=`).
- **User flow:**
  1. Open Events. `GET /api/user/events?countryId=<picker>&page=1` returns the upcoming events, soonest first.
  2. Switch to the "Past" tab with `past=1` (newest first).
  3. Tap a category chip (`category=<slug>`) or search (`q=`, matches title, summary or city).
  4. Tap an event to open the detail (web-only, see below).
- **Suggested mobile screen(s):** `EventsCalendar`: Upcoming/Past segmented control, category chips, search, a country selector, and event cards (cover, date block in the **event's timezone**, title, venue or "Online", city, category, "N going", "Full" badge when `capacity` is reached).
- **API(s):**
  - `GET /api/user/events`
  - Auth required: no (verified if signed in)
  - Request — query:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | countryId | string | no | exact country id | all | `clxctyIN` |
    | category | string | no | active category slug; unknown/retired → no filter | none | `community-meetups` |
    | q | string | no | contains in title / summary / city | none | `Pune` |
    | past | `"1"` | no | `1` = started before now | upcoming | `1` |
    | page | number | no | ≥1 | 1 | `1` |
    | perPage | number | no | clamped 1..48 | 12 | `12` |

  - Response (success) 200:
    ```ts
    interface EventsListResponse {
      events: EventCard[]; total: number; page: number; perPage: number; pageCount: number;
    }
    interface EventCard {
      id: string; slug: string; title: string; summary: string | null; coverUrl: string | null;
      startsAt: string; endsAt: string | null; timezone: string; isOnline: boolean;
      venueName: string | null; city: string | null; countryId: string | null;
      capacity: number | null; rsvpCount: number; status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
      hostNameSnapshot: string | null; hostAvatarSnapshot: string | null;
      category: { id: string; name: string; slug: string; emoji: string | null; color: string | null } | null;
    }
    ```
    ```json
    { "events": [{ "id": "clxev01", "slug": "beach-clean-up", "title": "Beach clean-up", "summary": "Bring gloves.",
      "coverUrl": "/uploads/events/beach.jpg", "startsAt": "2026-12-06T03:30:00.000Z", "endsAt": "2026-12-06T06:30:00.000Z",
      "timezone": "Asia/Kolkata", "isOnline": false, "venueName": "Juhu Beach", "city": "Mumbai", "countryId": "clxctyIN",
      "capacity": 40, "rsvpCount": 12, "status": "APPROVED", "hostNameSnapshot": "Asha", "hostAvatarSnapshot": null,
      "category": { "id": "clxec02", "name": "Volunteering", "slug": "volunteering", "emoji": "🧤", "color": "#3182ce" } }],
      "total": 1, "page": 1, "perPage": 12, "pageCount": 1 }
    ```
  - Errors: 403 — verification (middleware, signed-in unverified).
- **Form fields:**

  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | Upcoming / Past | segmented | no | — | upcoming, past |
  | Category | chip | no | — | slugs from event categories |
  | Search | text | no | — | any |

- **Business rules:** Only `APPROVED` (cancelled events never appear in the list). "Upcoming" means `endsAt >= now`, or `endsAt` null and `startsAt >= now`, so an event in progress still shows. "Past" means `startsAt < now`. In-progress events therefore show in both tabs.
- **Edge cases / notes for the mobile app:** **Always format `startsAt`/`endsAt` in `timezone`** (IANA), not the device zone. Offset paging, max 48. The card has no `going` flag, and RSVP state comes only from the RSVP response or the web detail page.
- **Status:** ✅ Complete

## Events → Event detail & attendees
- **Description:** The event page `/events/<slug>`: full markdown description, gallery, address line, online join link, the event's chat room link (created on approval), the viewer's `going` flag, host, and up to 24 attendees (names and avatars). Cancelled events stay visible here.
- **Who can use it:** Signed-in members (web).
- **Source files:** `src/app/events/[slug]/page.tsx`, `src/lib/events.ts` (`getEventBySlug`, `listAttendees`), `src/lib/timezone.ts`, `src/components/site/event-rsvp.tsx`.
- **User flow:**
  1. The server reads the event (status `APPROVED` or `CANCELLED`) and its attendees directly from the DB. Anything else gives 404.
  2. The RSVP button calls `POST /api/user/events/{id}/rsvp`.
  3. "Join the chat" links to the chat room (`room.slug`).
- **Suggested mobile screen(s):** `EventDetail`: cover, title, date/time in the event zone, venue, address and map, or a join link for online events, capacity bar, RSVP button, attendee avatars, a chat room button, host, description and gallery. Show a "Cancelled" banner when `status = CANCELLED`.
- **API(s):** **None.** There is no API to fetch one event, its description, address, join link, chat room or attendees.
- **Form fields:** none
- **Business rules:** `joinUrl` and `addressLine` are only available here. The chat room is created when an admin approves the event.
- **Edge cases / notes for the mobile app:** Mobile can show only card data from the list until `GET /api/user/events/[slug]` exists.
- **Status:** ⚠️ Web-only (no API)

## Events → Submit an event
- **Description:** A member submits a gathering. It lands **PENDING** and goes to the admin queue. It appears on the calendar only after approval.
- **Who can use it:** Signed-in members with a verified email.
- **Source files:** `src/app/api/user/events/route.ts` (POST), `src/lib/events.ts` (`submitEvent`, `normalise`), `src/lib/event-categories.ts` (`isSelectableCategory`), `src/lib/admin-notifications.ts`, `src/components/site/event-new-client.tsx`, `src/app/events/new/page.tsx`.
- **User flow:**
  1. Open "Add event". Load categories (`GET /api/public/event-categories`) and countries (`GET /api/public/geo/countries`, geography module).
  2. Fill in the title, category, description, the date/time in a chosen timezone (converted to a UTC ISO `startsAt`), online toggle (join link) or venue/city, country, and up to 4 photos (uploaded first via `POST /api/user/upload`; the first becomes the `coverUrl`).
  3. `POST`. On `201`, show the "Thanks, a moderator will review it" screen. The web stays on the page and does not redirect, because the event is not public yet.
  4. Failure: 400 with a validation message. Show it inline.
- **Suggested mobile screen(s):** `SubmitEvent` form, then a success screen.
- **API(s):**
  - `POST /api/user/events`
  - Auth required: yes (verified member)
  - Request — JSON body:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | title | string | yes | non-empty after trim; cut to 200 | — | `"Beach clean-up"` |
    | description | string | yes | non-empty (markdown) | — | `"We meet at the lifeguard tower..."` |
    | categoryId | string | yes | active EventCategory **id** | — | `"clxec02"` |
    | startsAt | string (ISO) | yes | valid date (UTC instant) | — | `"2026-12-06T03:30:00.000Z"` |
    | endsAt | string (ISO) | no | valid and after `startsAt` | null | `"2026-12-06T06:30:00.000Z"` |
    | timezone | string | no | IANA name (not validated) | `"UTC"` | `"Asia/Kolkata"` |
    | isOnline | boolean | no | — | false | `false` |
    | joinUrl | string | if online | non-empty (not URL-validated); dropped when not online | null | `"https://meet.example.com/abc"` |
    | venueName | string | if not online* | *venueName or addressLine required; dropped when online | null | `"Juhu Beach"` |
    | addressLine | string | if not online* | see above | null | `"Near gate 2"` |
    | city | string | no | trimmed | null | `"Mumbai"` |
    | countryId | string | no | trimmed | null | `"clxctyIN"` |
    | summary | string | no | cut to 400 | null | `"Bring gloves."` |
    | coverUrl | string | no | URL from upload | null | `"/uploads/events/beach.jpg"` |
    | photos | `{url, alt?}[]` | no | entries without url dropped; max 12 kept | [] | `[{"url":"/uploads/events/2.jpg"}]` |
    | capacity | number | no | >0 → floored; otherwise unlimited | null | `40` |

  - Response (success) 201:
    ```ts
    interface CreateEventResponse { ok: true; id: string; slug: string }
    ```
    ```json
    { "ok": true, "id": "clxev09", "slug": "beach-clean-up-2" }
    ```
  - Errors: 401 — "Unauthorized". 403 — "Verify your email address before submitting an event." (or the middleware message). 400 — "Title is required" / "Description is required" / "Start time is invalid" / "End time is invalid" / "The end time must be after the start time" / "Add a venue or address, or mark the event as online" / "Online events need a join link" / "Choose what kind of event this is." / other message.
- **Form fields:**

  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | Title | text | yes | ≤200 | any |
  | Category | picker | yes | active category | event categories |
  | Description | multiline (markdown) | yes | non-empty | any |
  | Starts | date-time + timezone | yes | valid | IANA zones |
  | Ends | date-time | no | after start | — |
  | Online event | switch | no | — | — |
  | Join link | url | if online | non-empty | — |
  | Venue name / Address | text | if in person | one of them | — |
  | City | text | no | — | — |
  | Country | picker | no | — | countries list |
  | Summary | text | no | ≤400 | — |
  | Photos | image picker | no | web allows 4; API keeps cover + 12 | jpg/png/webp (see uploads module) |
  | Capacity | number | no | positive integer | — |

- **Business rules:** The event is created with `status = PENDING`, `hostUserId = me`, and host name and avatar snapshots. A unique slug is generated from the title (`-2`, `-3` and so on). **All admins** get an in-app admin notification `EVENT_PENDING` ("An event is waiting for review", `src/lib/events.ts:295`). When an admin approves it: status becomes `APPROVED`, a public chat room `event-<slug>` is created, and the host gets an in-app `EVENT_APPROVED` notification linking to `/events/<slug>`. When an admin rejects it: `REJECTED` with an optional `rejectionReason`, and the host gets `EVENT_REJECTED` ("Reason: …"). Admins can later cancel it (`CANCELLED`), which notifies every RSVP'd member (`EVENT_CANCELLED`).
- **Edge cases / notes for the mobile app:** The web form sends only title, description, startsAt, timezone, isOnline, joinUrl, venueName, city, countryId, categoryId, coverUrl and photos. `summary`, `endsAt`, `addressLine` and `capacity` are accepted by the API but not offered on the web. Convert the local wall-clock time to UTC using the chosen zone before sending. Members cannot edit or delete their own events once submitted (there is no API).
- **Status:** ✅ Complete

## Events → RSVP
- **Description:** Toggle "I'm going" on an approved event. Capacity is enforced.
- **Who can use it:** Signed-in, verified members.
- **Source files:** `src/app/api/user/events/[id]/rsvp/route.ts`, `src/lib/events.ts` (`toggleRsvp`), `src/components/site/event-rsvp.tsx`.
- **User flow:**
  1. On the event, tap "Going" and `POST`.
  2. The response gives `going` and the new `rsvpCount`. Update the button and the count.
  3. Tap again to cancel the RSVP (always allowed).
  4. Failure: 400 "This event is full" → show a "Full" state. 404 "Event not found" → the event is missing, pending, rejected or cancelled.
- **Suggested mobile screen(s):** RSVP button and capacity bar on `EventDetail`. An optional quick RSVP on cards.
- **API(s):**
  - `POST /api/user/events/[id]/rsvp`
  - Auth required: yes (member)
  - Request — path `id` = event **id** (not slug). No body.
  - Response (success) 200:
    ```ts
    interface EventRsvpResponse { ok: true; going: boolean; rsvpCount: number }
    ```
    ```json
    { "ok": true, "going": true, "rsvpCount": 13 }
    ```
  - Errors: 401 — "Unauthorized". 404 — "Event not found" — not `APPROVED`. 400 — "This event is full" — `capacity` reached (only when adding). 400 — other message.
- **Form fields:** none
- **Business rules:** One RSVP per (event, user), storing name and avatar snapshots (shown in the attendee list). `rsvpCount` is recounted. `capacity = null` means unlimited. No notification to the host. RSVPs on cancelled events are blocked, and attendees get an `EVENT_CANCELLED` notification when an admin cancels.
- **Edge cases / notes for the mobile app:** ⚠️ The capacity check is not transactional, so two simultaneous RSVPs can overbook by one. There is no time check, so past events can still be RSVP'd. Hide the button for past events. There is no API listing "events I'm going to" (`listMyRsvps` exists but is unused).
- **Status:** ✅ Complete

## Events → My submissions & moderation status
- **Description:** How a member follows their submitted event: `PENDING` → `APPROVED` (on the calendar, with a chat room) or `REJECTED` (with a reason). An approved event can later become `CANCELLED`.
- **Who can use it:** The submitting member.
- **Source files:** `src/lib/events.ts` (`submitEvent`, `reviewEvent`, `cancelEvent`, `listMyRsvps`), `prisma/schema.prisma` (`enum EventStatus`).
- **User flow:**
  1. Submit, then see the success screen.
  2. Wait for an in-app notification: `EVENT_APPROVED` (actionUrl `/events/<slug>`) or `EVENT_REJECTED` (body "Reason: …", actionUrl `/events`).
  3. There is no screen or API listing "my submitted events", and a pending event cannot be fetched by its creator.
- **Suggested mobile screen(s):** `MySubmissions` (would need a backend change). For now, rely on the Notifications screen.
- **API(s):** None specific. Notifications come through the notifications module.
- **Form fields:** none
- **Business rules:** Statuses are `PENDING | APPROVED | REJECTED | CANCELLED`. Only `APPROVED` is listed. `APPROVED` and `CANCELLED` are viewable on the web detail page.
- **Edge cases / notes for the mobile app:** The rejection reason reaches the member only inside the notification body.
- **Status:** ⚠️ Partial / Unclear (no API or page shows a member their own pending/rejected events)

---

## Petitions → Categories
- **Description:** The active petition categories (the areas public bodies have departments for), each with a count of **open** petitions. Empty categories are included.
- **Who can use it:** Anyone (public).
- **Source files:** `src/app/api/public/petition-categories/route.ts`, `src/lib/petition-categories.ts` (`listPublicCategories`, `openPetitionWhere`), `src/components/site/petitions-client.tsx`, `src/app/petitions/new/page.tsx` (the form's picker is server-read, same lib).
- **User flow:**
  1. The petitions screen loads `GET /api/public/petition-categories?countryId=<current>` and shows tiles "Housing · 3".
  2. Tapping a tile filters the list with `category=<slug>&open=1`, so the list agrees with the tile count.
- **Suggested mobile screen(s):** Tile grid on `PetitionsList`. Picker on `StartPetition`.
- **API(s):**
  - `GET /api/public/petition-categories`
  - Auth required: no
  - Request — query:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | countryId | string | no | narrows `openCount` | all | `clxctyIN` |

  - Response (success) 200:
    ```ts
    interface PetitionCategoriesResponse { categories: {
      id: string; name: string; slug: string; description: string | null;
      emoji: string | null; color: string | null; openCount: number }[] }
    ```
    ```json
    { "categories": [{ "id": "clxpc01", "name": "Transport", "slug": "transport",
      "description": "Roads, buses, safe crossings.", "emoji": "🚌", "color": "#dd6b20", "openCount": 2 }] }
    ```
  - Errors: none handled.
- **Form fields:** none
- **Business rules:** "Open" = `status APPROVED` and (`closesAt` null or in the future). Only `isActive` categories, ordered by `sortOrder`, then name. The list is seeded by `prisma/seed-petition-categories.ts`.
- **Edge cases / notes for the mobile app:** Here the param is `countryId`. The petitions **list** uses `country` (see below).
- **Status:** ✅ Complete

## Petitions → Browse
- **Description:** Approved petitions, newest first, with filters for country, category and "open only". Each card shows the target, goal, signature and reaction counts, open/closed state, and whether it is the viewer's own.
- **Who can use it:** Anyone. The API is open (signed-in members must be verified). The web page requires login.
- **Source files:** `src/app/api/user/petitions/route.ts` (GET), `src/lib/petitions.ts` (`listPetitions`, `toCard`, `isOpen`), `src/lib/petition-categories.ts` (`categoryIdForSlug`), `src/components/site/petitions-client.tsx`, `src/components/site/home-sections.tsx`, `src/app/petitions/category/[slug]/page.tsx` (redirects to `/petitions?category=`).
- **User flow:**
  1. Open Petitions. `GET /api/user/petitions?country=<id>&page=1&take=30`.
  2. The web splits the results into "Open" and "Closed" using `open`.
  3. Tap a category tile → `category=<slug>&open=1`.
  4. "Load more" → `page+1`. Stop when fewer than `take` come back (there is no total).
- **Suggested mobile screen(s):** `PetitionsList`: category tiles, an "Open" section and a "Closed" section, and cards (cover, title, "To: target", progress bar `signatureCount/goal`, signature count, deadline, category, "Yours" badge).
- **API(s):**
  - `GET /api/user/petitions`
  - Auth required: no (verified if signed in; a signed-in viewer gets `isMine`)
  - Request — query:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | country | string | no | country id (**not** `countryId`) | all | `clxctyIN` |
    | category | string | no | petition category slug; unknown → no filter (retired slugs still match) | none | `transport` |
    | open | `"1"` | no | only APPROVED with future or no `closesAt` | all approved | `1` |
    | take | number | no | page size, max 60 | 30 | `30` |
    | page | number | no | 1-based | 1 | `2` |

  - Response (success) 200 (`Cache-Control: no-store`):
    ```ts
    interface PetitionsListResponse { petitions: PetitionCard[] }
    interface PetitionCard {
      id: string; slug: string; title: string; summary: string | null; coverUrl: string | null;
      photos: { url: string; alt: string | null }[];
      video: { assetId: string; url: string; posterUrl: string | null; width: number | null; height: number | null; durationSec: number | null } | null;
      target: string; goal: number | null; status: "PENDING" | "APPROVED" | "REJECTED" | "CLOSED";
      countryId: string | null;
      category: { id: string; name: string; slug: string; emoji: string | null; color: string | null } | null;
      closesAt: string | null; signatureCount: number; reactionCount: number;
      creatorUserId: string | null; creatorName: string; creatorAvatar: string | null;
      createdAt: string; open: boolean; isMine: boolean;
    }
    ```
    ```json
    { "petitions": [{ "id": "clxpt01", "slug": "safe-crossing-near-school", "title": "A safe crossing near Green Park school",
      "summary": "Children cross four lanes every morning.", "coverUrl": "/uploads/petitions/crossing.jpg", "photos": [],
      "video": null, "target": "Municipal Roads Department", "goal": 500, "status": "APPROVED", "countryId": "clxctyIN",
      "category": { "id": "clxpc01", "name": "Transport", "slug": "transport", "emoji": "🚌", "color": "#dd6b20" },
      "closesAt": "2027-01-31T00:00:00.000Z", "signatureCount": 214, "reactionCount": 31, "creatorUserId": "clxusr05",
      "creatorName": "Meera", "creatorAvatar": null, "createdAt": "2026-11-10T08:00:00.000Z", "open": true, "isMine": false }] }
    ```
  - Errors: 403 — verification (middleware).
- **Form fields:** none (filters only)
- **Business rules:** Without `open=1`, the list includes only `status = APPROVED`. Note that a petition the creator **closed** (`CLOSED`) is **not** in the list, while one past its deadline stays `APPROVED` with `open: false`. Order is `createdAt desc` (never most-signed first, by design).
- **Edge cases / notes for the mobile app:** No `total` or `pageCount` comes back, so infinite-scroll until a short page. `photos`/`video` are included on cards. `goal` can be null (no progress bar).
- **Status:** ✅ Complete

## Petitions → Detail & signers
- **Description:** One petition with its full body, the viewer's state (`hasSigned`, `myReaction`), and up to 50 most recent **named** signatures. The creator can also view their own `PENDING`/`REJECTED` petition, including the `rejectionReason`.
- **Who can use it:** Anyone for `APPROVED`/`CLOSED`. Only the creator for `PENDING`/`REJECTED`.
- **Source files:** `src/app/api/user/petitions/[slug]/route.ts` (GET), `src/lib/petitions.ts` (`getPetitionBySlug`, `listSignatures`), `src/app/petitions/[slug]/page.tsx`, `src/components/site/petition-detail-client.tsx`.
- **User flow:**
  1. Open a petition (by slug from a card or deep link `/petitions/<slug>`) and `GET`.
  2. Render the case, progress, target, deadline, gallery and video. If `status` is `PENDING`, show the "Waiting for review" banner. If `REJECTED`, show the reason.
  3. Sign, react or close (see the following features). After signing, the web re-GETs to refresh the signer list.
  4. Failure: 404 "Not found" when the slug is missing or someone else's non-public petition.
- **Suggested mobile screen(s):** `PetitionDetail`: cover/gallery/video, title, "To: target", progress bar (signatures/goal), deadline or "Closed", Sign button with a comment field and anonymous switch, reaction bar (shown below Sign, never in place of it), signer list (name, avatar, comment, time), creator controls ("Close petition"), and a status banner.
- **API(s):**
  - `GET /api/user/petitions/[slug]`
  - Auth required: no (verified if signed in)
  - Request — path `slug`.
  - Response (success) 200 (`no-store`):
    ```ts
    interface PetitionDetailResponse {
      petition: PetitionCard & {
        body: string; rejectionReason: string | null; // only for the creator
        hasSigned: boolean; myReaction: ReactionType | null;
      };
      signatures: { userId: string; name: string; avatar: string | null; comment: string | null; createdAt: string }[];
    }
    ```
    ```json
    { "petition": { "id": "clxpt01", "slug": "safe-crossing-near-school", "title": "A safe crossing near Green Park school",
      "summary": "Children cross four lanes every morning.", "coverUrl": "/uploads/petitions/crossing.jpg", "photos": [],
      "video": null, "target": "Municipal Roads Department", "goal": 500, "status": "APPROVED", "countryId": "clxctyIN",
      "category": { "id": "clxpc01", "name": "Transport", "slug": "transport", "emoji": "🚌", "color": "#dd6b20" },
      "closesAt": "2027-01-31T00:00:00.000Z", "signatureCount": 214, "reactionCount": 31, "creatorUserId": "clxusr05",
      "creatorName": "Meera", "creatorAvatar": null, "createdAt": "2026-11-10T08:00:00.000Z", "open": true, "isMine": false,
      "body": "Every morning ...", "rejectionReason": null, "hasSigned": true, "myReaction": null },
      "signatures": [{ "userId": "clxusr01", "name": "Priya", "avatar": null, "comment": "My son crosses here.",
        "createdAt": "2026-11-25T07:40:00.000Z" }] }
    ```
  - Errors: 404 — "Not found" — unknown slug, or PENDING/REJECTED and not the creator. 403 — verification (middleware).
- **Form fields:** none
- **Business rules:** Anonymous signatures count in `signatureCount` but are left out of `signatures`. The signer list holds at most 50, newest first. `open` is false when status ≠ `APPROVED` or `closesAt` has passed (checked on read, no cron).
- **Edge cases / notes for the mobile app:** `body` is markdown. The signer list has no paging beyond 50. `rejectionReason` is non-null only for the creator.
- **Status:** ✅ Complete

## Petitions → Start a petition
- **Description:** A member writes a petition addressed to a target body, with an optional signature goal, deadline, photos and one video. It lands **PENDING** until a moderator approves it.
- **Who can use it:** Signed-in, verified members.
- **Source files:** `src/app/api/user/petitions/route.ts` (POST), `src/lib/petitions.ts` (`submitPetition`, `normalise`), `src/lib/attached-media.ts` (`sanitiseImages`, `resolveAttachedVideo`, `MAX_GALLERY_PHOTOS`), `src/lib/petition-categories.ts` (`isSelectableCategory`), `src/components/site/petition-new-client.tsx`, `src/components/ui/video-upload.tsx`, `src/app/petitions/new/page.tsx`.
- **User flow:**
  1. Open "Start a petition" and pick a category (from `GET /api/public/petition-categories`).
  2. Fill in the target ("Who is this addressed to?"), title, summary, body, optional goal and closing date, up to 6 photos (via `POST /api/user/upload`; the first becomes the cover), and an optional video (via `POST /api/user/upload/video`, then poll until READY; send only the `videoAssetId`).
  3. `POST`. On `201 { slug }`, open `PetitionDetail` for that slug. The creator can see it with the PENDING banner.
  4. Failure: 400 with a readable message. Show it inline.
- **Suggested mobile screen(s):** `StartPetition` form → `PetitionDetail` (pending).
- **API(s):**
  - `POST /api/user/petitions`
  - Auth required: yes (member; returns 401 "Unauthorized" when signed out)
  - Request — JSON body:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | title | string | yes | trimmed, cut to 200, **≥6 chars** | — | `"A safe crossing near Green Park school"` |
    | target | string | yes | trimmed, cut to 200, **≥2 chars** | — | `"Municipal Roads Department"` |
    | body | string | yes | trimmed, **≥40 chars** (markdown) | — | `"Every morning ..."` |
    | categoryId | string | yes | active PetitionCategory id | — | `"clxpc01"` |
    | summary | string | no | cut to 400 | null | `"Children cross four lanes."` |
    | goal | number | no | >0 → truncated, max 1,000,000; else null | null | `500` |
    | closesAt | string (ISO date) | no | parsed with `new Date()` (not validated) | null | `"2027-01-31"` |
    | countryId | string | no | trimmed | null | `"clxctyIN"` |
    | coverUrl | string | no | upload URL | null | `"/uploads/petitions/crossing.jpg"` |
    | photos | `{url, alt?}[]` | no | entries without url dropped; max 10 kept | [] | `[{"url":"/uploads/petitions/2.jpg","alt":"Traffic"}]` |
    | videoAssetId | string | no | own VideoAsset with status READY | null | `"clxva01"` |

  - Response (success) 201:
    ```ts
    interface CreatePetitionResponse { slug: string }
    ```
    ```json
    { "slug": "a-safe-crossing-near-green-park-school" }
    ```
  - Errors: 401 — "Unauthorized". 400 — "Expected a JSON object." — body is not JSON. 400 — "Give the petition a clear title — at least a few words." (TITLE). 400 — "Say who this is addressed to." (TARGET). 400 — "Explain what you're asking for and why. A couple of sentences at least." (BODY). 400 — "Choose what this petition is about." (CATEGORY). 400 — "That video upload could not be found." / "That video belongs to someone else." / "That video is still processing — wait for it to finish." 400 — other thrown message (for example an invalid `closesAt`).
- **Form fields:**

  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | Addressed to (target) | text | yes | 2–200 chars | any |
  | Category | picker | yes | active | petition categories |
  | Title | text | yes | 6–200 chars | any |
  | Summary | text | no | ≤400 | any |
  | Body | multiline | yes | ≥40 chars | markdown |
  | Signature goal | number | no | 1–1,000,000 | integers |
  | Closing date | date | no | should be in the future | — |
  | Photos | image picker | no | web max 6; API keeps cover + 10 | images |
  | Video | video picker | no | must finish processing | video (see uploads module) |

- **Business rules:** Created with `status PENDING`, `creatorUserId = me`, and name and avatar snapshots. A unique slug is generated from the title. **All admins** get an admin notification `PETITION_PENDING` (`src/lib/petitions.ts:443`). On review, the creator gets an in-app `PETITION_APPROVED` ("Your petition is live", link `/petitions/<slug>`) or `PETITION_REJECTED` ("Reason: …") (`src/lib/petitions-admin.ts:90`). Admins can also close or delete petitions.
- **Edge cases / notes for the mobile app:** The client sends the video **id** only, never the URL. A past `closesAt` creates a petition that will be closed as soon as it is approved. The creator cannot edit after submitting (no API).
- **Status:** ✅ Complete

## Petitions → Sign / withdraw
- **Description:** Sign a petition with an optional short comment, optionally anonymously, or withdraw your signature. Signing needs an account. Withdrawing is allowed even after the petition closes.
- **Who can use it:** Signed-in, verified members.
- **Source files:** `src/app/api/user/petitions/[slug]/sign/route.ts`, `src/lib/petitions.ts` (`toggleSignature`, `isOpen`), `src/components/site/petition-detail-client.tsx`.
- **User flow:**
  1. On an open petition, optionally type a comment and tick "Sign anonymously", then tap "Sign".
  2. `POST` → `{ signed: true, signatureCount }`. Refresh the detail to update the signer list.
  3. If already signed, tap "Withdraw my signature" → `signed: false`.
  4. Failure: 409 "This petition has closed." → disable Sign. 404 → not found.
- **Suggested mobile screen(s):** Sign panel on `PetitionDetail` (comment field, anonymous switch, Sign/Withdraw button, count).
- **API(s):**
  - `POST /api/user/petitions/[slug]/sign`
  - Auth required: yes (member)
  - Request:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | slug (path) | string | yes | petition slug | — | `safe-crossing-near-school` |
    | comment | string | no | trimmed, cut to 400; used only when signing | null | `"My son crosses here."` |
    | anonymous | boolean | no | literal `true` hides the name from the list | false | `false` |

  - Response (success) 200:
    ```ts
    interface SignPetitionResponse { ok: true; signed: boolean; signatureCount: number }
    ```
    ```json
    { "ok": true, "signed": true, "signatureCount": 215 }
    ```
  - Errors: 401 — "Unauthorized". 404 — "Not found" — unknown slug. 409 — "This petition has closed." — signing when not open (CLOSED, past deadline, **and also PENDING/REJECTED**).
- **Form fields:**

  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | Comment | text | no | ≤400 chars | any |
  | Sign anonymously | switch | no | — | true/false |

- **Business rules:** One signature per (petition, user). This is a toggle: if a signature exists, it is deleted. The name snapshot is cut to 120 chars. `signatureCount` is recounted from rows. Signing is separate from reacting and never changes `signatureCount` through a reaction. No notification to the creator.
- **Edge cases / notes for the mobile app:** To change the comment or anonymity, withdraw and sign again. The anonymous choice is not echoed back (the detail has no "my signature" object, only `hasSigned`).
- **Status:** ✅ Complete

## Petitions → React
- **Description:** Leave, change or take back a reaction on a petition. This is separate from signing and allowed on CLOSED petitions too.
- **Who can use it:** Signed-in, verified members.
- **Source files:** `src/app/api/user/petitions/[slug]/react/route.ts`, `src/lib/petitions.ts` (`togglePetitionReaction`).
- **User flow:**
  1. Tap or long-press the reaction bar (shown under the Sign panel) and `POST {type}`.
  2. Update from `reacted`, `reactionCount` and `myReaction`.
  3. Failure: 404 unknown slug. 400 "This petition isn't available." (PENDING/REJECTED).
- **Suggested mobile screen(s):** Reaction bar on `PetitionDetail`.
- **API(s):**
  - `POST /api/user/petitions/[slug]/react`
  - Auth required: yes (member)
  - Request:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | slug (path) | string | yes | petition slug | — | `safe-crossing-near-school` |
    | type (body) | ReactionType | no | unknown → LIKE; same → remove | LIKE | `"STRENGTH"` |

  - Response (success) 200:
    ```ts
    interface PetitionReactResponse { reacted: boolean; reactionCount: number; myReaction: ReactionType | null }
    ```
    ```json
    { "reacted": true, "reactionCount": 32, "myReaction": "STRENGTH" }
    ```
  - Errors: 401 — "Unauthorized". 404 — "Not found" — unknown slug. 400 — "This petition isn't available." — not APPROVED/CLOSED. 400 — other message.
- **Form fields:** none
- **Business rules:** Uses a separate table and counter (`reactionCount`), recounted. Never counts as a signature.
- **Edge cases / notes for the mobile app:** The field is `reacted` (not `liked`).
- **Status:** ✅ Complete

## Petitions → Close own petition
- **Description:** The creator stops collecting signatures. `DELETE` **closes** the petition (status `CLOSED`). Nothing is deleted: the page, signatures and count remain.
- **Who can use it:** The petition creator, only while it is `APPROVED`.
- **Source files:** `src/app/api/user/petitions/[slug]/route.ts` (DELETE), `src/lib/petitions.ts` (`closePetition`), `src/components/site/petition-detail-client.tsx`.
- **User flow:**
  1. On their own petition (`isMine` and `status APPROVED`), the creator taps "Close petition" and confirms.
  2. `DELETE` → `{ ok: true }`. Re-fetch the detail (status `CLOSED`, `open: false`).
  3. Failure: 404 "Not found" (not the creator, not APPROVED, or unknown).
- **Suggested mobile screen(s):** Creator menu on `PetitionDetail`, with a confirm dialog explaining that signatures are kept.
- **API(s):**
  - `DELETE /api/user/petitions/[slug]`
  - Auth required: yes (creator)
  - Request — path `slug`. No body.
  - Response (success) 200:
    ```ts
    interface PetitionCloseResponse { ok: true }
    ```
    ```json
    { "ok": true }
    ```
  - Errors: 401 — "Unauthorized". 404 — "Not found" — not the creator, not APPROVED, or missing.
- **Form fields:** none
- **Business rules:** `APPROVED` → `CLOSED` only, and it cannot be reopened by the member. Closed petitions still accept reactions and signature withdrawals, but no new signatures. A `CLOSED` petition no longer appears in `GET /api/user/petitions` (that list filters on APPROVED) but is still reachable by slug.
- **Edge cases / notes for the mobile app:** The method is DELETE but the effect is a close. Label it "Close", not "Delete".
- **Status:** ✅ Complete

## Petitions → My petitions
- **Description:** The member's own petitions in any status (pending, approved, rejected, closed).
- **Who can use it:** The creator.
- **Source files:** `src/lib/petitions.ts` (`listMyPetitions` — defined but not used by any route or page).
- **User flow:**
  1. After submitting, the member is taken to the petition by slug, so they can see it then.
  2. Later, the only way back is the in-app notification (`PETITION_APPROVED`/`PETITION_REJECTED`) or the slug. The `isMine` flag appears on approved petitions in the public list.
- **Suggested mobile screen(s):** `MyPetitions` list (needs a backend endpoint).
- **API(s):** None. `listMyPetitions` exists in the lib but no endpoint uses it.
- **Form fields:** none
- **Business rules:** Statuses: `PENDING → APPROVED | REJECTED`, `APPROVED → CLOSED` (by the creator, an admin, or implicitly once past `closesAt`, which shows as `open: false`).
- **Edge cases / notes for the mobile app:** Store slugs of submitted petitions locally as a stopgap.
- **Status:** ⚠️ Partial / Unclear (lib function exists but is never exposed)

---

## Campaigns → Categories
- **Description:** The active campaign categories (what people organise around), each with a count of **live** campaigns (published and not past `endsAt`). Empty ones are included.
- **Who can use it:** Anyone (public).
- **Source files:** `src/app/api/public/campaign-categories/route.ts`, `src/lib/campaign-categories.ts` (`listPublicCategories`, `liveCampaignWhere`), `src/components/site/campaigns-client.tsx`, `src/app/campaigns/new/page.tsx`.
- **User flow:**
  1. The campaigns screen loads `GET /api/public/campaign-categories?countryId=<current>` and shows tiles.
  2. Tapping a tile filters with `category=<slug>&live=1`.
- **Suggested mobile screen(s):** Tile grid on `CampaignsList`. Picker on `SubmitCampaign`.
- **API(s):**
  - `GET /api/public/campaign-categories`
  - Auth required: no
  - Request — query:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | countryId | string | no | counts campaigns in that country **plus** country-less ones | all | `clxctyIN` |

  - Response (success) 200:
    ```ts
    interface CampaignCategoriesResponse { categories: {
      id: string; name: string; slug: string; description: string | null;
      emoji: string | null; color: string | null; liveCount: number }[] }
    ```
    ```json
    { "categories": [{ "id": "clxcc01", "name": "Loneliness & connection", "slug": "loneliness-connection",
      "description": "Bringing people back into contact.", "emoji": "🫂", "color": "#805ad5", "liveCount": 1 }] }
    ```
  - Errors: none handled.
- **Form fields:** none
- **Business rules:** Only `isActive`, ordered by `sortOrder`, then name. Seeded by `prisma/seed-campaign-categories.ts`.
- **Edge cases / notes for the mobile app:** Separate taxonomy from petitions. Do not mix the ids.
- **Status:** ✅ Complete

## Campaigns → Browse
- **Description:** Published awareness campaigns for the reader's country (country-less campaigns show everywhere), with the viewer's `supporting` flag and a `finished` flag.
- **Who can use it:** Signed-in, verified members (this API requires auth, unlike petitions and events).
- **Source files:** `src/app/api/user/campaigns/route.ts` (GET), `src/lib/campaigns.ts` (`listCampaigns`, `isFinished`), `src/lib/campaign-categories.ts` (`categoryIdForSlug`), `src/components/site/campaigns-client.tsx`, `src/app/campaigns/page.tsx`, `src/app/campaigns/category/[slug]/page.tsx` (redirects to `/campaigns?category=`).
- **User flow:**
  1. Open Campaigns. `GET /api/user/campaigns?countryId=<id>&take=24&page=1`.
  2. Category tile → `category=<slug>&live=1`.
  3. Tap "Support" on a card (see Support), or open the detail (web-only).
- **Suggested mobile screen(s):** `CampaignsList`: tiles, cards (cover, emoji, title, summary, category, supporter count, "N articles · M events", "Ended" badge when `finished`, Support toggle), and a "Start a campaign" button.
- **API(s):**
  - `GET /api/user/campaigns`
  - Auth required: yes (member)
  - Request — query:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | countryId | string | no | that country OR `countryId = null` | all | `clxctyIN` |
    | category | string | no | campaign category slug; unknown → no filter | none | `loneliness-connection` |
    | live | `"1"` | no | drop campaigns whose `endsAt` has passed | all published | `1` |
    | take | number | no | page size; **omitted = every row** (no cap) | unlimited | `24` |
    | page | number | no | 1-based, used only with `take` | 1 | `1` |

  - Response (success) 200:
    ```ts
    interface CampaignsListResponse { campaigns: CampaignCard[] }
    interface CampaignCard {
      id: string; slug: string; title: string; summary: string | null; coverUrl: string | null;
      emoji: string | null; status: "PENDING" | "DRAFT" | "PUBLISHED" | "REJECTED" | "ARCHIVED";
      publishedAt: string | null; startsAt: string | null; endsAt: string | null; countryId: string | null;
      supporterCount: number;
      category: { id: string; name: string; slug: string; emoji: string | null; color: string | null } | null;
      _count: { articles: number; events: number };
      supporting: boolean; finished: boolean;
    }
    ```
    ```json
    { "campaigns": [{ "id": "clxcp01", "slug": "no-one-eats-alone", "title": "No one eats alone", "summary": "Shared tables this winter.",
      "coverUrl": "/uploads/campaigns/table.jpg", "emoji": "🍲", "status": "PUBLISHED", "publishedAt": "2026-11-01T00:00:00.000Z",
      "startsAt": null, "endsAt": "2027-02-28T00:00:00.000Z", "countryId": null, "supporterCount": 88,
      "category": { "id": "clxcc01", "name": "Loneliness & connection", "slug": "loneliness-connection", "emoji": "🫂", "color": "#805ad5" },
      "_count": { "articles": 2, "events": 1 }, "supporting": false, "finished": false }] }
    ```
  - Errors: 401 — "Unauthorized". 403 — verification (middleware).
- **Form fields:** none
- **Business rules:** Only `PUBLISHED`. Order is `publishedAt desc, createdAt desc`. `finished` = `endsAt` is in the past. `_count` counts all attached rows (including unpublished articles and unapproved events, which the detail page filters out).
- **Edge cases / notes for the mobile app:** Always send `take` (e.g. 24) to get paging. No total comes back, so stop on a short page.
- **Status:** ✅ Complete

## Campaigns → Campaign detail
- **Description:** The campaign page `/campaigns/<slug>`: markdown body, gallery, call to action and CTA link (admin-set), attached published articles and approved events, a linked chat room, a linked approved petition, supporter state, and `finished`. The submitter can also see their own `PENDING`/`REJECTED` campaign with the admin's `reviewNote`.
- **Who can use it:** Signed-in members (web).
- **Source files:** `src/app/campaigns/[slug]/page.tsx`, `src/lib/campaigns.ts` (`getCampaignBySlug`), `src/components/site/campaign-detail-client.tsx`.
- **User flow:**
  1. The server reads the campaign by slug directly from the DB.
  2. The Support button calls `POST /api/user/campaigns/{id}/support`.
  3. Attached items link to articles, events, the chat room and the petition.
- **Suggested mobile screen(s):** `CampaignDetail`: cover, title, category, supporter count, Support button, CTA button, body, gallery, "Read" (articles), "Join" (events), chat room card, petition card with progress, and a status banner for the submitter.
- **API(s):** **None.**
- **Form fields:** none
- **Business rules:** Attachments are resolved at read time. Drafted articles, unapproved or cancelled events and non-approved petitions are dropped.
- **Edge cases / notes for the mobile app:** Needs `GET /api/user/campaigns/[slug]`.
- **Status:** ⚠️ Web-only (no API)

## Campaigns → Submit a campaign
- **Description:** A member sends in a campaign (title, summary, body, category, country, photos). It lands **PENDING**. Members cannot set status, dates, the CTA link, chat room, petition or attachments. Those are admin curation at review time.
- **Who can use it:** Signed-in, verified members.
- **Source files:** `src/app/api/user/campaigns/route.ts` (POST), `src/lib/campaigns.ts` (`submitCampaign`), `src/lib/campaign-categories.ts` (`isSelectableCategory`), `src/lib/attached-media.ts`, `src/components/site/campaign-new-client.tsx`, `src/app/campaigns/new/page.tsx`.
- **User flow:**
  1. Open "Start a campaign" and pick a category.
  2. Fill in the title, summary, body and up to 6 photos (via `POST /api/user/upload`; the first becomes the cover). The country comes from the country picker.
  3. `POST` → `201 { slug }`. The web navigates to `/campaigns/<slug>`, where the submitter sees it as pending.
  4. Failure: 400 with a message.
- **Suggested mobile screen(s):** `SubmitCampaign` form → success/pending screen.
- **API(s):**
  - `POST /api/user/campaigns`
  - Auth required: yes (member)
  - Request — JSON body:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | title | string | yes | trimmed, cut to 200, **≥6 chars** | — | `"No one eats alone"` |
    | body | string | yes | trimmed, cut to 40,000, **≥40 chars** | — | `"This winter we want ..."` |
    | categoryId | string | yes | active CampaignCategory id | — | `"clxcc01"` |
    | summary | string | no | cut to 400 | null | `"Shared tables this winter."` |
    | countryId | string | no | trimmed | null | `"clxctyIN"` |
    | coverUrl | string | no | upload URL | null | `"/uploads/campaigns/table.jpg"` |
    | photos | `{url, alt?}[]` | no | max 10 kept | [] | `[]` |

    Ignored if sent: `status`, `ctaUrl`, `startsAt`, `endsAt`, `chatRoomId`, `petitionId`.
  - Response (success) 201:
    ```ts
    interface CreateCampaignResponse { slug: string }
    ```
    ```json
    { "slug": "no-one-eats-alone" }
    ```
  - Errors: 401 — "Unauthorized". 400 — "Expected a JSON object." 400 — "Give the campaign a clear title — at least a few words." (TITLE). 400 — "Explain what the campaign is for and what you want to happen. A couple of sentences at least." (BODY). 400 — "Choose what this campaign is about." (CATEGORY).
- **Form fields:**

  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | Category | picker | yes | active | campaign categories |
  | Title | text | yes | 6–200 | any |
  | Summary | text | no | ≤400 | any |
  | Body | multiline | yes | 40–40,000 | markdown |
  | Photos | image picker | no | web max 6; API cover + 10 | images |

- **Business rules:** `status PENDING`, `submittedByUserId = me`, with submitter name and avatar snapshots. **All admins** get `CAMPAIGN_PENDING` (`src/lib/campaigns.ts:383`). On review: approve → `PUBLISHED` (`publishedAt` set the first time), reject → `REJECTED` with `reviewNote`. The submitter gets an in-app `CAMPAIGN_APPROVED` ("Your campaign is live") or `CAMPAIGN_REJECTED` ("Reason: …"), linking to `/campaigns/<slug>` (`src/lib/campaigns-admin.ts:394`). Statuses: `PENDING` (member submissions), `DRAFT` (admin-made), `PUBLISHED`, `REJECTED`, `ARCHIVED`.
- **Edge cases / notes for the mobile app:** No editing after submission. The pending campaign is visible to its submitter only on the web detail page.
- **Status:** ✅ Complete

## Campaigns → Support
- **Description:** Toggle "I support this" on a published campaign.
- **Who can use it:** Signed-in, verified members.
- **Source files:** `src/app/api/user/campaigns/[id]/support/route.ts`, `src/lib/campaigns.ts` (`toggleCampaignSupport`), `src/components/site/campaign-detail-client.tsx`.
- **User flow:**
  1. Tap Support and `POST`.
  2. Update from `supporting` and `supporterCount`. On error, revert.
- **Suggested mobile screen(s):** Support toggle on `CampaignsList` cards and `CampaignDetail`.
- **API(s):**
  - `POST /api/user/campaigns/[id]/support`
  - Auth required: yes (member)
  - Request — path `id` = campaign **id**. No body.
  - Response (success) 200:
    ```ts
    interface CampaignSupportResponse { supporting: boolean; supporterCount: number }
    ```
    ```json
    { "supporting": true, "supporterCount": 89 }
    ```
  - Errors: 401 — "Unauthorized". 400 — "Could not update" — any failure, including a campaign that is not PUBLISHED or missing.
- **Form fields:** none
- **Business rules:** Only `PUBLISHED` campaigns. The count is recounted. Finished campaigns can still be supported. No notification. `listSupportedCampaigns` exists but no route exposes it.
- **Edge cases / notes for the mobile app:** No `ok` field.
- **Status:** ✅ Complete

## Campaigns → My submitted campaigns
- **Description:** The `/campaigns` web page shows the member their own submitted campaigns in any status (pending, rejected with review note, published) above the public list.
- **Who can use it:** The submitter (web).
- **Source files:** `src/app/campaigns/page.tsx`, `src/lib/campaigns.ts` (`listOwnSubmittedCampaigns`: up to 20, newest first, fields `id, slug, title, summary, coverUrl, status, reviewNote, createdAt, category{name,slug,emoji}`).
- **User flow:**
  1. The server reads the member's submissions and passes them to the page.
  2. Tap one to open its detail page (also web-only).
- **Suggested mobile screen(s):** "Your submissions" section on `CampaignsList` with status chips (Pending / Rejected + note / Live).
- **API(s):** None.
- **Form fields:** none
- **Business rules:** Scoped to `submittedByUserId`, so it never shows other members' pending work.
- **Edge cases / notes for the mobile app:** Needs `GET /api/user/campaigns/mine`.
- **Status:** ⚠️ Web-only (no API)

---

## Shared → Gratitude categories
- **Description:** A public list of active categories for a content kind. The only allowed kind today is `gratitude` (gratitude wall composer picker and filter row). It sits in this route group but serves the gratitude feature.
- **Who can use it:** Anyone (public).
- **Source files:** `src/app/api/public/categories/route.ts`, `src/lib/post-categories.ts` (`listPublicCategories`), `src/components/site/category-controls.tsx`.
- **User flow:**
  1. The gratitude composer and filter call `GET /api/public/categories?kind=gratitude`.
  2. Show chips. Retired categories are absent.
- **Suggested mobile screen(s):** Category picker in the gratitude composer and filter chips on the gratitude wall.
- **API(s):**
  - `GET /api/public/categories`
  - Auth required: no
  - Request — query:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | kind | `"gratitude"` | yes | must be exactly `gratitude` | — | `gratitude` |

  - Response (success) 200 (`Cache-Control: public, max-age=60, stale-while-revalidate=300`):
    ```ts
    interface PublicCategoriesResponse { categories: { id: string; name: string; slug: string; emoji: string | null }[] }
    ```
    ```json
    { "categories": [{ "id": "clxgc01", "name": "Family", "slug": "family", "emoji": "👪" }] }
    ```
  - Errors: 400 — "Unknown kind" — `kind` missing or not `gratitude`.
- **Form fields:** none
- **Business rules:** Only `isActive`, ordered by `sortOrder`, then name. No counts.
- **Edge cases / notes for the mobile app:** Safe to cache for 60 s.
- **Status:** ✅ Complete

---

## Notes for the whole module

- **Not covered by any API here (all web-only):** article detail, article category tiles, theme detail (`about`), clip page and view counting, event detail and attendees, campaign detail, "my submitted campaigns". "My events", "my petitions" and "my RSVPs" have no API and no page. `listMyPetitions`, `listMyRsvps` and `listSupportedCampaigns` are unused lib functions.
- **Notifications triggered by this module:** admin notifications `EVENT_PENDING`, `PETITION_PENDING`, `CAMPAIGN_PENDING`. Member in-app notifications on review: `EVENT_APPROVED/REJECTED`, `EVENT_CANCELLED` (to RSVPs), `PETITION_APPROVED/REJECTED`, `CAMPAIGN_APPROVED/REJECTED`. No notifications for reactions, saves, comments, RSVPs, signatures or supports.
- **Inconsistencies to handle in the client:** country param `country` (petitions list) vs `countryId` (everything else); some toggle responses carry `ok: true` (articles, RSVP, sign) and some don't (clips, library, campaigns, petition react); article comments return unmasked anonymous authors while clip comments mask them; article comment delete errors are 404, clip comment delete errors are 400.
