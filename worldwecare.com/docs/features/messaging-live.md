# Chat Rooms, Direct Messages & Live Streaming

## Module overview

This module covers the three real-time social features of WorldWeCare:

1. **Chat rooms**: themed group rooms in four tiers (`PUBLIC`, `SUPPORT`, `CRISIS`, `CAVALRY`). Rooms have optional categories and a country scope. They support membership, per-room moderators, slow mode, replies, image attachments, @mentions, anonymous posting, curated emoji reactions, pinned messages, reports, a crisis "panic" button and unread counts. Live updates arrive over Server-Sent Events (SSE).
2. **Direct messages (DMs)**: 1:1 threads. A first message from someone the recipient does not follow goes into a "requests" box. DMs also have seen receipts, typing indicators, unread counts, soft delete and an SSE stream.
3. **Live streaming**: any permitted member can broadcast from the browser. The browser publishes over **WebRTC WHIP** to a self-hosted **MediaMTX** media server. Viewers watch over **HLS** (`index.m3u8`). The module also covers categories, PUBLIC/UNLISTED visibility, a live chat with its own SSE stream, server-counted viewers, optional recording, and a server-to-server auth hook (`/api/mediamtx/auth`) that MediaMTX calls before every publish and read.

All routes are Next.js App Router handlers. Auth uses the HMAC-signed `wwc-user-session` cookie. `requireUser` (`src/lib/user-auth.ts`) returns `401 { "error": "Unauthorized" }` when there is no valid session. Live routes that use `getCurrentUser()` return `401 { "error": "Sign in to watch." }` or `{ "error": "Unauthorized" }`. Middleware returns 403 `{ error: "Confirm your email address first.", needsVerification: true }` to unverified members. All timestamps are ISO 8601 UTC strings. Message bodies are masked with the admin banned-word list at read time (`src/lib/banned-words.ts`, `getMasker`). The author's own view is masked too.

> **React Native note (applies to every SSE stream in this module).** React Native has **no built-in `EventSource`**. Use one of these:
> - `react-native-sse`, which accepts custom headers so you can send `Cookie: wwc-user-session=…`.
> - `expo/fetch`, whose streaming body can be parsed by hand: split on blank lines, read the `event:` and `data:` lines, and ignore lines that start with `:` (heartbeats).
> - Polling. This works for chat (`GET …/messages?after=`) and live comments (`GET …/comments?after=`). DMs have **no** "newer than" endpoint, so a DM fallback has to re-fetch the newest page of the thread.
>
> The streams never send `id:` lines, so `Last-Event-ID` resume does not work. On reconnect, pass `?after=<last cursor>` yourself and de-duplicate by `id`. Close streams when the app goes to the background, because each open stream keeps a server-side timer polling the database. The servers send a `: ping` comment roughly every 20 s while idle.

## Table of contents

**Chat rooms**
- [Chat Rooms → Browse rooms](#chat-rooms--browse-rooms)
- [Chat Rooms → Room detail & permissions](#chat-rooms--room-detail--permissions)
- [Chat Rooms → Join / leave room](#chat-rooms--join--leave-room)
- [Chat Rooms → Members roster](#chat-rooms--members-roster)
- [Chat Rooms → List messages](#chat-rooms--list-messages)
- [Chat Rooms → Send message](#chat-rooms--send-message)
- [Chat Rooms → Edit / report / moderate message](#chat-rooms--edit--report--moderate-message)
- [Chat Rooms → Delete own message](#chat-rooms--delete-own-message)
- [Chat Rooms → Reactions](#chat-rooms--reactions)
- [Chat Rooms → Panic / crisis alert](#chat-rooms--panic--crisis-alert)
- [Chat Rooms → Read markers & unread](#chat-rooms--read-markers--unread)
- [Chat Rooms → Real-time stream (SSE)](#chat-rooms--real-time-stream-sse)

**Direct messages**
- [Direct Messages → Inbox & requests list](#direct-messages--inbox--requests-list)
- [Direct Messages → Unread counts](#direct-messages--unread-counts)
- [Direct Messages → Thread & send](#direct-messages--thread--send)
- [Direct Messages → Accept / decline request](#direct-messages--accept--decline-request)
- [Direct Messages → Read receipts](#direct-messages--read-receipts)
- [Direct Messages → Typing indicator](#direct-messages--typing-indicator)
- [Direct Messages → Delete message](#direct-messages--delete-message)
- [Direct Messages → Real-time stream (SSE)](#direct-messages--real-time-stream-sse)

**Live streaming**
- [Live Streaming → How broadcasting works (MediaMTX, WHIP, HLS, recording)](#live-streaming--how-broadcasting-works-mediamtx-whip-hls-recording)
- [Live Streaming → Browse live now](#live-streaming--browse-live-now)
- [Live Streaming → Categories](#live-streaming--categories)
- [Live Streaming → Create stream](#live-streaming--create-stream)
- [Live Streaming → My streams](#live-streaming--my-streams)
- [Live Streaming → Watch stream](#live-streaming--watch-stream)
- [Live Streaming → Start broadcast (publish grant)](#live-streaming--start-broadcast-publish-grant)
- [Live Streaming → Confirm go-live](#live-streaming--confirm-go-live)
- [Live Streaming → Recording toggle](#live-streaming--recording-toggle)
- [Live Streaming → End broadcast](#live-streaming--end-broadcast)
- [Live Streaming → Viewer count](#live-streaming--viewer-count)
- [Live Streaming → Chat comments](#live-streaming--chat-comments)
- [Live Streaming → Remove comment](#live-streaming--remove-comment)
- [Live Streaming → Comments stream (SSE)](#live-streaming--comments-stream-sse)
- [Live Streaming → MediaMTX auth hook](#live-streaming--mediamtx-auth-hook)

## Endpoints in this module

| Method | Path | Feature | Auth |
|---|---|---|---|
| GET | `/api/user/chatrooms` | Chat: Browse rooms | Member |
| GET | `/api/user/chatrooms/[slug]` | Chat: Room detail & permissions | Member |
| POST | `/api/user/chatrooms/[slug]/join` | Chat: Join / leave room | Member |
| POST | `/api/user/chatrooms/[slug]/leave` | Chat: Join / leave room | Member |
| GET | `/api/user/chatrooms/[slug]/members` | Chat: Members roster | Member (room readable) |
| GET | `/api/user/chatrooms/[slug]/messages` | Chat: List messages | Member (room readable) |
| POST | `/api/user/chatrooms/[slug]/messages` | Chat: Send message | Member |
| PATCH | `/api/user/chatrooms/[slug]/messages/[id]` | Chat: Edit / report / moderate message | Member (author / anyone / room MODERATOR) |
| DELETE | `/api/user/chatrooms/[slug]/messages/[id]` | Chat: Delete own message | Member (author) |
| POST | `/api/user/chatrooms/[slug]/messages/[id]/react` | Chat: Reactions | Member |
| POST | `/api/user/chatrooms/[slug]/panic` | Chat: Panic / crisis alert | Member |
| POST | `/api/user/chatrooms/[slug]/read` | Chat: Read markers & unread | Member |
| GET | `/api/user/chatrooms/[slug]/stream` | Chat: Real-time stream (SSE) | Member (room readable) |
| GET | `/api/user/messages` | DM: Inbox & requests list | Member |
| GET | `/api/user/messages/unread` | DM: Unread counts | Member |
| GET | `/api/user/messages/thread/[userId]` | DM: Thread & send | Member |
| POST | `/api/user/messages/thread/[userId]` | DM: Thread & send | Member |
| POST | `/api/user/messages/conversations/[id]/accept` | DM: Accept / decline request | Member (participant) |
| POST | `/api/user/messages/conversations/[id]/decline` | DM: Accept / decline request | Member (participant) |
| POST | `/api/user/messages/conversations/[id]/read` | DM: Read receipts | Member (participant) |
| POST | `/api/user/messages/conversations/[id]/typing` | DM: Typing indicator | Member (participant) |
| GET | `/api/user/messages/conversations/[id]/stream` | DM: Real-time stream (SSE) | Member (participant) |
| DELETE | `/api/user/messages/messages/[id]` | DM: Delete message | Member (sender) |
| GET | `/api/user/live` | Live: Browse live now | Optional |
| POST | `/api/user/live` | Live: Create stream | Member (+ canStream) |
| GET | `/api/user/live/categories` | Live: Categories | Public |
| GET | `/api/user/live/mine` | Live: My streams | Member |
| GET | `/api/user/live/[slug]` | Live: Watch stream | Member |
| POST | `/api/user/live/[slug]/start` | Live: Start broadcast (publish grant) | Member (owner) |
| POST | `/api/user/live/[slug]/live` | Live: Confirm go-live | Member (owner) |
| POST | `/api/user/live/[slug]/recording` | Live: Recording toggle | Member (owner) |
| POST | `/api/user/live/[slug]/end` | Live: End broadcast | Member (owner) |
| GET | `/api/user/live/[slug]/viewers` | Live: Viewer count | Member |
| GET | `/api/user/live/[slug]/comments` | Live: Chat comments | Member |
| POST | `/api/user/live/[slug]/comments` | Live: Chat comments | Member |
| DELETE | `/api/user/live/[slug]/comments/[id]` | Live: Remove comment | Member (author / broadcaster) |
| GET | `/api/user/live/[slug]/comments/stream` | Live: Comments stream (SSE) | Member |
| POST | `/api/mediamtx/auth` | Live: MediaMTX auth hook | MediaMTX (server-to-server, IP allowlist) |
| GET | `/api/mediamtx/auth` | Live: MediaMTX auth hook | none (always 401) |

---

## Chat Rooms → Browse rooms
- **Description:** Lists every `ACTIVE` chat room. Each row carries the viewer's membership state and an unread count for rooms the viewer has joined. Rooms are created by admins (see the admin chat module). Some rooms are auto-created for events and places (`eventId` and `placeId` on the model).
- **Who can use it:** Any signed-in, verified member.
- **Source files:** `src/app/api/user/chatrooms/route.ts`, `src/lib/chat-user.ts` (`listRoomsForUser`), `src/app/chatrooms/page.tsx`, `src/components/site/chat-browse.tsx`, `prisma/schema.prisma` (`ChatRoom`, `ChatTier`, `ChatCategory`).
- **User flow:**
  1. The member opens the Chatrooms tab. The web version redirects to `/login?next=/chatrooms` when signed out.
  2. The app calls `GET /api/user/chatrooms`, optionally with `?countryId=`.
  3. Rooms are shown grouped by `categoryName`, ordered by `categorySort`. Each card shows the emoji, colour, tier badge, member and message counts, a "Joined" state and an unread badge.
  4. Tapping a room opens the Chat Room screen.
  5. Failure: 401 means the session expired, so send the member to Login.
- **Suggested mobile screen(s):** `ChatRoomList`: search/filter header, category section list, room card (emoji avatar on `color`, name, description, tier chip, `memberCount`, unread badge), pull-to-refresh.
- **API(s):**
  - `GET /api/user/chatrooms`
  - Auth required: yes (member)
  - Request:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | `countryId` (query) | string | no | If set, returns global rooms (`countryId = null`) plus rooms for this country. Empty string is ignored. | all rooms | `ckcountry123` |

  - Response (success) 200:
    ```ts
    interface ChatListRoomsResponse { rooms: ChatRoomSummary[] }
    interface ChatRoomSummary {
      id: string; slug: string; name: string; description: string | null;
      tier: "PUBLIC" | "SUPPORT" | "CRISIS" | "CAVALRY";
      emoji: string | null; color: string | null;
      categoryId: string | null; categoryName: string | null; categorySort: number; // 9999 if none
      memberCount: number; messageCount: number;
      membership: "PENDING" | "ACTIVE" | "BANNED" | null;
      isMember: boolean;   // membership === "ACTIVE"
      unread: number;      // 0 unless ACTIVE member with lastReadAt
    }
    ```
    ```json
    { "rooms": [ { "id": "clr1", "slug": "anxiety-support", "name": "Anxiety Support", "description": "A gentle space.", "tier": "SUPPORT", "emoji": "🌿", "color": "#3b82f6", "categoryId": "clc1", "categoryName": "Wellbeing", "categorySort": 1, "memberCount": 412, "messageCount": 9810, "membership": "ACTIVE", "isMember": true, "unread": 3 } ] }
    ```
  - Errors: 401 `Unauthorized` (no session). 403 `needsVerification` (unverified).
- **Form fields:** none.
- **Business rules:**
  - Sort order: `isFeatured desc`, then `sortOrder asc`, then `name asc`.
  - `unread` counts `PUBLISHED` messages from other people created after the membership's `lastReadAt`. It is only computed for `ACTIVE` memberships that have a `lastReadAt`.
  - ARCHIVED rooms are not listed.
- **Edge cases / notes for the mobile app:** There is no pagination; all active rooms come back at once. The unread counts run one query per joined room, so avoid aggressive polling (the web page loads this once). An empty list should show "No rooms yet".
- **Status:** ✅ Complete

## Chat Rooms → Room detail & permissions
- **Description:** Returns one room's metadata and the viewer's permission flags. These flags drive the whole room UI: whether to show a Join button, a locked state or the composer, and whether the moderator tools are visible. It also returns up to 3 pinned messages.
- **Who can use it:** Any verified member. Any room can be looked up by slug, but message access depends on `canRead`.
- **Source files:** `src/app/api/user/chatrooms/[slug]/route.ts`, `src/lib/chat-user.ts` (`getRoomForUser`), `src/app/chatrooms/[slug]/page.tsx`, `src/components/site/chat-room.tsx`.
- **User flow:**
  1. The member opens a room. The app calls `GET /api/user/chatrooms/{slug}`.
  2. If `canRead` is false (a non-PUBLIC room and the member is not an ACTIVE member), show the rules, the description and a **Join** button.
  3. If `banned` is true, show "You can't post in this room" and hide Join.
  4. If `canPost` is true, show the composer. If `allowAnonymous` is true, show an "Post anonymously" toggle. If `slowModeSeconds` is above 0, show the slow-mode hint.
  5. If `isModerator` is true, enable the moderator actions in the message menu.
  6. Failure: 404 `Room not found`.
- **Suggested mobile screen(s):** `ChatRoom` header: name, emoji, tier chip, member count (tap opens the roster), overflow menu (Leave, Rules, Crisis help), pinned bar (carousel of up to 3).
- **API(s):**
  - `GET /api/user/chatrooms/[slug]`
  - Auth required: yes (member)
  - Request:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | `slug` (path) | string | yes | room slug | — | `anxiety-support` |

  - Response (success) 200:
    ```ts
    interface ChatRoomDetailResponse { room: ChatRoomDetail }
    interface ChatRoomDetail {
      id: string; slug: string; name: string; description: string | null; rulesText: string | null;
      tier: "PUBLIC" | "SUPPORT" | "CRISIS" | "CAVALRY"; status: "ACTIVE" | "ARCHIVED";
      emoji: string | null; color: string | null; allowAnonymous: boolean; slowModeSeconds: number;
      categoryName: string | null; memberCount: number; messageCount: number;
      membershipStatus: "PENDING" | "ACTIVE" | "BANNED" | null; firstPostApproved: boolean;
      isMember: boolean; isModerator: boolean; banned: boolean; canRead: boolean; canPost: boolean;
      pinned: { id: string; authorName: string; body: string }[]; // max 3, newest first; masked
    }
    ```
    ```json
    { "room": { "id": "clr1", "slug": "anxiety-support", "name": "Anxiety Support", "description": "A gentle space.", "rulesText": "Be kind. No medical advice.", "tier": "SUPPORT", "status": "ACTIVE", "emoji": "🌿", "color": "#3b82f6", "allowAnonymous": true, "slowModeSeconds": 10, "categoryName": "Wellbeing", "memberCount": 412, "messageCount": 9810, "membershipStatus": "ACTIVE", "firstPostApproved": false, "isMember": true, "isModerator": false, "banned": false, "canRead": true, "canPost": true, "pinned": [ { "id": "clm9", "authorName": "Anonymous member", "body": "Welcome! Read the rules first." } ] }
    }
    ```
  - Errors: 404 `Room not found`. 401 / 403 auth.
- **Form fields:** none.
- **Business rules:**
  - `isMember` is true when membership status is `ACTIVE`.
  - `banned` is true when status is `BANNED`.
  - `isModerator` is true when `isMember` is true and role is `MODERATOR`.
  - `canRead` is true for `PUBLIC` rooms. For any other tier it requires `isMember`.
  - `canPost` is true when the room is `ACTIVE`, the viewer is not banned, and the room is `PUBLIC` or the viewer is a member.
  - Pinned messages are only returned when `canRead` is true. Anonymous authors show as "Anonymous member".
  - **Room tiers:**
    - `PUBLIC`: anyone signed in can read and post. Membership is auto-created on first post.
    - `SUPPORT`, `CRISIS`, `CAVALRY`: members must join to read or post.
- **Edge cases / notes for the mobile app:** ARCHIVED rooms can still be fetched by slug, but `canPost` is false and join/post return `This room is archived.` Moderator roles (per-room `MODERATOR`) are assigned by admins. No member API in this module changes roles.
- **Status:** ✅ Complete

## Chat Rooms → Join / leave room
- **Description:** Join creates an `ACTIVE` membership. Leave deletes the membership row.
- **Who can use it:** Any verified member. Members `BANNED` in that room cannot join.
- **Source files:** `src/app/api/user/chatrooms/[slug]/join/route.ts`, `.../leave/route.ts`, `src/lib/chat-user.ts` (`joinRoom`, `leaveRoom`).
- **User flow:**
  1. The member taps **Join**, which calls `POST …/join`. On success, refetch the room detail (`canRead` becomes true) and load messages.
  2. Failure: 400 `You can't join this room.` (banned) or `This room is archived.`. 404 `Room not found`.
  3. The member taps **Leave** (with a confirm prompt), which calls `POST …/leave`. Go back to the room list.
- **Suggested mobile screen(s):** Join CTA on a locked `ChatRoom`. "Leave room" in the overflow menu with a confirm dialog.
- **API(s):**
  - `POST /api/user/chatrooms/[slug]/join`. Auth: member. No body.
    - 200: `{ "ok": true, "joined": true }`
    - Errors: 404 `Room not found`. 400 `This room is archived.`, `You can't join this room.`
  - `POST /api/user/chatrooms/[slug]/leave`. Auth: member. No body.
    - 200: `{ "ok": true, "left": true }`
    - Errors: 404 `Room not found`.
- **Form fields:** none.
- **Business rules:**
  - Join is idempotent: an existing non-banned membership just returns `joined: true` unchanged, even if its status is `PENDING`.
  - A new membership is created with status `ACTIVE`, `firstPostApproved = (tier === PUBLIC)` and `lastReadAt = now`. It also increments `memberCount`.
  - Leave deletes the membership. It decrements `memberCount` only if the status was `ACTIVE`. Leaving with no membership still returns `left: true`.
  - ⚠️ Leaving as a `BANNED` member deletes the ban row, so the member can then join again. This looks unintended; it follows from `leaveRoom` deleting any membership row.
  - Membership statuses: `PENDING` (defined but never produced by member APIs), `ACTIVE`, `BANNED` (set by admins).
- **Edge cases / notes for the mobile app:** There is no approval step when joining. `PENDING` exists in the enum but `joinRoom` never creates it.
- **Status:** ⚠️ Partial / Unclear. The PENDING status and the per-tier approval described in the code comments are not implemented, and leaving clears a ban.

## Chat Rooms → Members roster
- **Description:** The "Who's here" list of `ACTIVE` members in a room.
- **Who can use it:** Verified members who can read the room (`canRead`).
- **Source files:** `src/app/api/user/chatrooms/[slug]/members/route.ts`, `src/lib/chat-user.ts` (`listRoomMembers`), `src/components/site/chat-room.tsx` (members panel).
- **User flow:** The member taps the member count, which calls `GET …/members`. The list shows moderators first. Failure: 403 `Locked` (`locked: true`), meaning the member must join first. 404 means the room is not found.
- **Suggested mobile screen(s):** `ChatMembersSheet`: bottom sheet list with avatar, name and a "Moderator" badge. Tapping a row opens the profile or "Message" (DM).
- **API(s):**
  - `GET /api/user/chatrooms/[slug]/members`. Auth: member.
  - Response 200:
    ```ts
    interface ChatMembersResponse { members: { userId: string; userName: string; userAvatar: string | null; role: "MEMBER" | "MODERATOR" }[] }
    ```
    ```json
    { "members": [ { "userId": "u1", "userName": "Asha", "userAvatar": "/uploads/avatars/a.jpg", "role": "MODERATOR" }, { "userId": "u2", "userName": "Ben", "userAvatar": null, "role": "MEMBER" } ] }
    ```
  - Errors: 404 `Room not found`. 403 `{ "error": "Locked", "locked": true }`.
- **Form fields:** none.
- **Business rules:**
  - Results are ordered by `role asc` (enum order, so `MEMBER` sorts before `MODERATOR` in MySQL). Despite the "moderators first" intent, sort client-side to put moderators on top. Then by `joinedAt asc`.
  - At most 200 rows. `userName` and `userAvatar` are the snapshot taken when the member joined.
- **Edge cases / notes for the mobile app:** There is no pagination beyond 200. Names may be stale (snapshot). For PUBLIC rooms, members who only read (never posted or joined) are not listed.
- **Status:** ✅ Complete

## Chat Rooms → List messages
- **Description:** Keyset-paginated message history for a room. It has two modes: **older pages** (`before`) for scroll-back, and **newer than** (`after`) for catch-up or polling.
- **Who can use it:** Verified members who can read the room.
- **Source files:** `src/app/api/user/chatrooms/[slug]/messages/route.ts` (GET), `src/lib/chat-user.ts` (`listMessages`, `mapMessage`), `src/lib/cursor.ts`, `src/lib/blocks.ts` (`getBlockedIds`), `src/lib/chat-grouping.ts` (client-side grouping).
- **User flow:**
  1. When the room opens, call `GET …/messages?limit=30`. Render `items` (oldest first) and scroll to the bottom.
  2. Remember the last item's cursor, `"<createdAt>|<id>"`, for the SSE stream (or for `?after=` polling).
  3. When the member scrolls to the top and `hasMoreBefore` is true, call `GET …/messages?before=<beforeCursor>&limit=30` and prepend the results.
  4. After the initial load, call `POST …/read`.
  5. Failure: 403 `{ error: "Join this room to read messages", locked: true }`, so show the Join CTA. 404 means the room is not found.
- **Suggested mobile screen(s):** `ChatRoom` message list: an inverted FlatList with day dividers, grouped turns (see Business rules), reply preview, image grid, reaction pills, "edited" tag, "pending" tag, pinned icon.
- **API(s):**
  - `GET /api/user/chatrooms/[slug]/messages`
  - Auth required: yes (member, `canRead`)
  - Request:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | `before` (query) | string cursor | no | `"<ISO>|<id>"`. A bare ISO also works (legacy). Returns messages strictly older. | — | `2026-11-20T10:00:00.000Z|clm5` |
    | `after` (query) | string cursor | no | Same format. Takes priority over `before`. Returns up to **100** newer messages, oldest first. `limit` is ignored. | — | `2026-11-20T10:00:00.000Z|clm5` |
    | `limit` (query) | int | no | Clamped to 10..50 | 30 | `30` |

  - Response (success) 200:
    ```ts
    interface ChatListMessagesResponse {
      items: ChatMessage[];          // always oldest → newest
      hasMoreBefore: boolean;        // false in `after` mode
      beforeCursor: string | null;   // pass as ?before= for the next older page
      afterCursor: string | null;    // only in `after` mode: resume point for next poll
    }
    interface ChatMessage {
      id: string; authorId: string | null; authorName: string; authorAvatar: string | null;
      body: string; isAnonymous: boolean; isPinned: boolean; isOwn: boolean; pending: boolean; edited: boolean;
      createdAt: string;
      replyTo: { id: string; authorName: string; body: string } | null;
      reactions: { emoji: string; count: number; mine: boolean }[]; // sorted by count desc
      attachments: { url: string; alt?: string | null }[];
    }
    ```
    ```json
    { "items": [ { "id": "clm6", "authorId": "u2", "authorName": "Ben", "authorAvatar": null, "body": "Morning all 🌞", "isAnonymous": false, "isPinned": false, "isOwn": false, "pending": false, "edited": false, "createdAt": "2026-11-20T10:01:02.123Z", "replyTo": null, "reactions": [ { "emoji": "❤️", "count": 2, "mine": true } ], "attachments": [] } ], "hasMoreBefore": true, "beforeCursor": "2026-11-20T10:01:02.123Z|clm6", "afterCursor": null }
    ```
  - Errors: 404 `Room not found`. 403 `Join this room to read messages` (`locked: true`).
- **Form fields:** none.
- **Business rules:**
  - Visibility:
    - `PUBLISHED` messages are visible to everyone who can read the room.
    - The viewer also sees their own `PENDING` messages.
    - `REMOVED` messages are hidden.
    - Messages from users the viewer has blocked (one-directional, `UserBlock.blockerId = viewer`) are excluded.
  - Bodies, including the reply preview body, are banned-word masked.
  - `authorName` and `authorAvatar` are snapshots taken at send time.
  - ⚠️ For anonymous messages the API **still returns the real `authorId`, `authorName` and avatar**; `isAnonymous: true` is only a display flag. The web client hides them, and `chat-grouping.ts` assumes `authorId` is masked. The mobile app **must** render anonymous messages as "Anonymous member" with no avatar and no profile link. This is a privacy gap: the API should null these fields.
  - Reply previews of anonymous parents show `authorName: "Anonymous member"`.
  - Ordering uses `(createdAt, id)` keyset cursors (`src/lib/cursor.ts`), so messages that share a millisecond are never skipped.
  - **Client-side grouping** (`src/lib/chat-grouping.ts`, port this to mobile):
    - Messages from the same author within `GROUP_WINDOW_MS` = **5 minutes** on the same local day form one "turn". Show the name and avatar once at the top of the turn and the time once at the end.
    - Show a day divider at each new calendar day.
    - Anonymous messages never group.
    - A reply always starts a new turn.
- **Edge cases / notes for the mobile app:** Use `beforeCursor` exactly as returned. Do not build cursors from timestamps alone. The `after` cursor for your SSE or poll is the last item's `` `${createdAt}|${id}` ``, or `afterCursor` from an `after`-mode response. When the room has no messages, show the empty state "Say hello 👋". Edits, removals and reaction changes are **not** delivered by the stream, so refetch the visible page occasionally (for example on app focus).
- **Status:** ✅ Complete

## Chat Rooms → Send message
- **Description:** Posts a text and/or image message. Supports replies, @mentions, anonymous mode (where the room allows it) and slow mode.
- **Who can use it:** In `PUBLIC` rooms, any verified member who is not banned (posting auto-joins them). In other tiers, only `ACTIVE` members.
- **Source files:** `src/app/api/user/chatrooms/[slug]/messages/route.ts` (POST), `src/lib/chat-user.ts` (`postMessage`, `CHAT_BODY_MAX`), `src/lib/notifications.ts`, `src/components/site/chat-room.tsx` (composer, upload via `/api/user/upload`).
- **User flow:**
  1. The member types a message (max 2000 characters; the web shows a remaining counter). They can attach up to 4 images: each is uploaded first with `POST /api/user/upload` (multipart, field `file`), which returns `{ url }`. They can tap **Reply** on a message (sets `replyToId`) and toggle **Anonymous** if `room.allowAnonymous` is true.
  2. Optional @mention picker: the user ids are taken from the roster.
  3. Send calls `POST …/messages`. On 201, append `message` (de-duplicated by id, because the SSE stream will also deliver it), clear the composer and call `POST …/read`.
  4. Failure: 400 with a message such as slow mode (`Slow mode is on — wait 7s before posting again.`), so show it inline and optionally run a countdown from the number in the text or from `room.slowModeSeconds`.
- **Suggested mobile screen(s):** `ChatRoom` composer: multiline input (auto-grow), image picker (max 4 thumbnails), reply chip with cancel, anonymous switch, send button, slow-mode countdown, @mention autocomplete.
- **API(s):**
  - `POST /api/user/chatrooms/[slug]/messages`
  - Auth required: yes (member)
  - Request body (JSON):

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | `body` | string | **yes** (must be a string; may be `""` if attachments exist) | Trimmed. Max 2000 chars. Empty body with no attachments is rejected. | — | `"Thanks everyone 🙏"` |
    | `isAnonymous` | boolean | no | Only honoured if `room.allowAnonymous` | `false` | `true` |
    | `replyToId` | string | no | Silently ignored unless the parent is a PUBLISHED message in the same room | — | `clm6` |
    | `attachments` | `{url:string, alt?:string}[]` | no | Items without a string `url` are dropped. Max 4 kept. | `[]` | `[{"url":"/uploads/posts/2026/11/a.jpg"}]` |
    | `mentions` | string[] | no | User ids. Only ACTIVE members of this room are notified. | `[]` | `["u2"]` |

  - Response 201:
    ```ts
    interface ChatPostMessageResponse { ok: true; message: ChatMessage; pending: boolean }
    ```
    ```json
    { "ok": true, "message": { "id": "clm7", "authorId": "u1", "authorName": "Asha", "authorAvatar": null, "body": "Thanks everyone 🙏", "isAnonymous": false, "isPinned": false, "isOwn": true, "pending": false, "edited": false, "createdAt": "2026-11-20T10:05:00.000Z", "replyTo": null, "reactions": [], "attachments": [] }, "pending": false }
    ```
  - Errors (all 400 unless noted):
    - `Message is required`: `body` is not a string.
    - `Message can't be empty.`
    - `Message is too long (2105/2000).`
    - 404 `Room not found`.
    - `This room is archived.`
    - `You can't post in this room.`: banned.
    - `Slow mode is on — wait Ns before posting again.`
    - `Join this room to post.`: non-PUBLIC room and not an ACTIVE member.
- **Form fields:**

  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | Message | multiline text | yes, unless images are attached | ≤ 2000 chars after trim | any |
  | Images | image picker | no | ≤ 4. Type and size limits come from `/api/user/upload` (admin storage settings). | images |
  | Post anonymously | switch | no | Shown only if `allowAnonymous` | on/off |
  | Reply to | hidden | no | — | message id |

- **Business rules:**
  - **Slow mode:** if `room.slowModeSeconds > 0`, a member must wait that many seconds since their `membership.lastPostAt`. Room moderators (`ACTIVE` + `MODERATOR`) are exempt.
  - **PUBLIC auto-join:** posting without a membership creates an `ACTIVE` membership with `firstPostApproved = true` and increments `memberCount`.
  - **Side effects:** updates `membership.lastPostAt` and increments `room.messageCount`.
  - **Notifications** (in-app only, best-effort). `senderLabel` is "Someone" when anonymous:
    - Reply to another person's message: that person gets `CHAT_REPLY` with title "`<name>` replied to you", body = first 120 chars (or "Sent an image"), `actionUrl /chatrooms/<slug>`.
    - Mentions: deduplicated ids, excluding the sender and the reply parent's author, and only ACTIVE room members. They get `CHAT_MENTION` "`<name>` mentioned you in `<room>`".
  - ⚠️ **Moderation queue not active:** the response field `pending` and status `PENDING` exist, but `postMessage` always publishes immediately (`pending` is hard-coded `false`, with the comment "Messages post immediately (no first-post approval gate)"). The tier description in the file header says SUPPORT/CRISIS/CAVALRY first posts are held. The code does not do this.
- **Edge cases / notes for the mobile app:** Upload images **before** sending and pass only the returned URLs. Anonymous posts still store `authorId` (see the privacy note above). The server returns the masked body, so replace your optimistic text with the server's `message`.
- **Status:** ⚠️ Partial / Unclear. Message posting works, but the documented first-post approval flow is not implemented.

## Chat Rooms → Edit / report / moderate message
- **Description:** One PATCH endpoint with an `action` field handles six operations:
  - Edit your own message.
  - Report a message.
  - Room-moderator actions: pin, unpin, remove, approve.
- **Who can use it:**
  - `edit`: the author only.
  - `report`: any verified member.
  - `pin`, `unpin`, `remove`, `approve`: members whose membership in **that message's room** is `ACTIVE` with role `MODERATOR`. Site admins moderate through the admin module instead.
- **Source files:** `src/app/api/user/chatrooms/[slug]/messages/[id]/route.ts` (PATCH), `src/lib/chat-user.ts` (`editOwnMessage`, `reportMessage`, `modPinMessage`, `modRemoveMessage`, `modApproveMessage`, `requireRoomMod`), `src/lib/posts-user.ts` (`isValidReason`, `VALID_REPORT_REASONS`), `src/lib/admin-notifications.ts`.
- **User flow:**
  1. The member long-presses a message to open the action sheet. Options depend on `isOwn` and `room.isModerator`.
  2. **Edit:** an inline editor, then `PATCH { action: "edit", body }`. Replace the message with the returned one (`edited: true`).
  3. **Report:** a sheet with a reason and optional notes, then `PATCH { action: "report", reason, notes }`. If `duplicate: true`, show "You've already reported this." Otherwise show "Thanks — our team will review."
  4. **Moderator actions:**
     - Pin or unpin: refetch the room detail to update the pinned bar.
     - Remove: drop the message locally.
     - Approve: clear the `pending` badge.
  5. Failures: 403 `Not your message` or `Moderators only`. 404 `Message not found`. 400 `Invalid reason`, `Unknown action`, `Body required`, `This message was removed.`, `Message can't be empty.`, `Message is too long.`
- **Suggested mobile screen(s):** `ChatMessageActionSheet` (React, Reply, Copy, Edit, Delete, Report, Block author, plus a Moderator section). `ChatReportSheet` (radio list of reasons and a notes textarea).
- **API(s):**
  - `PATCH /api/user/chatrooms/[slug]/messages/[id]`
  - Auth required: yes (member; role depends on action)
  - Request body (JSON):

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | `action` | enum | yes | `edit` \| `report` \| `pin` \| `unpin` \| `remove` \| `approve` | — | `"report"` |
    | `body` | string | when `edit` | Trimmed, 1..2000 | — | `"Fixed typo"` |
    | `reason` | enum | when `report` | `SPAM`, `HARASSMENT`, `HATE_SPEECH`, `SELF_HARM`, `ADULT_CONTENT`, `MISINFORMATION`, `OFF_TOPIC`, `OTHER` | — | `"HARASSMENT"` |
    | `notes` | string | no | Trimmed. An empty string becomes null. No max length in code. | — | `"Repeated insults"` |

    Note: the `[slug]` path segment is **not** checked against the message's room. The message id decides the room.
  - Responses 200:
    - edit: `{ "ok": true, "message": ChatMessage }`
    - report: `{ "ok": true, "duplicate": false }`
    - pin / unpin / remove / approve: `{ "ok": true }`
  - Errors: 400 `Unknown action` / `Body required` / `Invalid reason` / lib messages. 403 `Not your message`, `Moderators only`. 404 `Message not found`.
- **Form fields (report):**

  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | Reason | single choice | yes | enum | Spam, Harassment, Hate speech, Self-harm, Adult content, Misinformation, Off topic, Other |
  | Notes | textarea | no | free text | — |

- **Business rules:**
  - **Edit** sets `editedAt`, which the API exposes as `edited: true`. REMOVED messages cannot be edited.
  - **Report:**
    - Only one OPEN report per (reporter, message). This is enforced by a unique index on `(reporterId, openMessageId)`. A repeat returns `duplicate: true` with no error.
    - Increments `chatMessage.reportCount`.
    - Notifies all admins (`POST_REPORTED`, "Chat message reported", 80-char snippet, `actionUrl /admin/chatrooms`).
  - **Pin:** sets `isPinned`. The room header shows up to 3 pinned messages.
  - **Remove:**
    - Status becomes `REMOVED` and `isPinned` becomes false.
    - Decrements `messageCount` if the message was published.
    - This is a soft remove: the row is kept for admin review.
  - **Approve:**
    - Only acts on `PENDING` messages; otherwise it is a silent no-op.
    - Publishes the message, increments `messageCount` and sets the author's `firstPostApproved = true`.
    - In practice nothing is PENDING (see Send message).
- **Edge cases / notes for the mobile app:** None of these changes are pushed over SSE. Other clients only see them after a refetch. A `SELF_HARM` report does not trigger any crisis flow (the schema comment says "triage separately — crisis flow later").
- **Status:** ✅ Complete

## Chat Rooms → Delete own message
- **Description:** The author permanently deletes their own message (hard delete).
- **Who can use it:** The message author.
- **Source files:** `src/app/api/user/chatrooms/[slug]/messages/[id]/route.ts` (DELETE), `src/lib/chat-user.ts` (`deleteOwnMessage`).
- **User flow:** Action sheet → **Delete** → confirm → `DELETE`. Remove the message locally. Failure: 403 `Not your message`, 404 `Message not found`.
- **Suggested mobile screen(s):** Confirm dialog from `ChatMessageActionSheet`.
- **API(s):**
  - `DELETE /api/user/chatrooms/[slug]/messages/[id]`. Auth: member (author). No body.
  - 200 `{ "ok": true }`
  - Errors: 404 `Message not found`. 403 `Not your message`. 400 other.
- **Form fields:** none.
- **Business rules:** This hard-deletes the row (reactions and replies follow the DB cascade rules). If the message was `PUBLISHED`, `room.messageCount` is decremented.
- **Edge cases / notes for the mobile app:** Other clients are not told about the delete through SSE. Their copy stays until they reload.
- **Status:** ✅ Complete

## Chat Rooms → Reactions
- **Description:** Toggles one of six curated emoji reactions on a message.
- **Who can use it:** Any verified member. The route does **not** check room membership or `canRead`; it only needs the message id.
- **Source files:** `src/app/api/user/chatrooms/[slug]/messages/[id]/react/route.ts`, `src/lib/chat-user.ts` (`toggleReaction`, `REACTION_EMOJIS`).
- **User flow:** The member taps a reaction pill or picks from the 6-emoji picker. Call `POST …/react { emoji }` and update the pill with the returned `count` and `mine`. Failure: 400 `Unsupported reaction.`, 404 `Message not found`.
- **Suggested mobile screen(s):** A reaction bar under each message, plus a long-press quick picker with the 6 emojis.
- **API(s):**
  - `POST /api/user/chatrooms/[slug]/messages/[id]/react`
  - Auth required: yes (member)
  - Request body:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | `emoji` | string | yes | Must be one of `❤️` `🙏` `🫂` `👍` `🎉` `😢` (exact code points) | — | `"🫂"` |

  - Response 200:
    ```ts
    interface ChatReactResponse { ok: true; emoji: string; count: number; mine: boolean }
    ```
    ```json
    { "ok": true, "emoji": "🫂", "count": 4, "mine": true }
    ```
  - Errors: 400 `Emoji required` (not a string), `Unsupported reaction.`. 404 `Message not found` (missing or REMOVED).
- **Form fields:** none.
- **Business rules:**
  - Unique per (message, user, emoji). A member can add several different emojis to one message.
  - Adding a reaction to someone else's message sends an in-app notification `CHAT_REACTION` "Someone reacted `<emoji>` to your message". Removing a reaction sends nothing.
- **Edge cases / notes for the mobile app:** Send exactly these emoji strings. `❤️` includes the variation selector U+FE0F. Reaction changes from other people are not pushed by SSE.
- **Status:** ✅ Complete

## Chat Rooms → Panic / crisis alert
- **Description:** A "I need help now" button. It alerts the room's moderators through in-app notifications and returns crisis hotline information to show the member.
- **Who can use it:** Any verified member. The route does not check membership.
- **Source files:** `src/app/api/user/chatrooms/[slug]/panic/route.ts`, `src/lib/chat-user.ts` (`panicAlert`), `src/components/site/chat-room.tsx` (panic UI).
- **User flow:**
  1. The member taps the crisis/help button in the room and confirms.
  2. Call `POST …/panic`.
  3. Show "We've let N moderators know". Show the hotline card (name, detail, emergency text). Offer a "Call 988" deep link (`tel:988`) and an "SMS 988" link.
  4. Failure: 400 `Room not found` (the route returns 400, not 404, for this error).
- **Suggested mobile screen(s):** `CrisisHelpSheet`: big calm card with the hotline, call and text buttons, the emergency note and the moderators-alerted line.
- **API(s):**
  - `POST /api/user/chatrooms/[slug]/panic`. Auth: member. No body.
  - Response 200:
    ```ts
    interface ChatPanicResponse { ok: true; moderatorsAlerted: number; hotline: { region: string; name: string; detail: string; emergency: string } }
    ```
    ```json
    { "ok": true, "moderatorsAlerted": 2, "hotline": { "region": "US", "name": "988 Suicide & Crisis Lifeline", "detail": "Call or text 988 — free, confidential, 24/7.", "emergency": "If you're in immediate danger, call your local emergency number." } }
    ```
  - Errors: 400 `Room not found` or `Failed`.
- **Form fields:** none.
- **Business rules:**
  - Every `ACTIVE` `MODERATOR` of the room except the presser gets an in-app `CRISIS_ALERT`: "Crisis alert in `<room>`", "A member asked for urgent help. Please check in on the room.", `actionUrl /chatrooms/<slug>`.
  - `moderatorsAlerted` counts all moderators, including the presser if they are a moderator.
  - No email, no push and no admin notification are sent.
  - There is no rate limit.
- **Edge cases / notes for the mobile app:** The hotline is **hard-coded to the US**. For other countries, show a local-resources fallback. If `moderatorsAlerted` is 0, still show the hotline prominently.
- **Status:** ✅ Complete

## Chat Rooms → Read markers & unread
- **Description:** Marks the room as read up to now. This sets `lastReadAt`, which the room list uses to compute `unread`.
- **Who can use it:** Any verified member. This is a no-op if they have no membership.
- **Source files:** `src/app/api/user/chatrooms/[slug]/read/route.ts`, `src/lib/chat-user.ts` (`markRoomRead`, `listRoomsForUser`).
- **User flow:** The web client calls this after the initial message load, after every SSE `messages` event, and after sending. The mobile app should do the same, and also when the room screen gains focus.
- **Suggested mobile screen(s):** None; this runs in the background.
- **API(s):**
  - `POST /api/user/chatrooms/[slug]/read`. Auth: member. No body.
  - 200 `{ "ok": true }`. This always succeeds, even for an unknown slug.
- **Form fields:** none.
- **Business rules:** Sets `chatMembership.lastReadAt = now` for this viewer and room. Unread counts in `GET /api/user/chatrooms` only count `PUBLISHED` messages from other people after `lastReadAt`.
- **Edge cases / notes for the mobile app:** There is no per-message read receipt in rooms. Debounce calls to about one every few seconds while messages stream in.
- **Status:** ✅ Complete

## Chat Rooms → Real-time stream (SSE)
- **Description:** A long-lived `text/event-stream` connection per open room. The server polls the database every **2.5 s** and pushes new messages.
- **Who can use it:** Verified members who can read the room.
- **Source files:** `src/app/api/user/chatrooms/[slug]/stream/route.ts`, `src/lib/chat-user.ts` (`listMessages` in `after` mode), `src/lib/cursor.ts`, `src/components/site/chat-room.tsx` (EventSource usage).
- **User flow:**
  1. After the initial page load, open `GET …/stream?after=<lastCursor>`. `lastCursor` is `` `${last.createdAt}|${last.id}` ``, or `new Date(0).toISOString()` for an empty room.
  2. On each `messages` event, de-duplicate by `id` and append. Update `lastCursor` from the newest item. If the user is near the bottom, auto-scroll. Call `POST …/read`.
  3. On disconnect, reconnect with the latest `lastCursor`. Consider backoff of 1 s, 2 s, 5 s and so on.
  4. Failure before the stream opens: JSON 404 `Room not found` or 403 `{ "error": "Locked" }`, or 401.
- **Suggested mobile screen(s):** Part of `ChatRoom`. Show a small "Reconnecting…" banner when the stream is down.
- **API(s):**
  - `GET /api/user/chatrooms/[slug]/stream`
  - Auth required: yes (member, `canRead`). Uses the session cookie, so send the `Cookie` header from React Native.
  - Request:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | `after` (query) | cursor string | no | `"<ISO>|<id>"` (a bare ISO also works) | server `now` | `2026-11-20T10:05:00.000Z|clm7` |

  - Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`. (Unlike the live-comments stream, there is no `X-Accel-Buffering: no`; behind nginx, events may be buffered unless the proxy config disables buffering.)
  - Events:
    ```
    event: messages
    data: [ChatMessage, ...]      // JSON array, oldest first, up to 100 per tick

    : ping                         // comment heartbeat after ~20 s without events
    ```
    ```ts
    type ChatStreamEvent = { event: "messages"; data: ChatMessage[] };
    ```
- **Form fields:** none.
- **Business rules:**
  - The poll runs every 2500 ms. A heartbeat goes out when there have been no events for 20 s.
  - The cursor advances using the library's `afterCursor`, the `(createdAt, id)` tie-safe cursor.
  - The blocked-user list is captured **when the stream opens**. Blocking someone mid-session needs a reconnect to take effect.
  - The stream includes the viewer's own messages, so de-duplicate them against the optimistic copy.
  - Transient DB errors are swallowed and retried on the next tick.
- **Edge cases / notes for the mobile app:** **Only new messages are delivered.** Edits, deletes, removals, pins and reaction changes never arrive through the stream. Refetch the latest page on app focus, or every 30–60 s while the room is open. React Native has no `EventSource`: use `react-native-sse` with a `Cookie` header, or fall back to polling `GET …/messages?after=<cursor>` every 2.5–5 s, which returns the same data. Close the stream when the screen blurs or the app is backgrounded.
- **Status:** ⚠️ Partial. New messages are delivered in near-real-time, but updates, deletions and reactions are not.

## Direct Messages → Inbox & requests list
- **Description:** Lists the viewer's 1:1 conversations in two boxes:
  - **primary**: threads the viewer has accepted.
  - **requests**: first contact from someone the viewer does not follow, not yet accepted.
- **Who can use it:** Any verified member.
- **Source files:** `src/app/api/user/messages/route.ts`, `src/lib/dm.ts` (`listConversations`), `src/app/messages/page.tsx`, `src/components/site/messages-client.tsx`.
- **User flow:**
  1. Open Messages. Call `GET /api/user/messages?box=primary` and `GET /api/user/messages/unread` (for the Requests badge).
  2. Switch to the Requests tab, which calls `?box=requests`.
  3. Tap a row to open the thread (`/messages/<otherId>`).
  4. The web client refreshes the list and request count every **8 s** while the page is open.
- **Suggested mobile screen(s):** `Inbox`: segmented control (Primary / Requests with a badge), rows showing the avatar, name, last message preview (prefix "You: " when `lastSenderId === me`), relative time and an unread count bubble. Empty states: "No messages yet" / "No message requests".
- **API(s):**
  - `GET /api/user/messages`
  - Auth required: yes (member)
  - Request:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | `box` (query) | enum | no | `requests` → requests box; any other value → primary | `primary` | `requests` |

  - Response 200:
    ```ts
    interface DmListConversationsResponse { conversations: DmConversationSummary[] }
    interface DmConversationSummary {
      id: string; otherId: string; otherName: string; otherAvatar: string | null;
      lastMessageText: string | null; // masked, ≤300 chars, "📷 Photo" for image-only
      lastMessageAt: string; lastSenderId: string | null;
      unread: number; isAccepted: boolean;
    }
    ```
    ```json
    { "conversations": [ { "id": "cv1", "otherId": "u2", "otherName": "Ben", "otherAvatar": null, "lastMessageText": "See you at the meetup!", "lastMessageAt": "2026-11-20T09:00:00.000Z", "lastSenderId": "u2", "unread": 1, "isAccepted": true } ] }
    ```
  - Errors: 401 / 403 auth.
- **Form fields:** none.
- **Business rules:**
  - Ordered by `lastMessageAt desc`. Max **100** conversations; there is no pagination.
  - Archived participants (`archivedAt` set) are hidden. No API sets `archivedAt` yet.
  - Threads where either side has blocked the other are hidden.
  - `unread` counts non-deleted messages from the other person after the viewer's `lastReadAt`.
  - If the other user record is missing, the name shows as "Member".
- **Edge cases / notes for the mobile app:** Each row runs a count query, so poll no faster than the web's 8 s. Better: poll only `GET /api/user/messages/unread` for badges, and refresh the list on focus.
- **Status:** ✅ Complete

## Direct Messages → Unread counts
- **Description:** Badge counts for the Messages icon: how many **threads** (not messages) have unread messages, split into inbox and requests.
- **Who can use it:** Any verified member.
- **Source files:** `src/app/api/user/messages/unread/route.ts`, `src/lib/dm.ts` (`unreadTotals`).
- **User flow:** The app polls this to show a badge on the Messages tab. Per the code comment, DMs create **no** bell notification, so this count is the only signal of new DMs.
- **Suggested mobile screen(s):** Tab-bar badge on Messages. Badge on the Requests segment.
- **API(s):**
  - `GET /api/user/messages/unread`. Auth: member.
  - 200:
    ```ts
    interface DmUnreadResponse { inbox: number; requests: number }
    ```
    ```json
    { "inbox": 2, "requests": 1 }
    ```
- **Form fields:** none.
- **Business rules:**
  - A thread counts if it has at least one non-deleted message from the other person after the viewer's `lastReadAt`. Accepted threads go to `inbox`; the rest go to `requests`.
  - Archived participants are excluded.
  - ⚠️ Unlike the list, blocked threads are **not** excluded, so the badge can count a thread the list hides.
- **Edge cases / notes for the mobile app:** Poll every 15–30 s in the foreground. There is no push notification for DMs (see gaps).
- **Status:** ✅ Complete

## Direct Messages → Thread & send
- **Description:** Opens the conversation with a given user, with keyset paging for older messages. Sending creates the conversation on first contact.
- **Who can use it:** Any verified member. Sending is refused if either side has blocked the other.
- **Source files:** `src/app/api/user/messages/thread/[userId]/route.ts`, `src/lib/dm.ts` (`getThread`, `sendMessage`), `src/lib/follows.ts` (`isFollowing`), `src/app/messages/[userId]/page.tsx`, `src/components/site/messages-client.tsx`, `src/components/site/photo-attach.tsx` (image upload via `/api/user/upload`).
- **User flow:**
  1. Open a thread, either from the inbox or from a profile's "Message" button, with `GET /api/user/messages/thread/<userId>`.
  2. If `conversationId` is null, there is no thread yet. Show an empty thread with the composer.
  3. If `isRequest` is true, show a banner: "`<name>` wants to message you" with **Accept** and **Decline**.
  4. If `blocked` is true, hide the composer and show "You can't message this member."
  5. Call `POST …/conversations/<id>/read` once loaded, then open the SSE stream.
  6. Scroll up: if `nextCursor` is set, call `GET …/thread/<userId>?cursor=<nextCursor>` and prepend.
  7. Send: optionally upload an image first (`POST /api/user/upload` returns `url`), then `POST …/thread/<userId> { body, imageUrl }`. On 201, append the message. If the thread had no `conversationId`, store the returned one and open the stream.
  8. While typing, call `POST …/typing` at most once every 3 s (the web client's throttle).
  9. Failure (400): `You can't message yourself.`, `Write a message first.`, `Message is too long.`, `You can't message this member.`
- **Suggested mobile screen(s):** `DmThread`: header (avatar, name → profile), request banner, inverted message list (own messages on the right), "Seen" under your last message when `otherLastReadAt >= its createdAt`, typing dots, "This message was deleted" placeholder, composer with a photo button (one image), emoji and send.
- **API(s):**
  - `GET /api/user/messages/thread/[userId]`
  - Auth required: yes (member)
  - Request:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | `userId` (path) | string | yes | The other user's id. Must not be yourself and must exist. | — | `u2` |
    | `cursor` (query) | string | no | Opaque base64url (`<iso>|<id>`) from `nextCursor`. An invalid value is ignored. | — | `MjAyNi0xMS0yMFQw...` |

    Page size is fixed at **30** (the route does not expose `limit`).
  - Response 200:
    ```ts
    interface DmThreadResponse {
      conversationId: string | null;   // null = no conversation yet
      other: { id: string; name: string; avatar: string | null } | null;
      isAccepted: boolean;             // viewer's side
      isRequest: boolean;              // pending request FOR the viewer
      blocked: boolean;                // either direction
      otherLastReadAt: string | null;  // for "Seen"
      messages: DmMessage[];           // chronological
      nextCursor: string | null;       // older page
    }
    interface DmMessage { id: string; senderId: string; body: string; imageUrl: string | null; deleted: boolean; isOwn: boolean; createdAt: string }
    ```
    ```json
    { "conversationId": "cv1", "other": { "id": "u2", "name": "Ben", "avatar": null }, "isAccepted": true, "isRequest": false, "blocked": false, "otherLastReadAt": "2026-11-20T09:01:00.000Z", "messages": [ { "id": "dm1", "senderId": "u2", "body": "See you at the meetup!", "imageUrl": null, "deleted": false, "isOwn": false, "createdAt": "2026-11-20T09:00:00.000Z" } ], "nextCursor": null }
    ```
  - Errors: 404 `Not found` (self, or unknown user). 401 / 403 auth.

  - `POST /api/user/messages/thread/[userId]`
  - Auth required: yes (member)
  - Request body:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | `body` | string | one of `body` / `imageUrl` | Trimmed. Max **4000** chars. A non-string is treated as `""`. | `""` | `"Hi Ben!"` |
    | `imageUrl` | string \| null | one of `body` / `imageUrl` | Trimmed. ⚠️ Not validated (any string is accepted); use the URL from `/api/user/upload`. | `null` | `"/uploads/posts/2026/11/p.jpg"` |

  - Response 201:
    ```ts
    interface DmSendResponse { conversationId: string; message: DmMessage }
    ```
    ```json
    { "conversationId": "cv1", "message": { "id": "dm2", "senderId": "u1", "body": "Hi Ben!", "imageUrl": null, "deleted": false, "isOwn": true, "createdAt": "2026-11-20T09:02:00.000Z" } }
    ```
  - Errors: 400 `You can't message yourself.`, `Write a message first.`, `Message is too long.`, `You can't message this member.`, or a DB error message (for example when the user id does not exist).
- **Form fields:**

  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | Message | multiline text | yes, unless a photo is attached | ≤ 4000 chars | any |
  | Photo | image picker (1) | no | Upload limits from `/api/user/upload` | image |

- **Business rules:**
  - A conversation is unique per user pair (stored sorted as `userAId < userBId`).
  - **Request logic:** on the first message, the recipient's side is created with `isAccepted = true` only if the recipient already follows the sender. Otherwise the thread lands in the recipient's **Requests**.
  - Sending a message also accepts the sender's own side, so replying to a request accepts it.
  - Each send:
    - Updates `lastMessageAt`, `lastMessageText` (≤300 chars, `"📷 Photo"` for image-only) and `lastSenderId`.
    - Sets the sender's `lastReadAt` to the message time and clears their typing flag.
  - **No notifications** (no in-app, email or push) are sent for DMs.
  - DMs are never anonymous.
  - Bodies are banned-word masked on read.
  - When the viewer is blocked, the GET still returns history with `blocked: true`. The POST is refused.
- **Edge cases / notes for the mobile app:** `nextCursor` is opaque base64url; do not parse it. This cursor format is different from the chat cursor. Deleted messages come back with `deleted: true`, an empty body and `imageUrl: null`.
- **Status:** ✅ Complete

## Direct Messages → Accept / decline request
- **Description:** Accept moves a request thread into the primary inbox. Decline deletes the whole conversation for **both** people.
- **Who can use it:** A participant of the conversation.
- **Source files:** `src/app/api/user/messages/conversations/[id]/accept/route.ts`, `.../decline/route.ts`, `src/lib/dm.ts` (`acceptRequest`, `declineRequest`).
- **User flow:** In the request banner:
  - **Accept** calls `POST …/accept`. Hide the banner and treat the thread as primary.
  - **Decline** shows a confirm, then calls `POST …/decline`. Go back to the Requests list and remove the row.
  - Failure: decline returns 400 `Not found.` if the viewer is not a participant.
- **Suggested mobile screen(s):** Request banner on `DmThread`. Optional swipe actions on rows in the Requests list.
- **API(s):**
  - `POST /api/user/messages/conversations/[id]/accept`. Auth: member. No body. 200 `{ "ok": true }`. Errors: 400 `Failed` (generic). ⚠️ It silently succeeds for a non-participant or unknown id (an `updateMany` that matches no rows).
  - `POST /api/user/messages/conversations/[id]/decline`. Auth: member. No body. 200 `{ "ok": true }`. Errors: 400 `Not found.`
- **Form fields:** none.
- **Business rules:**
  - Decline is a hard delete of the conversation, and all its messages cascade with it.
  - The sender is not told. If they write again, a new conversation (and a new request) is created.
  - Either participant can call decline on any conversation, including an accepted one. The code does not restrict it to requests.
- **Edge cases / notes for the mobile app:** Use the decline confirm text "This deletes the conversation for both of you."
- **Status:** ✅ Complete

## Direct Messages → Read receipts
- **Description:** Marks a conversation as read now. The other person's SSE stream then shows "Seen" (event `seen`).
- **Who can use it:** A participant.
- **Source files:** `src/app/api/user/messages/conversations/[id]/read/route.ts`, `src/lib/dm.ts` (`markRead`).
- **User flow:** Call this when a thread opens, and whenever an SSE `messages` event contains a message from the other person (`!isOwn`).
- **Suggested mobile screen(s):** None; it runs in the background. The sender sees "Seen" under their last message.
- **API(s):**
  - `POST /api/user/messages/conversations/[id]/read`. Auth: member. No body. 200 `{ "ok": true }`. Errors: 400 `Failed`. It is a silent no-op for a non-participant.
- **Form fields:** none.
- **Business rules:** Sets the participant's `lastReadAt = now`. This affects `unread` in the list, the badge totals, and `otherLastReadAt` on the other side.
- **Edge cases / notes for the mobile app:** Only call it while the thread is actually visible (app in the foreground).
- **Status:** ✅ Complete

## Direct Messages → Typing indicator
- **Description:** Signals "I'm typing". The other side's stream reports `typing: true` while the signal is less than **6 s** old.
- **Who can use it:** A participant.
- **Source files:** `src/app/api/user/messages/conversations/[id]/typing/route.ts`, `src/lib/dm.ts` (`setTyping`, `pollThread`).
- **User flow:** On text change, throttle to one call every 3 s (as the web client does). When a message is sent, the typing flag is cleared server-side.
- **Suggested mobile screen(s):** Typing dots bubble in `DmThread`.
- **API(s):**
  - `POST /api/user/messages/conversations/[id]/typing`. Auth: member. No body. 200 `{ "ok": true }`. Errors: 400 `Failed`.
- **Form fields:** none.
- **Business rules:** Sets `typingAt = now`. The stream computes `otherTyping = now - typingAt < 6000 ms` and only emits a `typing` event when the value changes.
- **Edge cases / notes for the mobile app:** The thread must already have a `conversationId`; there is no typing signal before the first message.
- **Status:** ✅ Complete

## Direct Messages → Delete message
- **Description:** The sender soft-deletes one of their own DMs. Both sides then see a "deleted" placeholder.
- **Who can use it:** The message sender.
- **Source files:** `src/app/api/user/messages/messages/[id]/route.ts`, `src/lib/dm.ts` (`deleteMessage`).
- **User flow:** Long-press your own message → Delete → `DELETE /api/user/messages/messages/<id>`. Mark it `deleted: true` locally.
- **Suggested mobile screen(s):** Action sheet on your own bubble.
- **API(s):**
  - `DELETE /api/user/messages/messages/[id]`. Auth: member. No body.
  - 200 `{ "ok": true }`. This also returns 200 when the id does not exist.
  - Errors: 400 `You can only delete your own messages.`
- **Form fields:** none.
- **Business rules:**
  - Sets `deletedAt`. Reads return an empty body, `imageUrl: null` and `deleted: true`.
  - The conversation's `lastMessageText` preview is **not** updated, so the inbox may still show the deleted text.
- **Edge cases / notes for the mobile app:** The other side is not told through SSE; they see the change on their next thread load.
- **Status:** ✅ Complete

## Direct Messages → Real-time stream (SSE)
- **Description:** A per-conversation SSE stream. Every **2 s** it pushes new messages, the other side's read position and the other side's typing state.
- **Who can use it:** A participant.
- **Source files:** `src/app/api/user/messages/conversations/[id]/stream/route.ts`, `src/lib/dm.ts` (`pollThread`), `src/components/site/messages-client.tsx`.
- **User flow:**
  1. Once `conversationId` is known, open `GET …/conversations/<id>/stream?after=<createdAt of last message>`. Use `new Date(0).toISOString()` if the thread is empty.
  2. Handle the events:
     - `messages`: de-duplicate by id and append. If any message is `!isOwn`, call `POST …/read`.
     - `seen`: update `otherLastReadAt`.
     - `typing`: show or hide the dots.
  3. On reconnect, pass the newest `createdAt` as `after`.
- **Suggested mobile screen(s):** Part of `DmThread`.
- **API(s):**
  - `GET /api/user/messages/conversations/[id]/stream`
  - Auth required: yes (member, participant)
  - Request:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | `after` (query) | ISO date string | no | Plain timestamp. ⚠️ No `|id` tie-breaker. | server `now` | `2026-11-20T09:02:00.000Z` |

  - Events:
    ```
    event: messages
    data: [DmMessage, ...]                         // up to 50, oldest first

    event: seen
    data: {"otherLastReadAt":"2026-11-20T09:03:00.000Z"}   // sent on first tick and whenever it changes

    event: typing
    data: {"typing":true}                          // only when it changes (initial false is not sent)

    : ping                                         // heartbeat after ~20 s idle
    ```
    ```ts
    type DmStreamEvent =
      | { event: "messages"; data: DmMessage[] }
      | { event: "seen"; data: { otherLastReadAt: string | null } }
      | { event: "typing"; data: { typing: boolean } };
    ```
  - Errors: 401 / 403 auth (JSON, before the stream starts).
- **Form fields:** none.
- **Business rules:**
  - Poll every 2000 ms, heartbeat every 20 s. The server advances the cursor to the last message's `createdAt`.
  - Messages include your own.
  - Messages deleted before delivery arrive with `deleted: true`. Messages deleted after delivery are never re-sent.
- **Edge cases / notes for the mobile app:**
  - ⚠️ If the conversation does not exist or the viewer is not a participant, the server returns **200** and the stream just stays open with no events (the poll stops but the connection is never closed). Add a client timeout or verify the thread first.
  - ⚠️ The cursor is timestamp-only (`createdAt > after`), so two messages in the same millisecond can drop one. Refetch the thread on app focus to self-heal.
  - React Native: use `react-native-sse` with a `Cookie` header. There is no polling "after" endpoint for DMs, so the fallback is to re-GET the thread (latest 30) every few seconds.
- **Status:** ⚠️ Partial. Works, but with a timestamp-only cursor, a hanging stream for invalid ids, and no delete or update events.

## Live Streaming → How broadcasting works (MediaMTX, WHIP, HLS, recording)
- **Description:** This section describes the infrastructure behind every Live endpoint. It has no endpoint of its own.
  - **Media never passes through the Next.js app.** A separate **MediaMTX** server (`deploy/mediamtx/mediamtx.yml`, run by systemd via `deploy/mediamtx/mediamtx.service` as `/usr/local/bin/mediamtx /etc/mediamtx/mediamtx.yml`) handles the video.
  - **Publishing** uses **WebRTC WHIP**. The broadcaster's client POSTs an SDP offer to `publishUrl` (`<publicUrl>/<pathPrefix>live-<slug>/whip`) with `Authorization: Bearer <grant token>`.
  - **Watching** uses **HLS**. Viewers play `watchUrl` (`<publicUrl>/<pathPrefix>live-<slug>/index.m3u8`). HLS was chosen over WHEP so one publisher can fan out to many viewers through plain HTTP or a CDN, at the cost of a few seconds of latency.
  - **Authorisation.** MediaMTX calls `POST https://worldwecare.com/api/mediamtx/auth` (`authMethod: http`) before every publish and every read:
    - **publish** needs the owner's live grant token.
    - **read** is allowed for any stream with status `LIVE`, PUBLIC or UNLISTED, with no token, because HLS viewers carry no credential.
    - Control actions (`api`, `metrics`, `pprof`) are excluded from the hook and use an internal API user. The password is in `mediamtx.yml` (value withheld; a placeholder in the repo).
  - **Control API.** The app calls MediaMTX's Control API (`<apiUrl>/v3/...`, Basic auth with `stream.apiUser` / `stream.apiPass` platform settings) for these jobs:
    - Read path state: whether a publisher is present, which tracks it sends, and reader count (`/paths/get`).
    - Turn recording on or off (`/config/paths/add|patch|delete`).
    - Kick WebRTC sessions when a stream ends (`/webrtcsessions/kick`).
- **Who can use it:** n/a (infrastructure).
- **Source files:** `src/lib/mediamtx.ts`, `src/lib/whip.ts`, `src/lib/live-streams.ts`, `src/components/site/broadcast-client.tsx`, `src/components/site/live-clients.tsx` (`HlsPlayer`), `deploy/mediamtx/mediamtx.yml`, `deploy/mediamtx/mediamtx.service`.
- **User flow (broadcaster, as built for the web):**
  1. `POST /api/user/live` creates the stream (status `IDLE`).
  2. Open `/live/<slug>/broadcast`. `getUserMedia` is called for camera and microphone (ideal 1280×720, echo cancellation and noise suppression on).
  3. Tap **Go live**, which calls `POST /api/user/live/<slug>/start`. The response is a ticket: `token`, `publishUrl`, `watchUrl`, `maxHeight`, `maxDurationMin`, `recording`.
  4. `whip.publish()` runs:
     - Creates an `RTCPeerConnection` with sendonly transceivers.
     - **Prefers H.264** (packetization-mode=1, constrained-baseline `42e01f` first).
     - Waits up to 3 s for ICE gathering. Trickle ICE is not used.
     - `POST publishUrl`, with `Content-Type: application/sdp` and `Authorization: Bearer <token>`, body = offer SDP.
     - The 201 response has the answer SDP plus a `Location` header (used later for `DELETE`).
  5. Poll `POST /api/user/live/<slug>/live` up to **6 times, 1.2 s apart**. When it returns `live: true`, the stream flips to `LIVE`. If it never does, close the WHIP session and show `problem`.
  6. While live, poll `GET …/viewers` every 10 s. Optionally toggle recording.
  7. **End:** `POST …/end`, then send `DELETE` to the WHIP `Location` and stop the tracks.
- **Suggested mobile screen(s):** see the Broadcast, LiveWatch and GoLiveCreate screens below.
- **API(s):** none directly. See the following sections.
- **Form fields:** none.
- **Business rules:**
  - **MediaMTX configuration** (`mediamtx.yml`):

    | Setting | Value | Meaning |
    |---|---|---|
    | API | port 9997 | Control API |
    | HLS | port 8888, `hlsVariant: lowLatency`, 1 s segments, 7 segments, `hlsAlwaysRemux: yes` | HLS playback |
    | `hlsAllowOrigins` / `webrtcAllowOrigins` | `https://worldwecare.com` | CORS for browsers |
    | WebRTC | HTTP port 8889, **UDP 8189** for media, STUN `stun.l.google.com:19302` | WHIP publishing |
    | Playback server | port 9996 | Recording playback |
    | RTSP / RTMP / SRT | **disabled** | No other ingest protocols |
    | Paths | regex `~^live/live-[a-f0-9]{32}$` | One path per broadcast, `record: no` by default, `runOnDemandCloseAfter: 60s` |
    | Recordings | fmp4 at `/var/lib/mediamtx/recordings/%path/%Y-%m-%d_%H-%M-%S-%f`, 1 h segments | Default deletion after 168 h |

  - **Stream path** = `<pathPrefix>live-<slug>`. The default prefix is `live/`. The slug is 32 lowercase hex characters (128 random bits). The auth hook rejects any path that does not match this shape before it touches the database.
  - **Platform settings** (`getMediamtxConfig`, stored in settings):

    | Setting | Default | Allowed range / values |
    |---|---|---|
    | `stream.enabled` | false | boolean |
    | `stream.publicUrl` | — | URL |
    | `stream.pathPrefix` | `live/` | normalised path prefix |
    | `stream.apiUrl` | — | URL |
    | `stream.apiUser` / `stream.apiPass` | — | credentials (values withheld) |
    | `stream.playbackUrl` | — | URL |
    | `stream.allowedIps` | — | IP allowlist for the auth hook |
    | `stream.maxDurationMin` | 120 | 5–1440 |
    | `stream.maxConcurrentPerUser` | 1 | 1–10 |
    | `stream.maxHeight` | 720 | 240–2160 |
    | `stream.defaultVisibility` | `PUBLIC` | `PUBLIC` \| `UNLISTED` |
    | `stream.requireEmailVerified` | true | boolean |
    | `stream.autoRecord` | false | boolean |
    | `stream.recordingRetentionDays` | 7 | 0 = forever, max 3650 |

    Streaming is "configured" only when `enabled` is true and both `publicUrl` and `apiUrl` are set.
  - **Grant tokens:**
    - 32 random bytes as 64 hex characters, stored in `LiveStreamGrant`, one per (stream, owner).
    - Re-minted on every `/start` call, which replaces the old token.
    - Expire after `maxDurationMin + 10` minutes.
    - Revoked when the stream ends.
  - **Codec gate:** a stream only becomes `LIVE` if MediaMTX reports a video track in H.264/H.265 (AVC/HEVC). VP8, VP9 and AV1 are refused with a clear `problem` message, because HLS cannot carry them.
  - **Recording:**
    - When enabled, the app adds a concrete MediaMTX path entry with `record: true`, `recordFormat: fmp4`, 1 h segments and `recordDeleteAfter` = retention days × 24 h (or `8760h` if retention is 0).
    - Disabling deletes the entry, falling back to patching `record: false`.
    - Recording is all-or-nothing: on failure it is switched back off.
  - **Ending:**
    - Ending is always best-effort toward MediaMTX (disable recording, kick sessions), then a guaranteed DB write: revoke grants, then set `status ENDED`, `endedAt`, `endedBy` (`OWNER` / `ADMIN` / `LIMIT` / `STALE`) and `viewerCount 0`.
    - A newer stream setup automatically ends any of the member's previous `IDLE` streams (endedBy `STALE`).
  - ⚠️ **Auto-end sweeper is not scheduled.** `sweepStreams()` is meant to end streams past `maxDurationMin`, stuck LIVE streams with no publisher, and IDLE streams older than 6 h. It is never called anywhere in the codebase. The only cleanup that runs is `reconcileStuck`, and only when a member hits their concurrency limit. The duration cap is therefore enforced only indirectly, through grant expiry (which affects new publish attempts, not a session already connected).
  - ⚠️ **No member-facing recording playback.** `listRecordingSegments()` and `playbackUrl()` exist in `src/lib/mediamtx.ts`, but no user route uses them, and the auth hook denies every action other than `publish` and `read`, including `playback`. Recordings exist only on the media server.
- **Edge cases / notes for the mobile app:**
  - **Watching on mobile is easy.** Play `watchUrl` with a native HLS player: `react-native-video` or `expo-video` (AVPlayer on iOS, ExoPlayer on Android). Native players are not subject to the CORS rule in `hlsAllowOrigins`. No token is needed for the manifest. Low-latency HLS works best on iOS AVPlayer and ExoPlayer.
  - **Broadcasting from mobile needs WebRTC (web-only today).** Publishing is implemented only in browser JavaScript (`src/lib/whip.ts`). A React Native broadcaster would need:
    1. `react-native-webrtc`: camera via `mediaDevices.getUserMedia`, an `RTCPeerConnection` with sendonly transceivers, and H.264 placed first (via `setCodecPreferences` if available, or by SDP munging). Mobile hardware encoders usually support H.264 baseline.
    2. A hand-written WHIP exchange: `POST publishUrl` with `Content-Type: application/sdp` and `Authorization: Bearer <token>`, read the answer SDP, keep the `Location` header for the `DELETE`.
    3. Outbound UDP 8189 reachable from mobile networks. Only STUN is configured; with no TURN server, some carrier NATs will fail.
    4. The same start → confirm loop (`/start`, then poll `/live`) and `/end`.

    RTMP, SRT and RTSP ingest are disabled, so off-the-shelf RTMP mobile SDKs or OBS **cannot** be used unless the server config changes.
- **Status:** ⚠️ Partial. Publishing is web-only (WebRTC/WHIP in the browser), the stream sweeper is never scheduled, and there is no recording playback for members.

## Live Streaming → Browse live now
- **Description:** What's live right now: PUBLIC streams with status `LIVE`, plus the category list. For signed-in members it also includes the reason, if any, why they can't go live.
- **Who can use it:** Anyone, including signed-out users. `blockedReason` is filled only for signed-in members.
- **Source files:** `src/app/api/user/live/route.ts` (GET), `src/lib/live-streams.ts` (`listLive`, `whyNotAllowed`), `src/lib/live-categories.ts` (`categoryIdForSlug`, `listPublicCategories`), `src/app/live/page.tsx`, `src/app/live/category/[slug]/page.tsx` (redirects to `/live?category=`), `src/components/site/live-clients.tsx` (`LiveCategories`, which refreshes every 30 s).
- **User flow:**
  1. Open the Live tab, which calls `GET /api/user/live` (optionally with `?category=<slug>`).
  2. Show category chips (with `liveCount`) and a grid of stream cards.
  3. Show **Go live** if `blockedReason` is null. Otherwise show the reason text.
  4. Refresh every 30 s (as the web does) and on pull-to-refresh.
  5. Tapping a card opens LiveWatch. Signed-out users must sign in first, because watching requires an account.
- **Suggested mobile screen(s):** `LiveHome`: horizontal category chips (emoji, name, live count), a grid of cards (thumbnail placeholder in the category colour, LIVE badge, title, owner avatar and name, viewer count) and a Go Live FAB.
- **API(s):**
  - `GET /api/user/live`
  - Auth required: no (optional session)
  - Request:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | `countryId` (query) | string | no | Filters by stream country | — | `ckcountry123` |
    | `categoryId` (query) | string | no | Takes priority over `category` | — | `clcat1` |
    | `category` (query) | string | no | Category slug (lowercased). An unknown or retired slug returns empty `streams` with `unknownCategory: true`. | — | `music` |

  - Response 200:
    ```ts
    interface LiveBrowseResponse { streams: LiveStreamCard[]; categories: LiveCategory[]; unknownCategory: boolean; blockedReason: string | null }
    interface LiveStreamCard {
      id: string; slug: string; title: string; summary: string | null;
      status: "IDLE" | "LIVE" | "ENDED"; visibility: "PUBLIC" | "UNLISTED";
      ownerUserId: string | null; ownerName: string; ownerAvatar: string | null;
      startedAt: string | null; endedAt: string | null; viewerCount: number; viewerPeak: number;
      isMine: boolean; recording: boolean;
      category: { id: string; name: string; slug: string; emoji: string | null; color: string | null } | null;
    }
    ```
    ```json
    { "streams": [ { "id": "ls1", "slug": "3f9c0a1b2c3d4e5f60718293a4b5c6d7", "title": "Morning meditation", "summary": "20 minutes, all welcome", "status": "LIVE", "visibility": "PUBLIC", "ownerUserId": "u3", "ownerName": "Chloe", "ownerAvatar": null, "startedAt": "2026-11-20T07:00:00.000Z", "endedAt": null, "viewerCount": 14, "viewerPeak": 20, "isMine": false, "recording": false, "category": { "id": "clcat1", "name": "Wellbeing", "slug": "wellbeing", "emoji": "🧘", "color": "#10b981" } } ], "categories": [ { "id": "clcat1", "name": "Wellbeing", "slug": "wellbeing", "description": null, "emoji": "🧘", "color": "#10b981", "liveCount": 1, "viewerCount": 14 } ], "unknownCategory": false, "blockedReason": null }
    ```
  - Errors: none specific.
- **Form fields:** none.
- **Business rules:**
  - Only `visibility PUBLIC` and `status LIVE` streams are listed. Order: `viewerCount desc`, then `startedAt desc`. Max **30** (the route does not expose `take`).
  - `blockedReason` texts (from `whyNotAllowed`):
    - "Live streaming isn't switched on yet."
    - "We couldn't find your account."
    - "Your account can't go live."
    - "Going live has been turned off for your account."
    - "Verify your email address first — check your inbox for the link."
    - "You're already broadcasting. End that stream first — you can do it from its card below."
    - "You can broadcast N streams at once, and you're at the limit."
- **Edge cases / notes for the mobile app:** There is no pagination. UNLISTED streams never appear here. Stream cards have no thumbnail image, so design a placeholder. `viewerCount` is the stored value, updated only when someone polls `/viewers`.
- **Status:** ✅ Complete

## Live Streaming → Categories
- **Description:** Active live-stream categories (managed by admins), each with how many PUBLIC streams are live and how many people are watching across them.
- **Who can use it:** Anyone (public).
- **Source files:** `src/app/api/user/live/categories/route.ts`, `src/lib/live-categories.ts` (`listPublicCategories`).
- **User flow:** Used for the filter chips on LiveHome and for the category picker on GoLiveCreate.
- **Suggested mobile screen(s):** Category chips; category picker (list with emoji and description).
- **API(s):**
  - `GET /api/user/live/categories`. Auth: none.
  - 200:
    ```ts
    interface LiveCategoriesResponse { categories: { id: string; name: string; slug: string; description: string | null; emoji: string | null; color: string | null; liveCount: number; viewerCount: number }[] }
    ```
    ```json
    { "categories": [ { "id": "clcat1", "name": "Wellbeing", "slug": "wellbeing", "description": "Calm, mindful sessions", "emoji": "🧘", "color": "#10b981", "liveCount": 1, "viewerCount": 14 } ] }
    ```
  - Errors: none. On any DB error it returns `{ "categories": [] }` with status 200.
- **Form fields:** none.
- **Business rules:**
  - Only `isActive` categories are returned, ordered by `sortOrder asc`, then `name asc`.
  - Categories with nothing live are still included.
  - Colour is `#rgb` or `#rrggbb`. Emoji is a single grapheme.
- **Edge cases / notes for the mobile app:** An empty list means either "no categories yet" or a server error.
- **Status:** ✅ Complete

## Live Streaming → Create stream
- **Description:** Sets up a new broadcast with status `IDLE`. This does not start video.
- **Who can use it:** A verified member who is active and not banned, with `user.canStream = true`, an email-verified account (if the `stream.requireEmailVerified` setting is on), and fewer than `maxConcurrentPerUser` LIVE streams. Streaming must also be configured.
- **Source files:** `src/app/api/user/live/route.ts` (POST), `src/lib/live-streams.ts` (`createStream`, `whyNotAllowed`), `src/app/live/new/page.tsx`, `src/components/site/live-clients.tsx` (`NewStream`).
- **User flow:**
  1. Tap Go Live. If `blockedReason` (from `/live` or `/live/mine`) is set, show it instead of the form.
  2. Fill in the title, category, summary and visibility. Submit with `POST /api/user/live`.
  3. On 201, navigate to the Broadcast screen for `stream.slug`.
  4. Failure: 400 with a readable message.
- **Suggested mobile screen(s):** `GoLiveCreate`: Title input, Category picker (required), Summary textarea, Visibility segmented control (Public / Unlisted, with help text "Unlisted: only people with the link"), Continue button.
- **API(s):**
  - `POST /api/user/live`
  - Auth required: yes (member, plus the streaming permission checks above)
  - Request body:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | `title` | string | yes | Trimmed, 1–200 chars | — | `"Morning meditation"` |
    | `categoryId` | string | yes | Must be an existing **active** live category id | — | `"clcat1"` |
    | `summary` | string \| null | no | Trimmed, truncated to 400. Empty becomes null. | null | `"20 minutes, all welcome"` |
    | `visibility` | `"PUBLIC"` \| `"UNLISTED"` | no | Only `"UNLISTED"` is honoured; anything else uses the server default | `stream.defaultVisibility` (PUBLIC) | `"UNLISTED"` |

  - Response 201: `{ "ok": true, "stream": LiveStreamCard }` (status `IDLE`, `isMine: true`).
  - Errors (400):
    - Any `blockedReason` text (see Browse).
    - `Give your stream a title.`
    - `Keep the title under 200 characters.`
    - `Choose a category so people can find your stream.`
    - `That category isn't available any more — pick another.`
    - `We couldn't find your account.`
- **Form fields:**

  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | Title | text | yes | 1–200 chars | any |
  | Category | picker | yes | active category | from `/api/user/live/categories` |
  | Summary | textarea | no | ≤ 400 (truncated) | any |
  | Visibility | segmented | no | — | Public, Unlisted |

- **Business rules:**
  - Any of the member's existing `IDLE` streams (up to 20) are ended as `STALE` with the reason "Replaced by a newer stream."
  - These values are snapshotted onto the new row: owner name and avatar, `countryId` (from the owner), `maxDurationMin` (from current settings) and `recordingEnabled` (from `stream.autoRecord`).
  - The slug is 32 random hex characters. It is unguessable, which is what keeps UNLISTED streams private.
- **Edge cases / notes for the mobile app:** Creating a stream on mobile is useful even if mobile publishing is not built, but the actual broadcast would then have to happen on the web.
- **Status:** ✅ Complete

## Live Streaming → My streams
- **Description:** The member's own streams (any status), plus whether they can start another one.
- **Who can use it:** Any verified member.
- **Source files:** `src/app/api/user/live/mine/route.ts`, `src/lib/live-streams.ts` (`listMine`, `whyNotAllowed`), `src/components/site/live-clients.tsx` (my-streams section with an End button).
- **User flow:** Open My Streams, which calls `GET /api/user/live/mine`. Each card shows its status. LIVE or IDLE cards offer **Open broadcast** and **End** (`POST …/end`).
- **Suggested mobile screen(s):** `MyStreams`: list of cards (status chip IDLE/LIVE/ENDED, created or started time, peak viewers, recording badge) with actions.
- **API(s):**
  - `GET /api/user/live/mine`. Auth: member.
  - 200:
    ```ts
    interface LiveMineResponse { streams: LiveStreamCard[]; blockedReason: string | null }
    ```
    ```json
    { "streams": [ { "id": "ls9", "slug": "a1b2c3d4e5f60718293a4b5c6d7e8f90", "title": "Q&A", "summary": null, "status": "ENDED", "visibility": "UNLISTED", "ownerUserId": "u1", "ownerName": "Asha", "ownerAvatar": null, "startedAt": "2026-11-18T18:00:00.000Z", "endedAt": "2026-11-18T18:45:00.000Z", "viewerCount": 0, "viewerPeak": 31, "isMine": true, "recording": false, "category": null } ], "blockedReason": null }
    ```
- **Form fields:** none.
- **Business rules:** Ordered by `createdAt desc`, max **50**. `blockedReason` may run `reconcileStuck` for this user, which ends their LIVE streams that have had no publisher for over 60 s, as a side effect.
- **Edge cases / notes for the mobile app:** `category` can be null for streams created before categories existed.
- **Status:** ✅ Complete

## Live Streaming → Watch stream
- **Description:** Returns one stream for the watch page, plus the HLS manifest URL while it is live.
- **Who can use it:** Any signed-in member. A valid session cookie is required (`getCurrentUser`). Works for PUBLIC and UNLISTED streams alike: anyone holding the slug can watch an UNLISTED stream.
- **Source files:** `src/app/api/user/live/[slug]/route.ts`, `src/lib/live-streams.ts` (`getBySlug`, `pathForStream`), `src/lib/mediamtx.ts` (`hlsUrl`, `isConfigured`), `src/app/live/[slug]/page.tsx`, `src/components/site/live-clients.tsx` (`LiveWatch`, `HlsPlayer`).
- **User flow:**
  1. Open a stream from a card or a shared link (`/live/<slug>`). Call `GET /api/user/live/<slug>`.
  2. If `watchUrl` is set, start the HLS player. If the stream is `IDLE`, show "Starting soon". If it is `ENDED`, show "This broadcast has ended" (the chat stays readable).
  3. Poll `GET …/viewers` every **10 s**. If it returns `live: false` while the UI thinks the stream is LIVE, refetch this endpoint (the stream has ended).
  4. Load chat (see Chat comments).
  5. Failure: 401 `Sign in to watch.`, so go to Login with a return target. 404 `Not found`.
- **Suggested mobile screen(s):** `LiveWatch`: 16:9 video (react-native-video / expo-video with `source={{ uri: watchUrl }}`), LIVE badge with viewer count, title, owner row (tap opens the profile), category chip, summary, Share (`https://worldwecare.com/live/<slug>`), and the chat panel below the video (or beside it in landscape).
- **API(s):**
  - `GET /api/user/live/[slug]`
  - Auth required: yes (member session)
  - Request: `slug` (path, 32 hex chars).
  - Response 200:
    ```ts
    interface LiveWatchResponse { stream: LiveStreamCard; watchUrl: string | null }
    ```
    ```json
    { "stream": { "id": "ls1", "slug": "3f9c0a1b2c3d4e5f60718293a4b5c6d7", "title": "Morning meditation", "summary": null, "status": "LIVE", "visibility": "PUBLIC", "ownerUserId": "u3", "ownerName": "Chloe", "ownerAvatar": null, "startedAt": "2026-11-20T07:00:00.000Z", "endedAt": null, "viewerCount": 14, "viewerPeak": 20, "isMine": false, "recording": true, "category": null }, "watchUrl": "https://stream.example.org/live/live-3f9c0a1b2c3d4e5f60718293a4b5c6d7/index.m3u8" }
    ```
  - Errors: 401 `Sign in to watch.` 404 `Not found`.
- **Form fields:** none.
- **Business rules:**
  - `watchUrl` is non-null only when streaming is configured **and** `status === "LIVE"`.
  - MediaMTX serves the manifest without a token, but only while the stream is LIVE (enforced by the auth hook).
  - ⚠️ The total view counter (`viewCount`, `noteView`) is incremented only when the **web page** `/live/[slug]` renders for a signed-in member. This API does not count views, so mobile views are not counted.
- **Edge cases / notes for the mobile app:**
  - Handle player errors (an HLS 404 right after a stream ends) by refetching this endpoint.
  - Expect 2–6 s of latency.
  - Background audio and Picture-in-Picture are optional native features.
- **Status:** ⚠️ Partial. Watching works, but the view counter only counts web page loads.

## Live Streaming → Start broadcast (publish grant)
- **Description:** The owner requests a publish ticket: a grant token plus the WHIP and HLS URLs. It also starts recording if the stream has recording enabled. It does **not** mark the stream LIVE.
- **Who can use it:** The stream owner, who must still pass the account checks (active, not banned, `canStream`, email verified if required). Streaming must be configured.
- **Source files:** `src/app/api/user/live/[slug]/start/route.ts`, `src/lib/live-streams.ts` (`startBroadcast`, `whyNotAllowedToResume`, `startRecording`), `src/lib/whip.ts`, `src/components/site/broadcast-client.tsx`.
- **User flow:**
  1. Camera preview is on. Tap **Go live**, which calls `POST …/start`.
  2. Use `publishUrl` and `token` for the WHIP POST. Display `watchUrl` and `maxDurationMin`. Set the recording toggle from `recording`.
  3. Then confirm (see Confirm go-live).
  4. Failure: 400 with a message, so show it and stay in preview.
- **Suggested mobile screen(s):** `Broadcast`: full-screen camera preview, Go Live button, mic and camera toggles, flip camera, recording switch, viewer count, share link, End button.
- **API(s):**
  - `POST /api/user/live/[slug]/start`. Auth: member (owner). No body. Response header `Cache-Control: no-store, private`.
  - Response 200:
    ```ts
    interface LiveBroadcastTicket {
      streamId: string; slug: string;
      token: string;        // 64 hex chars — send as Authorization: Bearer <token> to publishUrl
      expiresAt: string;    // now + maxDurationMin + 10 min
      publishUrl: string;   // <publicUrl>/<prefix>live-<slug>/whip
      watchUrl: string;     // <publicUrl>/<prefix>live-<slug>/index.m3u8
      maxHeight: number;    // advisory camera height cap (default 720)
      maxDurationMin: number;
      recording: boolean;
    }
    ```
    ```json
    { "streamId": "ls1", "slug": "3f9c0a1b2c3d4e5f60718293a4b5c6d7", "token": "<64-hex-token>", "expiresAt": "2026-11-20T09:10:00.000Z", "publishUrl": "https://stream.example.org/live/live-3f9c0a1b2c3d4e5f60718293a4b5c6d7/whip", "watchUrl": "https://stream.example.org/live/live-3f9c0a1b2c3d4e5f60718293a4b5c6d7/index.m3u8", "maxHeight": 720, "maxDurationMin": 120, "recording": false }
    ```
  - Errors (400):
    - `Live streaming isn't switched on yet.`
    - `That stream doesn't exist.`
    - `This isn't your stream.`
    - `That stream has already ended.`
    - `Your account can't go live.`
    - `Going live has been turned off for your account.`
    - `Verify your email address first — check your inbox for the link.`
    - `We couldn't find your account.`
- **Form fields:** none.
- **Business rules:**
  - One grant per (stream, owner). Each call **replaces** the token and resets `revokedAt`, `useCount` and `lastUsedAt`, so an old token stops working.
  - The concurrency limit is not re-checked when resuming an existing stream.
  - If `recordingEnabled` is true and recording is not already running, the server turns MediaMTX recording on. `recording` reports whether that succeeded.
  - **WHIP request the client must make:**
    - `POST publishUrl` with headers `Content-Type: application/sdp` and `Authorization: Bearer <token>`, body = SDP offer.
    - 201 = SDP answer, with a `Location` header (relative to `publishUrl`).
    - 401 or 403 = the token is invalid or expired.
    - 404 = the path is not served.
    - To stop, send `DELETE <Location>` with the same Bearer header.
    - MediaMTX also accepts the token as the Basic-auth password.
- **Edge cases / notes for the mobile app:** ⚠️ **Web-only tech.** Publishing needs WebRTC. In React Native, use `react-native-webrtc` and implement the WHIP exchange above. Put H.264 first (packetization-mode=1, profile `42e01f` preferred), or viewers will see a black picture. Keep the token in memory only; never persist or log it.
- **Status:** ⚠️ Web-only (WebRTC/WHIP publishing implemented only in the browser; the API itself is usable).

## Live Streaming → Confirm go-live
- **Description:** After the WHIP handshake, the app asks the server to verify with MediaMTX that a publisher is actually sending **playable** video. If it is, the stream flips to `LIVE`.
- **Who can use it:** The stream owner.
- **Source files:** `src/app/api/user/live/[slug]/live/route.ts`, `src/lib/live-streams.ts` (`confirmLive`, `inspectPublisher`).
- **User flow:**
  1. After the WHIP answer, call `POST …/live` up to **6 times, 1.2 s apart**, until `live: true`.
  2. On `live: true`, switch the UI to the LIVE state and start polling viewers.
  3. If it never succeeds, close the WHIP connection and show `problem`. With no problem text, show the generic message: "Your camera connected but the streaming server never received any video. This is usually a blocked UDP port (8189)…"
- **Suggested mobile screen(s):** A "Connecting…" overlay on `Broadcast`.
- **API(s):**
  - `POST /api/user/live/[slug]/live`. Auth: member (owner). No body.
  - Response 200:
    ```ts
    interface LiveConfirmResponse { live: boolean; problem?: string; tracks?: string[] }
    ```
    ```json
    { "live": true, "tracks": ["H264", "Opus"] }
    ```
    ```json
    { "live": false, "tracks": ["VP8", "Opus"], "problem": "Your browser is sending VP8 video, which viewers can't play. Broadcasts have to be H.264. ..." }
    ```
  - Errors (400): `That stream doesn't exist.`, `This isn't your stream.`, `That stream has already ended.`, and `unreachable` when the MediaMTX Control API can't be reached.
- **Form fields:** none.
- **Business rules:**
  - `live: false` with no `problem` means no publisher has registered yet.
  - Two `problem` messages exist: audio with no video ("…receiving your audio but no video…"), and a non-H.264/H.265 video codec.
  - On success, `status` becomes `LIVE` and `startedAt` is set if it was empty.
  - If streaming is not configured, the response is `{ live: false }`.
- **Edge cases / notes for the mobile app:** A 400 `unreachable` is transient, so keep retrying within the loop.
- **Status:** ✅ Complete

## Live Streaming → Recording toggle
- **Description:** The owner turns MediaMTX recording on or off during a broadcast.
- **Who can use it:** The stream owner. The stream must not be ENDED.
- **Source files:** `src/app/api/user/live/[slug]/recording/route.ts`, `src/lib/live-streams.ts` (`setRecording`, `startRecording`, `stopRecording`), `src/lib/mediamtx.ts` (`enableRecording`, `disableRecording`).
- **User flow:** Flip the "Record" switch, which calls `POST …/recording { wanted }`. Set the switch to the returned `recording`. If you asked for `true` but got `false`, show "Couldn't start recording."
- **Suggested mobile screen(s):** Recording switch with a red dot on `Broadcast`.
- **API(s):**
  - `POST /api/user/live/[slug]/recording`
  - Auth required: yes (owner)
  - Request body:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | `wanted` | boolean | no | Only the literal `true` turns recording on; anything else turns it off | `false` | `true` |

  - Response 200: `{ "recording": true }`
  - Errors (400): `That stream doesn't exist.`, `This isn't your stream.`, `That stream has already ended.`
- **Form fields:** Record (switch).
- **Business rules:**
  - Turning recording on sets `recordingEnabled = true` and adds the MediaMTX path config with `record: true` and retention-based deletion. On success it sets `recordingStartedAt`.
  - Turning it off removes the path config and sets `recordingEnabled = false` and `recordingStoppedAt`.
  - Viewers see `stream.recording` (true while `recordingStartedAt` is set). Show a "Recording" badge to viewers for transparency.
- **Edge cases / notes for the mobile app:** ⚠️ There is no member API to list or play recordings afterwards (see the infrastructure section).
- **Status:** ⚠️ Partial. Recording can be toggled, but there is no playback for members.

## Live Streaming → End broadcast
- **Description:** The owner ends their stream. This revokes the publish grant, kicks the WebRTC publisher, stops recording and marks the stream `ENDED`.
- **Who can use it:** The stream owner.
- **Source files:** `src/app/api/user/live/[slug]/end/route.ts`, `src/lib/live-streams.ts` (`endBySlug`, `endStream`).
- **User flow:** Tap **End** and confirm ("End this broadcast? Everyone watching will be disconnected."). Call `POST …/end`, then send the WHIP `DELETE` and stop the camera. Navigate to Live home.
- **Suggested mobile screen(s):** End button with a confirm dialog on `Broadcast`. End action on `MyStreams` cards.
- **API(s):**
  - `POST /api/user/live/[slug]/end`. Auth: member (owner). No body.
  - 200 `{ "ok": true }`. Idempotent: ending an already ENDED stream also returns ok.
  - Errors (400): `That stream doesn't exist.`, `This isn't your stream.`
- **Form fields:** none.
- **Business rules:**
  - Sets `endedBy = OWNER`, `endedAt = now`, `viewerCount = 0` and clears `recordingStartedAt`.
  - MediaMTX calls are best-effort; the DB write always happens.
  - Viewers' HLS stops: the auth hook denies reads on ENDED streams, and the publisher is kicked.
  - The live chat becomes read-only (`canPost: false`).
- **Edge cases / notes for the mobile app:** Also call `end` when the broadcaster leaves the screen or the app is killed, if possible. The web client tears down WHIP on `pagehide` but does **not** call `/end`, so the stream stays LIVE until a reconcile runs.
- **Status:** ✅ Complete

## Live Streaming → Viewer count
- **Description:** The current viewer count, read from MediaMTX (the number of readers on the path). Each call also updates the stored `viewerCount` and `viewerPeak`.
- **Who can use it:** Any signed-in member.
- **Source files:** `src/app/api/user/live/[slug]/viewers/route.ts`, `src/lib/live-streams.ts` (`refreshViewerCount`).
- **User flow:** Poll every **10 s** while watching or broadcasting (the web interval). A response of `live: false` means the stream ended, so refetch the stream.
- **Suggested mobile screen(s):** Eye icon with a count on `LiveWatch` and `Broadcast`.
- **API(s):**
  - `GET /api/user/live/[slug]/viewers`. Auth: member session.
  - 200:
    ```ts
    interface LiveViewersResponse { viewers: number; live: boolean }
    ```
    ```json
    { "viewers": 14, "live": true }
    ```
  - Errors: 401 `Sign in to watch.` 404 `Not found`.
- **Form fields:** none.
- **Business rules:**
  - If the stream is LIVE and MediaMTX answers: returns a fresh count with `live: true`, and stores `viewerCount` and `viewerPeak = max(peak, count)`.
  - Otherwise (not LIVE, not configured, or MediaMTX unreachable): returns the stored `viewerCount` and `live: status === "LIVE"`.
- **Edge cases / notes for the mobile app:** ⚠️ The count is `path.readers.length`. With `hlsAlwaysRemux: yes`, HLS viewers are served by MediaMTX's HLS muxer, which may be counted as a single reader rather than one per viewer. Treat the number as approximate until this is verified on the server.
- **Status:** ⚠️ Partial / Unclear. The accuracy of the HLS viewer count is unverified.

## Live Streaming → Chat comments
- **Description:** The chat beside a broadcast. GET returns recent comments; POST adds one. Posting only works while the stream is `LIVE`. Reading stays available after the stream ends.
- **Who can use it:** Signed-in members. Both GET and POST return 401 when signed out. The header comment in the route file says GET is unauthenticated; that comment is stale.
- **Source files:** `src/app/api/user/live/[slug]/comments/route.ts`, `src/lib/live-comments.ts` (`listComments`, `createComment`, `MAX_BODY`, `RATE_PER_MIN`), `src/components/site/live-chat.tsx`.
- **User flow:**
  1. When LiveWatch opens, call `GET …/comments`. Render the comments (oldest at the top). Show the composer only if `canPost` is true.
  2. Set `after = "<newest.createdAt>|<newest.id>"` (or now if empty), then open the comments stream. If the stream is ENDED, skip the stream.
  3. To send, call `POST …/comments { body }`. On 201, merge the returned `comment` (de-duplicate by id).
  4. Failures:
     - 400 `Say something first.`
     - 400 `Keep it under 500 characters.`
     - 400 `This broadcast has ended.`
     - 429 `You're sending messages very quickly. Wait a moment.`
     - 404 `Not found`
     - 401 `Sign in to watch.` (GET) or `Unauthorized` (POST)
- **Suggested mobile screen(s):** Chat panel in `LiveWatch` (and an overlay on `Broadcast` so the streamer can read along): list of rows (avatar, name, body, delete icon when `canRemove`), input with a 500-character counter, send button. When the stream has ended, show "Chat closed".
- **API(s):**
  - `GET /api/user/live/[slug]/comments`
  - Auth required: yes (member session)
  - Request:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | `after` (query) | cursor | no | `"<ISO>|<id>"`. Tail mode: everything newer, oldest first, max 200. | — | `2026-11-20T07:05:00.000Z|lc3` |
    | `limit` (query) | int | no | Page mode, clamped 10–100. Returns the newest N, oldest first. | 50 | `50` |

  - Response 200 (header `Cache-Control: no-store`):
    ```ts
    interface LiveCommentsResponse { comments: LiveComment[]; canPost: boolean }
    interface LiveComment { id: string; authorUserId: string | null; authorName: string; authorAvatar: string | null; body: string; createdAt: string; isMine: boolean; canRemove: boolean }
    ```
    ```json
    { "comments": [ { "id": "lc3", "authorUserId": "u2", "authorName": "Ben", "authorAvatar": null, "body": "Good morning!", "createdAt": "2026-11-20T07:05:00.000Z", "isMine": false, "canRemove": false } ], "canPost": true }
    ```
  - Errors: 401 `Sign in to watch.` 404 `Not found`.

  - `POST /api/user/live/[slug]/comments`
  - Auth required: yes (member)
  - Request body:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | `body` | string | yes | Trimmed, 1–500 chars | — | `"Thank you!"` |

  - Response 201: `{ "comment": LiveComment }`
  - Errors: 400 `Say something first.` / `Keep it under 500 characters.` / `This broadcast has ended.`. 429 `You're sending messages very quickly. Wait a moment.`. 401 `Unauthorized`. 404 `Not found`.
- **Form fields:**

  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | Comment | single-line text | yes | 1–500 chars | any |

- **Business rules:**
  - Rate limit: **12 comments per author per rolling 60 s**. The limit is counted across **all** streams, from the database.
  - Posting requires status `LIVE` (not IDLE).
  - The author's name and avatar are snapshotted (name truncated to 120 chars).
  - Bodies are banned-word masked.
  - Comments from users the viewer blocked are hidden from that viewer. The blocked person can still post, and is not told.
  - Removed comments are hidden.
  - `canRemove` is true for the author and for the broadcaster (`isMine` on the stream).
  - No notifications are sent.
- **Edge cases / notes for the mobile app:** There is no "older" pagination: page mode only returns the newest 10–100. UNLISTED and ended streams are readable by anyone signed in who has the slug.
- **Status:** ✅ Complete

## Live Streaming → Remove comment
- **Description:** Soft-removes a live-chat comment. The broadcaster can clear abuse from their own chat in real time.
- **Who can use it:** The comment's author, or the stream's owner (broadcaster). Admins cannot use this route: `isAdmin` is never passed.
- **Source files:** `src/app/api/user/live/[slug]/comments/[id]/route.ts`, `src/lib/live-comments.ts` (`removeComment`).
- **User flow:** Tap the delete icon (shown when `canRemove`), confirm, then call `DELETE …/comments/<id>` and remove the comment locally. A 404 means it was already gone or the viewer was not allowed.
- **Suggested mobile screen(s):** Long-press a chat row, then choose Remove.
- **API(s):**
  - `DELETE /api/user/live/[slug]/comments/[id]`. Auth: member. No body.
  - 200 `{ "ok": true }`
  - Errors: 401 `Unauthorized`. 404 `Not found`. Not-yours, already-removed, wrong stream and unknown id all return the same 404 on purpose.
- **Form fields:** none.
- **Business rules:**
  - Sets `removedAt` and `removedBy` (`AUTHOR` or `OWNER`). The row is kept for admin audit.
  - The comment must belong to the stream named by `[slug]`.
- **Edge cases / notes for the mobile app:** Removals are **not** pushed over the comments stream. Other viewers keep seeing the comment until they reload.
- **Status:** ✅ Complete

## Live Streaming → Comments stream (SSE)
- **Description:** A live-chat SSE stream for one broadcast. The server polls every **1.5 s** (faster than chat rooms) and pushes new comments.
- **Who can use it:** Signed-in members (401 otherwise). The route's header comment says it is open to signed-out users; the code requires sign-in.
- **Source files:** `src/app/api/user/live/[slug]/comments/stream/route.ts`, `src/lib/live-comments.ts` (`listComments` in tail mode), `src/lib/cursor.ts`, `src/components/site/live-chat.tsx`.
- **User flow:**
  1. After the initial GET, open `GET …/comments/stream?after=<newest cursor>`.
  2. On each `comments` event, merge the comments, de-duplicating by id.
  3. On reconnect, pass the newest `"<createdAt>|<id>"`.
  4. Do not open the stream for ENDED broadcasts (the web client skips it).
- **Suggested mobile screen(s):** Part of `LiveWatch` and `Broadcast`.
- **API(s):**
  - `GET /api/user/live/[slug]/comments/stream`
  - Auth required: yes (member session)
  - Request:

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | `after` (query) | cursor | no | `"<ISO>|<id>"` | server now | `2026-11-20T07:05:00.000Z|lc3` |

  - Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`, `X-Accel-Buffering: no`.
  - Events:
    ```
    event: comments
    data: [LiveComment, ...]      // oldest first, up to 200 per tick

    : ping                         // heartbeat after ~20 s idle
    ```
    ```ts
    type LiveCommentsStreamEvent = { event: "comments"; data: LiveComment[] };
    ```
  - Errors (JSON, before the stream starts): 401 `Sign in to watch.` 404 `Not found`.
- **Form fields:** none.
- **Business rules:**
  - Poll every 1500 ms, heartbeat every 20 s.
  - The cursor is `"<createdAt>|<id>"` of the newest delivered comment.
  - The blocked list is re-read on every tick.
  - The stream does not close by itself when the broadcast ends; close it client-side when `live` becomes false.
- **Edge cases / notes for the mobile app:** React Native has no `EventSource`. Use `react-native-sse` with a `Cookie` header, or poll `GET …/comments?after=<cursor>` every 1.5–3 s (same data). Removals are not pushed.
- **Status:** ✅ Complete

## Live Streaming → MediaMTX auth hook
- **Description:** A server-to-server endpoint that **MediaMTX** calls before every publish or read on a broadcast path. **The mobile app never calls this.** It is documented here so the access rules are clear.
- **Who can use it:** Only the MediaMTX server. If `stream.allowedIps` is set, the source IP (left-most `X-Forwarded-For`, or `X-Real-IP`) must be on that list.
- **Source files:** `src/app/api/mediamtx/auth/route.ts`, `src/lib/live-streams.ts` (`parseStreamPath`, `authoriseStream`, `noteStreamGrantUse`), `src/lib/mediamtx.ts` (`getMediamtxConfig`), `deploy/mediamtx/mediamtx.yml` (`authMethod: http`, `authHTTPAddress`).
- **User flow (server):**
  1. A client tries to publish (WHIP) or read (HLS) at MediaMTX.
  2. MediaMTX POSTs JSON to this hook.
  3. **200** with an empty body means allow. **401** with an empty body means deny, for every reason. Reasons are only logged server-side, never returned.
- **Suggested mobile screen(s):** none.
- **API(s):**
  - `POST /api/mediamtx/auth`
  - Auth required: MediaMTX source IP (optional allowlist). Publishing needs a grant token in the body.
  - Request body (sent by MediaMTX):

    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | `action` | string | yes | `publish` or `read` are evaluated. `api`, `metrics` and `pprof` are always denied. Anything else (for example `playback`) is denied. | — | `"publish"` |
    | `path` | string | yes | Must be `<pathPrefix>live-<32 hex>` | — | `"live/live-3f9c…"` |
    | `token` | string | for publish | The Bearer token from the WHIP `Authorization` header. Must be 64 chars. | — | `<64-hex>` |
    | `password` | string | alt. for publish | Used when `token` is empty (Basic-auth WHIP clients) | — | — |
    | `user`, `ip`, `protocol`, `id`, `query` | string | no | `ip` is recorded as the grant's `lastIp` | — | `"203.0.113.5"` |

  - Response: `200` (empty) or `401` (empty).
  - **Decision rules** (`authoriseStream`):
    - Streaming disabled → deny. Source IP not on the allowlist → deny. Unparseable body → deny. Bad path shape → deny.
    - Unknown stream → deny. Stream `ENDED` → deny.
    - `read`: allow only if status is `LIVE`, for both PUBLIC and UNLISTED. No token is needed.
    - `publish`: the token must be 64 chars, exist, not be revoked or expired, belong to this stream, and belong to the stream's owner.
    - Any database error → deny.
  - Side effect: on an allow that carried a token, the grant's `useCount`, `lastUsedAt` and `lastIp` are updated **after** the response is decided (fire-and-forget).

  - `GET /api/mediamtx/auth`
  - Auth required: none. **Always returns `401` with an empty body**, so probing reveals nothing.
- **Form fields:** none.
- **Business rules:** Deny is the default. The response carries no information. There is no shared secret in the URL (MediaMTX cannot add headers). See the in-file comments.
- **Edge cases / notes for the mobile app:** This explains the WHIP status codes a mobile broadcaster may see: MediaMTX turns a hook 401 into a 401 on the WHIP POST, which the web client shows as "Your place in this session has expired. Rejoin to continue." The fix is to call `/start` again for a new token. Viewers need no token, but HLS fetches fail as soon as the stream is not `LIVE`.
- **Status:** ✅ Complete

