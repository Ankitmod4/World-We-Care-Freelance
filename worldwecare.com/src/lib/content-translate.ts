/**
 * Translating what members wrote.
 *
 * ── HOW THIS DIFFERS FROM THE INTERFACE CATALOGUE ──
 *
 * `i18n.ts` serves a curated set of English strings an admin has
 * filled in. This serves text that did not exist when the page was
 * built, in a language nobody declared, to a reader who picked a
 * different one. Three consequences shape everything below:
 *
 *   1. IT IS PAID FOR PER CHARACTER, so nothing is translated twice.
 *      Every result is stored against the text it came from; the
 *      second reader of a post in Russian costs nothing.
 *
 *   2. THE CALLER NEVER SENDS THE TEXT. A route that translated
 *      whatever string it was handed would be an open translation
 *      proxy on somebody's billing account. The client sends ids; the
 *      loaders below fetch the text themselves, and only for rows a
 *      member is allowed to read.
 *
 *   3. AN EDIT INVALIDATES IT. `sourceHash` is the hash of the text
 *      that was translated. When it stops matching the row is ignored
 *      and re-fetched, so an edited post is never shown in translation
 *      of what it used to say.
 *
 * ── WHAT IS DELIBERATELY NOT TRANSLATED ──
 *
 * Names. A display name, a room's name typed by its founder, a town —
 * these are labels, not prose, and a machine that turns a person's
 * name into a common noun has done real damage for no gain. Room
 * names are the one exception and they are here only because they are
 * phrases ("Alcohol & Drug Recovery"), founded by staff, and act as
 * navigation.
 *
 * Anything not PUBLISHED. A removed or pending row is not readable, so
 * it is not translatable either — the loaders filter, rather than the
 * route trusting an id.
 */

import { createHash } from "node:crypto";
import { prisma } from "./db";
import { translateBatch, translationConfigured } from "./google-translate";
import { DEFAULT_LOCALE } from "./i18n-core";
import { CONTENT_KINDS, isContentKind, type ContentKind } from "./content-kinds";

export { CONTENT_KINDS, isContentKind };
export type { ContentKind };


export interface ContentRef {
  kind: ContentKind;
  id: string;
  field: string;
}

/** `post:abc123:body` — one key, used in the cache map and the wire. */
export function refKey(r: ContentRef): string {
  return `${r.kind}:${r.id}:${r.field}`;
}

function hash(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 40);
}

/**
 * How much of one request we are willing to SPEND.
 *
 * A feed page asks for twenty posts at once and a long post is a few
 * thousand characters, so a single careless request could be a
 * five-figure character bill. Past the cap the extra items are simply
 * not translated this time; the reader sees the original and the next
 * request picks them up, which is a far better failure than a route
 * that refuses everything because one item was long.
 *
 * ── THE CAPS APPLY TO MISSES, NOT TO THE REQUEST ──
 *
 * They used to be checked before the cache was read, which was a real
 * bug once category strips joined in: a listing page asks for twelve
 * tabs plus twelve cards plus their summaries, so the fortieth
 * reference was reached while every one of them was already sitting
 * in the cache. Readers past the cap got English for something
 * already paid for. Reading the cache is one indexed query whatever
 * its size; only the part that reaches Google is worth rationing.
 */
const MAX_LOOKUP = 400;
const MAX_ITEMS = 40;
const MAX_CHARS = 20_000;
/** Longer than this and the "Translate" affordance is the honest UI. */
const MAX_ONE = 6_000;

/* ── loading the source text ─────────────────────────────────── */

/**
 * `viewerId` is passed to every loader and used by exactly one of
 * them — notifications, which are addressed to a person.
 *
 * IT IS NOT OPTIONAL ON THE TYPE, on purpose. A loader that quietly
 * ignored it would be indistinguishable from one that forgot it, and
 * the thing it protects is somebody else's notification list. Having
 * it in every signature means adding a per-person table later starts
 * from "whose is this?" rather than from a missing argument.
 */
type Loader = (
  ids: string[],
  viewerId: string | null,
) => Promise<Map<string, Record<string, string>>>;

const CATEGORY_FIELDS = ["name", "description"] as const;

/**
 * The category tables, which mostly share three columns.
 *
 * Written once rather than eight times because eight copies is eight
 * chances for one of them to forget `isActive` — and a forgotten
 * filter means paying to translate a category nobody can see.
 *
 * ── `isActive` IS A PARAMETER, AND THAT COST A DAY ──
 *
 * Seven of these tables have the column. `article_categories` does
 * not, and sharing the helper meant every article category was asked
 * for with `where: { isActive: true }` — which Prisma rejects
 * outright. The loader threw, the request 500'd, and because failure
 * here is deliberately soft the whole page fell back to English with
 * nothing said. It took a screenshot showing translated petition tabs
 * beside untranslated article tabs to find it.
 *
 * So the flag is declared per table rather than assumed, and the
 * isolation below makes sure the next one of these takes only its own
 * kind down rather than the page.
 */
function cat(
  model: "articleCategory" | "eventCategory" | "campaignCategory" | "petitionCategory"
    | "gratitudeCategory" | "liveCategory" | "townHeroCategory",
  opts: { hasIsActive: boolean } = { hasIsActive: true },
): Loader {
  return async (ids) => {
    const rows = await (prisma[model] as {
      findMany: (a: unknown) => Promise<Array<{ id: string; name: string; description: string | null }>>;
    }).findMany({
      where: opts.hasIsActive ? { id: { in: ids }, isActive: true } : { id: { in: ids } },
      select: { id: true, name: true, description: true },
    });
    return new Map(
      rows.map((r) => [r.id, { name: r.name, description: r.description ?? "" }]),
    );
  };
}

/**
 * Every loader filters for readability, because the route hands them
 * ids straight off the wire. `post` and `comment` are PUBLISHED only,
 * gratitude entries APPROVED only, rooms ACTIVE only.
 */
const LOADERS: Record<ContentKind, Loader> = {
  /* ── taxonomy ─────────────────────────────────────────────── */
  // Categories have no reader-facing gate beyond `isActive`; an
  // inactive one is not on any tab strip, so it is not asked for and
  // not paid for.
  // No `isActive` column on this one — see the note on `cat`.
  articleCategory: cat("articleCategory", { hasIsActive: false }),
  eventCategory: cat("eventCategory"),
  campaignCategory: cat("campaignCategory"),
  petitionCategory: cat("petitionCategory"),
  gratitudeCategory: cat("gratitudeCategory"),
  liveCategory: cat("liveCategory"),
  townHeroCategory: cat("townHeroCategory"),
  // Chat categories carry no description and no isActive flag.
  chatCategory: async (ids) => {
    const rows = await prisma.chatCategory.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
    return new Map(rows.map((r) => [r.id, { name: r.name }]));
  },
  /*
     Themes are addressed by SLUG rather than by id.

     Every component that shows a theme's name has its slug — that is
     what the URL is built from — and several of them never load its
     id at all. Adding `id` to four `select` blocks so the translator
     could use it would be four chances to forget one; the slug is
     already unique, already stable, and already there.
  */
  libraryTheme: async (ids) => {
    const rows = await prisma.libraryTheme.findMany({
      where: { slug: { in: ids }, isActive: true },
      select: { slug: true, name: true, tagline: true, about: true },
    });
    return new Map(
      rows.map((r) => [
        r.slug,
        { name: r.name, tagline: r.tagline ?? "", about: r.about ?? "" },
      ]),
    );
  },
  /* ── submissions ──────────────────────────────────────────── */
  article: async (ids) => {
    const rows = await prisma.article.findMany({
      where: { id: { in: ids }, status: "PUBLISHED" },
      select: { id: true, title: true, excerpt: true, body: true },
    });
    return new Map(
      rows.map((r) => [
        r.id,
        { title: r.title, excerpt: r.excerpt ?? "", body: r.body },
      ]),
    );
  },
  event: async (ids) => {
    const rows = await prisma.event.findMany({
      where: { id: { in: ids }, status: "APPROVED" },
      select: { id: true, title: true, summary: true, description: true },
    });
    return new Map(
      rows.map((r) => [
        r.id,
        { title: r.title, summary: r.summary ?? "", description: r.description },
      ]),
    );
  },
  campaign: async (ids) => {
    const rows = await prisma.campaign.findMany({
      where: { id: { in: ids }, status: "PUBLISHED" },
      select: { id: true, title: true, summary: true, body: true },
    });
    return new Map(
      rows.map((r) => [
        r.id,
        { title: r.title, summary: r.summary ?? "", body: r.body ?? "" },
      ]),
    );
  },
  // A CLOSED petition is still readable — that is the whole point of
  // closing rather than deleting one — so both states are allowed.
  petition: async (ids) => {
    const rows = await prisma.petition.findMany({
      where: { id: { in: ids }, status: { in: ["APPROVED", "CLOSED"] } },
      select: { id: true, title: true, summary: true, body: true },
    });
    return new Map(
      rows.map((r) => [
        r.id,
        { title: r.title, summary: r.summary ?? "", body: r.body },
      ]),
    );
  },
  place: async (ids) => {
    const rows = await prisma.place.findMany({
      where: { id: { in: ids }, status: { in: ["APPROVED", "CLOSED"] } },
      select: { id: true, name: true, summary: true, about: true },
    });
    return new Map(
      rows.map((r) => [
        r.id,
        { name: r.name, summary: r.summary ?? "", about: r.about ?? "" },
      ]),
    );
  },
  townHero: async (ids) => {
    const rows = await prisma.townHero.findMany({
      where: { id: { in: ids }, status: "APPROVED" },
      select: { id: true, heroName: true, town: true, summary: true, body: true },
    });
    return new Map(
      rows.map((r) => [
        r.id,
        {
          heroName: r.heroName,
          // The town is free text a nominator typed, not a row in the
          // geography table — same shape, and the same decision, as a
          // member's `location`. See the note in `content-kinds.ts`.
          town: r.town ?? "",
          summary: r.summary ?? "",
          body: r.body,
        },
      ]),
    );
  },
  clip: async (ids) => {
    const rows = await prisma.clip.findMany({
      where: { id: { in: ids }, isPublished: true },
      select: { id: true, title: true, caption: true },
    });
    return new Map(
      rows.map((r) => [r.id, { title: r.title, caption: r.caption ?? "" }]),
    );
  },
  liveStream: async (ids) => {
    const rows = await prisma.liveStream.findMany({
      where: { id: { in: ids }, status: { in: ["LIVE", "ENDED"] } },
      select: { id: true, title: true, summary: true },
    });
    return new Map(
      rows.map((r) => [r.id, { title: r.title, summary: r.summary ?? "" }]),
    );
  },
  room: async (ids) => {
    const rows = await prisma.chatRoom.findMany({
      where: { id: { in: ids }, status: "ACTIVE" },
      select: { id: true, name: true, description: true },
    });
    return new Map(
      rows.map((r) => [r.id, { name: r.name, description: r.description ?? "" }]),
    );
  },

  /* ── editorial ────────────────────────────────────────────── */
  /*
     The daily quote's ATTRIBUTION is offered, unlike every other name
     on the site, because it is not only a name: "Maya Angelou, in
     Letter to My Daughter" has a preposition and a title in it, and
     leaving the whole line English strands the one part that does
     need moving. Google leaves a bare name alone.
  */
  dailyQuote: async (ids) => {
    const rows = await prisma.dailyQuote.findMany({
      where: { id: { in: ids }, isActive: true },
      select: { id: true, body: true, attribution: true },
    });
    return new Map(
      rows.map((r) => [r.id, { body: r.body, attribution: r.attribution ?? "" }]),
    );
  },
  dailyQuestion: async (ids) => {
    const rows = await prisma.dailyQuestion.findMany({
      where: { id: { in: ids }, isActive: true },
      select: { id: true, body: true },
    });
    return new Map(rows.map((r) => [r.id, { body: r.body }]));
  },

  /* ── conversation ─────────────────────────────────────────── */
  post: async (ids) => {
    const rows = await prisma.post.findMany({
      where: { id: { in: ids }, status: "PUBLISHED" },
      select: { id: true, body: true },
    });
    return new Map(rows.map((r) => [r.id, { body: r.body }]));
  },
  comment: async (ids) => {
    const rows = await prisma.postComment.findMany({
      where: { id: { in: ids }, status: "PUBLISHED" },
      select: { id: true, body: true },
    });
    return new Map(rows.map((r) => [r.id, { body: r.body }]));
  },
  gratitude: async (ids) => {
    const rows = await prisma.gratitudeEntry.findMany({
      where: { id: { in: ids }, status: "APPROVED" },
      select: { id: true, body: true },
    });
    return new Map(rows.map((r) => [r.id, { body: r.body }]));
  },
  gratitudeComment: async (ids) => {
    const rows = await prisma.gratitudeComment.findMany({
      where: { id: { in: ids } },
      select: { id: true, body: true },
    });
    return new Map(rows.map((r) => [r.id, { body: r.body }]));
  },
  /*
     THE ONLY LOADER THAT FILTERS BY READER.

     A notification belongs to one person. Everything else in this
     registry is content several people can already read, so an id
     off the wire is harmless; here an unfiltered lookup would let
     any signed-in member read any other member's notifications by
     guessing ids — through a translation endpoint, of all things.
  */
  notification: async (ids, viewerId) => {
    if (!viewerId) return new Map();
    const rows = await prisma.userNotification.findMany({
      where: { id: { in: ids }, userId: viewerId },
      select: { id: true, title: true, body: true },
    });
    return new Map(
      rows.map((r) => [r.id, { title: r.title, body: r.body ?? "" }]),
    );
  },
  /*
     A member's display name, for the directory and the profile card.

     THE SAME GATE THE MEMBERS DIRECTORY USES: active, unbanned
     accounts only. Without it this route would confirm whether a
     banned or deleted account exists, which is a thing the directory
     deliberately does not do — and it would do it through a
     translation endpoint, where nobody would think to look.

     THE THREE THINGS A MEMBER PUBLISHES ABOUT THEMSELVES — the name
     they go by, their bio, and the "City, Country" line. Never an
     email, and never a field they did not put on their own profile.
  */
  member: async (ids) => {
    const rows = await prisma.user.findMany({
      where: { id: { in: ids }, isActive: true, bannedAt: null },
      select: { id: true, displayName: true, bio: true, location: true },
    });
    return new Map(
      rows.map((r) => [
        r.id,
        { displayName: r.displayName, bio: r.bio ?? "", location: r.location ?? "" },
      ]),
    );
  },
  articleComment: async (ids) => {
    const rows = await prisma.articleComment.findMany({
      where: { id: { in: ids }, status: "PUBLISHED" },
      select: { id: true, body: true },
    });
    return new Map(rows.map((r) => [r.id, { body: r.body }]));
  },
  chatMessage: async (ids) => {
    const rows = await prisma.chatMessage.findMany({
      where: { id: { in: ids }, status: "PUBLISHED" },
      select: { id: true, body: true },
    });
    return new Map(rows.map((r) => [r.id, { body: r.body }]));
  },
  // Live comments are removed by timestamp rather than status.
  liveComment: async (ids) => {
    const rows = await prisma.liveComment.findMany({
      where: { id: { in: ids }, removedAt: null },
      select: { id: true, body: true },
    });
    return new Map(rows.map((r) => [r.id, { body: r.body }]));
  },
  clipComment: async (ids) => {
    const rows = await prisma.clipComment.findMany({
      where: { id: { in: ids }, status: "PUBLISHED" },
      select: { id: true, body: true },
    });
    return new Map(rows.map((r) => [r.id, { body: r.body }]));
  },
};

/** Which fields each kind will hand over. An unknown field is dropped. */
const FIELDS: Record<ContentKind, readonly string[]> = {
  articleCategory: CATEGORY_FIELDS,
  eventCategory: CATEGORY_FIELDS,
  campaignCategory: CATEGORY_FIELDS,
  petitionCategory: CATEGORY_FIELDS,
  gratitudeCategory: CATEGORY_FIELDS,
  chatCategory: ["name"],
  liveCategory: CATEGORY_FIELDS,
  townHeroCategory: CATEGORY_FIELDS,
  libraryTheme: ["name", "tagline", "about"],

  article: ["title", "excerpt", "body"],
  event: ["title", "summary", "description"],
  campaign: ["title", "summary", "body"],
  petition: ["title", "summary", "body"],
  place: ["name", "summary", "about"],
  townHero: ["heroName", "town", "summary", "body"],
  clip: ["title", "caption"],
  liveStream: ["title", "summary"],
  room: ["name", "description"],

  dailyQuote: ["body", "attribution"],
  dailyQuestion: ["body"],

  post: ["body"],
  comment: ["body"],
  gratitude: ["body"],
  gratitudeComment: ["body"],
  clipComment: ["body"],
  articleComment: ["body"],
  chatMessage: ["body"],
  liveComment: ["body"],
  notification: ["title", "body"],
  // What a member chose to publish about themselves on a public
  // directory — content like any other. Never an email: it is not on
  // the page, and it is not a sentence. See the long note in
  // `content-kinds.ts` for why `location` is on this list despite the
  // argument against translating places.
  member: ["displayName", "bio", "location"],
};

/* ── the one entry point ─────────────────────────────────────── */

export interface TranslatedContent {
  /** refKey → the translated text. Missing means "show the original". */
  values: Record<string, string>;
  /** True when something was left out because the caps were hit. */
  partial: boolean;
}

/**
 * Translate a batch of references into `locale`.
 *
 * Returns only what it has. A miss is not an error: the component
 * renders the original, which is always a whole sentence somebody
 * wrote, never a hole.
 */
export async function translateContent(
  refs: ContentRef[],
  locale: string,
  viewerId: string | null = null,
): Promise<TranslatedContent> {
  const values: Record<string, string> = {};
  if (!refs.length || locale === DEFAULT_LOCALE) return { values, partial: false };

  // An unknown or disabled locale must not reach the translator: it
  // would be a paid request for a language nobody can select.
  const live = await prisma.locale.findFirst({
    where: { code: locale, isEnabled: true },
    select: { code: true },
  });
  if (!live) return { values, partial: false };

  const usable = refs.filter(
    (r) => isContentKind(r.kind) && FIELDS[r.kind].includes(r.field),
  );
  const wanted = usable.slice(0, MAX_LOOKUP);
  const partialFromCap = wanted.length < usable.length;
  if (!wanted.length) return { values, partial: partialFromCap };

  // ── the source text, per kind, one query each ───────────────
  const byKind = new Map<ContentKind, Set<string>>();
  for (const r of wanted) {
    const set = byKind.get(r.kind) ?? new Set<string>();
    set.add(r.id);
    byKind.set(r.kind, set);
  }
  /*
     ONE BROKEN KIND MUST NOT TAKE THE PAGE WITH IT.

     A listing page asks for its tab strip and its cards
     in a single request. When the article-category loader threw on a
     column that does not exist, the throw escaped this loop, the
     route returned 500, and the reader lost every card
     label as well — none of which had anything wrong with them. The
     symptom was "the articles page is not translated", which points
     at nothing.

     Each kind is now loaded on its own and a failure costs only that
     kind. It is still logged, loudly, because a loader that throws is
     a bug and quietly returning less is how it would live forever.
  */
  const loaded = new Map<string, Record<string, string>>();
  for (const [kind, ids] of byKind) {
    try {
      const rows = await LOADERS[kind]([...ids], viewerId);
      for (const [id, fields] of rows) loaded.set(`${kind}:${id}`, fields);
    } catch (err) {
      console.error(`[content-translate] the "${kind}" loader failed`, err);
    }
  }

  type Job = { ref: ContentRef; text: string; hash: string };
  const jobs: Job[] = [];
  for (const r of wanted) {
    const text = loaded.get(`${r.kind}:${r.id}`)?.[r.field]?.trim();
    if (!text || text.length > MAX_ONE) continue;
    jobs.push({ ref: r, text, hash: hash(text) });
  }
  if (!jobs.length) return { values, partial: partialFromCap };

  // ── what is already paid for ────────────────────────────────
  const cached = await prisma.contentTranslation.findMany({
    where: {
      localeCode: locale,
      OR: jobs.map((j) => ({ kind: j.ref.kind, refId: j.ref.id, field: j.ref.field })),
    },
    select: { kind: true, refId: true, field: true, sourceHash: true, value: true },
  });
  const have = new Map(
    cached.map((c) => [`${c.kind}:${c.refId}:${c.field}`, c]),
  );

  const misses: Job[] = [];
  for (const j of jobs) {
    const hit = have.get(refKey(j.ref));
    // A stale hash means the author edited it. Ignore the row rather
    // than showing a translation of what the post used to say.
    if (hit && hit.sourceHash === j.hash) values[refKey(j.ref)] = hit.value;
    else misses.push(j);
  }
  if (!misses.length) return { values, partial: partialFromCap };

  if (!(await translationConfigured())) return { values, partial: true };

  // ── spend, within the caps ──────────────────────────────────
  const send: Job[] = [];
  let chars = 0;
  for (const j of misses) {
    if (send.length >= MAX_ITEMS) break;
    if (chars + j.text.length > MAX_CHARS) break;
    chars += j.text.length;
    send.push(j);
  }
  const cappedOut = send.length < misses.length;
  if (!send.length) return { values, partial: true };

  let out: string[];
  try {
    // `null` source: the author's language is not recorded anywhere, so
    // Google detects it. Passing "en" would mistranslate every post
    // that was not written in English.
    out = await translateBatch(send.map((j) => j.text), locale, null);
  } catch {
    // A translator outage is not a page error. The reader gets the
    // originals and whatever was already cached.
    return { values, partial: true };
  }

  const writes: Promise<unknown>[] = [];
  for (let i = 0; i < send.length; i += 1) {
    const j = send[i];
    const value = out[i];
    // Google echoing the input back means it could not do better than
    // the original — usually because the post was already in this
    // language. Storing it is right (it stops us paying again); using
    // it changes nothing.
    if (typeof value !== "string" || !value) continue;
    values[refKey(j.ref)] = value;
    writes.push(
      prisma.contentTranslation.upsert({
        where: {
          kind_refId_field_localeCode: {
            kind: j.ref.kind,
            refId: j.ref.id,
            field: j.ref.field,
            localeCode: locale,
          },
        },
        create: {
          kind: j.ref.kind,
          refId: j.ref.id,
          field: j.ref.field,
          localeCode: locale,
          sourceHash: j.hash,
          value,
        },
        update: { sourceHash: j.hash, value },
      }),
    );
  }
  // A failed write costs a re-translation later; it must not cost the
  // reader their page.
  await Promise.allSettled(writes);

  return { values, partial: partialFromCap || cappedOut };
}

/* ── is any of this actually working? ────────────────────────── */

export interface ContentHealth {
  /** False when `content_translations` is not in the database. */
  tableReady: boolean;
  /** Rows cached, and how they split by language and by kind. */
  rows: number;
  byLocale: Array<{ locale: string; rows: number }>;
  /**
   * WHICH KINDS HAVE EVER BEEN TRANSLATED, and which never have.
   *
   * Every failure in this file is soft on purpose — a broken loader
   * costs its own kind and the page shows the original — which means
   * "chat messages are not translating" and "chat messages are all
   * already in your language" look exactly alike from outside, and
   * cost an afternoon each to tell apart by reading code.
   *
   * A kind with rows is working. A kind with none either has nothing
   * to translate or is failing, and the server log says which. Either
   * way it is one glance instead of a guess.
   */
  byKind: Array<{ kind: string; rows: number }>;
  /** A Google key is set — without one, nothing is ever translated. */
  configured: boolean;
  /** What the translator said when asked to do one short string. */
  probe: { ok: boolean; message: string } | null;
  error: string | null;
}

/**
 * A straight answer to "why is none of my content translated?".
 *
 * ── WHY THIS EXISTS ──
 *
 * Every failure in this module is deliberately soft: no key, a
 * missing table, Google refusing the key, a network problem — all of
 * them end with the reader seeing the original text, which is the
 * right thing for the reader and completely silent for whoever runs
 * the site. "It is not translating" then looks identical to "it has
 * nothing to translate" and to "it is working fine and this post was
 * already in your language".
 *
 * The most likely cause by far is the least visible one: the schema
 * change was never applied, so `content_translations` does not exist
 * and every single lookup throws. That is one query to check, and
 * checking it turns a day of guessing into a sentence.
 *
 * `probe` actually spends a few characters at Google, on purpose —
 * a key can be present, stored, and rejected, and only a real call
 * finds that out.
 */
export async function contentTranslationHealth(
  probeLocale?: string | null,
): Promise<ContentHealth> {
  const out: ContentHealth = {
    tableReady: false,
    rows: 0,
    byLocale: [],
    byKind: [],
    configured: false,
    probe: null,
    error: null,
  };

  try {
    out.rows = await prisma.contentTranslation.count();
    out.tableReady = true;
    const grouped = await prisma.contentTranslation.groupBy({
      by: ["localeCode"],
      _count: { _all: true },
    });
    out.byLocale = grouped
      .map((g) => ({ locale: g.localeCode, rows: g._count._all }))
      .sort((a, b) => b.rows - a.rows);

    const kinds = await prisma.contentTranslation.groupBy({
      by: ["kind"],
      _count: { _all: true },
    });
    const seen = new Map(kinds.map((k) => [k.kind, k._count._all]));
    // EVERY kind is listed, including the ones with nothing — a kind
    // missing from the list would be indistinguishable from a kind
    // that is quietly broken, which is the whole problem.
    out.byKind = CONTENT_KINDS.map((kind) => ({ kind, rows: seen.get(kind) ?? 0 })).sort(
      (a, b) => b.rows - a.rows || a.kind.localeCompare(b.kind),
    );
  } catch (err) {
    out.error =
      err instanceof Error && /content_translations|does not exist|Unknown table|P2021/i.test(err.message)
        ? "The content_translations table is not in the database. Run `npx prisma db push` on the server \u2014 until then nothing members wrote can be translated, and the site quietly shows the original of everything."
        : err instanceof Error
          ? err.message
          : "Could not read the cache.";
    return out;
  }

  out.configured = await translationConfigured();
  if (!out.configured) return out;

  if (probeLocale && probeLocale !== DEFAULT_LOCALE) {
    try {
      const got = await translateBatch(["Good morning"], probeLocale, "en");
      out.probe = {
        ok: !!got[0],
        message: got[0] ? `"Good morning" came back as "${got[0]}".` : "Google returned nothing.",
      };
    } catch (err) {
      out.probe = {
        ok: false,
        message: err instanceof Error ? err.message : "The translator refused.",
      };
    }
  }

  return out;
}
