/**
 * Everything on this site that is written in a language.
 *
 * No imports at all, so the server (which fetches the text and pays
 * Google) and the browser (which asks for it) name the same things.
 * It lives in its own file for the same reason `i18n-core.ts` does: a
 * client component importing this from `content-translate.ts` would
 * pull Prisma into the browser bundle, and the version of that bug
 * that involved a cookie constant cost an afternoon.
 *
 * ── THREE GROUPS, AND THEY BEHAVE DIFFERENTLY ──
 *
 * TAXONOMY — the category names and blurbs, the library themes, the
 * page banners. A few dozen rows in total, written by an admin,
 * appearing in the tabs and headings of every listing page. Because
 * the set is small and shared, the first reader in a language pays
 * for it and every reader after that gets it from the cache. These
 * are the ones people notice first, because an English tab strip over
 * a translated page is the most obvious thing on the screen.
 *
 * SUBMISSIONS — articles, events, campaigns, petitions, places, town
 * heroes, clips, streams. Titles and summaries and bodies, moderated
 * before they appear. Unbounded, but slow-moving.
 *
 * CONVERSATION — posts, comments, gratitude notes. High
 * volume, short, and the reason the per-request caps exist.
 *
 * ── WHAT IS NOT HERE ──
 *
 * An author byline snapshotted onto an old post, a town, a city, an
 * email address. Those are either somebody's exact words at the time
 * or a point on a map, and neither is improved by translation.
 *
 * NAMES ARE IN — places, heroes, and members — by an explicit
 * decision of the person who owns this site, asked twice and
 * confirmed twice. The argument against is real and is kept here
 * rather than thrown away, because whoever reads this next deserves
 * to know it was weighed: a name is how somebody is addressed, a
 * machine rewriting one has changed what a person is called rather
 * than translated anything, and a reader has nothing to check it
 * against — a mangled sentence reads as a bad translation, a mangled
 * name just reads as a different person. "The Grove Centre" is also
 * what is painted on the door and filed in every map.
 *
 * That was the call to make and it was made. What follows from it is
 * that `member` covers `displayName`, `bio` and `location`, and
 * nothing else — never an email, never anything the member did not
 * choose to publish on their own profile, and only for accounts that
 * are already listed in the members directory.
 *
 * LOCATION WAS ADDED LATER, and it contradicts the paragraph above
 * about points on a map, so here is why. It is not a map reference:
 * it is a free-text line the member types into a box hinted "City,
 * Country", which is mostly a country and mostly has a real name in
 * every language. "Mumbai, India" reading as "Мумбаи, Индия" to a
 * Russian member is the same courtesy as translating the rest of the
 * profile. The town half may come back odd; that is the cost, it was
 * weighed, and the owner of this site chose it knowingly — the same
 * call, for the same reason, as the one about names above.
 *
 * DIRECT MESSAGES, and private journal entries. Not because they are
 * hard — a DM between two people who do not share a language is the
 * single most useful thing on this list — but because translating
 * them means sending private correspondence to a third party without
 * anyone having asked. If that is wanted it should be a button the
 * reader presses on their own conversation, not a default applied to
 * everybody's. A journal entry is the member's own words in their own
 * language; there is nothing to translate.
 *
 * CHAT ROOM MESSAGES ARE IN, and the line between them and a DM is
 * deliberate: a room is a space several people share, often
 * explicitly a place to find others going through the same thing, and
 * a message posted there was written to be read by people the author
 * has not met. A DM was written to one person.
 */

export const CONTENT_KINDS = [
  // taxonomy
  "articleCategory",
  "eventCategory",
  "campaignCategory",
  "petitionCategory",
  "gratitudeCategory",
  "chatCategory",
  "liveCategory",
  "townHeroCategory",
  "libraryTheme",
  // submissions
  "article",
  "event",
  "campaign",
  "petition",
  "place",
  "townHero",
  "clip",
  "liveStream",
  "room",
  // editorial
  "dailyQuote",
  "dailyQuestion",
  // conversation
  "post",
  "comment",
  "gratitude",
  "gratitudeComment",
  "clipComment",
  "articleComment",
  "chatMessage",
  "liveComment",
  // addressed to one person — see the loader's note
  "notification",
  /** `displayName` only — see the note above. */
  "member",
] as const;

export type ContentKind = (typeof CONTENT_KINDS)[number];

export function isContentKind(v: unknown): v is ContentKind {
  return typeof v === "string" && (CONTENT_KINDS as readonly string[]).includes(v);
}

/**
 * The taxonomy kinds, which are cheap enough to translate eagerly.
 *
 * Used by the admin's "Fill gaps" so somebody turning on a language
 * can warm the tab strips in one press rather than waiting for the
 * first member to land on each page and pay for it mid-scroll.
 */
export const TAXONOMY_KINDS: readonly ContentKind[] = [
  "articleCategory",
  "eventCategory",
  "campaignCategory",
  "petitionCategory",
  "gratitudeCategory",
  "chatCategory",
  "liveCategory",
  "townHeroCategory",
  "libraryTheme",
];
