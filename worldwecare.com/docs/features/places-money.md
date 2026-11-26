# Places Directory, Town Heroes, Geography, Donations & Payouts

**Module key:** `places-money`

This module covers five areas that share a few libraries:

- **Geography**: the public country and state/region lists that every picker uses.
- **Places Directory**: a map and list of help places (clinics, food banks, shelters and so on). Members search and filter it, save places, keep named filter sets, report wrong listings, and submit new places. Submissions are geocoded through OpenStreetMap Nominatim and wait for an admin to approve them.
- **Town Heroes**: members nominate local people. An admin approves the nomination before it is public. Members can "heart" approved heroes. Admins manage the categories.
- **Donations**: Stripe Checkout (hosted page, redirect flow). A donation can go to a campaign, an event (credits the host), a live stream (credits the broadcaster), a member, or WorldWeCare itself. A Stripe webhook turns payments, refunds and disputes into ledger rows.
- **Payouts**: members who received donations save payout methods (PayPal, bank, Wise, posted cheque; details encrypted at rest) and request withdrawals. An admin sends the money by hand.

Conventions in this module:
- Money is always an **integer number of cents**. Fees are **basis points** (100 bp = 1%).
- Dates are ISO-8601 strings.
- Errors have the shape `{ "error": string }`.
- `requireUser` returns `401 { "error": "Unauthorized" }` when there is no valid session.
- Middleware returns `403 { "error": "Confirm your email address first.", "needsVerification": true }` to a signed-in but unverified member on `/api/user/*`. `/api/public/*` and `/api/webhooks/*` are exempt.

## Table of contents

1. [Geography → Country list](#geography--country-list)
2. [Geography → State / region list](#geography--state--region-list)
3. [Places → Type tiles & category pages](#places--type-tiles--category-pages)
4. [Places → Browse, search & map](#places--browse-search--map)
5. [Places → Place detail](#places--place-detail)
6. [Places → Submit a place](#places--submit-a-place)
7. [Places → Save / unsave a place](#places--save--unsave-a-place)
8. [Places → Saved filter sets](#places--saved-filter-sets)
9. [Places → Report a listing](#places--report-a-listing)
10. [Town Heroes → List & search](#town-heroes--list--search)
11. [Town Heroes → Hero detail](#town-heroes--hero-detail)
12. [Town Heroes → Home highlights](#town-heroes--home-highlights)
13. [Town Heroes → Categories](#town-heroes--categories)
14. [Town Heroes → Nominate a hero](#town-heroes--nominate-a-hero)
15. [Town Heroes → Heart a hero](#town-heroes--heart-a-hero)
16. [Donations → Config](#donations--config)
17. [Donations → Start checkout (Stripe Checkout)](#donations--start-checkout-stripe-checkout)
18. [Donations → Thanks / cancelled return pages](#donations--thanks--cancelled-return-pages)
19. [Donations → Giving & receiving history](#donations--giving--receiving-history)
20. [Donations → Stripe webhook](#donations--stripe-webhook)
21. [Payouts → Overview & balance](#payouts--overview--balance)
22. [Payouts → Request a withdrawal](#payouts--request-a-withdrawal)
23. [Payouts → Cancel a withdrawal request](#payouts--cancel-a-withdrawal-request)
24. [Payouts → Payout methods](#payouts--payout-methods)

## Endpoints in this module

| Method | Path | Feature | Auth |
|---|---|---|---|
| GET | `/api/public/geo/countries` | Geography → Country list | Public |
| GET | `/api/public/geo/states` | Geography → State / region list | Public |
| GET | `/api/public/place-types` | Places → Type tiles | Public |
| GET | `/api/user/places` | Places → Browse, search & map | Member |
| POST | `/api/user/places` | Places → Submit a place | Member |
| POST | `/api/user/places/[id]/save` | Places → Save / unsave | Member |
| POST | `/api/user/places/[id]/report` | Places → Report a listing | Member |
| GET | `/api/user/places/filters` | Places → Saved filter sets | Member |
| POST | `/api/user/places/filters` | Places → Saved filter sets | Member |
| DELETE | `/api/user/places/filters/[id]` | Places → Saved filter sets | Member |
| GET | `/api/user/town-heroes` | Town Heroes → List & search | Member |
| POST | `/api/user/town-heroes` | Town Heroes → Nominate | Member |
| POST | `/api/user/town-heroes/[id]/heart` | Town Heroes → Heart | Member |
| GET | `/api/public/town-heroes` | Town Heroes → Home highlights | Public |
| GET | `/api/public/town-hero-categories` | Town Heroes → Categories | Public |
| GET | `/api/public/donations/config` | Donations → Config | Public |
| POST | `/api/user/donations/checkout` | Donations → Start checkout | Optional (guest allowed) |
| GET | `/api/user/donations` | Donations → History | Member |
| POST | `/api/webhooks/stripe` | Donations → Stripe webhook | Stripe signature |
| GET | `/api/user/payouts` | Payouts → Overview & balance | Member |
| POST | `/api/user/payouts` | Payouts → Request a withdrawal | Member |
| DELETE | `/api/user/payouts/[id]` | Payouts → Cancel request | Member |
| GET | `/api/user/payouts/methods` | Payouts → Payout methods | Member |
| POST | `/api/user/payouts/methods` | Payouts → Payout methods | Member |
| PATCH | `/api/user/payouts/methods/[id]` | Payouts → Payout methods | Member |
| DELETE | `/api/user/payouts/methods/[id]` | Payouts → Payout methods | Member |

"Member" means a signed-in member with a verified email who is not banned or deactivated. That is what `requireUser` accepts.

---

## Geography → Country list
- **Description:** Returns the active countries, sorted by name. Used by the country switcher, place submission, hero nomination and signup. The same lib function serves the signup page.
- **Who can use it:** Anyone. No auth.
- **Source files:** `src/app/api/public/geo/countries/route.ts`, `src/lib/geography.ts`, `src/lib/country-name.ts` (localised label helper used on the client)
- **User flow:**
  1. The app opens a screen that has a country picker.
  2. It calls `GET /api/public/geo/countries` and shows `emojiFlag + name`.
  3. Success: the list is shown. There is no error path in the handler. A DB failure returns a 500 from Next.js.
- **Suggested mobile screen(s):** `CountryPicker` (searchable modal list: flag, name). Reused on Places, Town Heroes and the Nominate form.
- **API(s):**
  - `GET /api/public/geo/countries`
  - Auth required: no
  - Request: no params.
  - Response (success):
    ```ts
    interface GeoCountriesResponse { items: { id: string; name: string; code: string; slug: string; emojiFlag: string | null }[] }
    ```
    ```json
    { "items": [ { "id": "ck_ie", "name": "Ireland", "code": "IE", "slug": "ireland", "emojiFlag": "🇮🇪" } ] }
    ```
  - Errors: none defined (500 only on server failure).
- **Form fields:** n/a
- **Business rules:** Only `isActive = true` countries are returned, ordered by `name` ascending. Response header is `Cache-Control: public, max-age=60, stale-while-revalidate=300`.
- **Edge cases / notes for the mobile app:** Not paginated (the full list). Cache it locally. Names come back in English. To localise, use `Intl.DisplayNames` with `code` and fall back to `name`. This is what `countryLabel()` in `src/lib/country-name.ts` does on the web.
- **Status:** ✅ Complete

## Geography → State / region list
- **Description:** The active states, provinces or regions of one country. Used by the directory's region filter.
- **Who can use it:** Anyone. No auth.
- **Source files:** `src/app/api/public/geo/states/route.ts`
- **User flow:**
  1. The user picks a country.
  2. The app calls `GET /api/public/geo/states?countryId=…`.
  3. If `items` is empty, hide the region filter. The country has no regions.
- **Suggested mobile screen(s):** Region dropdown inside the `PlacesFilters` sheet.
- **API(s):**
  - `GET /api/public/geo/states`
  - Auth required: no
  - Request (query):
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | countryId | string | no (but needed) | Missing → `{ items: [] }` | – | `ck_ie` |
  - Response (success):
    ```ts
    interface GeoStatesResponse { items: { id: string; name: string; code: string | null; slug: string }[] }
    ```
    ```json
    { "items": [ { "id": "st_mun", "name": "Munster", "code": "M", "slug": "munster" } ] }
    ```
  - Errors: none defined.
- **Form fields:** n/a
- **Business rules:** `isActive = true`, ordered by `sortOrder` then `name`. Cached 60 s, the same as countries.
- **Edge cases / notes for the mobile app:** Clear the selected `stateId` when the country changes. The web client does this.
- **Status:** ✅ Complete

## Places → Type tiles & category pages
- **Description:** The fixed list of 10 place types (an enum, not an admin table). Each type has a label, emoji, pin colour, URL slug, blurb and the count of APPROVED places, optionally narrowed to a country. Empty types are still returned.
- **Who can use it:** Anyone. No auth. The directory itself needs sign-in, though.
- **Source files:** `src/app/api/public/place-types/route.ts`, `src/lib/places.ts` (`PLACE_TYPES`, `listPlaceTypeTiles`), `src/lib/place-kinds-text.ts` (translated labels and blurbs), `src/app/places/category/[slug]/page.tsx` (redirects to `/places?category=<slug>`)
- **User flow:**
  1. The directory screen loads and calls `GET /api/public/place-types?countryId=…`.
  2. It shows 10 tiles. Tapping a tile sets the `types` filter on the list (see Browse).
  3. The web URL `/places/category/<slug>` only redirects to `/places?category=<slug>`, and the client maps the slug to a type.
- **Suggested mobile screen(s):** `PlacesHome` tile grid (emoji in a coloured disc, label, blurb, count or "Nothing yet").
- **API(s):**
  - `GET /api/public/place-types`
  - Auth required: no
  - Request (query):
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | countryId | string | no | Narrows the counts | all countries | `ck_ie` |
  - Response (success):
    ```ts
    interface PlaceTypesResponse { types: { value: PlaceType; label: string; emoji: string; colour: string; slug: string; blurb: string; count: number }[] }
    ```
    ```json
    { "types": [ { "value": "FOOD_BANK", "label": "Food bank", "emoji": "🥫", "colour": "#f59e0b", "slug": "food-banks", "blurb": "Parcels, pantries and hot meals.", "count": 12 } ] }
    ```
  - Errors: none defined.
- **Form fields:** n/a
- **Business rules:** The types, in fixed order, are `RECOVERY_PROGRAM` (recovery-programs), `CLINIC` (clinics), `COUNSELLING` (counselling), `CHURCH` (faith-groups), `FOOD_BANK` (food-banks), `ANIMAL_SHELTER` (animal-shelters), `SHELTER` (shelters), `COMMUNITY_CENTRE` (community-centres), `DONATING_BUSINESS` (donating-businesses), `OTHER` (other). Counts include only `status = APPROVED` places.
- **Edge cases / notes for the mobile app:** Labels are English. Translated strings live in `place-kinds-text.ts` under the `placeKind.*` i18n keys. Not cached (`force-dynamic`).
- **Status:** ✅ Complete

## Places → Browse, search & map
- **Description:** One endpoint serves all three directory views: **List** (paged), **Map** (viewport bounding box, only places with coordinates) and **Saved** (only the viewer's saved places). Only APPROVED places are returned.
- **Who can use it:** Verified members. The web page `/places` redirects signed-out users to `/login?next=/places`.
- **Source files:** `src/app/api/user/places/route.ts` (GET), `src/lib/places.ts` (`listPlaces`), `src/lib/geocode.ts` (`boundingBox`, `distanceKm`, `isValidCoordinate`), `src/app/places/page.tsx`, `src/components/site/places-client.tsx`
- **User flow:**
  1. The user opens the directory. The app calls `GET /api/user/places?perPage=50` (plus `countryId` from the active country).
  2. The user types a search, toggles type chips, toggles "donor only", or picks a region. Refetch after a 250 ms debounce. Keep only the newest response, as the web does.
  3. Map tab: send `mappable=1&perPage=200&lat=&lng=&km=` for the visible viewport. Results are sorted by distance.
  4. Saved tab: send `saved=1`. All other filters still apply.
  5. Empty result: show an empty state with a link to "Add a place".
  6. Failure: 401 → sign-in screen. 403 needsVerification → verify-email screen.
- **Suggested mobile screen(s):** `PlacesDirectory` with segmented tabs List / Map / Saved, a search bar, a type-chip row, a "Donor businesses" toggle, a region dropdown and a "Saved filters" menu. `PlacesMap` with a pin colour per type (`colour`) and a bottom-sheet card.
- **API(s):**
  - `GET /api/user/places`
  - Auth required: yes (member)
  - Request (query):
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | types | string | no | Comma-separated PlaceType values, case-insensitive. Unknown values are dropped. | all | `FOOD_BANK,SHELTER` |
    | donorOnly | "1" | no | Only `isDonor = true` | off | `1` |
    | countryId | string | no | Exact match | – | `ck_ie` |
    | stateId | string | no | Exact match | – | `st_mun` |
    | saved | "1" | no | Only places the viewer saved (newest 500 saves) | off | `1` |
    | q | string | no | Substring match on name, summary, city, needs | – | `soup` |
    | lat | number | no | Used only if lat, lng and km are all finite and valid | – | `53.34` |
    | lng | number | no | see lat | – | `-6.26` |
    | km | number | no | Half-size of the box. Clamped 1..2000. | – | `15` |
    | mappable | "1" | no | Only rows with lat/lng (ignored when a viewport is given) | off | `1` |
    | page | int | no | ≥ 1 | 1 | `2` |
    | perPage | int | no | 1..200 | 50 | `50` |
  - Response (success):
    ```ts
    interface PlacesListResponse {
      places: {
        id: string; slug: string; name: string; type: PlaceType; summary: string | null;
        addressLine: string | null; city: string | null; postcode: string | null;
        latitude: number | null; longitude: number | null; phone: string | null; website: string | null;
        isDonor: boolean; coverUrl: string | null; saveCount: number; needs: string | null;
        countryId: string | null; saved: boolean; distanceKm: number | null;
      }[];
      total: number; page: number; perPage: number; pageCount: number;
    }
    ```
    ```json
    { "places": [ { "id": "cpl1", "slug": "st-annes-food-bank", "name": "St Anne's Food Bank", "type": "FOOD_BANK", "summary": "Parcels Tue/Thu", "addressLine": "12 Main St", "city": "Cork", "postcode": "T12 X1Y2", "latitude": 51.897, "longitude": -8.47, "phone": "+353 21 000 0000", "website": "https://example.org", "isDonor": false, "coverUrl": "/uploads/places/a.jpg", "saveCount": 4, "needs": "Tinned fish, nappies", "countryId": "ck_ie", "saved": true, "distanceKm": 1.8 } ], "total": 1, "page": 1, "perPage": 50, "pageCount": 1 }
    ```
  - Errors: 401 `Unauthorized` (no session). 403 `Confirm your email address first.` (middleware).
- **Form fields:** filters only (see query table).
- **Business rules:**
  - Default order: `isDonor` descending, then `name` ascending. With a viewport, the returned page is re-sorted by `distanceKm` ascending. Distance is computed only for that page, after the box filter.
  - The bounding box is `latDelta = km/111` and `lngDelta = km/(111·max(0.05, cos(lat)))`, clamped to valid ranges. Coordinates (0,0) count as invalid.
  - `distanceKm` is the great-circle distance in km. It is null when there is no viewport or the place has no coordinates.
  - The read path never geocodes.
- **Edge cases / notes for the mobile app:** Page-based pagination (`page`/`perPage`, max 200). With a viewport, the distance sort only applies inside one page. Use `perPage=200` on the map, as the web does. `coverUrl` is a relative `/uploads/...` path, so prefix it with the site origin. Directions on the web link to OpenStreetMap (`directionsUrl()` in `places.ts`). Mobile can open the native maps app with lat/lng.
- **Status:** ✅ Complete

## Places → Place detail
- **Description:** The full place page: about (Markdown), photo gallery, opening hours, email, region, view count, linked chat room (created when the place is approved), and country name and flag. It also bumps `viewCount`.
- **Who can use it:** Verified members (the web page redirects to login otherwise). Only APPROVED places are found.
- **Source files:** `src/app/places/[slug]/page.tsx`, `src/lib/places.ts` (`getPlaceBySlug`, `recordPlaceView`, `parseHours`, `directionsUrl`, `mapUrl`), `src/components/site/place-detail-client.tsx`
- **User flow:**
  1. The user taps a place card. The web renders `/places/<slug>` on the server.
  2. A missing or not-approved slug → 404 page.
  3. The page offers Save (`POST /api/user/places/[id]/save`), Report (`POST /api/user/places/[id]/report`), Directions (OSM), and the chat room link.
- **Suggested mobile screen(s):** `PlaceDetail`: cover and gallery carousel, name, type badge, donor badge, summary, about, an hours table (Sun–Sat, "closed"), needs, Call / Website / Email / Directions buttons, a Save heart with count, a "Report a problem" link, and a "Join chat" button.
- **API(s):** ⚠️ **None.** No JSON endpoint returns a single place. The page reads the DB directly with `getPlaceBySlug(slug, viewerId)`. Data shape (for a future API) is in `PlaceDetail` in `places-money.ts`: the card fields plus `photos [{url, alt}]`, `about`, `email`, `hours [{day 0-6, opens "HH:MM", closes, closed}]`, `stateId`, `viewCount`, `chatRoomId`, `geocodedAt`, `createdAt`, `room {id, slug, name, memberCount} | null`, `country {name, emojiFlag} | null`, `saved`.
- **Form fields:** n/a
- **Business rules:** Hours are parsed defensively. Malformed entries are dropped, and `day` must be 0..6 (0 = Sunday). The view count increment is fire-and-forget.
- **Edge cases / notes for the mobile app:** Until a detail API exists, mobile can show only the card fields from the list endpoint. Or it can open the web page in a WebView.
- **Status:** ⚠️ Web-only (no API)

## Places → Submit a place
- **Description:** A member suggests a new place. The address is geocoded on the way in (OpenStreetMap Nominatim) so the reviewing admin sees a pin. The place is created `PENDING` and all admins are notified.
- **Who can use it:** Verified members.
- **Source files:** `src/app/api/user/places/route.ts` (POST), `src/lib/places-admin.ts` (`submitPlace`, `normalise`, `geocodeFields`, `reviewPlace`), `src/lib/geocode.ts`, `src/lib/attached-media.ts` (`sanitiseImages`, `MAX_GALLERY_PHOTOS = 10`), `src/app/places/new/page.tsx`, `src/components/site/place-new-client.tsx`
- **User flow:**
  1. The user opens "Add a place". The app loads countries (`GET /api/public/geo/countries`).
  2. The user fills in the form and uploads photos through `POST /api/user/upload` with category `places` (another module). The web allows 6 photos. The first becomes `coverUrl` and the rest go in `photos`.
  3. Submit `POST /api/user/places`. Success (201): show "Thanks, a moderator will review it". The place is not on the map yet. Do not navigate to its page.
  4. Failure (400): show `error`, for example "Name is required" or "The website must start with http:// or https://".
  5. Later, the member gets an in-app notification: PLACE_APPROVED ("Your place was added", link `/places/<slug>`) or PLACE_REJECTED (with the reason).
- **Suggested mobile screen(s):** `PlaceSubmit` form plus a success state.
- **API(s):**
  - `POST /api/user/places`
  - Auth required: yes (verified member). The route also re-checks `emailVerifiedAt`.
  - Request body (JSON):
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | name | string | yes | Trimmed, non-empty, cut to 200 | – | `St Anne's Food Bank` |
    | type | PlaceType | no | One of the 10 values (not validated server-side, so send a valid one) | `OTHER` | `FOOD_BANK` |
    | summary | string\|null | no | Cut to 400 | null | `Parcels Tue/Thu` |
    | about | string\|null | no | Markdown, cut to 20000 | null | |
    | addressLine | string\|null | no | Cut to 300 | null | `12 Main St` |
    | city | string\|null | no | Cut to 120 | null | `Cork` |
    | postcode | string\|null | no | Cut to 30 | null | `T12 X1Y2` |
    | countryId | string\|null | no | Cut to 60. Its name is used for geocoding. | null | `ck_ie` |
    | stateId | string\|null | no | Cut to 60 | null | |
    | phone | string\|null | no | Cut to 40 | null | |
    | email | string\|null | no | Cut to 200 (format not checked) | null | |
    | website | string\|null | no | Must start with `http://` or `https://`. Cut to 500. | null | `https://example.org` |
    | hours | array\|null | no | `[{day:0-6, opens:"H:MM"/"HH:MM", closes, closed?}]`. Invalid rows are dropped. A row without `closed` needs both times. | none | `[{"day":1,"opens":"09:00","closes":"17:00"}]` |
    | needs | string\|null | no | Cut to 4000 | null | `Tinned fish` |
    | coverUrl | string\|null | no | Cut to 500. Use an uploaded `/uploads/...` URL. | null | |
    | photos | `{url, alt?}[]`\|null | no | Entries without a `url` are dropped. Max 10 kept. | null | |
    | latitude / longitude / isDonor / status | – | – | **Ignored for members.** The server forces `isDonor=false`, `status=PENDING` and geocoded coordinates. | | |
  - Response (success, 201):
    ```ts
    interface SubmitPlaceResponse { ok: true; id: string; slug: string; name: string }
    ```
    ```json
    { "ok": true, "id": "cpl9", "slug": "st-annes-food-bank", "name": "St Anne's Food Bank" }
    ```
  - Errors: 400 `Name is required`; 400 `The website must start with http:// or https://`; 400 `Could not add the place` (other failures); 403 `Verify your email address before adding a place.`; 401 `Unauthorized`.
- **Form fields:**
  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | Name | text | yes | ≤200 | |
  | Type | select | yes (UI) | | 10 PlaceType values |
  | Short summary | text | no | ≤400 | |
  | Address / City / Postcode | text | no | ≤300 / 120 / 30 | |
  | Country | picker | no | | active countries |
  | Phone | tel | no | ≤40 | |
  | Website | url | no | http(s) only | |
  | What they need | textarea | no | ≤4000 | |
  | Photos | image picker | no | web max 6, server max 1 cover + 10 gallery | |
- **Business rules:**
  - The slug is made from the name, with `-2`, `-3` and so on added when it clashes.
  - Geocoding: the query is `addressLine, city, postcode, country name`. Calls are queued globally at most one per 1.1 s, with a 15 s timeout. A failure never blocks the submission. The place is saved with `latitude/longitude = null` and a `geocodeError` that admins can see. `GEOCODING_DISABLED=1` turns geocoding off. Env vars: `NOMINATIM_URL`, `GEOCODER_CONTACT`.
  - Because of the queue, the request can take several seconds when the queue is busy.
  - Side effect: an admin notification `PLACE_PENDING` goes to all admins (`places-admin.ts:382`).
  - Statuses: `PENDING → APPROVED | REJECTED` (admin). `CLOSED` exists in the enum but no member flow uses it. On approval a chat room is created for the place, and the submitter gets an in-app notification (`places-admin.ts:415`).
- **Edge cases / notes for the mobile app:** There is no "my submissions" endpoint, so a member cannot see their pending places. No rate limit.
- **Status:** ✅ Complete

## Places → Save / unsave a place
- **Description:** Toggles the viewer's bookmark on a place and returns the new state and the recount.
- **Who can use it:** Verified members.
- **Source files:** `src/app/api/user/places/[id]/save/route.ts`, `src/lib/places.ts` (`togglePlaceSave`)
- **User flow:** Tap the heart/bookmark → `POST` → update the UI from the response. On error, roll back the optimistic change.
- **Suggested mobile screen(s):** Bookmark button on `PlaceCard` and `PlaceDetail`. Saved tab in `PlacesDirectory`.
- **API(s):**
  - `POST /api/user/places/[id]/save`
  - Auth required: yes (member)
  - Request: path `id` (place id). No body.
  - Response (success):
    ```ts
    interface PlaceSaveToggleResponse { saved: boolean; saveCount: number }
    ```
    ```json
    { "saved": true, "saveCount": 5 }
    ```
  - Errors: 400 `Could not update` (for example an unknown place id fails the foreign key); 401.
- **Form fields:** n/a
- **Business rules:** A toggle. If a save exists it is deleted, otherwise it is created. `Place.saveCount` is then recounted from the saves table. The place's status is **not** checked, so a non-approved place id can be saved.
- **Edge cases / notes for the mobile app:** It is not idempotent. Two quick taps cancel each other out, so debounce or disable the button while the request is in flight.
- **Status:** ✅ Complete

## Places → Saved filter sets
- **Description:** A member names and stores a combination of directory filters (types, donor only, region, search text) and re-applies it later. Up to 20 per member.
- **Who can use it:** Verified members.
- **Source files:** `src/app/api/user/places/filters/route.ts`, `src/app/api/user/places/filters/[id]/route.ts`, `src/lib/places.ts` (`listFilterSets`, `saveFilterSet`, `cleanFilters`, `deleteFilterSet`)
- **User flow:**
  1. When the directory opens, `GET /api/user/places/filters` loads the sets into a menu.
  2. "Save these filters" → ask for a name → `POST`. 201 adds it to the menu. 400 shows the error (no name, or 20 already saved).
  3. Tap a set → apply its `filters` to the UI.
  4. Delete → `DELETE /api/user/places/filters/[id]` → remove it from the menu.
- **Suggested mobile screen(s):** "Saved filters" bottom sheet in `PlacesDirectory` (list with a delete swipe, plus a "Save current" button and a name prompt).
- **API(s):**
  - `GET /api/user/places/filters`
    - Auth required: yes (member)
    - Response:
      ```ts
      interface PlaceFilterSetsResponse { sets: { id: string; name: string; filters: { types?: PlaceType[]; donorOnly?: true; stateId?: string; q?: string }; createdAt: string }[] }
      ```
      ```json
      { "sets": [ { "id": "cfs1", "name": "Food near me", "filters": { "types": ["FOOD_BANK"], "q": "soup" }, "createdAt": "2026-11-01T10:00:00.000Z" } ] }
      ```
    - Errors: 401.
  - `POST /api/user/places/filters`
    - Auth required: yes (member)
    - Request body:
      | Field | Type | Required | Validation / Rules | Default | Example |
      |---|---|---|---|---|---|
      | name | string | yes | Trimmed, non-empty, cut to 80 | – | `Food near me` |
      | filters.types | PlaceType[] | no | Unknown values dropped | – | `["FOOD_BANK"]` |
      | filters.donorOnly | boolean | no | Kept only if `true` | – | `true` |
      | filters.stateId | string | no | Kept only if ≤ 40 chars | – | `st_mun` |
      | filters.q | string | no | Trimmed, cut to 120 | – | `soup` |
    - Response (201):
      ```ts
      interface SavePlaceFilterSetResponse { ok: true; set: { id: string; name: string; filters: PlaceFilterSetFilters } }
      ```
      ```json
      { "ok": true, "set": { "id": "cfs2", "name": "Shelters", "filters": { "types": ["SHELTER"] } } }
      ```
    - Errors: 400 `Give the filter set a name`; 400 `That's 20 saved filters — remove one first.`; 400 `Could not save`; 401.
  - `DELETE /api/user/places/filters/[id]`
    - Auth required: yes (member)
    - Request: path `id`.
    - Response: `{ "ok": true }`. This is returned even if the id does not exist or belongs to someone else, in which case nothing is deleted.
    - Errors: 401.
- **Form fields:**
  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | Name | text | yes | 1–80 chars | |
- **Business rules:** Any other keys in `filters` are dropped. In particular **`countryId` is not stored**, even though the schema comment mentions it. A set re-applies against the current country. The list returns the newest first, at most 20.
- **Edge cases / notes for the mobile app:** Not paginated (max 20). Pressing the "save filters" button with no filters active stores `{}`.
- **Status:** ✅ Complete

## Places → Report a listing
- **Description:** "This place is wrong." A member flags an approved listing with a reason and optional notes. This is a separate queue from content/user reports.
- **Who can use it:** Verified members, and only for APPROVED places.
- **Source files:** `src/app/api/user/places/[id]/report/route.ts`, `src/lib/place-reports.ts`, `src/lib/place-report-kinds.ts`, `src/components/site/report-place-modal.tsx`
- **User flow:**
  1. On the place detail, tap "Report a problem". A sheet shows the 6 reasons and a notes box.
  2. Submit → `POST`. Success shows "Thanks". If `updated: true`, the member's earlier open report was replaced.
  3. Failure: 400 "Pick what's wrong" (no or invalid kind) or "Place not found".
- **Suggested mobile screen(s):** `ReportPlaceSheet` (radio list of reasons, a multiline notes field, Send).
- **API(s):**
  - `POST /api/user/places/[id]/report`
  - Auth required: yes (member)
  - Request body:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | kind | enum | yes | `CLOSED_DOWN`, `MOVED`, `WRONG_DETAILS`, `DUPLICATE`, `NOT_APPROPRIATE`, `OTHER` | – | `MOVED` |
    | notes | string | no | Trimmed, cut to 2000. Empty → null. | null | `Now at 4 Quay St` |
  - Response (success):
    ```ts
    interface ReportPlaceResponse { ok: true; updated: boolean }
    ```
    ```json
    { "ok": true, "updated": false }
    ```
  - Errors: 400 `Pick what's wrong`; 400 `Place not found` (missing or not approved); 400 `Could not send that`; 401.
- **Form fields:**
  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | What's wrong | radio | yes | | It has closed down / It has moved / The details are wrong / It's listed twice / It doesn't belong here / Something else |
  | Notes | textarea | no | ≤2000 | |
- **Business rules:** One OPEN report per member per place. A second report updates the existing one (kind, notes, createdAt) and does **not** notify admins again. A new report creates an admin notification `PLACE_REPORTED` (`place-reports.ts:77`). Report statuses: `OPEN → RESOLVED | DISMISSED` (admin only). The reporter is not notified of the outcome.
- **Edge cases / notes for the mobile app:** Reason labels have i18n keys `placeReport.*` (see `placeReportKinds(t)`).
- **Status:** ✅ Complete

## Town Heroes → List & search
- **Description:** The Town Heroes wall. Returns APPROVED heroes plus the viewer's own nominations in any status, so a member can see theirs waiting for review. Filters: country, category slug, and text search. Paged.
- **Who can use it:** Verified members. The web page `/town-heroes` redirects to login otherwise.
- **Source files:** `src/app/api/user/town-heroes/route.ts` (GET), `src/lib/town-heroes.ts` (`listTownHeroes`, `shape`), `src/app/town-heroes/page.tsx`, `src/app/town-heroes/category/[slug]/page.tsx` (redirects to `/town-heroes?category=<slug>`), `src/components/site/town-heroes-client.tsx`
- **User flow:**
  1. Open Town Heroes. Load the categories (`GET /api/public/town-hero-categories`) and `GET /api/user/town-heroes?countryId=…`.
  2. Tap a category tab → `category=<slug>`. Type a search → `q=`.
  3. Scroll → `page=2` and so on, until fewer than `take` items come back.
  4. Own pending or rejected cards show a status badge. A rejected card shows `rejectionReason`, which is only sent to the nominator.
- **Suggested mobile screen(s):** `TownHeroesList`: category chips (emoji and colour), a search bar, a grid of cards (photo, name, town, summary, category chip, heart count, a "Featured" ribbon, a "Pending review" badge on own items), and a FAB "Nominate someone".
- **API(s):**
  - `GET /api/user/town-heroes`
  - Auth required: yes (member)
  - Request (query):
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | countryId | string | no | Matches the country OR heroes with no country | – | `ck_ie` |
    | category | string | no | Category slug, lower-cased | – | `food-and-meals` |
    | q | string | no | Substring of heroName, town, summary | – | `soup` |
    | take | int | no | 1..60 (page size) | 30 | `30` |
    | page | int | no | ≥1 | 1 | `2` |
  - Response (success):
    ```ts
    interface TownHeroesListResponse { heroes: TownHero[] }
    interface TownHero {
      id: string; slug: string; heroName: string; town: string | null; countryId: string | null;
      photoUrl: string | null; photoAlt: string; summary: string | null;
      category: { id: string; name: string; slug: string; emoji: string | null; color: string | null };
      nominatorName: string | null; isAnonymous: boolean; status: "PENDING" | "APPROVED" | "REJECTED";
      rejectionReason: string | null; heartCount: number; hearted: boolean; isOwn: boolean;
      isFeatured: boolean; approvedAt: string | null; createdAt: string;
      body?: string; // not in list responses
    }
    ```
    ```json
    { "heroes": [ { "id": "cth1", "slug": "mary-oconnor", "heroName": "Mary O'Connor", "town": "Cork", "countryId": "ck_ie", "photoUrl": "/uploads/heroes/m.jpg", "photoAlt": "Mary at the soup van", "summary": "Runs the Tuesday soup run.", "category": { "id": "cat1", "name": "Food & meals", "slug": "food-and-meals", "emoji": "🍲", "color": "#f59e0b" }, "nominatorName": "Sam", "isAnonymous": false, "status": "APPROVED", "rejectionReason": null, "heartCount": 14, "hearted": false, "isOwn": false, "isFeatured": true, "approvedAt": "2026-10-02T09:00:00.000Z", "createdAt": "2026-09-30T18:00:00.000Z" } ] }
    ```
  - Errors: 401; 403 (unverified).
- **Form fields:** n/a
- **Business rules:** Order is `isFeatured` desc, then `featuredAt` desc, `approvedAt` desc, `createdAt` desc. `nominatorName` is null when the nomination is anonymous. `rejectionReason` is only sent to the nominator.
- **Edge cases / notes for the mobile app:** No `total` or `pageCount`. Stop paging when `heroes.length < take`. The heroName and summary may contain `***` where banned words were masked.
- **Status:** ✅ Complete

## Town Heroes → Hero detail
- **Description:** The single hero page: the full story (`body`, Markdown), photo, category, heart button, with translation toggles on the web.
- **Who can use it:** Verified members. A PENDING or REJECTED hero is visible only to its nominator.
- **Source files:** `src/app/town-heroes/[slug]/page.tsx`, `src/lib/town-heroes.ts` (`getTownHero`), `src/components/site/hero-thanks.tsx` (heart button)
- **User flow:** Tap a card → the web renders `/town-heroes/<slug>` on the server → a 404 if it is missing or not visible. The heart button calls `POST /api/user/town-heroes/[id]/heart`.
- **Suggested mobile screen(s):** `TownHeroDetail`: a hero photo, name, town, category chip, "Nominated by X" (hidden if anonymous), the Markdown story, and a heart button with count.
- **API(s):** ⚠️ **None for reading.** `getTownHero(slug, viewerId)` is only called from the server page. Its shape is `TownHero` plus `body: string`.
- **Form fields:** n/a
- **Business rules:** The same visibility rules as the list. The slug lookup is case-insensitive (lower-cased).
- **Edge cases / notes for the mobile app:** The list response has no `body`. Mobile needs a new endpoint, or a WebView of the web page, to show the story. Exception: the `POST /api/user/town-heroes` response includes `body` for the hero just nominated.
- **Status:** ⚠️ Web-only (no API)

## Town Heroes → Home highlights
- **Description:** A small strip of approved heroes (featured first) for the home page. Works when signed out.
- **Who can use it:** Anyone.
- **Source files:** `src/app/api/public/town-heroes/route.ts`, `src/lib/town-heroes.ts` (`listHeroHighlights`), `src/components/site/home-sections.tsx`
- **User flow:** The home screen calls `GET /api/public/town-heroes?countryId=…&take=6` and shows a horizontal carousel. Tapping a card goes to the hero (needs sign-in on the web).
- **Suggested mobile screen(s):** `HomeHeroStrip` carousel on the Home tab.
- **API(s):**
  - `GET /api/public/town-heroes`
  - Auth required: no
  - Request (query):
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | countryId | string | no | The country OR heroes with no country | – | `ck_ie` |
    | take | int | no | 1..12 | 6 | `6` |
  - Response: `{ "heroes": TownHero[] }`. The shape is the same as the list, with `hearted: false`, `isOwn: false` and `rejectionReason: null` always, because no viewer is applied.
  - Errors: none defined.
- **Form fields:** n/a
- **Business rules:** APPROVED only. Order is `isFeatured` desc, `featuredAt` desc, `approvedAt` desc.
- **Edge cases / notes for the mobile app:** `hearted` is always false here even for a signed-in viewer. Use the member list endpoint when the true heart state is needed.
- **Status:** ✅ Complete

## Town Heroes → Categories
- **Description:** The active, admin-managed hero categories, with counts of approved heroes. Empty categories are still returned.
- **Who can use it:** Anyone.
- **Source files:** `src/app/api/public/town-hero-categories/route.ts`, `src/lib/town-hero-categories.ts` (`listPublicHeroCategories`, `validHeroCategoryId`)
- **User flow:** Used for the category tabs on the list and the required category picker on the Nominate form.
- **Suggested mobile screen(s):** Category chips in `TownHeroesList`, picker in `NominateHero`.
- **API(s):**
  - `GET /api/public/town-hero-categories`
  - Auth required: no
  - Request (query): `countryId` (optional; counts include that country plus heroes with no country).
  - Response:
    ```ts
    interface TownHeroCategoriesResponse { categories: { id: string; name: string; slug: string; description: string | null; emoji: string | null; color: string | null; publicCount: number }[] }
    ```
    ```json
    { "categories": [ { "id": "cat1", "name": "Food & meals", "slug": "food-and-meals", "description": "Soup runs, pantries", "emoji": "🍲", "color": "#f59e0b", "publicCount": 12 } ] }
    ```
  - Errors: none defined.
- **Form fields:** n/a
- **Business rules:** Ordered by `sortOrder`, then `name`. Counts include APPROVED heroes only. `color` is `#abc` or `#aabbcc` or null. `emoji` is a single code point or null. Admin create/update/delete happens in the admin module. A category that is in use cannot be deleted, only retired.
- **Edge cases / notes for the mobile app:** Not paginated. The seed provides an "Anything else" category, so the picker always has a fallback.
- **Status:** ✅ Complete

## Town Heroes → Nominate a hero
- **Description:** A member nominates someone from their town. The nominee is free text, not a user account. The nomination is created PENDING and appears publicly only after an admin approves it. The member can stay anonymous to readers.
- **Who can use it:** Verified members.
- **Source files:** `src/app/api/user/town-heroes/route.ts` (POST), `src/lib/town-heroes.ts` (`nominateHero`, `uniqueHeroSlug`, `RESERVED_HERO_SLUGS`, `reviewTownHero`), `src/lib/town-hero-categories.ts` (`validHeroCategoryId`), `src/lib/banned-words.ts` (masker), `src/app/town-heroes/new/page.tsx`, `src/components/site/nominate-hero-form.tsx`
- **User flow:**
  1. Open "Nominate someone". Load the categories and countries.
  2. Optionally attach one photo. The web uses the `PhotoAttach` upload component, which is in another module.
  3. Submit → `POST /api/user/town-heroes`. 201 → show "Thanks, it's in review". The returned hero (status PENDING, `isOwn: true`) now appears at the top of the viewer's list.
  4. 400 → show `error`.
  5. Later the nominator gets an in-app notification, TOWN_HERO_APPROVED ("Your nomination is up") or TOWN_HERO_REJECTED (with the reason) (`town-heroes.ts:465`).
- **Suggested mobile screen(s):** `NominateHero` form plus a success state.
- **API(s):**
  - `POST /api/user/town-heroes`
  - Auth required: yes (member)
  - Request body:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | heroName | string | yes | Trimmed, non-empty, cut to 120. Banned words masked. | – | `Mary O'Connor` |
    | categoryId | string | yes | Must be an **active** category id. Unknown or retired → refused. | – | `cat1` |
    | body | string | yes | Trimmed, **≥ 20 chars**, cut to 8000. Markdown. Masked. | – | `Every Tuesday for ten years…` |
    | town | string\|null | no | Cut to 120 | null | `Cork` |
    | countryId | string\|null | no | Cut to 40 (not checked against the countries table) | null | `ck_ie` |
    | photoUrl | string\|null | no | Cut to 500 | null | `/uploads/heroes/m.jpg` |
    | photoAlt | string\|null | no | Cut to 300 | null | |
    | summary | string\|null | no | Cut to 400, masked | null | `Runs the soup run.` |
    | isAnonymous | boolean | no | Only `true` counts | false | `true` |
  - Response (201):
    ```ts
    interface NominateTownHeroResponse { hero: TownHero /* with body, status "PENDING", isOwn true */ }
    ```
    ```json
    { "hero": { "id": "cth9", "slug": "mary-oconnor-2", "heroName": "Mary O'Connor", "town": "Cork", "countryId": "ck_ie", "photoUrl": null, "photoAlt": "", "summary": null, "category": { "id": "cat1", "name": "Food & meals", "slug": "food-and-meals", "emoji": "🍲", "color": "#f59e0b" }, "body": "Every Tuesday for ten years…", "nominatorName": "Sam", "isAnonymous": false, "status": "PENDING", "rejectionReason": null, "heartCount": 0, "hearted": false, "isOwn": true, "isFeatured": false, "approvedAt": null, "createdAt": "2026-11-25T12:00:00.000Z" } }
    ```
  - Errors (all 400): `Who would you like to nominate?` (no name); `Tell us a little about what they do — a sentence or two is plenty.` (body < 20 chars); `Pick what kind of thing they do.` (missing, unknown or retired category); `Couldn't send that nomination.` (any other error). 401/403 auth.
- **Form fields:**
  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | Their name | text | yes | 1–120 | |
  | What they do (category) | picker | yes | | active categories |
  | Town | text | no | ≤120 | free text |
  | Country | picker | no | | active countries |
  | One-line summary | text | no | ≤400 | |
  | Their story | textarea | yes | 20–8000 | |
  | Photo | image | no | one image | |
  | Keep my name off it | switch | no | | true/false |
- **Business rules:** The slug comes from heroName. Reserved slugs (`new`, `nominate`, `category`, `mine`, `search`, `all`, `town`) get `-hero` added, and clashes get `-2` and so on. Banned words are masked when stored. Anonymity hides the nominator from readers only, and admins still see who sent it. **No admin notification is sent** for a new nomination (unlike places). Statuses: `PENDING → APPROVED | REJECTED` (admin). `approvedAt` is set only on the first approval. Admins can also feature a hero and edit it.
- **Edge cases / notes for the mobile app:** No rate limit. A member cannot edit or delete their own nomination; there is no endpoint for it.
- **Status:** ✅ Complete

## Town Heroes → Heart a hero
- **Description:** Toggles the viewer's applause (heart) on an approved hero.
- **Who can use it:** Verified members. APPROVED heroes only.
- **Source files:** `src/app/api/user/town-heroes/[id]/heart/route.ts`, `src/lib/town-heroes.ts` (`toggleHeroHeart`), `src/components/site/hero-thanks.tsx`
- **User flow:** Tap the heart → `POST` → set `hearted` and `heartCount` from the response. 400 → revert and show "This hero isn't available."
- **Suggested mobile screen(s):** Heart button on `TownHeroCard` and `TownHeroDetail`.
- **API(s):**
  - `POST /api/user/town-heroes/[id]/heart`
  - Auth required: yes (member)
  - Request: path `id` (hero id). No body.
  - Response:
    ```ts
    interface TownHeroHeartResponse { hearted: boolean; heartCount: number }
    ```
    ```json
    { "hearted": true, "heartCount": 15 }
    ```
  - Errors: 400 `This hero isn't available.` (missing or not APPROVED); 400 `Failed` (other error, for example a race on a double tap); 401.
- **Form fields:** n/a
- **Business rules:** A toggle. The heart row and the `heartCount` increment/decrement run in one transaction. The count is floored at 0 in responses.
- **Edge cases / notes for the mobile app:** Not idempotent, so disable the button while the request is in flight.
- **Status:** ✅ Complete

## Donations → Config
- **Description:** Tells the UI whether donating is switched on and the allowed amount range and currency. The checkout endpoint re-checks these values on the server, so this is only a hint for the UI.
- **Who can use it:** Anyone.
- **Source files:** `src/app/api/public/donations/config/route.ts`, `src/lib/payments.ts` (`getPaymentSettings`, `PAYMENT_DEFAULTS`), `src/components/site/donate-button.tsx`
- **User flow:** Before showing a Donate button, call this. If `enabled` is false, hide the button.
- **Suggested mobile screen(s):** Used by `DonateSheet` (and to decide whether to render Donate buttons on Event, Campaign, Live and Profile screens).
- **API(s):**
  - `GET /api/public/donations/config`
  - Auth required: no
  - Request: none.
  - Response:
    ```ts
    type DonationsConfigResponse = { enabled: boolean; minCents: number; maxCents: number; currency: string } | { enabled: false };
    ```
    ```json
    { "enabled": true, "minCents": 100, "maxCents": 500000, "currency": "usd" }
    ```
  - Errors: none. Any internal error returns `{ "enabled": false }` with status 200.
- **Form fields:** n/a
- **Business rules:** `enabled` = admin switch **and** a Stripe secret key is configured. The defaults are min 100 (¢), max 500 000, currency `usd`. Admin settings floor the min at 50 and the max at 100.
- **Edge cases / notes for the mobile app:** `currency` is a lower-case ISO code. Format amounts as cents / 100. The web shows `$` only for USD and otherwise "12.34 EUR" (`formatCents` in `src/lib/money.ts`). The web preset buttons are 500, 1000, 2500 and 5000 cents.
- **Status:** ✅ Complete

## Donations → Start checkout (Stripe Checkout)
- **Description:** Creates a PENDING donation row and a Stripe Checkout Session (hosted payment page, `mode: payment`) and returns its URL. The client must **redirect the user to Stripe**. The money lands in the WorldWeCare Stripe account and is earmarked for the recipient, who withdraws it later through Payouts. Signed-out (guest) donors are allowed.
- **Who can use it:** Anyone. A signed-in member must have verified their email, because middleware returns 403 otherwise. A guest with no cookie passes.
- **Source files:** `src/app/api/user/donations/checkout/route.ts`, `src/lib/donations.ts` (`createCheckout`, `DonationRefused`), `src/lib/stripe.ts` (`getStripe`), `src/lib/payments.ts`, `src/lib/rate-limit.ts`, `src/lib/app-url.ts`, `src/components/site/donate-button.tsx`
- **User flow:**
  1. The user taps Donate on an event, campaign, live stream or profile. The app loads the config.
  2. The user picks a preset or types an amount, adds an optional message, ticks "anonymous", and (as a guest) enters an email.
  3. `POST /api/user/donations/checkout` → `{ ok, url }`.
  4. Open `url` (Stripe hosted Checkout). Mobile can use an in-app browser or a custom tab.
  5. On success Stripe redirects to `<site>/donate/thanks?session_id=<id>`. On cancel it redirects to `<site>/donate/cancelled?d=<donationId>`. **These are web pages.** See the next feature.
  6. Crediting happens only through the webhook. The row may stay PENDING for a few seconds after the redirect.
  7. Failures: 400 shows the donor-facing message. 429 means too many attempts, so honour `Retry-After`. 502 shows "We couldn't start that donation. Please try again shortly."
- **Suggested mobile screen(s):** `DonateSheet` (amount chips, a custom amount field, a message (≤500), an "Give anonymously" switch, an email field when signed out, a cause title, and a Donate button) → in-app browser → `DonationResult`.
- **API(s):**
  - `POST /api/user/donations/checkout`
  - Auth required: optional
  - Request body:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | amountCents | integer | yes | Truncated to an integer. Must be ≥ `minDonationCents` and ≤ `maxDonationCents`. | – | `2500` |
    | campaignId | string | no | The campaign must exist and be `PUBLISHED` | – | `ccmp1` |
    | eventId | string | no | The event must be `APPROVED`. The recipient becomes the event host (or the charity if there is no host). | – | `cev1` |
    | liveStreamId | string | no | The stream must have status `LIVE`. The recipient becomes the stream owner (or the charity). | – | `cls1` |
    | recipientUserId | string | no | Used when no event or stream is given. Must be an active, unbanned user. | null → WorldWeCare | `cus1` |
    | donorEmail | string | no | Used only when signed out (otherwise the account email). Cut to 320 and passed to Stripe as `customer_email`. | – | `guest@example.com` |
    | message | string | no | Trimmed, cut to 500 | null | `Keep it up!` |
    | isAnonymous | boolean | no | Only `true` counts | false | `true` |
  - Response (success):
    ```ts
    interface DonationCheckoutResponse { ok: true; url: string }
    ```
    ```json
    { "ok": true, "url": "https://checkout.stripe.com/c/pay/cs_test_a1B2c3" }
    ```
  - Errors:
    - 400 `Donations aren't switched on yet.`
    - 400 `The smallest donation is 1.00 USD.` / `The largest single donation is 5000.00 USD.`
    - 400 `That campaign isn't accepting donations.` / `That event isn't accepting donations.` / `That broadcast isn't accepting donations.`
    - 400 `That member can't receive donations right now.`
    - 429 `That's a lot of donation attempts. Give it a few minutes.` (12 starts per IP per 10 minutes. Header `Retry-After` in seconds.)
    - 502 `We couldn't start that donation. Please try again shortly.` (Stripe or DB error; the details are logged only)
    - 403 needsVerification (signed in but not verified)
- **Form fields:**
  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | Amount | chips + currency input | yes | min..max from config; parse with `parseAmountToCents` rules (comma only as a thousands separator, ≤2 decimals) | presets 5, 10, 25, 50 |
  | Message | textarea | no | ≤500 | |
  | Give anonymously | switch | no | | |
  | Your email (guests) | email | no (recommended, it is where the receipt goes) | | |
- **Business rules:**
  - Target precedence: campaign sets the cause title, then live stream (overrides the recipient and title), then event (overrides the recipient and title). A client `recipientUserId` is overridden whenever an event or stream is given.
  - The row is created first (`status PENDING`, `netCents 0`, name snapshots, `causeTitleSnapshot`), then the Stripe session. The Stripe line item name is "Donation — <cause>", "Donation to <recipient>" or "Donation to WorldWeCare". `managed_payments` is disabled. `metadata.donationId` is set on the session and the PaymentIntent. The idempotency key is `donation_<id>`.
  - If Stripe definitely refuses, the row is marked FAILED. On a timeout or unknown error the row stays PENDING and the webhook is the authority.
  - `liveStreamId` is **not stored** on the row, only its title and recipient.
  - Statuses: `PENDING → SUCCEEDED | FAILED`, `SUCCEEDED → REFUNDED | DISPUTED`, `DISPUTED → SUCCEEDED/REFUNDED` (dispute won). See the webhook.
- **Edge cases / notes for the mobile app:**
  - ⚠️ The return URLs are fixed web URLs built from the request origin (`APP_URL` env, or forwarded headers). The client cannot pass a deep link. To detect completion in the app, close the browser when its URL matches `/donate/thanks` or `/donate/cancelled`, then refetch `GET /api/user/donations` (signed in only).
  - ⚠️ `appBaseUrl()` returns the origin with a trailing `/`, and the route then appends `/donate/...`, so the URL contains `//donate/thanks`. It probably still resolves, but check it.
  - The amount must be integer cents. Never send a float.
- **Status:** ⚠️ Partial. It works on the web, but the redirect/return flow is web-only and needs mobile deep-link support.

## Donations → Thanks / cancelled return pages
- **Description:** The server-rendered pages Stripe sends the donor back to. `/donate/thanks?session_id=` reads the donation by its Stripe session id and shows the amount and cause, and either "has gone through" (SUCCEEDED) or "is being confirmed" (still PENDING). `/donate/cancelled?d=<donationId>` says "No donation was made". Both show a "Back to the campaign/event/WorldWeCare" link worked out by `donationReturnTo()`, and the thanks page also links to "See your donations" when signed in.
- **Who can use it:** Anyone. No auth.
- **Source files:** `src/app/donate/thanks/page.tsx`, `src/app/donate/cancelled/page.tsx`, `src/lib/donation-return.ts`
- **User flow:** Stripe redirect → page. The cancelled page changes nothing. The abandoned PENDING row becomes FAILED later through the `checkout.session.expired` webhook.
- **Suggested mobile screen(s):** `DonationResult` (success: check icon, "Thank you", amount and cause, a pending note; cancel: "No donation was made"; buttons: My donations, Back to cause).
- **API(s):** ⚠️ **None.** There is no endpoint to look up a donation by session id. The return link rules are: a campaign still `PUBLISHED` → `/campaigns/<slug>`; otherwise an event still `APPROVED` → `/events/<slug>`; otherwise `/`. Live-stream donations always go home.
- **Form fields:** n/a
- **Business rules:** The thanks page shows only `grossCents`, `currency`, `status`, and the cause or recipient name. The cancelled page reads only `campaignId` and `eventId`.
- **Edge cases / notes for the mobile app:** The mobile app should build its own result screen. It already knows the cause it started from, so it can choose the back link itself.
- **Status:** ⚠️ Web-only (no API)

## Donations → Giving & receiving history
- **Description:** The member's donations given and received, plus their current balance (the same balance object as Payouts).
- **Who can use it:** Verified members.
- **Source files:** `src/app/api/user/donations/route.ts`, `src/lib/donations.ts` (`listGiven`, `listReceived`, `shape`), `src/lib/payments.ts` (`balanceFor`), `src/app/settings/donations/page.tsx`, `src/components/site/donation-clients.tsx`
- **User flow:** Settings → Donations → `GET /api/user/donations` → two tabs, Given and Received, with a balance summary and a link to Payouts. An empty state shows "No donations yet".
- **Suggested mobile screen(s):** `MyDonations` (balance cards: available, on hold, lifetime; tabs Given / Received; rows show amount, cause or recipient, status chip, date, message, and "withdrawable from <availableAt>" for received rows).
- **API(s):**
  - `GET /api/user/donations`
  - Auth required: yes (member)
  - Request: none.
  - Response:
    ```ts
    interface DonationsHistoryResponse {
      given: DonationRow[];
      received: DonationRow[];
      balance: { availableCents: number; onHoldCents: number; reservedCents: number; paidOutCents: number; lifetimeCents: number; currency: string };
    }
    interface DonationRow {
      id: string; grossCents: number; netCents: number; refundedCents: number; currency: string;
      status: "SUCCEEDED" | "REFUNDED" | "DISPUTED"; message: string | null; isAnonymous: boolean;
      recipientName: string | null; donorName: string | null; causeTitle: string | null;
      createdAt: string; succeededAt: string | null; availableAt: string | null;
    }
    ```
    ```json
    { "given": [ { "id": "cdn1", "grossCents": 2500, "netCents": 2398, "refundedCents": 0, "currency": "usd", "status": "SUCCEEDED", "message": "Keep it up!", "isAnonymous": false, "recipientName": "Beach Cleanup Crew", "donorName": "Sam", "causeTitle": "Beach Cleanup", "createdAt": "2026-11-20T10:00:00.000Z", "succeededAt": "2026-11-20T10:01:00.000Z", "availableAt": "2026-12-04T10:01:00.000Z" } ],
      "received": [ { "id": "cdn7", "grossCents": 1000, "netCents": 941, "refundedCents": 0, "currency": "usd", "status": "SUCCEEDED", "message": null, "isAnonymous": true, "recipientName": "Sam", "donorName": null, "causeTitle": null, "createdAt": "2026-11-18T08:00:00.000Z", "succeededAt": "2026-11-18T08:00:30.000Z", "availableAt": "2026-12-02T08:00:30.000Z" } ],
      "balance": { "availableCents": 0, "onHoldCents": 941, "reservedCents": 0, "paidOutCents": 0, "lifetimeCents": 941, "currency": "usd" } }
    ```
  - Errors: 401; 403 (unverified).
- **Form fields:** n/a
- **Business rules:** Only `SUCCEEDED`, `REFUNDED` and `DISPUTED` rows are listed. PENDING and FAILED are hidden. Newest first, **max 50 each**. In `received`, `donorName` is null when the gift is anonymous. In `given`, the donor sees their own name. `netCents` is what credits the recipient (gross minus the Stripe fee in the default "net" mode). `refundedCents` is the **net clawback** (proportional share of net), not the amount refunded to the card. For the balance maths see Payouts → Overview.
- **Edge cases / notes for the mobile app:** No pagination parameters. Guest donations are not linked to an account and never appear here.
- **Status:** ✅ Complete

## Donations → Stripe webhook
- **Description:** Stripe calls this endpoint with payment, refund and dispute events. It verifies the signature and applies each event to donation rows idempotently. Not called by the mobile app. It is documented because it decides donation statuses and balances.
- **Who can use it:** Stripe only (HMAC signature with the webhook signing secret).
- **Source files:** `src/app/api/webhooks/stripe/route.ts`, `src/lib/donations.ts` (`applyStripeEvent` and handlers), `src/lib/stripe-events.ts` (`REQUIRED_STRIPE_EVENTS`), `src/lib/stripe.ts`, `src/lib/payment-notify.ts`, `src/lib/secret-box.ts`
- **User flow:** Stripe → POST → verify → apply → `200 { received, handled, note }`. A 5xx makes Stripe retry.
- **Suggested mobile screen(s):** none.
- **API(s):**
  - `POST /api/webhooks/stripe`
  - Auth required: `stripe-signature` header, verified against the raw body. Node runtime.
  - Request: the raw Stripe event JSON.
  - Response (success):
    ```ts
    interface StripeWebhookResponse { received: true; handled: boolean; note: string }
    ```
    ```json
    { "received": true, "handled": true, "note": "Donation cdn1 credited 2398" }
    ```
  - Errors: 400 `Missing signature`; 400 `Invalid signature`; 500 `Webhook not configured` (no signing secret saved, so Stripe retries); 500 `Handler failed` (DB error, so Stripe retries).
- **Form fields:** n/a
- **Business rules (events handled):**
  | Event | Effect |
  |---|---|
  | `checkout.session.completed`, `checkout.session.async_payment_succeeded` | Only if `payment_status = paid`. Reads the real Stripe fee from the balance transaction (if unreadable, fee = 0 and `feeUnknown = true`). `netCents = gross − fee` (mode "net", the default) or `gross` (mode "gross"). Sets `SUCCEEDED`, `succeededAt`, `availableAt = now + payoutHoldDays` (default 14), and the Stripe ids. Updates only rows that are PENDING or FAILED. Then sends the **donor receipt email** (template `donation_receipt`) and a **DONATION_RECEIVED** in-app notification to the recipient (`payment-notify.ts:42`, `:80`). A session without metadata is recorded as an unattributed donation. |
  | `checkout.session.async_payment_failed` | PENDING → FAILED |
  | `checkout.session.expired` | PENDING → FAILED (abandoned checkout) |
  | `charge.refunded` | Sets `REFUNDED`, `refundedCents = round(netCents × refunded/gross)` (a set, not an increment). Ignored if the donation is DISPUTED. |
  | `charge.refund.updated` | Re-reads the charge and re-applies the refund logic (handles failed refunds). |
  | `charge.dispute.created` | SUCCEEDED/REFUNDED → `DISPUTED`, `disputedAt`. The money leaves the recipient's balance. |
  | `charge.dispute.closed` | If `won`: DISPUTED → REFUNDED (if `refundedCents > 0`) or SUCCEEDED. Otherwise it stays DISPUTED. |
  | anything else | `{ handled: false, note: "Ignored <type>" }` |
- **Edge cases / notes for the mobile app:** The Stripe keys and webhook secret are stored encrypted in platform settings, sealed with AES-256-GCM by `secret-box.ts`. The key comes from env `PAYMENTS_SECRET`, falling back to `USER_SESSION_SECRET`. ⚠️ Unclear: the refund "already recorded" check compares the net clawback with Stripe's gross `amount_refunded`. Setting the value again is harmless, but the check rarely matches.
- **Status:** ✅ Complete

## Payouts → Overview & balance
- **Description:** Everything the withdrawal screen needs in one call: the member's balance, saved payout methods (masked), payout history, and the platform's withdrawal limits.
- **Who can use it:** Verified members.
- **Source files:** `src/app/api/user/payouts/route.ts` (GET), `src/lib/payments.ts` (`balanceFor`, `getPaymentSettings`), `src/lib/payouts.ts` (`listMethods`, `listPayouts`), `src/app/settings/payouts/page.tsx`, `src/components/site/payout-clients.tsx`
- **User flow:** Settings → Payouts → `GET /api/user/payouts` → show the balance cards, the "Withdraw" form (if `limits.enabled`), methods, and history with status chips and a Cancel button on REQUESTED rows.
- **Suggested mobile screen(s):** `Payouts` (cards: Available, On hold, Reserved, Paid out; withdraw CTA; history list), `PayoutMethods` (see below).
- **API(s):**
  - `GET /api/user/payouts`
  - Auth required: yes (member)
  - Request: none.
  - Response:
    ```ts
    interface PayoutsOverviewResponse {
      balance: { availableCents: number; onHoldCents: number; reservedCents: number; paidOutCents: number; lifetimeCents: number; currency: string };
      methods: PayoutMethod[];   // see Payout methods
      payouts: Payout[];         // full rows, newest requestedAt first, max 50
      limits: { enabled: boolean; minCents: number; feeBasisPoints: number; holdDays: number; currency: string; allowedMethods: ("PAYPAL"|"BANK"|"WISE"|"CHECK")[] };
    }
    interface Payout {
      id: string; userId: string; userNameSnapshot: string; userEmailSnapshot: string | null;
      amountCents: number; feeBasisPoints: number; feeCents: number; netCents: number; currency: string;
      methodId: string | null; methodSnapshot: { type: string; label: string | null; displayHint: string };
      status: "REQUESTED" | "APPROVED" | "PAID" | "REJECTED" | "CANCELLED";
      requestedAt: string; reviewedAt: string | null; paidAt: string | null; reviewedByAdminId: string | null;
      adminNote: string | null; rejectionReason: string | null; externalRef: string | null; createdAt: string; updatedAt: string;
    }
    ```
    ```json
    { "balance": { "availableCents": 4523, "onHoldCents": 941, "reservedCents": 1000, "paidOutCents": 2000, "lifetimeCents": 8464, "currency": "usd" },
      "methods": [ { "id": "cpm1", "type": "PAYPAL", "typeLabel": "PayPal", "label": "My PayPal", "displayHint": "PayPal · s…@example.com", "isDefault": true, "readable": true, "createdAt": "2026-10-01T09:00:00.000Z" } ],
      "payouts": [ { "id": "cpo1", "userId": "cus1", "userNameSnapshot": "Sam", "userEmailSnapshot": "sam@example.com", "amountCents": 1000, "feeBasisPoints": 100, "feeCents": 10, "netCents": 990, "currency": "usd", "methodId": "cpm1", "methodSnapshot": { "type": "PAYPAL", "label": "My PayPal", "displayHint": "PayPal · s…@example.com" }, "status": "REQUESTED", "requestedAt": "2026-11-24T12:00:00.000Z", "reviewedAt": null, "paidAt": null, "reviewedByAdminId": null, "adminNote": null, "rejectionReason": null, "externalRef": null, "createdAt": "2026-11-24T12:00:00.000Z", "updatedAt": "2026-11-24T12:00:00.000Z" } ],
      "limits": { "enabled": true, "minCents": 1000, "feeBasisPoints": 100, "holdDays": 14, "currency": "usd", "allowedMethods": ["PAYPAL", "BANK"] } }
    ```
  - Errors: 401; 403 (unverified).
- **Form fields:** n/a
- **Business rules (balance calculation, `balanceFor`, worked out from the rows on every call):**
  - `maturedNet` = Σ(`netCents − refundedCents`) of the member's received donations with status SUCCEEDED or REFUNDED and `availableAt ≤ now`.
  - `onHoldCents` = Σ(`netCents − refundedCents`) of SUCCEEDED donations with `availableAt > now` (floored at 0).
  - `reservedCents` = Σ `amountCents` of payouts in REQUESTED or APPROVED. `paidOutCents` = Σ of PAID payouts.
  - `availableCents` = max(0, maturedNet − reserved − paidOut). `lifetimeCents` = maturedNet + onHold.
  - DISPUTED, PENDING and FAILED donations never count. ⚠️ A REFUNDED donation that is still inside its hold window is counted in neither `onHold` nor `matured` until `availableAt` passes.
  - Defaults: `payoutMinCents` 1000 ($10), `payoutFeeBasisPoints` 100 (1%), `payoutHoldDays` 14, methods `["PAYPAL","BANK"]`. The admin can change all of these.
- **Edge cases / notes for the mobile app:** `payouts` returns the raw DB rows. Ignore `adminNote` and `reviewedByAdminId`; the server sends them, but they are admin working fields. Max 50 history rows, no pagination.
- **Status:** ✅ Complete

## Payouts → Request a withdrawal
- **Description:** The member asks for part of their available balance to be paid to one of their saved methods. A fee is deducted. The admin reviews the request and sends the money by hand.
- **Who can use it:** Verified, active, unbanned members.
- **Source files:** `src/app/api/user/payouts/route.ts` (POST), `src/lib/payouts.ts` (`requestPayout`), `src/lib/money.ts` (`splitFee`, `parseAmountToCents`), `src/lib/payment-notify.ts` (`notifyPayout`)
- **User flow:**
  1. On Payouts, tap Withdraw. Enter an amount (show "max = availableCents"), pick a method (the default is preselected), and show "Fee X, you receive Y".
  2. `POST /api/user/payouts` → 201 → refetch the overview. The new row shows REQUESTED.
  3. 400 → show `error`.
  4. Later the member gets in-app notifications PAYOUT_APPROVED, PAYOUT_PAID or PAYOUT_REJECTED. "Withdrawal came back" is also sent as PAYOUT_REJECTED (`payment-notify.ts:132`).
- **Suggested mobile screen(s):** `WithdrawSheet` (amount input, a method picker, a fee/net breakdown, Submit).
- **API(s):**
  - `POST /api/user/payouts`
  - Auth required: yes (member)
  - Request body:
    | Field | Type | Required | Validation / Rules | Default | Example |
    |---|---|---|---|---|---|
    | amountCents | integer | yes | > 0, ≥ `payoutMinCents`, ≤ `availableCents`, net after fee > 0 | – | `2500` |
    | methodId | string | yes | One of the member's own methods, and still decryptable | – | `cpm1` |
  - Response (201): `{ "ok": true, "id": "cpo2" }`
  - Errors (all 400): `Payouts aren't switched on at the moment.`; `Enter an amount.`; `The smallest withdrawal is 10.00 USD.`; `Your account can't request a payout.`; `Choose a payout method.`; `That payout method can't be read any more — remove it and add it again.`; `That amount is entirely consumed by the fee.`; `You can withdraw up to 45.23 USD right now.`; `Couldn't create that request.` 401/403 auth.
- **Form fields:**
  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | Amount | currency input | yes | min `limits.minCents`, max `balance.availableCents` | |
  | Pay to | picker | yes | | the member's methods |
- **Business rules:** `feeCents = round(amount × bp / 10000)` and `netCents = amount − feeCents`, both stored on the row together with the rate. The request runs in a transaction that locks the user row (`SELECT … FOR UPDATE`), so parallel requests cannot double-spend. The method is copied into `methodSnapshot` (type, label, hint). Status lifecycle: `REQUESTED → APPROVED → PAID`. Admins can also go `REQUESTED → PAID` directly. `REQUESTED/APPROVED → REJECTED` (admin, with a reason; the money is released). `PAID → REJECTED` (admin "reverse"; the money is returned). `REQUESTED → CANCELLED` (member). **No admin notification is created on request.**
- **Edge cases / notes for the mobile app:** Send integer cents. Show the fee preview with the same rounding (`Math.round`).
- **Status:** ✅ Complete

## Payouts → Cancel a withdrawal request
- **Description:** The member withdraws their own request while it is still REQUESTED. The reservation is released.
- **Who can use it:** Verified members (owner only).
- **Source files:** `src/app/api/user/payouts/[id]/route.ts`, `src/lib/payouts.ts` (`cancelPayout`)
- **User flow:** Tap Cancel on a REQUESTED row → confirm → `DELETE` → refetch. A 409 means the admin has already picked it up.
- **Suggested mobile screen(s):** Cancel action on a payout history row.
- **API(s):**
  - `DELETE /api/user/payouts/[id]`
  - Auth required: yes (member)
  - Request: path `id`.
  - Response: `{ "ok": true }`
  - Errors: 409 `That request has already been picked up and can't be cancelled.` (also returned for an unknown id or someone else's id); 401.
- **Form fields:** n/a
- **Business rules:** Conditional update `status REQUESTED → CANCELLED`, scoped to the user. The row is kept, not deleted.
- **Edge cases / notes for the mobile app:** Show Cancel only when `status === "REQUESTED"`.
- **Status:** ✅ Complete

## Payouts → Payout methods
- **Description:** Members save up to 5 destinations for withdrawals: PayPal, bank transfer, Wise or posted cheque. Details are validated, **encrypted at rest** (AES-256-GCM through `secret-box.ts`), and never sent back. Only a masked `displayHint` is returned. Admins can decrypt the details only while a payout to that method is open.
- **Who can use it:** Verified members.
- **Source files:** `src/app/api/user/payouts/methods/route.ts`, `src/app/api/user/payouts/methods/[id]/route.ts`, `src/lib/payouts.ts` (`METHOD_TYPES`, `buildMethod`, `listMethods`, `addMethod`, `setDefaultMethod`, `removeMethod`), `src/lib/secret-box.ts`, `src/components/site/payout-clients.tsx`
- **User flow:**
  1. Payouts → Methods → list (`GET /api/user/payouts/methods`, or the `methods` array in the overview).
  2. Add: pick a type (only `limits.allowedMethods` from the overview), fill in the type's fields → `POST`. 201 → refetch. 400 → show the error.
  3. Make default → `PATCH { isDefault: true }`.
  4. Remove → `DELETE`. 400 if an open payout uses it.
  5. If `readable` is false (the encryption key was rotated), show "Re-enter this method" and block using it.
- **Suggested mobile screen(s):** `PayoutMethods` list (type icon, label, displayHint, "Default" badge, a "Can't be read — re-add" warning), plus an `AddPayoutMethod` form with fields that change by type.
- **API(s):**
  - `GET /api/user/payouts/methods`
    - Auth required: yes (member)
    - Response:
      ```ts
      interface PayoutMethodsResponse { methods: { id: string; type: "PAYPAL"|"BANK"|"WISE"|"CHECK"; typeLabel: string; label: string | null; displayHint: string; isDefault: boolean; readable: boolean; createdAt: string }[] }
      ```
      ```json
      { "methods": [ { "id": "cpm2", "type": "BANK", "typeLabel": "Bank transfer", "label": "Joint account", "displayHint": "Bank · ····6789 · AIB", "isDefault": false, "readable": true, "createdAt": "2026-10-05T09:00:00.000Z" } ] }
      ```
    - Order: default first, then newest. Errors: 401.
  - `POST /api/user/payouts/methods`
    - Auth required: yes (member)
    - Request body:
      | Field | Type | Required | Validation / Rules | Default | Example |
      |---|---|---|---|---|---|
      | type | enum | yes | `PAYPAL`, `BANK`, `WISE`, `CHECK` (case-insensitive) and also in the admin's allowed list | – | `PAYPAL` |
      | label | string | no | Trimmed, cut to 80 | null | `My PayPal` |
      | details | object | yes | Depends on the type (below) | `{}` | |
      | **PAYPAL / WISE** details.email | string | yes | Lower-cased, ≤320, must look like an email | | `sam@example.com` |
      | **BANK** details.accountName | string | yes | ≤120 | | `Sam Smith` |
      | details.accountNumber | string | one of number/IBAN | ≤64. Needs `routingNumber` or `swift`. | | `12345678` |
      | details.routingNumber | string | cond. | ≤64 | | `021000021` |
      | details.iban | string | one of number/IBAN | ≤64, upper-cased | | `IE29AIBK93115212345678` |
      | details.swift | string | cond. | ≤32, upper-cased | | `AIBKIE2D` |
      | details.bankName | string | no | ≤120 | | `AIB` |
      | details.country | string | no | 2 letters, upper-cased | | `IE` |
      | **CHECK** details.payeeName | string | yes | ≤120 | | `Sam Smith` |
      | details.line1 | string | yes | ≤160 | | `12 Main St` |
      | details.line2 | string | no | ≤160 | | |
      | details.city | string | yes | ≤80 | | `Cork` |
      | details.state | string | no | ≤80 | | |
      | details.postcode | string | yes | ≤24 | | `T12 X1Y2` |
      | details.country | string | no | 2 letters | | `IE` |
    - Response (201): `{ "ok": true, "id": "cpm3" }`. The details are never echoed back.
    - Errors (400): `Pick a payout method.` (bad type); `<PayPal|Bank transfer|Wise|Posted cheque> isn't accepted at the moment.`; `Enter the email address on your PayPal account.` (or Wise); `Enter the name on the account.`; `Enter either an account number or an IBAN.`; `An account number needs a routing number or a SWIFT/BIC code alongside it.`; `A posted cheque needs a payee name and a full address.`; `You can save up to five payout methods. Remove one first.` 401.
  - `PATCH /api/user/payouts/methods/[id]`
    - Auth required: yes (member)
    - Request body: `{ "isDefault": true }`. This is the only change supported.
    - Response: `{ "ok": true }`
    - Errors: 400 `Nothing to change.` (body is not `isDefault: true`); 404 `Not found.` (not the member's method); 401.
  - `DELETE /api/user/payouts/methods/[id]`
    - Auth required: yes (member)
    - Response: `{ "ok": true }`
    - Errors (400): `Not found.`; `There's a payout waiting to be sent to this method. Cancel it first.` 401.
- **Form fields:**
  | Label | Type | Required | Validation | Allowed values |
  |---|---|---|---|---|
  | Method type | segmented | yes | | `limits.allowedMethods` |
  | Nickname | text | no | ≤80 | |
  | PayPal/Wise email | email | yes (PAYPAL/WISE) | email | |
  | Account holder name | text | yes (BANK) | ≤120 | |
  | Account number + Routing or SWIFT | text | one route required (BANK) | | |
  | IBAN (+ SWIFT optional) | text | alternative (BANK) | | |
  | Bank name, Country | text | no | ≤120, 2 letters | |
  | Payee name, Address line 1, City, Postcode | text | yes (CHECK) | | |
  | Address line 2, State, Country | text | no | | |
- **Business rules:** The first method added becomes the default. Setting a default clears the others in a transaction. Deleting the default promotes the newest remaining method. Hints are masked: emails show as `s…@domain`, and accounts or IBANs show only the last 4 digits (`····1234`). Paid history keeps `methodSnapshot`, so deleting a method does not change it. Encryption key: env `PAYMENTS_SECRET` (falls back to `USER_SESSION_SECRET`). Rotating it makes stored details unreadable (`readable: false`).
- **Edge cases / notes for the mobile app:** There is no edit endpoint. To change details, delete the method and add it again. Never cache the raw details on the device after submitting.
- **Status:** ✅ Complete
