# World We Care: mobile app

React Native app for iOS and Android, built with **Expo SDK 58** and **Expo Router**. It talks to the existing Next.js backend in [`../worldwecare.com`](../worldwecare.com).

The full feature spec (every screen, endpoint, field and rule) is in [`../worldwecare.com/docs/FEATURES.md`](../worldwecare.com/docs/FEATURES.md) and `docs/features/*.md`. Build features from those files.

## Getting started

```bash
cd Mobile
npm install
cp .env.example .env.local      # set EXPO_PUBLIC_API_URL to your backend
npx expo start                  # press a (Android) or i (iOS)
```

- On a real phone, `EXPO_PUBLIC_API_URL` must be your computer's LAN IP (e.g. `http://192.168.1.10:3000`), not `localhost`.
- Checks: `npm run typecheck`, then `npm run doctor`.
- Builds: `npx eas-cli@latest build --profile development|preview|production` (profiles are in `eas.json`).

## Tech stack

| Concern | Choice | Why |
|---|---|---|
| Navigation | Expo Router (file-based, `src/app/`) | Deep links for free; auth gate via `Stack.Protected` |
| Server data | TanStack Query | Caching, infinite scroll, refetch on app focus, retries |
| Client state | Zustand | Tiny stores for session and theme only |
| Forms | react-hook-form + zod | Same validation messages as the web (`signup-rules.ts`) |
| Images | expo-image | Caching and smooth loading for feed media |
| API types | `src/types/api-types.ts` | Copied from the backend docs; `npm run sync-types` refreshes it |

## Folder structure

```
Mobile/
├── src/
│   ├── app/                    # ROUTES ONLY: every file is a screen (Expo Router)
│   │   ├── _layout.tsx         # providers + auth gate (Stack.Protected)
│   │   ├── (auth)/             # signed out: login, signup, forgot-password
│   │   ├── verify-email.tsx    # signed in, email not confirmed
│   │   └── (app)/              # signed in
│   │       ├── (tabs)/         # Feed · Messages · Alerts · Profile
│   │       └── settings.tsx    # screens pushed over the tabs
│   ├── features/               # ONE FOLDER PER BACKEND MODULE
│   │   ├── auth/               # api/ hooks/ store/ schemas/ components/ index.ts
│   │   ├── feed/
│   │   └── profile/
│   ├── lib/
│   │   ├── api/                # HTTP client, ApiError, QueryClient, query keys
│   │   └── utils/              # media URLs, time-ago
│   ├── ui/                     # design-system components (AppText, Button, TextField, Screen, state views)
│   ├── theme/                  # tokens (web "Sky" palette, light + dark), useTheme()
│   ├── providers/              # AppProviders (SafeArea, QueryClient, StatusBar)
│   ├── config/env.ts           # EXPO_PUBLIC_* config
│   └── types/api-types.ts      # backend request/response types
├── scripts/sync-api-types.js
├── app.json · eas.json · .env.example
```

### Rules that keep it clean

1. **`src/app/` holds routes only.** Screens stay thin: they call hooks and render `ui/` components. No `fetch` in screens.
2. **A feature is a folder** with `api/` (endpoint calls), `hooks/` (TanStack Query wrappers), `components/`, an optional `store/` or `schemas/`, and an `index.ts` that is its public surface. Import `@/features/feed`, never deep paths from another feature.
3. **All HTTP goes through `src/lib/api/client.ts`.** It handles the base URL, cookies, the timeout, JSON, and turning every failure into an `ApiError`.
4. **Query keys live in `src/lib/api/query-keys.ts`.**
5. **No hex colours in components.** Use `useTheme().colors`.
6. **Use `@/` imports** (mapped to `src/`).

## Auth: how it works

The backend authenticates with **HttpOnly cookies** (`wwc-user-session`, `wwc-user-verified`); it has no bearer tokens. React Native's native networking keeps and resends cookies per host, so the client sends `credentials: "include"` and never handles the token itself.

`useSession` (in `features/auth/store`) is a small state machine:

| Status | How it's decided | What the user sees |
|---|---|---|
| `loading` | app start | native splash |
| `signedOut` | `GET /api/user/profile` → 401 | `(auth)` stack |
| `unverified` | 403 with `needsVerification: true` | verify-email gate (checks every 15 s and on app focus) |
| `signedIn` | profile returned | `(app)` tabs |

Any 401 from any endpoint signs the user out (`setUnauthorizedHandler`). Login and signup call `refresh-verified` and then re-check the profile.

**Backend change recommended for production:** add `Authorization: Bearer` support and refresh tokens (see FEATURES.md → mobile gaps). When that lands, store the token with `expo-secure-store` (already installed) and change only `lib/api/client.ts`.

## Adding a feature (recipe)

1. Read its spec in `worldwecare.com/docs/features/<module>.md`.
2. Create `src/features/<name>/api/<name>-api.ts`, typed with `@/types/api-types` (for example `Feed.FeedPage`).
3. Add query keys, then hooks in `hooks/` (`useQuery`, `useInfiniteQuery` for cursor lists, `useMutation` + `invalidateQueries`).
4. Build components with `@/ui` and `useTheme()`.
5. Add the route file under `src/app/(app)/…` and keep it thin.
6. Run `npm run typecheck`.

## What's built

| Area | State |
|---|---|
| Architecture, API client, theming, UI kit | ✅ |
| Login, signup (captcha + country picker), forgot password, verify-email gate, sign out | ✅ |
| Feed list (infinite scroll, pull to refresh) | ✅ basic card: reactions, comments, compose, video still to do |
| Profile (header + journey stats), settings (appearance, sign out) | ✅ basic |
| Messages, notifications | placeholder screens linked to their specs |
| Everything else in FEATURES.md (241 features) | to do, module by module |

Suggested build order: feed actions and comments → notifications → messaging (DMs, rooms) → content (articles, clips, events) → places and donations → settings.

## Known issues and next steps

- **Tab icons:** `@expo/vector-icons` and `eslint-config-expo` can't be installed yet. The SDK 58 template pins `react@19.3.0`, but `react-dom@19.3.1` wants `19.3.1` (npm ERESOLVE). Re-try with `npx expo install --fix` after the next Expo patch. Tabs are text-only until then. Don't use `--force`.
- **Lint:** not set up for the same reason (`npx expo lint` once the conflict is fixed).
- **Deep links:** the email confirm/reset links open the website. Add universal links / app links (`scheme: "worldwecare"` is set) plus the backend endpoints listed in FEATURES.md.
- **Real-time:** the backend uses Server-Sent Events. That needs an SSE client (e.g. `react-native-sse`) when messaging is built.
- **Push notifications:** none on the backend yet (see FEATURES.md gaps).
- **Bundle ids:** `com.worldwecare.app` in `app.json` is a placeholder. Confirm it before the first store build.
- **Expo web:** not a target. Cookie auth across origins won't work there; the website is the web app.
