# Community Feed, Gratitude, Confessions, Uploads & Utilities

This module covers the member-generated content surfaces of WorldWeCare:

- **Community feed**: posts with text, up to 6 images or a converted video, an anonymous flag and a country. Members can react (6 reaction types), save, report, comment, and delete their own posts and comments. Posts publish straight away (status `PUBLISHED`).
- **Gratitude wall**: short entries (up to 1000 chars) with one photo **or** one video, an optional category (required when any active category exists) and an anonymous flag. Every entry waits for admin approval (`PENDING` → `APPROVED`/`REJECTED`). Members can react, add comments with one level of replies, and react to comments.
- **Confessions**: **removed from the product.** The DB tables are still there, but there is no API and the page folders under `src/app/confessions/**` are empty.
- **Uploads**: image upload (resized to WebP plus a thumbnail) and video upload (streamed, converted to H.264 MP4 by ffmpeg, with status you poll).
- **Utilities**: Open Graph link preview, and machine translation of stored content by id.

Common rules (see the shared brief): auth is cookie-based (`wwc-user-session`). Signed-in but unverified members get `403 { error: "Confirm your email address first.", needsVerification: true }` on every endpoint here. Errors use `{ error: string }` unless noted. Dates are ISO 8601 strings. Banned words are masked with `*` **when the text is read** (the stored text is never changed) on feed posts, post comments, gratitude entries and gratitude comments (`src/lib/banned-words.ts`). Authors that the viewer has blocked are left out of the feed, post comments, gratitude wall and gratitude comments (`getBlockedIds`, which only covers people the viewer blocked, not people who blocked the viewer).

## Table of contents

1. [Feed → List posts](#feed--list-posts)
2. [Feed → Create post (anonymous, images, video, country)](#feed--create-post-anonymous-images-video-country)
3. [Feed → Edit post / comment (not supported)](#feed--edit-post--comment-not-supported)
4. [Feed → Delete own post](#feed--delete-own-post)
5. [Feed → React to post](#feed--react-to-post)
6. [Feed → Save post](#feed--save-post)
7. [Feed → Report post](#feed--report-post)
8. [Feed → Post comments (list + add)](#feed--post-comments-list--add)
9. [Feed → Delete own comment](#feed--delete-own-comment)
10. [Feed → React to comment](#feed--react-to-comment)
11. [Feed → Report comment](#feed--report-comment)
12. [Feed → Post detail (single post)](#feed--post-detail-single-post)
13. [Gratitude → List wall](#gratitude--list-wall)
14. [Gratitude → Create entry](#gratitude--create-entry)
15. [Gratitude → Delete own entry](#gratitude--delete-own-entry)
16. [Gratitude → React to entry](#gratitude--react-to-entry)
17. [Gratitude → Comments (list + add, one-level replies)](#gratitude--comments-list--add-one-level-replies)
18. [Gratitude → Delete own comment](#gratitude--delete-own-comment)
19. [Gratitude → React to comment](#gratitude--react-to-comment)
20. [Gratitude → Categories & category tiles](#gratitude--categories--category-tiles)
21. [Gratitude → Entry detail (single entry)](#gratitude--entry-detail-single-entry)
22. [Confessions → Confession wall (removed)](#confessions--confession-wall-removed)
23. [Uploads → Image upload](#uploads--image-upload)
24. [Uploads → Video upload + limits](#uploads--video-upload--limits)
25. [Uploads → Video status polling & discard](#uploads--video-status-polling--discard)
26. [Utilities → Link preview](#utilities--link-preview)
27. [Utilities → Translate content](#utilities--translate-content)
28. [Reference: reaction types & report reasons](#reference-reaction-types--report-reasons)

## Endpoints in this module

| Method | Path | Feature | Auth |
|---|---|---|---|
| GET | `/api/user/posts/feed` | Feed → List posts | Optional |
| POST | `/api/user/posts` | Feed → Create post | Member |
| DELETE | `/api/user/posts/[id]` | Feed → Delete own post | Member (author) |
| POST | `/api/user/posts/[id]/like` | Feed → React to post | Member |
| POST | `/api/user/posts/[id]/save` | Feed → Save post | Member |
| POST | `/api/user/posts/[id]/report` | Feed → Report post | Member |
| GET | `/api/user/posts/[id]/comments` | Feed → Post comments | Optional |
| POST | `/api/user/posts/[id]/comments` | Feed → Post comments | Member |
| DELETE | `/api/user/posts/comments/[id]` | Feed → Delete own comment | Member (author) |
| POST | `/api/user/posts/comments/[id]/like` | Feed → React to comment | Member |
| POST | `/api/user/posts/comments/[id]/report` | Feed → Report comment | Member |
| GET | `/api/user/gratitude` | Gratitude → List wall | Member |
| POST | `/api/user/gratitude` | Gratitude → Create entry | Member |
| DELETE | `/api/user/gratitude/[id]` | Gratitude → Delete own entry | Member (author) |
| POST | `/api/user/gratitude/[id]/heart` | Gratitude → React to entry | Member |
| GET | `/api/user/gratitude/[id]/comments` | Gratitude → Comments | Optional |
| POST | `/api/user/gratitude/[id]/comments` | Gratitude → Comments | Member |
| DELETE | `/api/user/gratitude/comments/[commentId]` | Gratitude → Delete own comment | Member (author) |
| POST | `/api/user/gratitude/comments/[commentId]/like` | Gratitude → React to comment | Member |
| POST | `/api/user/upload` | Uploads → Image upload | Member |
| POST | `/api/user/upload/video` | Uploads → Video upload | Member (email verified) |
| GET | `/api/user/upload/video` | Uploads → Video limits | Member |
| GET | `/api/user/upload/video/[id]` | Uploads → Video status | Member (owner) |
| DELETE | `/api/user/upload/video/[id]` | Uploads → Video discard | Member (owner) |
| GET | `/api/user/link-preview` | Utilities → Link preview | Member |
| POST | `/api/user/translate-content` | Utilities → Translate content | Optional (signed out: 60 requests/min per IP) |

Related endpoint documented in another module but used here: `GET /api/public/categories?kind=gratitude` (gratitude category picker). `GET /api/user/saved` (the list of saved posts, built on `listSaved` in `src/lib/posts-feed.ts`) belongs to the saved/profile module.

---

## Feed → List posts
- **Description:** The community feed: published posts, newest first, with cursor paging. When the viewer is signed in, each row includes their own reaction and save state.
- **Who can use it:** Anyone. Signed-out readers see the same posts with `liked`/`saved` always false.
- **Source files:** `src/app/api/user/posts/feed/route.ts`, `src/lib/posts-feed.ts` (`listFeed`, `toFeedPost`, `hydrateLiveAuthors`, `viewerState`), `src/lib/banned-words.ts`, `src/lib/blocks.ts`, `src/components/site/feed-client.tsx`, `src/components/site/country-context.tsx`
- **User flow:**
  1. The app opens the feed and calls `GET /api/user/posts/feed?limit=20` (plus `countryId` if a country is selected).
  2. It shows `items`. When the user nears the end of the list, it calls again with `cursor=<nextCursor>`.
  3. When `nextCursor` is `null`, the feed has no more posts.
  4. Failure: a signed-in but unverified member gets a 403 from middleware.
- **Suggested mobile screen(s):** `FeedScreen`: country chip or filter, a "What's on your mind" button that opens ComposePost, a FlatList of PostCards. Each card shows: avatar and name (or "Anonymous member"), country, relative time, rich text body, image grid or video player, reaction button with picker, comment count, save toggle, and an overflow menu (Report, or Delete if `isOwn`). Pull-to-refresh and infinite scroll.
- **API(s):**
  - `GET /api/user/posts/feed`
  - Auth required: no (optional session)
  - Request (query):

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | cursor | string | no | Opaque `"<ISO createdAt>_<id>"` taken from the previous `nextCursor`. An invalid cursor is ignored, so you get the first page. | none | `2026-11-20T10:15:02.123Z_clx9a0b1c0000` |
    | limit | int | no | Clamped to 5–50 | 20 | `20` |
    | countryId | string | no | Only posts with this country | none | `clcountry123` |

  - Response (success, 200):
    ```ts
    interface FeedPage { items: FeedPost[]; nextCursor: string | null }
    interface FeedPost {
      id: string; authorId: string | null; authorName: string; authorAvatar: string | null;
      body: string; images: { url: string; alt?: string | null }[];
      video: { assetId: string; url: string; posterUrl: string | null; width: number | null; height: number | null; durationSec: number | null } | null;
      isAnonymous: boolean; isFeatured: boolean; likeCount: number; commentCount: number; saveCount: number;
      liked: boolean; myReaction: "LIKE"|"HEART"|"CARE"|"STRENGTH"|"PROUD"|"SAME"|null; saved: boolean; isOwn: boolean;
      countryName: string | null; countryCode: string | null; createdAt: string;
    }
    ```
    ```json
    {
      "items": [{
        "id": "clpost001", "authorId": "cluser42", "authorName": "Maya R.", "authorAvatar": "/uploads/avatars/m.webp",
        "body": "Day 30 today. **Thank you** all.", "images": [{ "url": "/uploads/posts/lq1x-ab12.webp", "alt": null }],
        "video": null, "isAnonymous": false, "isFeatured": false, "likeCount": 12, "commentCount": 3, "saveCount": 1,
        "liked": true, "myReaction": "PROUD", "saved": false, "isOwn": false,
        "countryName": "India", "countryCode": "IN", "createdAt": "2026-11-20T10:15:02.123Z"
      }],
      "nextCursor": "2026-11-20T10:15:02.123Z_clpost001"
    }
    ```
  - Errors: 403 — `Confirm your email address first.` — signed in but email not verified (middleware). There are no other errors.
- **Form fields:** None.
- **Business rules:**
  - Only `status = PUBLISHED` posts appear. Posts whose author is banned (`bannedAt`) or deactivated (`isActive=false`) are hidden. Posts from deleted authors (author is null) still show, using the name saved when they were posted.
  - Sort order is `createdAt desc, id desc`. There is no other sort, no search, and no "featured first" ordering (`isFeatured` is only a flag).
  - Authors the viewer has blocked are excluded.
  - For non-anonymous posts, the current display name and avatar replace the name and avatar saved at posting time.
  - Banned words in `body` are masked with `*`.
- **Edge cases / notes for the mobile app:**
  - ⚠️ **Anonymity leak:** for anonymous posts the API still returns the real `authorId` and the author's real name and avatar as saved at posting time. The web hides them in the UI only (`composer.tsx`, `comment-thread.tsx`). The mobile app **must** show "Anonymous member" with no avatar and no profile link when `isAnonymous` is true. See Gaps.
  - The cursor is opaque. Send it back exactly as received (URL-encode it).
  - Body formatting is a small markup set: `**bold**`/`__bold__`, `*italic*`, `~~strike~~`, line breaks and paragraphs (`src/lib/rich-text.tsx` `RichText`). Render links as plain text.
  - Thumbnails: for any `/uploads/...` raster image, the thumbnail is at the same path with the extension replaced by `-thumb.webp` (`src/lib/image-urls.ts` `thumbUrlFor`; not for .svg/.gif/.ico/.avif). The thumbnail may not exist, so fall back to the full URL on error.
  - Empty state: `items: []`, `nextCursor: null`.
- **Status:** ✅ Complete

## Feed → Create post (anonymous, images, video, country)
- **Description:** A member publishes a post. It can have text, up to 6 images, one converted video, an anonymous flag and an optional country. Posts go live straight away; there is no pre-moderation.
- **Who can use it:** Signed-in, verified members whose account is active and not banned.
- **Source files:** `src/app/api/user/posts/route.ts`, `src/lib/posts-write.ts` (`createPost`, `BODY_MAX=5000`, `MAX_IMAGES=6`), `src/lib/attached-media.ts` (`sanitiseImages`, `resolveAttachedVideo`), `src/components/site/composer.tsx`
- **User flow:**
  1. The user opens the composer and types text.
  2. Optional: they pick images. Each one is uploaded with `POST /api/user/upload`, which returns a `url`. Up to 6.
  3. Optional: they pick a video. It is uploaded with `POST /api/user/upload/video` and the app polls `GET /api/user/upload/video/{id}` until `status = READY`.
  4. Optional: they turn on "Post anonymously". The country comes from the currently selected country, if any.
  5. The app calls `POST /api/user/posts`. On 201 `{ ok, id }`, it refreshes the feed (the response does not include the post object).
  6. Failure: 400 with a message (for example "Post can't be empty.", "That video is still processing — wait for it to finish."). Show it as a toast.
- **Suggested mobile screen(s):** `ComposePost`: multiline text input (with a 5000-character counter), B/I/S formatting buttons, image picker (6 max, thumbnails with remove), video picker with progress (VideoUploadProgress), anonymous toggle that changes the avatar preview to "?", country label, and a Post button that is disabled until there is text, an image or a video.
- **API(s):**
  - `POST /api/user/posts`
  - Auth required: yes (Member)
  - Request (JSON body):

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | body | string | yes (must be a string; can be `""`) | Trimmed; max 5000 chars. May be empty only if there are images or a video. | none | `"Feeling stronger this week."` |
    | isAnonymous | boolean | no | Only `true` counts as true | false | `true` |
    | images | `{url: string, alt?: string}[]` | no | Entries without a string `url` are dropped; the first 6 are kept; only `url` and `alt` are stored | none | `[{"url":"/uploads/posts/lq1x-ab12.webp"}]` |
    | videoAssetId | string | no | Must be a VideoAsset you own with status `READY` | none | `"clvid0001"` |
    | countryId | string | no | Country id. Not validated; an unknown id gives a raw DB error (400). | null | `"clcountryIN"` |

  - Response (success, 201):
    ```ts
    interface CreatePostResponse { ok: true; id: string }
    ```
    ```json
    { "ok": true, "id": "clpost002" }
    ```
  - Errors:
    - 400 — `Body is required` — `body` missing or not a string
    - 400 — `Post is too long (N/5000).`
    - 400 — `Post can't be empty.` — no text, no images and no video
    - 400 — `That video upload could not be found.` / `That video belongs to someone else.` / `That video is still processing — wait for it to finish.`
    - 400 — `User not found` / `Account is deactivated.` / `Account is banned.`
    - 401 — not signed in; 403 — email not verified
- **Form fields:**

  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | What's on your mind | multiline text | conditional | ≤5000 chars after trim | markup `**b**` `*i*` `~~s~~` |
  | Photos | image picker | no | ≤6; each uploaded via /api/user/upload | png, jpeg, webp, gif, svg, ico |
  | Video | video picker | no | one; must reach READY | video/* |
  | Post anonymously | switch | no | none | true/false |

- **Business rules:**
  - The author's display name and avatar are saved on the post at posting time (`authorNameSnapshot`, `authorAvatarSnapshot`).
  - The video is stored as a JSON copy of the VideoAsset (`assetId, url, posterUrl, width, height, durationSec`). The client never sends a video URL.
  - On the server a post can have **both** images and a video. The web composer disables the image button while the video panel is open, so the web only produces one or the other.
  - No notifications are sent, and admins are not notified of new posts.
  - Image URLs are stored as sent. The server does not check that they are uploads you own (see Gaps).
- **Edge cases / notes for the mobile app:** Do not send `videoAssetId` until polling shows `READY`. The new post's status is `PUBLISHED` straight away.
- **Status:** ✅ Complete

## Feed → Edit post / comment (not supported)
- **Description:** There is no way to edit a post, a post comment or a gratitude entry or comment after it is published. No `PATCH`/`PUT` route exists in this module.
- **Who can use it:** Nobody.
- **Source files:** None (no route exists). Checked under `src/app/api/user/posts/**` and `src/app/api/user/gratitude/**`.
- **User flow:** 1. The author can only delete the content and post it again.
- **Suggested mobile screen(s):** Do not show an "Edit" action.
- **API(s):** None.
- **Form fields:** None.
- **Business rules:** `Post.updatedAt` exists in the schema, but nothing writes to it from the user side.
- **Edge cases / notes for the mobile app:** If editing is wanted, a backend change is needed (see Gaps).
- **Status:** ⚠️ Partial / Unclear (not implemented)

## Feed → Delete own post
- **Description:** The author permanently deletes their own post. Its comments, reactions, saves and reports go with it, and so do the images and video they uploaded.
- **Who can use it:** Signed-in members, only for their own posts. This includes their own anonymous posts (ownership is checked against the real author).
- **Source files:** `src/app/api/user/posts/[id]/route.ts`, `src/lib/posts-write.ts` (`deletePost`), `src/lib/media.ts` (`deleteMediaByUrls`, `extractLocalImageUrls`), `src/lib/video-status.ts` (`discardVideo`)
- **User flow:**
  1. The user taps Delete on their own post (shown only when `isOwn`) and confirms.
  2. The app calls `DELETE /api/user/posts/{id}`. On 200 it removes the card from the list.
  3. Failure: 403 for someone else's post, 404 if the post is already gone (remove the card anyway).
- **Suggested mobile screen(s):** Post overflow menu → "Delete post" → confirmation dialog.
- **API(s):**
  - `DELETE /api/user/posts/[id]`
  - Auth required: yes (Member, author only)
  - Request (path):

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | id | string | yes | Post id | none | `clpost001` |

  - Response (success, 200): `{ ok: true }`
  - Errors: 404 — `Post not found`; 403 — `Not your post`; 400 — other failure; 401 — not signed in.
- **Form fields:** None.
- **Business rules:** The post row is hard-deleted. Comments, likes, saves and reports are deleted with it. Image files listed in `images` and `/uploads/` images written in the body (`![](...)`) are deleted, together with their `-thumb` files, but only files whose UploadedFile owner is the caller. The attached VideoAsset and its MP4 and poster are deleted too, again only if the caller owns them.
- **Edge cases / notes for the mobile app:** The same works for posts with any status (for example REMOVED by a moderator).
- **Status:** ✅ Complete

## Feed → React to post
- **Description:** Add, change or remove a reaction on a post. There are six reaction types (see Reference). Each person has one reaction per post. `likeCount` counts **people**, not reactions.
- **Who can use it:** Signed-in members.
- **Source files:** `src/app/api/user/posts/[id]/like/route.ts`, `src/lib/posts-feed.ts` (`toggleLike`), `src/lib/reaction-toggle.ts` (`reactionOutcome`, `REACTION_VERB`), `src/lib/reactions.ts`
- **User flow:**
  1. Tap the reaction button: the app sends `{type:"LIKE"}` (or no body). Long-press opens the picker and the user chooses one of the six.
  2. The app updates the UI straight away, calls the API, then applies the returned `liked`, `likeCount` and `myReaction`.
  3. Sending the same type the viewer already has **removes** it. Sending a different type **changes** it (the count stays the same).
  4. Failure: 404 if the post is gone, 400 `Post not available` if it is not published. Undo the optimistic change.
- **Suggested mobile screen(s):** Reaction button on PostCard and PostDetail, with a long-press emoji picker (👍 ❤️ 🤗 💪 🌟 🙋).
- **API(s):**
  - `POST /api/user/posts/[id]/like`
  - Auth required: yes (Member)
  - Request (JSON body, optional):

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | type | enum | no | `LIKE`,`HEART`,`CARE`,`STRENGTH`,`PROUD`,`SAME`. An unknown value is treated as LIKE. | `LIKE` | `"SAME"` |

  - Response (success, 200):
    ```ts
    interface PostReactionResponse { ok: true; liked: boolean; likeCount: number; myReaction: ReactionType | null }
    ```
    ```json
    { "ok": true, "liked": true, "likeCount": 13, "myReaction": "SAME" }
    ```
  - Errors: 404 — `Post not found`; 400 — `Post not available` (not PUBLISHED) or another error; 401.
- **Form fields:** None.
- **Business rules:**
  - The three cases: added (count +1), changed (count unchanged), removed (count −1).
  - Only a **new** reaction notifies the author, and only if the reactor is not the author. The in-app notification is type `POST_LIKE`, titled "`<display name> <verb> your post`". The verbs are: liked / loved / sent love on / is rooting for you on / is proud of / said "same here" on. The body is the first 120 characters of the post, and the link is `/post/<id>`.
  - ⚠️ The notification uses the reactor's real display name. Reactions have no anonymous option.
- **Edge cases / notes for the mobile app:** It is safe to double-tap because the result depends only on the current state, not on how many requests were sent. There is no endpoint that lists who reacted or counts per type.
- **Status:** ✅ Complete

## Feed → Save post
- **Description:** Bookmark a post, or remove the bookmark.
- **Who can use it:** Signed-in members.
- **Source files:** `src/app/api/user/posts/[id]/save/route.ts`, `src/lib/posts-feed.ts` (`toggleSave`, `listSaved`), `src/app/saved/page.tsx`
- **User flow:**
  1. Tap the bookmark icon. The app calls `POST /api/user/posts/{id}/save`, and the response gives the new state.
  2. Saved posts are listed under Saved (`GET /api/user/saved`, documented in the saved/profile module). That list is ordered by when each post was saved, newest first.
- **Suggested mobile screen(s):** Bookmark toggle on PostCard; a `SavedPosts` screen.
- **API(s):**
  - `POST /api/user/posts/[id]/save`
  - Auth required: yes (Member)
  - Request: path `id` only, no body.
  - Response (success, 200):
    ```json
    { "ok": true, "saved": true, "saveCount": 4 }
    ```
  - Errors: 404 — `Post not found`; 400 — `Post not available`; 401.
- **Form fields:** None.
- **Business rules:** The API toggles: calling it again removes the save. `saveCount` is updated in the same transaction. No notification is sent.
- **Edge cases / notes for the mobile app:** Removing a save works even if the post is no longer published.
- **Status:** ✅ Complete

## Feed → Report post
- **Description:** Flag a post for moderators, with a reason and optional notes.
- **Who can use it:** Signed-in members.
- **Source files:** `src/app/api/user/posts/[id]/report/route.ts`, `src/lib/posts-user.ts` (`reportPost`, `isValidReason`, `VALID_REPORT_REASONS`), `src/lib/report-reasons.ts` (labels and hints), `src/components/site/report-modal.tsx`
- **User flow:**
  1. Overflow menu → Report opens a sheet with 8 reasons, each with a label and hint, plus an optional notes field.
  2. Submit calls `POST /api/user/posts/{id}/report`.
  3. `duplicate: false` → "Thanks, our team will review it." `duplicate: true` → "You've already reported this."
  4. Failure: 400 `Invalid reason`, 404 post gone.
- **Suggested mobile screen(s):** `ReportSheet`: radio list of reasons with hints, notes textarea (2000 max), Send button.
- **API(s):**
  - `POST /api/user/posts/[id]/report`
  - Auth required: yes (Member)
  - Request (JSON body):

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | reason | enum | yes | One of the 8 values in the Reference section | none | `"HARASSMENT"` |
    | notes | string | no | Cut to 2000 chars and trimmed; empty becomes null | none | `"Targets a member by name"` |

  - Response (success, 200):
    ```json
    { "ok": true, "duplicate": false }
    ```
  - Errors: 400 — `Invalid reason`; 404 — `Post not found`; 400 — other; 401.
- **Form fields:**

  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | Reason | radio | yes | none | SPAM, HARASSMENT, HATE_SPEECH, SELF_HARM, ADULT_CONTENT, MISINFORMATION, OFF_TOPIC, OTHER |
  | Notes | textarea | no | ≤2000 chars | free text |

- **Business rules:**
  - Each member can have only one OPEN report per post. This is enforced by a unique (`reporterId`, `openKey`="POST:<id>") key; a repeat returns `duplicate: true`. After moderators resolve or dismiss it, the member can report the post again.
  - `Post.reportCount` goes up by 1.
  - Every active admin gets an admin notification (`POST_REPORTED`, "Post reported (<reason>)", with an 80-character snippet; link `/admin/posts/reports`).
- **Edge cases / notes for the mobile app:** Reporting your own post is allowed. You can report posts that are not published.
- **Status:** ✅ Complete

## Feed → Post comments (list + add)
- **Description:** A comment thread under a post. Comments are **flat**: there are no replies or threading for post comments (the `PostComment` model has no `parentId`). Commenters can choose to be anonymous.
- **Who can use it:** Anyone can read. Only signed-in members can post.
- **Source files:** `src/app/api/user/posts/[id]/comments/route.ts`, `src/lib/comments.ts` (`listComments`, `createComment`, `COMMENT_BODY_MAX=2000`), `src/components/site/comment-thread.tsx`
- **User flow:**
  1. Opening the comments calls `GET /api/user/posts/{id}/comments?limit=20`. Newest comments come first, and the composer sits at the top.
  2. "Load more" calls again with `cursor=<nextCursor>`.
  3. To post, the user types up to 2000 characters, optionally turns on "anonymous", and the app calls `POST`. On 201 it puts `comment` at the top and adds 1 to the post's `commentCount` on screen.
  4. Failure: 400 empty or too long, 404 post gone, 400 `Post not available`.
- **Suggested mobile screen(s):** `PostDetail` / `CommentsSheet`: composer at the top (avatar becomes "?" when anonymous, anonymous switch, Send), then a list of comments (name or "Anonymous member", time, body, reaction button, overflow menu with Delete if `isOwn` or Report), and a Load more button.
- **API(s):**
  - `GET /api/user/posts/[id]/comments`
  - Auth required: no (optional session)
  - Request (query):

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | cursor | string | no | Opaque `"<ISO>_<id>"` | none | `2026-11-20T11:00:00.000Z_clcmt9` |
    | limit | int | no | Clamped to 5–50 | 20 | `20` |

  - Response (success, 200):
    ```ts
    interface CommentPage { items: FeedComment[]; nextCursor: string | null }
    interface FeedComment {
      id: string; authorId: string | null; authorName: string; authorAvatar: string | null; body: string;
      isAnonymous: boolean; likeCount: number; liked: boolean; myReaction: ReactionType | null; isOwn: boolean; createdAt: string;
    }
    ```
    ```json
    { "items": [{ "id": "clcmt9", "authorId": "cluser7", "authorName": "Jon", "authorAvatar": null,
      "body": "So proud of you!", "isAnonymous": false, "likeCount": 2, "liked": false, "myReaction": null,
      "isOwn": false, "createdAt": "2026-11-20T11:00:00.000Z" }], "nextCursor": null }
    ```
  - Errors: none. An unknown post id returns an empty list.
  - `POST /api/user/posts/[id]/comments`
  - Auth required: yes (Member)
  - Request (JSON body):

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | body | string | yes | Trimmed, 1–2000 chars | none | `"Sending strength."` |
    | isAnonymous | boolean | no | Only `true` counts | false | `false` |

  - Response (success, 201):
    ```json
    { "ok": true, "comment": { "id": "clcmt10", "authorId": "cluser42", "authorName": "Maya R.", "authorAvatar": null,
      "body": "Sending strength.", "isAnonymous": false, "likeCount": 0, "liked": false, "myReaction": null,
      "isOwn": true, "createdAt": "2026-11-20T11:05:00.000Z" } }
    ```
  - Errors: 400 — `Body is required` / `Comment can't be empty.` / `Comment is too long (N/2000).` / `Post not available` / `Account is deactivated.` / `Account is banned.`; 404 — `Post not found`; 401.
- **Form fields:**

  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | Comment | text | yes | 1–2000 chars | inline markup |
  | Comment anonymously | switch | no | none | true/false |

- **Business rules:**
  - Only PUBLISHED comments are listed. Comments by authors the viewer blocked are hidden. The body is masked for banned words.
  - Unlike the feed, the name and avatar shown are the ones saved when the comment was posted; they are not updated to the current values.
  - `Post.commentCount` goes up by 1 in the same transaction as the insert.
  - The post author gets an in-app notification (if they are not the commenter): `POST_COMMENT`, "`<name | Someone> commented on your post`", the first 120 characters, link `/post/<id>`.
- **Edge cases / notes for the mobile app:**
  - ⚠️ **Anonymity leak:** like posts, anonymous comments still return the real `authorId` and `authorName`/`authorAvatar`. The app must hide them itself.
  - The `comment` returned by POST is **not** banned-word masked; the list endpoint does mask it.
- **Status:** ✅ Complete

## Feed → Delete own comment
- **Description:** The author permanently deletes their own post comment.
- **Who can use it:** Signed-in members, only for their own comments.
- **Source files:** `src/app/api/user/posts/comments/[id]/route.ts`, `src/lib/comments.ts` (`deleteComment`)
- **User flow:** 1. Overflow → Delete → confirm. 2. `DELETE /api/user/posts/comments/{id}`. 3. On 200, remove the comment and subtract 1 from the post's comment count. 4. 403 or 404 → show the error.
- **Suggested mobile screen(s):** Comment overflow menu → Delete confirmation.
- **API(s):**
  - `DELETE /api/user/posts/comments/[id]`
  - Auth required: yes (Member, author only)
  - Request: path `id` (comment id).
  - Response (success, 200): `{ "ok": true }`
  - Errors: 404 — `Comment not found`; 403 — `Not your comment`; 400 — other; 401.
- **Form fields:** None.
- **Business rules:** Hard delete. `Post.commentCount` goes down by 1 only if the comment was PUBLISHED.
- **Edge cases / notes for the mobile app:** None.
- **Status:** ✅ Complete

## Feed → React to comment
- **Description:** Add, change or remove one of the six reactions on a post comment.
- **Who can use it:** Signed-in members.
- **Source files:** `src/app/api/user/posts/comments/[id]/like/route.ts`, `src/lib/comments.ts` (`togglePostCommentReaction`), `src/lib/reaction-toggle.ts`
- **User flow:** 1. Tap or long-press the reaction on a comment. 2. `POST` with `{type}`. 3. Apply the response. 4. 404 if the comment is gone or not published.
- **Suggested mobile screen(s):** Small reaction button with picker on each comment row.
- **API(s):**
  - `POST /api/user/posts/comments/[id]/like`
  - Auth required: yes (Member)
  - Request (JSON body, optional): `type` — same as React to post (defaults to `LIKE`).
  - Response (success, 200). **No `ok` key**:
    ```json
    { "liked": true, "likeCount": 3, "myReaction": "CARE" }
    ```
  - Errors: 404 — `Comment not found` (missing or not PUBLISHED); 400 — other; 401.
- **Form fields:** None.
- **Business rules:** Same rule as for posts: the same type removes the reaction, a different type changes it. `likeCount` is **recounted** from the rows each time, not incremented. No notification is sent.
- **Edge cases / notes for the mobile app:** None.
- **Status:** ✅ Complete

## Feed → Report comment
- **Description:** Flag a post comment for moderators. It works the same way as reporting a post.
- **Who can use it:** Signed-in members.
- **Source files:** `src/app/api/user/posts/comments/[id]/report/route.ts`, `src/lib/posts-user.ts` (`reportPost` with `commentId`)
- **User flow:** 1. Comment overflow → Report → ReportSheet. 2. `POST`. 3. Handle `duplicate` the same way as for posts.
- **Suggested mobile screen(s):** Reuse `ReportSheet`.
- **API(s):**
  - `POST /api/user/posts/comments/[id]/report`
  - Auth required: yes (Member)
  - Request (JSON body): `reason` (required, one of the 8 values), `notes` (optional, cut to 2000 chars).
  - Response (success, 200): `{ "ok": true, "duplicate": false }`
  - Errors: 400 — `Invalid reason`; 404 — `Comment not found`; 400 — other (including `Post not found`); 401.
- **Form fields:** Same as Report post.
- **Business rules:** The report is stored with `targetType=COMMENT` and `openKey="COMMENT:<commentId>"`. `PostComment.reportCount` goes up by 1. All admins get a `POST_REPORTED` notification: "Comment reported (<reason>)" / "A comment by <name | an anonymous member> on <author>'s post was flagged."
- **Edge cases / notes for the mobile app:** The web UI never calls this endpoint (there is no Report option on comments in `comment-thread.tsx`). The API works.
- **Status:** ⚠️ Partial / Unclear (API complete, but no web UI uses it)

## Feed → Post detail (single post)
- **Description:** The permalink `/post/[id]` (the link target of `POST_LIKE`/`POST_COMMENT` notifications) shows one post and its comments. It is a server-rendered page that calls `getPost()` directly. **There is no JSON endpoint for one post.**
- **Who can use it:** Signed-in members (the page sends signed-out visitors to `/login?next=/post/<id>`).
- **Source files:** `src/app/post/[id]/page.tsx`, `src/lib/posts-feed.ts` (`getPost`), `src/components/site/post-detail.tsx`
- **User flow:** 1. The user taps a notification or a shared link. 2. The web page loads the post (404 if it is missing or not PUBLISHED). 3. Comments load through `GET /api/user/posts/{id}/comments`.
- **Suggested mobile screen(s):** `PostDetail`: a full PostCard plus the comment thread.
- **API(s):** None for the post itself. Mobile workaround: none reliable. The feed cannot fetch one post by id. A backend `GET /api/user/posts/[id]` is needed (see Gaps).
- **Form fields:** None.
- **Business rules:** `getPost` returns the same `FeedPost` shape as the feed, with banned-word masking and the current author name and avatar.
- **Edge cases / notes for the mobile app:** To deep link `/post/<id>`, the app needs the new endpoint.
- **Status:** ⚠️ Web-only (no API)

## Gratitude → List wall
- **Description:** The moderated gratitude wall. It shows APPROVED entries plus the viewer's own entries at any status, newest first, with cursor paging and an optional category filter.
- **Who can use it:** Signed-in, verified members only (both the route and the `/gratitude` page require sign-in).
- **Source files:** `src/app/api/user/gratitude/route.ts` (GET), `src/lib/gratitude.ts` (`listGratitude`), `src/lib/post-categories.ts` (`categoryIdForSlug`, `listCategoryTiles`), `src/app/gratitude/page.tsx`, `src/components/site/gratitude-client.tsx`, `src/components/site/entry-card.tsx`
- **User flow:**
  1. Open the Gratitude tab. The app calls `GET /api/user/gratitude` and, for the tabs, `GET /api/public/categories?kind=gratitude`.
  2. Tapping a category tab calls `GET /api/user/gratitude?category=<slug>`.
  3. Infinite scroll calls again with `cursor=<nextCursor>`, keeping the same `category`.
  4. The viewer's own entries show a status badge: PENDING ("Waiting for review") or REJECTED (with `rejectionReason`).
- **Suggested mobile screen(s):** `GratitudeWall`: horizontal category tabs ("Everything" plus emoji chips), a grid or list of EntryCards (body, photo or video poster, category chip, author or "Anonymous", reaction button, comment count, status badge on own entries), a FAB to compose, and Delete in the menu for own entries.
- **API(s):**
  - `GET /api/user/gratitude`
  - Auth required: yes (Member)
  - Request (query):

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | cursor | string | no | Opaque base64url of `"<ISO>|<id>"` | none | `MjAyNi0xMS0yMFQxMDowMDowMC4wMDBafGNsZ3Iz` |
    | category | string | no | Category **slug**. An unknown slug means no filter (not an error). | none | `family` |

    (`limit` is **not** read by the route. The page size is always 20.)
  - Response (success, 200):
    ```ts
    interface GratitudePage { items: GratitudeItem[]; nextCursor: string | null }
    interface GratitudeItem {
      id: string; authorId: string | null; authorName: string; authorAvatar: string | null; body: string;
      isAnonymous: boolean; heartCount: number; commentCount: number; hearted: boolean; myReaction: ReactionType | null;
      isOwn: boolean; imageUrl: string | null; video: AttachedVideo | null;
      status: "PENDING" | "APPROVED" | "REJECTED"; rejectionReason: string | null;
      category: { id: string; name: string; slug: string; emoji: string | null } | null; createdAt: string;
    }
    ```
    ```json
    { "items": [{ "id": "clgr3", "authorId": null, "authorName": "Anonymous", "authorAvatar": null,
      "body": "Grateful my sister called today.", "isAnonymous": true, "heartCount": 5, "commentCount": 1,
      "hearted": false, "myReaction": null, "isOwn": false, "imageUrl": null, "video": null, "status": "APPROVED",
      "rejectionReason": null, "category": { "id": "clcat1", "name": "Family", "slug": "family", "emoji": "👪" },
      "createdAt": "2026-11-20T10:00:00.000Z" }], "nextCursor": null }
    ```
  - Errors: 401 — not signed in; 403 — email not verified.
- **Form fields:** None.
- **Business rules:**
  - Visibility is `status = APPROVED OR authorId = viewer`. Authors the viewer blocked are hidden.
  - Anonymous entries return `authorId: null`, `authorName: "Anonymous"` and `authorAvatar: null`. This is done correctly on the server. Non-anonymous entries show the author's current name and avatar.
  - `rejectionReason` is returned only for the viewer's own entries. The body is masked for banned words.
  - Sort order is `createdAt desc, id desc`.
- **Edge cases / notes for the mobile app:** The gratitude cursor format (base64url) is different from the feed cursor. Treat both as opaque. The empty state differs between "no entries yet" and "no entries in this category".
- **Status:** ✅ Complete

## Gratitude → Create entry
- **Description:** Share something you're grateful for. It is held as PENDING until an admin approves it.
- **Who can use it:** Signed-in, verified members.
- **Source files:** `src/app/api/user/gratitude/route.ts` (POST), `src/lib/gratitude.ts` (`createGratitude`, `BODY_MAX=1000`), `src/lib/post-categories.ts` (`validCategoryId`, `hasCategories`), `src/lib/attached-media.ts`, `src/components/site/gratitude-client.tsx`, `src/components/site/photo-attach.tsx`
- **User flow:**
  1. Open the composer. Load categories from `GET /api/public/categories?kind=gratitude`.
  2. Type the text (up to 1000 characters) and choose a category (required if any exist).
  3. Optional: attach **either** a photo (`POST /api/user/upload` → `imageUrl`) **or** a video (`POST /api/user/upload/video`, then poll until READY → `videoAssetId`). Optional: turn on anonymous.
  4. The app calls `POST /api/user/gratitude`. On 201, it adds `item` to the top of the wall (status PENDING) and shows "Submitted for review".
  5. Failure: 400 with a message.
- **Suggested mobile screen(s):** `ComposeGratitude`: text area with a 1000-character counter, required category chips, a single media slot (Photo | Video, only one at a time), anonymous switch, Share button.
- **API(s):**
  - `POST /api/user/gratitude`
  - Auth required: yes (Member)
  - Request (JSON body):

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | body | string | yes | Trimmed, 1–1000 chars | none | `"Grateful for my morning walk."` |
    | categoryId | string | conditional | Required when at least one active category exists. An unknown or inactive id becomes null, which then fails with "Choose a category before sharing." | null | `"clcat1"` |
    | imageUrl | string | no | Trimmed. Cannot be combined with `videoAssetId`. **Not checked** to be an upload. | null | `"/uploads/posts/lq2-ff.webp"` |
    | videoAssetId | string | no | A READY VideoAsset you own | null | `"clvid0002"` |
    | isAnonymous | boolean | no | Only `true` counts | false | `true` |

  - Response (success, 201):
    ```json
    { "item": { "id": "clgr9", "authorId": "cluser42", "authorName": "Maya R.", "authorAvatar": null,
      "body": "Grateful for my morning walk.", "isAnonymous": false, "heartCount": 0, "commentCount": 0,
      "hearted": false, "myReaction": null, "isOwn": true, "imageUrl": null, "video": null, "status": "PENDING",
      "rejectionReason": null, "category": { "id": "clcat1", "name": "Nature", "slug": "nature", "emoji": "🌿" },
      "createdAt": "2026-11-25T08:00:00.000Z" } }
    ```
  - Errors (all 400): `Write something you're grateful for.`; `Keep it under 1000 characters.`; `Choose a category before sharing.`; `Attach a photo or a video, not both.`; `That video upload could not be found.` / `That video belongs to someone else.` / `That video is still processing — wait for it to finish.`; 401/403.
- **Form fields:**

  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | What are you grateful for? | multiline text | yes | 1–1000 chars | inline markup |
  | Category | chip select | yes if any categories exist | must be active | from /api/public/categories?kind=gratitude |
  | Photo | image | no | not with video | image types per Image upload |
  | Video | video | no | not with photo; READY | video/* |
  | Share anonymously | switch | no | none | true/false |

- **Business rules:** The new entry's status is `PENDING`. It becomes visible to others only after an admin approves it. On approve or reject, the author gets an in-app `SYSTEM` notification ("Your gratitude post was approved" / "...wasn't approved", with "Reason: …"). Admins get **no** notification about new entries; they see the pending count in the admin area. The author's name and avatar are saved on the entry at posting time.
- **Edge cases / notes for the mobile app:** Reactions and comments are refused on an entry until it is APPROVED. Hide those controls on the author's own PENDING or REJECTED entries.
- **Status:** ✅ Complete

## Gratitude → Delete own entry
- **Description:** The author permanently deletes their own entry, at any status.
- **Who can use it:** Signed-in members, only for their own entries.
- **Source files:** `src/app/api/user/gratitude/[id]/route.ts`, `src/lib/gratitude.ts` (`deleteGratitude`)
- **User flow:** 1. Menu → Delete → confirm. 2. `DELETE /api/user/gratitude/{id}`. 3. Remove the entry from the list.
- **Suggested mobile screen(s):** Entry overflow → Delete confirmation.
- **API(s):**
  - `DELETE /api/user/gratitude/[id]`
  - Auth required: yes (Member, author only)
  - Request: path `id`.
  - Response (success, 200): `{ "ok": true }`
  - Errors: 400 — `You can only delete your own entries.`; 401.
- **Form fields:** None.
- **Business rules:** Hard delete. Hearts and comments are deleted with it. The attached video asset and its files are discarded. ⚠️ The photo file is **not** deleted from disk.
- **Edge cases / notes for the mobile app:** A non-existent id returns `{ ok: true }` (not 404).
- **Status:** ✅ Complete

## Gratitude → React to entry
- **Description:** The "grateful too" reaction. The route is called `heart`, but it accepts the same six reaction types as posts. `heartCount` counts people.
- **Who can use it:** Signed-in members, on APPROVED entries only.
- **Source files:** `src/app/api/user/gratitude/[id]/heart/route.ts`, `src/lib/gratitude.ts` (`toggleHeart`), `src/lib/reaction-toggle.ts`
- **User flow:** 1. Tap (LIKE) or long-press to pick a reaction. 2. `POST` with `{type}`. 3. Apply `hearted`, `heartCount` and `myReaction` from the response.
- **Suggested mobile screen(s):** Reaction button on EntryCard and GratitudeDetail.
- **API(s):**
  - `POST /api/user/gratitude/[id]/heart`
  - Auth required: yes (Member)
  - Request (JSON body, optional): `type` (one of the 6; defaults to LIKE).
  - Response (success, 200). **Key names differ from posts, and there is no `ok`**:
    ```json
    { "hearted": true, "heartCount": 6, "myReaction": "HEART" }
    ```
  - Errors: 400 — `This entry isn't available.` (missing or not APPROVED); 401.
- **Form fields:** None.
- **Business rules:** Same type removes the reaction, a different type changes it, a new one adds it. **No notification** goes to the author.
- **Edge cases / notes for the mobile app:** A missing entry returns 400, not 404.
- **Status:** ✅ Complete

## Gratitude → Comments (list + add, one-level replies)
- **Description:** Comments on a gratitude entry, with **one level of replies**. A reply to a reply is attached to the top-level comment instead. The API returns all comments in one flat list, oldest first; the client groups replies under their parent using `parentId`.
- **Who can use it:** Anyone can read (signed-out readers too). Only signed-in members can post, and only on APPROVED entries.
- **Source files:** `src/app/api/user/gratitude/[id]/comments/route.ts`, `src/lib/gratitude-comments.ts` (`listGratitudeComments`, `addGratitudeComment`, `BODY_MAX=4000`), `src/components/site/threaded-comments.tsx`, `src/components/site/gratitude-detail-client.tsx`
- **User flow:**
  1. Open the entry detail. Call `GET /api/user/gratitude/{id}/comments`.
  2. Group the list: comments with `parentId == null` are top level, and their replies sit under them in time order.
  3. To comment, call `POST` with `body` (and `isAnonymous`). To reply, also send `parentId` (the comment's id, or the reply's id, since the server moves it to the top-level comment).
  4. On 201, add `comment` to the list and set the entry's comment count to the returned `commentCount`.
  5. Failure: 400 `This entry isn't available.` (not approved), `That comment is no longer there.` (bad parent).
- **Suggested mobile screen(s):** `GratitudeDetail`: the entry card, then a comment list with indented replies (reply button on top-level comments, reaction button, Delete if `isOwn`), and a bottom composer with an anonymous switch and a "Replying to X" chip.
- **API(s):**
  - `GET /api/user/gratitude/[id]/comments`
  - Auth required: no (optional session)
  - Request: path `id` (entry id). No query parameters.
  - Response (success, 200):
    ```ts
    interface GratitudeCommentsResponse { comments: GratitudeComment[] }
    interface GratitudeComment {
      id: string; parentId: string | null; authorId: string | null; authorName: string; authorAvatar: string | null;
      body: string; isAnonymous: boolean; likeCount: number; liked: boolean; myReaction: ReactionType | null;
      isOwn: boolean; createdAt: string;
    }
    ```
    ```json
    { "comments": [
      { "id": "clgc1", "parentId": null, "authorId": "cluser7", "authorName": "Jon", "authorAvatar": null,
        "body": "Love this!", "isAnonymous": false, "likeCount": 1, "liked": false, "myReaction": null,
        "isOwn": false, "createdAt": "2026-11-21T09:00:00.000Z" },
      { "id": "clgc2", "parentId": "clgc1", "authorId": null, "authorName": "Anonymous", "authorAvatar": null,
        "body": "Same here.", "isAnonymous": true, "likeCount": 0, "liked": false, "myReaction": null,
        "isOwn": true, "createdAt": "2026-11-21T09:10:00.000Z" } ] }
    ```
  - Errors: none. An unknown entry returns `{ comments: [] }`.
  - `POST /api/user/gratitude/[id]/comments`
  - Auth required: yes (Member)
  - Request (JSON body):

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | body | string | yes | Trimmed, 1–4000 chars | none | `"Beautiful."` |
    | isAnonymous | boolean | no | Only `true` counts | false | `false` |
    | parentId | string | no | Must be a comment on the **same** entry. If it is itself a reply, the new comment is attached to that reply's parent instead. | null | `"clgc1"` |

  - Response (success, 201):
    ```json
    { "comment": { "id": "clgc3", "parentId": "clgc1", "authorId": "cluser42", "authorName": "Maya R.",
      "authorAvatar": null, "body": "Beautiful.", "isAnonymous": false, "likeCount": 0, "liked": false,
      "myReaction": null, "isOwn": true, "createdAt": "2026-11-21T09:20:00.000Z" }, "commentCount": 3 }
    ```
  - Errors (400): `Write something first.`; `Keep it under 4000 characters.`; `This entry isn't available.`; `That comment is no longer there.`; 401/403.
- **Form fields:**

  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | Comment | text | yes | 1–4000 chars | inline markup |
  | Comment anonymously | switch | no | none | true/false |
  | (hidden) parentId | string | no | same entry | comment id |

- **Business rules:**
  - Anonymous comments return `authorId: null` and `authorName: "Anonymous"`. `isOwn` is still worked out from the real author, so people can delete their own anonymous comments.
  - The list returns at most 500 comments, with **no pagination**. Comments by blocked authors are hidden, and bodies are masked.
  - `commentCount` is recounted from the rows each time, never incremented.
  - The entry author gets an in-app `SYSTEM` notification (if they are not the commenter): "`<name | Someone> replied to your gratitude post`", the first 120 characters, link `/gratitude`.
- **Edge cases / notes for the mobile app:** The GET does not check whether the entry is approved. Comments only exist on entries that were approved at the time they were written.
- **Status:** ✅ Complete

## Gratitude → Delete own comment
- **Description:** Permanently delete your own gratitude comment. **Its replies are deleted with it.**
- **Who can use it:** Signed-in members, only for their own comments (including anonymous ones).
- **Source files:** `src/app/api/user/gratitude/comments/[commentId]/route.ts`, `src/lib/gratitude-comments.ts` (`deleteOwnGratitudeComment`)
- **User flow:** 1. Delete → confirm (warn "replies will also be removed"). 2. `DELETE`. 3. Remove the comment and its replies, and set the entry count to `commentCount`.
- **Suggested mobile screen(s):** Comment overflow → Delete confirmation.
- **API(s):**
  - `DELETE /api/user/gratitude/comments/[commentId]`
  - Auth required: yes (Member, author only)
  - Request: path `commentId`.
  - Response (success, 200): `{ "commentCount": 2 }`
  - Errors: 400 — `Comment not found` / `Not your comment` (both return **400**, not 404/403); 401.
- **Form fields:** None.
- **Business rules:** Hard delete. Replies are deleted with it. The entry's `commentCount` is recounted.
- **Edge cases / notes for the mobile app:** None.
- **Status:** ✅ Complete

## Gratitude → React to comment
- **Description:** Add, change or remove one of the six reactions on a gratitude comment or reply.
- **Who can use it:** Signed-in members.
- **Source files:** `src/app/api/user/gratitude/comments/[commentId]/like/route.ts`, `src/lib/gratitude-comments.ts` (`toggleGratitudeCommentReaction`)
- **User flow:** 1. Tap or long-press the reaction. 2. `POST {type}`. 3. Apply the response.
- **Suggested mobile screen(s):** Reaction button on each comment row.
- **API(s):**
  - `POST /api/user/gratitude/comments/[commentId]/like`
  - Auth required: yes (Member)
  - Request (JSON body, optional): `type` (defaults to LIKE).
  - Response (success, 200): `{ "liked": true, "likeCount": 2, "myReaction": "LIKE" }`
  - Errors: 404 — `Comment not found` (this message is never actually thrown); 400 — any other error, including a raw database error for an unknown comment id; 401.
- **Form fields:** None.
- **Business rules:** `likeCount` is recounted each time. No notification is sent. The server does not check that the comment or its entry is still approved or visible.
- **Edge cases / notes for the mobile app:** An unknown id gives a 400 with a technical error message. Show a generic error.
- **Status:** ✅ Complete

## Gratitude → Categories & category tiles
- **Description:** Admin-managed categories (name, slug, emoji, description, sort order, active flag) for the gratitude wall. They drive the composer picker and the tab strip on the wall. The web page also shows how many APPROVED entries each category has.
- **Who can use it:** Anyone can read the active categories. Admins manage them (admin module).
- **Source files:** `src/lib/post-categories.ts` (`listPublicCategories`, `listCategoryTiles`, `validCategoryId`, `categoryIdForSlug`, `hasCategories`), `src/app/api/public/categories/route.ts` (other module), `src/app/gratitude/page.tsx`, `src/app/gratitude/category/[slug]/page.tsx`
- **User flow:** 1. Load `GET /api/public/categories?kind=gratitude` → `{ categories: [{id,name,slug,emoji}] }` (active only, sorted by `sortOrder` then `name`, cached for 60 s). 2. Use it for the tabs and the composer. 3. The old URL `/gratitude/category/<slug>` permanently redirects to `/gratitude?category=<slug>`.
- **Suggested mobile screen(s):** Category tabs on GratitudeWall; chip picker in ComposeGratitude.
- **API(s):** None in this module's scope (the public categories endpoint is documented with public endpoints). The **per-category counts** (`listCategoryTiles`: APPROVED entries per active category, empty categories included) are only shown on the server-rendered `/gratitude` page and have **no API**.
- **Form fields:** None.
- **Business rules:** Retired (`isActive=false`) categories are not offered, but entries already filed under them keep the category. Deleting a category leaves its entries with no category. When no active category exists, entries can be posted without one.
- **Edge cases / notes for the mobile app:** If the tile counts are wanted, the backend needs to expose `listCategoryTiles`.
- **Status:** ⚠️ Partial / Unclear (the category list is available via API, but tile counts are web-only)

## Gratitude → Entry detail (single entry)
- **Description:** `/gratitude/[id]` shows one entry and its comment thread. It is server-rendered with `getGratitudeEntry()`, and **there is no JSON endpoint** for one entry.
- **Who can use it:** Signed-in members. They can see APPROVED entries, or their own entries at any status. Entries by blocked authors are hidden. Anything the viewer cannot see shows as 404.
- **Source files:** `src/app/gratitude/[id]/page.tsx`, `src/lib/gratitude.ts` (`getGratitudeEntry`), `src/components/site/gratitude-detail-client.tsx`
- **User flow:** 1. The user opens an entry from the wall. 2. The page renders the entry. 3. Comments load through `GET /api/user/gratitude/{id}/comments`.
- **Suggested mobile screen(s):** `GratitudeDetail`. On mobile it can be opened from the already-loaded wall item. A deep link needs a new `GET /api/user/gratitude/[id]`.
- **API(s):** None for the entry itself.
- **Form fields:** None.
- **Business rules:** The entry has the same `GratitudeItem` shape as in the wall list.
- **Edge cases / notes for the mobile app:** Notifications for gratitude link to `/gratitude`, not to the entry.
- **Status:** ⚠️ Web-only (no API)

## Confessions → Confession wall (removed)
- **Description:** An anonymous-first wall where every confession was held for admin approval. **The feature has been removed from the product.** The directories `src/app/confessions/`, `src/app/confessions/[id]/` and `src/app/confessions/category/[slug]/` exist but contain **no files**. There is no API route, no lib module (`confessions.ts` does not exist) and no admin screen. Only the database tables are left, and the media sweeper still reads them so the files they reference are not deleted (`src/lib/media.ts` ~line 297: "The confession wall and the page-banner system have been removed from the product… DELETE THESE TWO QUERIES IN THE SAME COMMIT that drops `Confession`"). `src/lib/post-categories.ts` also says: "The confession wall is gone."
- **Who can use it:** Nobody (no web page and no API).
- **Source files:** `prisma/schema.prisma` (models `ConfessionCategory`, `Confession`, `ConfessionSupport`, `ConfessionComment`, `ConfessionCommentReaction`, enum `ConfessionStatus`), `src/lib/media.ts` (sweeper references only), empty `src/app/confessions/**` directories. Leftover comments mentioning it: `src/components/site/entry-card.tsx`, `src/components/admin/category-manager.tsx`.
- **User flow (as the schema describes it, not currently reachable):**
  1. A member writes a confession. It is anonymous by default (`isAnonymous` default `true`), with an optional photo **or** video and an optional category.
  2. It is saved with status `PENDING`. An admin approves or rejects it (`rejectionReason`, `reviewedAt`, `reviewedBy`).
  3. On the wall, the author is shown only if `isAnonymous` is false (`authorId` is always stored for accountability).
  4. Members react ("support") once each, with any of the 6 reaction types. `supportCount` counts people.
  5. Comments are posted straight away (banned words masked), can be anonymous, and have one level of replies. Comments can have reactions.
- **Suggested mobile screen(s):** None until a backend exists. If it is restored: `ConfessionWall`, `ComposeConfession`, `ConfessionDetail`, mirroring the Gratitude screens.
- **API(s):** None.
- **Data model (for reference):**

  | Model | Fields |
  |---|---|
  | ConfessionCategory | `id`, `name` (≤60), `slug` (unique), `description?`, `emoji?` (≤8), `sortOrder` (0), `isActive` (true), `createdAt`, `updatedAt` |
  | Confession | `id`, `authorId`, `authorNameSnapshot`, `authorAvatarSnapshot?`, `body` (text), `imageUrl?`, `isAnonymous` (default **true**), `video` (JSON `{assetId,url,posterUrl,width,height,durationSec}`; photo OR video), `categoryId?` (SetNull), `status` (`PENDING`/`APPROVED`/`REJECTED`, default PENDING), `rejectionReason?`, `reviewedAt?`, `reviewedBy?`, `supportCount` (0), `commentCount` (0), `createdAt` |
  | ConfessionSupport | `id`, `confessionId`, `userId`, `type` (Reaction, default LIKE), `createdAt`; unique (`confessionId`,`userId`) |
  | ConfessionComment | `id`, `confessionId`, `authorId`, `authorNameSnapshot`, `authorAvatarSnapshot?`, `body`, `isAnonymous` (false), `likeCount` (0), `parentId?` (one level deep; replies to replies are moved to the top-level comment), `createdAt` |
  | ConfessionCommentReaction | `commentId`, `userId`, `type` (Reaction, default LIKE), `createdAt`; primary key (`commentId`,`userId`) |

- **Form fields:** None currently.
- **Business rules:** See the model notes above. These come from the schema only; no code enforces them any more.
- **Edge cases / notes for the mobile app:** Do **not** build a Confessions screen. Ask the product owner whether it is coming back (see Questions).
- **Status:** ⚠️ Web-only (no API) — and the web pages are removed too; only the DB tables remain

## Uploads → Image upload
- **Description:** Upload one image (multipart). Raster images are resized and re-encoded to WebP with a thumbnail, and GPS and other metadata are removed. Returns the public URL to use in posts (`images[].url`) or gratitude (`imageUrl`).
- **Who can use it:** Signed-in, verified members.
- **Source files:** `src/app/api/user/upload/route.ts`, `src/lib/upload.ts` (`uploadFile`, `ALLOWED_MIME`), `src/lib/image-variants.ts` (`processImage`, `FULL_MAX_EDGE=1600`, `THUMB_MAX_EDGE=480`, `MAX_INPUT_PIXELS=50_000_000`), `src/lib/upload-limits.ts` (`DEFAULT_MAX_FILE_MB=8`), `src/lib/media.ts` (`recordUpload`), `src/lib/image-urls.ts`
- **User flow:**
  1. The user picks an image. The app checks the type and size (8 MB by default).
  2. It sends `POST /api/user/upload` as multipart with the field `file`.
  3. On 200 `{ ok: true, url }`, it shows a preview and keeps the `url`.
  4. On failure (400 `{ ok: false, error }`), it shows the error. Possible reasons: unsupported type, too large, image too large in pixels.
- **Suggested mobile screen(s):** Used inside ComposePost and ComposeGratitude: thumbnail tile with a spinner, remove button and an error state.
- **API(s):**
  - `POST /api/user/upload`
  - Auth required: yes (Member)
  - Request (multipart/form-data):

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | file | File | yes | MIME must be one of `image/png`, `image/jpeg`, `image/webp`, `image/gif`, `image/svg+xml`, `image/x-icon`, `image/vnd.microsoft.icon`. Size ≤ `storage.maxFileMB` (default **8 MB**, admin can set 1–1024). Raster images up to **50 megapixels**. | none | `photo.jpg` |

  - Response (success, 200):
    ```ts
    interface ImageUploadResponse { ok: true; url: string } // or { ok: false; error: string } with 400
    ```
    ```json
    { "ok": true, "url": "/uploads/posts/lq9z3k-1a2b3c4d5e6f7a8b.webp" }
    ```
  - Errors:
    - 400 — `Request must be multipart/form-data`
    - 400 — `Missing file`
    - 400 — `{ ok:false, error:"Unsupported file type: <mime>" }`
    - 400 — `{ ok:false, error:"File larger than 8 MB limit." }` (the number is the current setting)
    - 400 — `{ ok:false, error:"That image is N megapixels — too large to process. The limit is 50." }`
    - 400 — a disk write failure message; 401/403.
- **Form fields:** `file` (image picker).
- **Business rules:**
  - Files are saved to `public/uploads/posts/<base36 time>-<16 hex>.<ext>`. If the admin set `storage.publicBaseUrl`, the URL starts with that CDN prefix.
  - PNG, JPEG and WebP are auto-rotated using EXIF, resized so the long edge is at most **1600 px** (never enlarged), and saved as WebP at quality 82. A **480 px** thumbnail (WebP, quality 72) is written next to it as `<name>-thumb.webp`, but only when the long edge is over 480 px. Metadata, including GPS, is removed.
  - GIF, SVG and ICO are stored unchanged, with no thumbnail. Files that cannot be read are also stored unchanged.
  - The size limit is checked against the **uploaded** bytes. Each file (and its thumbnail) is recorded in `UploadedFile` with the owner, so the delete paths can remove only files the owner uploaded.
- **Edge cases / notes for the mobile app:**
  - Send the correct `type` in the form part. The server decides by the MIME type, not the file extension. HEIC (`image/heic`) is **refused**, so convert iPhone photos to JPEG on the device before uploading.
  - The response does not include the thumbnail URL. Work it out yourself (see Feed → List posts notes).
  - Error responses here include `ok: false`, unlike other routes.
- **Status:** ✅ Complete

## Uploads → Video upload + limits
- **Description:** Upload one video as a **raw request body** (not multipart), streamed straight to disk. The server returns a VideoAsset `id` immediately and converts the video in the background to H.264/AAC MP4 (long edge at most 1920 px) with a poster image. A GET returns the current limits so the app can reject large files before uploading.
- **Who can use it:** Signed-in members whose email is verified.
- **Source files:** `src/app/api/user/upload/video/route.ts`, `src/lib/video-upload.ts` (`receiveVideoUpload`), `src/lib/video.ts` (`convertAsset`, `MAX_EDGE=1920`, `MAX_CONCURRENT=2`, `STAGES`), `src/lib/upload-limits.ts` (`normaliseLimits`, `DEFAULT_MAX_VIDEO_MB=512`, `DEFAULT_MAX_VIDEO_SECONDS=0`, `BODY_LIMIT_MB`), `src/components/ui/video-upload.tsx`
- **User flow:**
  1. `GET /api/user/upload/video` returns `{ maxMB, maxSeconds }`. Refuse files larger than `maxMB` on the device, and check the duration when possible.
  2. `POST /api/user/upload/video` with headers `Content-Type: <file mime>` and `x-filename: <encodeURIComponent(name)>`, and the file bytes as the body. Show upload progress.
  3. On 201 `{ ok, id }`, start polling `GET /api/user/upload/video/{id}` (see next feature).
  4. When the status is `READY`, the user can submit the post or entry with `videoAssetId = id`.
  5. Failure: 415 unsupported type, 413 too large, 400 incomplete or empty upload, 403 email not verified.
- **Suggested mobile screen(s):** `VideoUploadProgress` component: upload bar, then a conversion bar with the stage message, percent and ETA, a Cancel button (calls DELETE), and the poster preview once ready.
- **API(s):**
  - `GET /api/user/upload/video`
  - Auth required: yes (Member)
  - Response (success, 200):
    ```json
    { "maxMB": 512, "maxSeconds": 0 }
    ```
    (`maxSeconds: 0` means no length limit.)
  - `POST /api/user/upload/video`
  - Auth required: yes (Member with `emailVerifiedAt`)
  - Request (headers + raw body):

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | Content-Type (header) | string | yes | Must start with `video/`, or be `application/octet-stream` or `application/mp4` | none | `video/quicktime` |
    | x-filename (header) | string | no | URI-encoded. Decoded, CR/LF removed, max 300 chars | `video` | `IMG_0042.MOV` |
    | Content-Length (header) | int | recommended | If it is over the limit, the upload is refused before any bytes are read | none | `48211234` |
    | body | binary | yes | ≤ `maxMB` MB (default 512, capped at the build-time limit `MAX_UPLOAD_BODY_MB`, default 2048); must not be empty | none | (bytes) |

  - Response (success, 201):
    ```json
    { "ok": true, "id": "clvid0003" }
    ```
  - Errors:
    - 403 — `Verify your email address before uploading video.`
    - 415 — `Unsupported file type: <mime|unknown>`
    - 413 — `That video is larger than the <N> MB limit.`
    - 400 — `No file was sent.` / `The upload did not finish. Please try again.` / `The uploaded file was empty.`
    - 401.
- **Form fields:** Video picker (accepts `video/*`, `.mkv`, `.mov`, `.m4v`).
- **Business rules:**
  - Statuses go `UPLOADING` → `QUEUED` (bytes saved) → `PROCESSING` → `READY` | `FAILED`.
  - At most 2 conversions run at once per server process. Others stay QUEUED and are started when someone polls their status.
  - The length limit (`storage.maxVideoSeconds`, if above 0) is checked **after** upload, during the "inspect" stage. A video that is too long ends as `FAILED` with "That video is Ns long — the limit is Ms."
  - Output: `/uploads/videos/<id>.mp4` and poster `/uploads/videos/<id>.jpg` (frame at 10% of the length, at most 10 s in, width at most 1280). If conversion fails, the original file is **never** used as a fallback.
  - The route stores the asset with category `clips`.
- **Edge cases / notes for the mobile app:** Use a streaming or background upload (the server allows up to 900 s for the request, `maxDuration`). On Android, set the real MIME type; `application/octet-stream` is accepted. If the user abandons the upload, call DELETE to free the server files.
- **Status:** ✅ Complete

## Uploads → Video status polling & discard
- **Description:** Poll the conversion progress of a VideoAsset you uploaded, or discard it (deleting all its files).
- **Who can use it:** Signed-in members, for their own assets only. Anyone else gets 404.
- **Source files:** `src/app/api/user/upload/video/[id]/route.ts`, `src/lib/video-status.ts` (`readVideoStatus`, `discardVideo`), `src/lib/video.ts` (`nudge`, `isStale`, `STALE_MS=90_000`, `stageMessage`)
- **User flow:**
  1. After the upload, call `GET /api/user/upload/video/{id}` repeatedly. The web client waits **1.5 s** between polls, and **4 s** after an error.
  2. Show `message`, `percent` and `etaSeconds`.
  3. `READY` → show the poster (`posterUrl`) and enable Submit. `FAILED` → show `error` and let the user try again.
  4. Cancel or remove → `DELETE /api/user/upload/video/{id}`.
- **Suggested mobile screen(s):** Part of `VideoUploadProgress`.
- **API(s):**
  - `GET /api/user/upload/video/[id]`
  - Auth required: yes (Member, owner)
  - Response (success, 200):
    ```ts
    interface VideoStatusResponse {
      id: string; status: "UPLOADING" | "QUEUED" | "PROCESSING" | "READY" | "FAILED";
      percent: number; etaSeconds: number | null; stage: string; message: string;
      url: string | null; posterUrl: string | null; width: number | null; height: number | null;
      durationSec: number | null; error: string | null;
    }
    ```
    ```json
    { "id": "clvid0003", "status": "PROCESSING", "percent": 47, "etaSeconds": 31, "stage": "convert",
      "message": "Converting so it plays on every device…", "url": null, "posterUrl": null,
      "width": null, "height": null, "durationSec": null, "error": null }
    ```
  - Errors: 404 — `Not found` (missing or not yours); 401.
  - `DELETE /api/user/upload/video/[id]`
  - Auth required: yes (Member, owner)
  - Response: 200 `{ "ok": true }`, or 404 `{ "ok": false }`.
- **Form fields:** None.
- **Business rules:**
  - Stages and their share of the percentage: `inspect` (5%, "Checking the video…"), `convert` (80%, "Converting so it plays on every device…"), `poster` (8%, "Picking a thumbnail…"), `verify` (5%, "Making sure it plays…"), `finish` (2%, "Almost done…"), then `done`. While QUEUED the message is "Waiting for a slot…". READY gives percent 100 and "Ready". FAILED gives "Something went wrong", with the details in `error`.
  - Percent stays at 99 or below until READY.
  - Each poll also restarts work: a QUEUED asset is started, and a PROCESSING asset with no heartbeat for 90 s (for example after a server restart) is put back in the queue and restarted. **Keep polling** so queued work keeps moving.
  - FAILED messages include: "ffmpeg is not installed on this server…", "That file does not contain a video track.", "That video is Ns long — the limit is Ms.", "Could not convert this video. …", "The converted file was not usable…", "The uploaded file is missing — please upload it again."
  - DELETE removes `<id>.mp4`, `.mp4.part`, `.jpg`, `.jpg.part`, the temporary source file, and the database row.
- **Edge cases / notes for the mobile app:** Stop polling when the screen closes. Never discard an asset that is already attached to a published post; deleting the post discards it automatically.
- **Status:** ✅ Complete

## Utilities → Link preview
- **Description:** Fetches Open Graph metadata (title, description, image, site name) for a URL, used to show link cards. On the web it is only used in chat messages (`src/components/site/chat-message.tsx` → `link-preview.tsx`).
- **Who can use it:** Signed-in, verified members.
- **Source files:** `src/app/api/user/link-preview/route.ts`, `src/lib/link-preview.ts` (`fetchLinkPreview`), `src/components/site/link-preview.tsx`
- **User flow:** 1. Find the first URL in a message or post. 2. `GET /api/user/link-preview?url=<encoded>`. 3. If `preview` is not null, show a card; otherwise show nothing.
- **Suggested mobile screen(s):** `LinkPreviewCard` (image, title, description, site name). Tapping opens the browser.
- **API(s):**
  - `GET /api/user/link-preview`
  - Auth required: yes (Member)
  - Request (query):

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | url | string | yes (otherwise `{preview:null}`) | http/https only. Private, localhost and LAN hosts are refused | none | `https://example.org/story` |

  - Response (success, 200):
    ```ts
    interface LinkPreviewResponse { preview: { url: string; title?: string; description?: string; image?: string; siteName?: string } | null }
    ```
    ```json
    { "preview": { "url": "https://example.org/story", "title": "A story of recovery",
      "description": "How one town came together.", "image": "https://example.org/og.jpg", "siteName": "example.org" } }
    ```
  - Errors: 401/403 only. Any fetch problem gives `{ preview: null }`.
- **Form fields:** None.
- **Business rules:** 4.5 s timeout. Only the first 300 KB of HTML is read. User-Agent is `WorldWeCareBot/1.0 (+link-preview)`. A response that is not HTML gives `{ url }` only. `siteName` falls back to the host name without `www.`. Results are not cached.
- **Edge cases / notes for the mobile app:** Debounce requests and cache results on the device. The `image` may be a relative or a remote URL.
- **Status:** ✅ Complete

## Utilities → Translate content
- **Description:** Machine translation (Google Translate v2) of stored content, into the reader's chosen language. The client sends **references** (`kind`, `id`, `field`), never the text itself. Results are cached on the server per text version.
- **Who can use it:** Anyone. Signed-out callers are limited to **60 requests per minute per IP**. The `notification` kind only works when signed in.
- **Source files:** `src/app/api/user/translate-content/route.ts`, `src/lib/content-translate.ts` (`translateContent`, `MAX_LOOKUP=400`, `MAX_ITEMS=40`, `MAX_CHARS=20000`, `MAX_ONE=6000`), `src/lib/content-kinds.ts`, `src/lib/google-translate.ts`, `src/lib/i18n-core.ts` (`LOCALE_COOKIE="wwc-locale"`, `DEFAULT_LOCALE="en"`), `src/components/site/translated-content.tsx`
- **User flow:**
  1. The reader's language comes from the **`wwc-locale` cookie**, not from the request body.
  2. After a page of posts or comments loads, the app sends `POST /api/user/translate-content { refs: [{kind:"post", id, field:"body"}, …] }`.
  3. It replaces the text for each `values["<kind>:<id>:<field>"]` returned. Anything missing stays in the original language.
  4. 429 → back off for `retryAfter` seconds. 500 → keep showing the originals.
- **Suggested mobile screen(s):** No separate screen. Show a "Translated · Show original" toggle on PostCard, Comment and EntryCard.
- **API(s):**
  - `POST /api/user/translate-content`
  - Auth required: no (optional session; signed out is rate-limited)
  - Request (cookie `wwc-locale`, JSON body):

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | refs | array | yes | Only the first 60 are used. Bad items are skipped quietly | none | see below |
    | refs[].kind | enum | yes | One of the content kinds (this module uses `post`, `comment`, `gratitude`, `gratitudeComment`, `gratitudeCategory`) | none | `"post"` |
    | refs[].id | string | yes | non-empty | none | `"clpost001"` |
    | refs[].field | string | yes | Must be allowed for the kind (`body` for post, comment, gratitude and gratitudeComment; `name`/`description` for gratitudeCategory) | none | `"body"` |

  - Response (success, 200):
    ```ts
    interface TranslateResponse { locale: string; values: Record<string, string>; partial: boolean }
    ```
    ```json
    { "locale": "es", "values": { "post:clpost001:body": "Hoy cumplo 30 días. **Gracias** a todos." }, "partial": false }
    ```
  - Errors: 400 — `refs required`; 429 — `{ error: "Too many requests.", retryAfter: <seconds> }` (signed out only); 500 — `Could not translate.`, or a message saying the `content_translations` table is missing.
- **Form fields:** None.
- **Business rules:**
  - If the locale is `en` or not enabled, the response has an empty `values`.
  - Only readable rows are translated: `post` and `comment` must be PUBLISHED and `gratitude` must be APPROVED (`gratitudeComment` is not filtered).
  - Limits per request: at most 400 references are looked up, and at most 40 items and 20,000 characters are sent to Google for texts not already cached. A single text over 6000 characters is never translated. When any limit is hit, `partial: true`, and the next request picks up the rest.
  - Translations are cached in the `content_translations` table, keyed by kind, id, field and locale, with a hash of the source text, so an edited text is translated again.
  - The Google API key comes from the setting `translation.googleApiKey` or the env var `GOOGLE_TRANSLATE_API_KEY`. If neither is set, the response is `partial: true` with nothing translated.
- **Edge cases / notes for the mobile app:** The mobile app must set the `wwc-locale` cookie to choose the target language (there is no body or header option). Make one request per page of content.
- **Status:** ✅ Complete

## Reference: reaction types & report reasons

**Reactions** (`src/lib/reactions.ts`, Prisma enum `Reaction`). Shown in this order in the picker. Used on posts, post comments, gratitude entries and gratitude comments:

| type | emoji | label | notification verb |
|---|---|---|---|
| LIKE | 👍 | Like | liked |
| HEART | ❤️ | Love | loved |
| CARE | 🤗 | Sending love | sent love on |
| STRENGTH | 💪 | You've got this | is rooting for you on |
| PROUD | 🌟 | Proud of you | is proud of |
| SAME | 🙋 | Same here | said "same here" on |

How a tap works (`src/lib/reaction-toggle.ts`): if the person has no reaction, one is **added** (count +1, and for posts only, the author is notified). If they send a different type, it is **changed** (count unchanged, no notification). If they send the type they already have, it is **removed** (count −1). An unknown or missing `type` is treated as `LIKE`. Each person has one reaction per item. There is no API that lists who reacted or counts per type.

**Report reasons** (`src/lib/report-reasons.ts`, Prisma enum `ReportReason`):

| value | label | hint |
|---|---|---|
| SPAM | Spam | Ads, scams, off-topic promotion. |
| HARASSMENT | Harassment | Targeting someone with hostility. |
| HATE_SPEECH | Hate speech | Attacking people for who they are. |
| SELF_HARM | Self-harm | Encourages or celebrates hurting oneself. |
| ADULT_CONTENT | Adult content | Explicit material. |
| MISINFORMATION | Misinformation | False or misleading claim. |
| OFF_TOPIC | Off-topic | Doesn't belong on this wall. |
| OTHER | Other | Something else. |

Report statuses (moderator side): `OPEN` → `RESOLVED` | `DISMISSED`. Gratitude entries and comments have **no** report endpoint.
