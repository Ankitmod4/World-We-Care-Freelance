/**
 * Cached counters: what each one is supposed to equal, in one place.
 *
 * The app keeps denormalised counts — `Post.likeCount`,
 * `ChatRoom.memberCount`, and twenty more — because the feed cannot
 * afford a COUNT(*) per card. Nearly every write path already
 * RECOUNTS rather than incrementing, precisely so a lost write cannot
 * drift; the handful that do increment are paired with a decrement.
 *
 * WHAT WENT WRONG. `deleteAccount` deletes a departing member's likes,
 * saves, hearts, supports, RSVPs and chat memberships — some directly,
 * the rest by cascade when the User row goes — and recounted none of
 * the parents. Every deletion therefore left every counter that person
 * had touched permanently too high, with nothing anywhere to correct
 * it. Only `deleteCommentsAndRecount` got this right.
 *
 * So the definitions live here now, each one copied from the write
 * path that owns it, and there are two callers:
 *
 *   • `deleteAccount`, which passes the ids it is about to orphan.
 *   • `prisma/recount-counters.ts`, which passes null and sweeps the
 *     whole database — the repair for drift already banked.
 *
 * Passing `ids: null` means "every row". Passing `[]` means nothing,
 * and short-circuits.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

export interface CounterFix {
  counter: string;
  id: string;
  from: number;
  to: number;
}

interface Spec {
  counter: string;
  /** Current stored values for the rows in scope. */
  parents: (ids: string[] | null) => Promise<Array<{ id: string; value: number }>>;
  /** What those values should be, keyed by parent id. Absent = 0. */
  tally: (ids: string[] | null) => Promise<Map<string, number>>;
  write: (id: string, value: number) => Prisma.PrismaPromise<unknown>;
}

/** `{ fk: { in: ids } }`, or no filter at all when ids is null. */
function scope<K extends string>(key: K, ids: string[] | null) {
  return ids ? ({ [key]: { in: ids } } as Record<K, { in: string[] }>) : {};
}

/**
 * Turn a groupBy result into `{ parentId -> count }`.
 *
 * Prisma types every groupBy differently, so this takes the shape it
 * actually needs and nothing more: a foreign key and `_count._all`.
 */
function toMap<K extends string>(
  rows: Array<Record<K, string> & { _count: { _all: number } }>,
  key: K,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows) out.set(r[key], r._count._all);
  return out;
}

/* ── the definitions ─────────────────────────────────────────── */

const SPECS: Spec[] = [
  /* posts */
  {
    counter: "Post.likeCount",
    parents: (ids) =>
      prisma.post.findMany({ where: ids ? { id: { in: ids } } : {}, select: { id: true, likeCount: true } })
        .then((r) => r.map((p) => ({ id: p.id, value: p.likeCount }))),
    tally: (ids) =>
      prisma.postLike.groupBy({ by: ["postId"], where: scope("postId", ids), _count: { _all: true } })
        .then((r) => toMap(r, "postId")),
    write: (id, value) => prisma.post.update({ where: { id }, data: { likeCount: value } }),
  },
  {
    counter: "Post.saveCount",
    parents: (ids) =>
      prisma.post.findMany({ where: ids ? { id: { in: ids } } : {}, select: { id: true, saveCount: true } })
        .then((r) => r.map((p) => ({ id: p.id, value: p.saveCount }))),
    tally: (ids) =>
      prisma.postSave.groupBy({ by: ["postId"], where: scope("postId", ids), _count: { _all: true } })
        .then((r) => toMap(r, "postId")),
    write: (id, value) => prisma.post.update({ where: { id }, data: { saveCount: value } }),
  },
  {
    counter: "Post.commentCount",
    parents: (ids) =>
      prisma.post.findMany({ where: ids ? { id: { in: ids } } : {}, select: { id: true, commentCount: true } })
        .then((r) => r.map((p) => ({ id: p.id, value: p.commentCount }))),
    tally: (ids) =>
      prisma.postComment.groupBy({
        by: ["postId"],
        where: { status: "PUBLISHED", ...scope("postId", ids) },
        _count: { _all: true },
      }).then((r) => toMap(r, "postId")),
    write: (id, value) => prisma.post.update({ where: { id }, data: { commentCount: value } }),
  },

  /* articles */
  {
    counter: "Article.likeCount",
    parents: (ids) =>
      prisma.article.findMany({ where: ids ? { id: { in: ids } } : {}, select: { id: true, likeCount: true } })
        .then((r) => r.map((a) => ({ id: a.id, value: a.likeCount }))),
    tally: (ids) =>
      prisma.articleLike.groupBy({ by: ["articleId"], where: scope("articleId", ids), _count: { _all: true } })
        .then((r) => toMap(r, "articleId")),
    write: (id, value) => prisma.article.update({ where: { id }, data: { likeCount: value } }),
  },
  {
    counter: "Article.saveCount",
    parents: (ids) =>
      prisma.article.findMany({ where: ids ? { id: { in: ids } } : {}, select: { id: true, saveCount: true } })
        .then((r) => r.map((a) => ({ id: a.id, value: a.saveCount }))),
    tally: (ids) =>
      prisma.articleSave.groupBy({ by: ["articleId"], where: scope("articleId", ids), _count: { _all: true } })
        .then((r) => toMap(r, "articleId")),
    write: (id, value) => prisma.article.update({ where: { id }, data: { saveCount: value } }),
  },
  {
    counter: "Article.commentCount",
    parents: (ids) =>
      prisma.article.findMany({ where: ids ? { id: { in: ids } } : {}, select: { id: true, commentCount: true } })
        .then((r) => r.map((a) => ({ id: a.id, value: a.commentCount }))),
    tally: (ids) =>
      prisma.articleComment.groupBy({
        by: ["articleId"],
        where: { status: "PUBLISHED", ...scope("articleId", ids) },
        _count: { _all: true },
      }).then((r) => toMap(r, "articleId")),
    write: (id, value) => prisma.article.update({ where: { id }, data: { commentCount: value } }),
  },
  {
    counter: "ArticleComment.likeCount",
    parents: (ids) =>
      prisma.articleComment.findMany({ where: ids ? { id: { in: ids } } : {}, select: { id: true, likeCount: true } })
        .then((r) => r.map((c) => ({ id: c.id, value: c.likeCount }))),
    tally: (ids) =>
      prisma.articleCommentLike.groupBy({ by: ["commentId"], where: scope("commentId", ids), _count: { _all: true } })
        .then((r) => toMap(r, "commentId")),
    write: (id, value) => prisma.articleComment.update({ where: { id }, data: { likeCount: value } }),
  },

  /* clips */
  {
    counter: "Clip.likeCount",
    parents: (ids) =>
      prisma.clip.findMany({ where: ids ? { id: { in: ids } } : {}, select: { id: true, likeCount: true } })
        .then((r) => r.map((c) => ({ id: c.id, value: c.likeCount }))),
    tally: (ids) =>
      prisma.clipLike.groupBy({ by: ["clipId"], where: scope("clipId", ids), _count: { _all: true } })
        .then((r) => toMap(r, "clipId")),
    write: (id, value) => prisma.clip.update({ where: { id }, data: { likeCount: value } }),
  },
  {
    counter: "Clip.saveCount",
    parents: (ids) =>
      prisma.clip.findMany({ where: ids ? { id: { in: ids } } : {}, select: { id: true, saveCount: true } })
        .then((r) => r.map((c) => ({ id: c.id, value: c.saveCount }))),
    tally: (ids) =>
      prisma.clipSave.groupBy({ by: ["clipId"], where: scope("clipId", ids), _count: { _all: true } })
        .then((r) => toMap(r, "clipId")),
    write: (id, value) => prisma.clip.update({ where: { id }, data: { saveCount: value } }),
  },
  {
    counter: "Clip.commentCount",
    parents: (ids) =>
      prisma.clip.findMany({ where: ids ? { id: { in: ids } } : {}, select: { id: true, commentCount: true } })
        .then((r) => r.map((c) => ({ id: c.id, value: c.commentCount }))),
    tally: (ids) =>
      prisma.clipComment.groupBy({
        by: ["clipId"],
        where: { status: "PUBLISHED", ...scope("clipId", ids) },
        _count: { _all: true },
      }).then((r) => toMap(r, "clipId")),
    write: (id, value) => prisma.clip.update({ where: { id }, data: { commentCount: value } }),
  },
  {
    counter: "ClipComment.likeCount",
    parents: (ids) =>
      prisma.clipComment.findMany({ where: ids ? { id: { in: ids } } : {}, select: { id: true, likeCount: true } })
        .then((r) => r.map((c) => ({ id: c.id, value: c.likeCount }))),
    tally: (ids) =>
      prisma.clipCommentLike.groupBy({ by: ["commentId"], where: scope("commentId", ids), _count: { _all: true } })
        .then((r) => toMap(r, "commentId")),
    write: (id, value) => prisma.clipComment.update({ where: { id }, data: { likeCount: value } }),
  },
  {
    counter: "LibraryTheme.followerCount",
    parents: (ids) =>
      prisma.libraryTheme.findMany({ where: ids ? { id: { in: ids } } : {}, select: { id: true, followerCount: true } })
        .then((r) => r.map((t) => ({ id: t.id, value: t.followerCount }))),
    tally: (ids) =>
      prisma.themeFollow.groupBy({ by: ["themeId"], where: scope("themeId", ids), _count: { _all: true } })
        .then((r) => toMap(r, "themeId")),
    write: (id, value) => prisma.libraryTheme.update({ where: { id }, data: { followerCount: value } }),
  },
  {
    // Published only — matches library-admin.ts, which is what writes it.
    counter: "LibraryTheme.clipCount",
    parents: (ids) =>
      prisma.libraryTheme.findMany({ where: ids ? { id: { in: ids } } : {}, select: { id: true, clipCount: true } })
        .then((r) => r.map((t) => ({ id: t.id, value: t.clipCount }))),
    tally: (ids) =>
      prisma.clip.groupBy({
        by: ["themeId"],
        where: { isPublished: true, ...scope("themeId", ids) },
        _count: { _all: true },
      }).then((r) => toMap(r, "themeId")),
    write: (id, value) => prisma.libraryTheme.update({ where: { id }, data: { clipCount: value } }),
  },

  /* gratitude */
  {
    counter: "GratitudeEntry.heartCount",
    parents: (ids) =>
      prisma.gratitudeEntry.findMany({ where: ids ? { id: { in: ids } } : {}, select: { id: true, heartCount: true } })
        .then((r) => r.map((g) => ({ id: g.id, value: g.heartCount }))),
    tally: (ids) =>
      prisma.gratitudeHeart.groupBy({ by: ["entryId"], where: scope("entryId", ids), _count: { _all: true } })
        .then((r) => toMap(r, "entryId")),
    write: (id, value) => prisma.gratitudeEntry.update({ where: { id }, data: { heartCount: value } }),
  },

  /* campaigns, events, petitions, places */
  {
    counter: "Campaign.supporterCount",
    parents: (ids) =>
      prisma.campaign.findMany({ where: ids ? { id: { in: ids } } : {}, select: { id: true, supporterCount: true } })
        .then((r) => r.map((c) => ({ id: c.id, value: c.supporterCount }))),
    tally: (ids) =>
      prisma.campaignSupport.groupBy({ by: ["campaignId"], where: scope("campaignId", ids), _count: { _all: true } })
        .then((r) => toMap(r, "campaignId")),
    write: (id, value) => prisma.campaign.update({ where: { id }, data: { supporterCount: value } }),
  },
  {
    counter: "Event.rsvpCount",
    parents: (ids) =>
      prisma.event.findMany({ where: ids ? { id: { in: ids } } : {}, select: { id: true, rsvpCount: true } })
        .then((r) => r.map((e) => ({ id: e.id, value: e.rsvpCount }))),
    tally: (ids) =>
      prisma.eventRsvp.groupBy({ by: ["eventId"], where: scope("eventId", ids), _count: { _all: true } })
        .then((r) => toMap(r, "eventId")),
    write: (id, value) => prisma.event.update({ where: { id }, data: { rsvpCount: value } }),
  },
  {
    counter: "Petition.signatureCount",
    parents: (ids) =>
      prisma.petition.findMany({ where: ids ? { id: { in: ids } } : {}, select: { id: true, signatureCount: true } })
        .then((r) => r.map((p) => ({ id: p.id, value: p.signatureCount }))),
    tally: (ids) =>
      prisma.petitionSignature.groupBy({ by: ["petitionId"], where: scope("petitionId", ids), _count: { _all: true } })
        .then((r) => toMap(r, "petitionId")),
    write: (id, value) => prisma.petition.update({ where: { id }, data: { signatureCount: value } }),
  },
  {
    counter: "Place.saveCount",
    parents: (ids) =>
      prisma.place.findMany({ where: ids ? { id: { in: ids } } : {}, select: { id: true, saveCount: true } })
        .then((r) => r.map((p) => ({ id: p.id, value: p.saveCount }))),
    tally: (ids) =>
      prisma.placeSave.groupBy({ by: ["placeId"], where: scope("placeId", ids), _count: { _all: true } })
        .then((r) => toMap(r, "placeId")),
    write: (id, value) => prisma.place.update({ where: { id }, data: { saveCount: value } }),
  },

  /* chatrooms */
  {
    // ACTIVE only: PENDING is a join request and BANNED is not a member.
    counter: "ChatRoom.memberCount",
    parents: (ids) =>
      prisma.chatRoom.findMany({ where: ids ? { id: { in: ids } } : {}, select: { id: true, memberCount: true } })
        .then((r) => r.map((c) => ({ id: c.id, value: c.memberCount }))),
    tally: (ids) =>
      prisma.chatMembership.groupBy({
        by: ["roomId"],
        where: { status: "ACTIVE", ...scope("roomId", ids) },
        _count: { _all: true },
      }).then((r) => toMap(r, "roomId")),
    write: (id, value) => prisma.chatRoom.update({ where: { id }, data: { memberCount: value } }),
  },
  {
    counter: "ChatRoom.messageCount",
    parents: (ids) =>
      prisma.chatRoom.findMany({ where: ids ? { id: { in: ids } } : {}, select: { id: true, messageCount: true } })
        .then((r) => r.map((c) => ({ id: c.id, value: c.messageCount }))),
    tally: (ids) =>
      prisma.chatMessage.groupBy({
        by: ["roomId"],
        where: { status: "PUBLISHED", ...scope("roomId", ids) },
        _count: { _all: true },
      }).then((r) => toMap(r, "roomId")),
    write: (id, value) => prisma.chatRoom.update({ where: { id }, data: { messageCount: value } }),
  },
];

/* ── running them ────────────────────────────────────────────── */

export type CounterName = string;

/** Which counters exist, for a script that wants to name them. */
export function counterNames(): string[] {
  return SPECS.map((s) => s.counter);
}

/**
 * Recompute counters and, unless `dryRun`, write the corrections.
 *
 * `scopeIds` maps a MODEL name ("Post", "ChatRoom") to the ids to
 * check. A model absent from the map is skipped entirely; pass null
 * for the whole map to sweep everything.
 */
export async function recountCounters(opts: {
  scopeIds: Map<string, string[]> | null;
  dryRun?: boolean;
  onProgress?: (counter: string, checked: number, fixed: number) => void;
}): Promise<CounterFix[]> {
  const dryRun = opts.dryRun ?? false;
  const all: CounterFix[] = [];

  for (const spec of SPECS) {
    const model = spec.counter.split(".")[0];

    let ids: string[] | null = null;
    if (opts.scopeIds) {
      const scoped = opts.scopeIds.get(model);
      if (!scoped || scoped.length === 0) continue;
      ids = [...new Set(scoped)];
    }

    const [parents, tally] = await Promise.all([spec.parents(ids), spec.tally(ids)]);

    const ops: Prisma.PrismaPromise<unknown>[] = [];
    const fixes: CounterFix[] = [];
    for (const p of parents) {
      const to = tally.get(p.id) ?? 0;
      if (to === p.value) continue;
      fixes.push({ counter: spec.counter, id: p.id, from: p.value, to });
      ops.push(spec.write(p.id, to));
    }

    if (!dryRun && ops.length) {
      // Chunked: one transaction per few hundred rows keeps a sweep of
      // a large table off a single long-held lock.
      for (let i = 0; i < ops.length; i += 200) {
        await prisma.$transaction(ops.slice(i, i + 200));
      }
    }

    all.push(...fixes);
    opts.onProgress?.(spec.counter, parents.length, fixes.length);
  }

  return all;
}
