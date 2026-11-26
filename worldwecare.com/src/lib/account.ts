/**
 * Everything a member can do to their own account.
 *
 * Three rules run through this file:
 *
 *  1. ANYTHING THAT CHANGES HOW YOU GET IN NEEDS THE CURRENT PASSWORD.
 *     Changing the email or the password are both account takeovers if
 *     a borrowed session can do them unchallenged — a phone left
 *     unlocked on a table is the realistic threat, not a hacker.
 *  2. A NEW EMAIL IS CONFIRMED FROM THE NEW EMAIL, never trusted from
 *     the form. Until that happens it lives in `pendingEmail` and the
 *     account still signs in with the old one.
 *  3. DESTRUCTIVE THINGS SAY WHAT THEY DID. Deletion returns counts,
 *     so the caller can tell the person what actually went, rather
 *     than a shrug and a redirect.
 */

import { prisma } from "./db";
import { hashPassword, verifyPassword } from "./password";
import { confirmError, emailError, passwordError } from "./signup-rules";
import { consumeToken, sendEmailChangeEmail } from "./verification";
import { deletePost, postImageUrls } from "./posts-write";
import { discardVideo } from "./video-status";
import { deleteMediaByUrls, extractLocalImageUrls } from "./media";
import { THEMES, parseAppearanceMode, parseTone } from "./theming";
import { recountCounters } from "./recount";

/* ── email ───────────────────────────────────────────────────── */

export async function requestEmailChange(input: {
  userId: string;
  newEmail: string;
  currentPassword: string;
  appUrl: string;
}): Promise<{ ok: true; pendingEmail: string }> {
  const email = input.newEmail.trim().toLowerCase();
  const bad = emailError(email);
  if (bad) throw new Error(bad);

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true, displayName: true, passwordHash: true },
  });
  if (!user) throw new Error("Account not found");
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw new Error("That's not your current password.");
  }
  if (email === user.email) {
    throw new Error("That's already your email address.");
  }

  // Checked, but the answer is deliberately vague. Saying "that
  // address belongs to someone else" turns this into the membership
  // oracle that /forgot-password works so hard not to be.
  const taken = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (taken) throw new Error("That address can't be used. Try another.");

  await prisma.user.update({
    where: { id: user.id },
    data: { pendingEmail: email },
  });
  await sendEmailChangeEmail(user, email, input.appUrl);

  return { ok: true, pendingEmail: email };
}

export async function cancelEmailChange(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { pendingEmail: null } });
  await prisma.verificationToken.updateMany({
    where: { userId, purpose: "EMAIL_CHANGE", usedAt: null },
    data: { usedAt: new Date() },
  });
}

export async function confirmEmailChange(
  token: string,
): Promise<{ ok: boolean; email?: string; error?: string }> {
  const consumed = await consumeToken(token, "EMAIL_CHANGE");
  if (!consumed.ok || !consumed.userId) {
    return { ok: false, error: consumed.error ?? "Invalid or expired link." };
  }

  const user = await prisma.user.findUnique({
    where: { id: consumed.userId },
    select: { id: true, pendingEmail: true },
  });
  if (!user?.pendingEmail) {
    return { ok: false, error: "There's no pending email change on this account." };
  }

  // Re-check at the moment of the swap. Between the request and the
  // click, someone else may have signed up with that address.
  const taken = await prisma.user.findFirst({
    where: { email: user.pendingEmail, NOT: { id: user.id } },
    select: { id: true },
  });
  if (taken) {
    await prisma.user.update({ where: { id: user.id }, data: { pendingEmail: null } });
    return { ok: false, error: "That address is no longer available." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      email: user.pendingEmail,
      pendingEmail: null,
      // The new address is proven — it is the one that received this
      // link — so the account is verified, not un-verified.
      emailVerifiedAt: new Date(),
    },
  });
  return { ok: true, email: user.pendingEmail };
}

/* ── password ────────────────────────────────────────────────── */

export async function changePassword(input: {
  userId: string;
  currentPassword: string;
  password: string;
  confirm: string;
}): Promise<{ ok: true; sessionsRevokedAt: Date }> {
  const bad = passwordError(input.password) ?? confirmError(input.password, input.confirm);
  if (bad) throw new Error(bad);

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, passwordHash: true },
  });
  if (!user) throw new Error("Account not found");
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw new Error("That's not your current password.");
  }
  if (await verifyPassword(input.password, user.passwordHash)) {
    throw new Error("That's the password you already have.");
  }

  const sessionsRevokedAt = new Date();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(input.password),
      // Same write, so there is no instant where the password has
      // changed but the old cookies still work. The caller re-issues
      // a cookie for the device doing this, which is why the person
      // changing it doesn't get logged out of their own browser.
      sessionsValidFrom: sessionsRevokedAt,
    },
  });

  await prisma.verificationToken
    .updateMany({
      where: { userId: user.id, purpose: "PASSWORD_RESET", usedAt: null },
      data: { usedAt: new Date() },
    })
    .catch(() => {});

  return { ok: true, sessionsRevokedAt };
}

/* ── preferences ─────────────────────────────────────────────── */

export async function setCountry(userId: string, countryId: string | null): Promise<void> {
  if (countryId) {
    const country = await prisma.country.findFirst({
      where: { id: countryId, isActive: true },
      select: { id: true },
    });
    if (!country) throw new Error("Pick a country from the list.");
  }
  await prisma.user.update({ where: { id: userId }, data: { countryId } });
}

export async function setAnonymousDefault(userId: string, on: boolean): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { anonymousByDefault: on },
  });
}

/**
 * Colour theme and light/dark.
 *
 * Both are optional and independent — changing one must not silently
 * reset the other, because the two controls are in different places
 * (the palette in Settings, the mode in the menu) and a member who
 * flips to dark from the menu has not said anything about their
 * palette.
 *
 * VALIDATION IS THE POINT OF THIS FUNCTION. `themeId` arrives from a
 * request body and ends up interpolated into a `<style>` tag on every
 * subsequent page, so it is checked against the actual list here and
 * never stored unless it names a real theme. `getTheme()` also falls
 * back safely, which makes this belt and braces — deliberately, since
 * it is the one field in this file whose value reaches the DOM.
 *
 * ALL THREE MODES ARE STORED AS THEMSELVES, "system" included. It
 * used to be collapsed to NULL, which was harmless while NULL and
 * "system" meant the same thing. They no longer do: NULL now means
 * "never chose" and resolves to the app default, so a member who
 * deliberately picked Auto has to be written down as having picked
 * it, or the next page load would quietly move them to dark.
 *
 * The attribute the shell writes is still absent for "system" — that
 * is `appearanceAttribute`'s job at render time, not the column's.
 */
export async function setAppearance(
  userId: string,
  input: {
    colorThemeId?: string | null;
    appearanceMode?: string | null;
    brandTone?: number | null;
  },
): Promise<void> {
  const data: {
    colorThemeId?: string | null;
    appearanceMode?: string | null;
    brandTone?: number;
  } = {};

  if (input.colorThemeId !== undefined) {
    const id = typeof input.colorThemeId === "string" ? input.colorThemeId : null;
    if (id !== null && !THEMES.some((t) => t.id === id)) {
      throw new Error("That's not one of the themes.");
    }
    data.colorThemeId = id;
  }

  if (input.appearanceMode !== undefined) {
    const mode = parseAppearanceMode(
      typeof input.appearanceMode === "string" ? input.appearanceMode : null,
    );
    data.appearanceMode = mode;
  }

  if (input.brandTone !== undefined) {
    // parseTone clamps anything out of range back to the default, so a
    // hand-rolled request can't store a step the picker has no swatch
    // for and the contrast check has never seen.
    data.brandTone = parseTone(input.brandTone);
  }

  if (Object.keys(data).length === 0) return;
  await prisma.user.update({ where: { id: userId }, data });
}

/* ── leaving ─────────────────────────────────────────────────── */

/**
 * Deactivate — reversible, and nothing is destroyed.
 *
 * `isActive: false` makes `getCurrentUser` hydrate as null, and
 * stamping the session cut-off drops every device at once rather than
 * leaving the account half-usable on whichever phone it was open on.
 */
export async function deactivateAccount(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { isActive: false, sessionsValidFrom: new Date() },
  });
}

export interface DeleteAccountResult {
  posts: number;
  comments: number;
  gratitude: number;
  messages: number;
  chatMessages: number;
}

/**
 * Delete — and mean it.
 *
 * The schema was built so that hard-deleting a user does NOT take
 * their content with it: `Post.authorId` and friends are
 * `onDelete: SetNull`, which would leave a feed full of authorless
 * posts. That is the right default for an admin removing an account,
 * and the wrong one for a person exercising their own erasure.
 *
 * So the content is removed explicitly, in dependency order, before
 * the row goes. The split is deliberate:
 *
 *   REMOVED — what is theirs and personal: posts, comments,
 *   gratitude entries, direct messages, chat messages,
 *   and every uploaded file behind them.
 *
 *   DETACHED — contributions to shared resources: a place they
 *   submitted, an event they hosted, a report they filed. Deleting a
 *   food bank listing because the person who told us about it left
 *   would punish everyone who still needs it. Those keep the display
 *   snapshot the loose-FK convention already stores, and lose the
 *   link to the person.
 *
 * Anything not in either list is cascaded by the database.
 */
/**
 * Delete every comment this person left, and put the cached counts on
 * the things they commented on back in step with reality.
 *
 * The parent ids are collected BEFORE the delete, because afterwards
 * nothing is left to say which threads shrank. Each parent is then
 * recounted rather than decremented, matching how the rest of the
 * codebase maintains these numbers.
 *
 * The status filters below are not decoration: posts, articles and
 * clips all count only PUBLISHED comments, so a recount that ignored
 * status would quietly fold moderator-removed comments back into the
 * number.
 *
 * Returns the number of post comments removed — the figure the caller
 * reports back to the person.
 */
async function deleteCommentsAndRecount(userId: string): Promise<{ count: number }> {
  const uniq = (v: string[]) => [...new Set(v)];

  const [postIds, articleIds, clipIds] = await Promise.all([
    prisma.postComment
      .findMany({ where: { authorId: userId }, select: { postId: true } })
      .then((r) => uniq(r.map((x) => x.postId)))
      .catch(() => [] as string[]),
    prisma.articleComment
      .findMany({ where: { authorId: userId }, select: { articleId: true } })
      .then((r) => uniq(r.map((x) => x.articleId)))
      .catch(() => [] as string[]),
    prisma.clipComment
      .findMany({ where: { authorId: userId }, select: { clipId: true } })
      .then((r) => uniq(r.map((x) => x.clipId)))
      .catch(() => [] as string[]),
  ]);

  const comments = await prisma.postComment.deleteMany({ where: { authorId: userId } });
  await Promise.all(
    [
      prisma.articleComment.deleteMany({ where: { authorId: userId } }),
      // Replies to their comments go by cascade; their own likes on
      // other people's comments have to be named.
      prisma.clipComment.deleteMany({ where: { authorId: userId } }),
      prisma.clipCommentLike.deleteMany({ where: { userId } }),
    ].map((q) => q.catch(() => undefined)),
  );

  // These lists are short — the threads one person took part in, not
  // the whole table.
  await Promise.all(
    [
      ...postIds.map(async (id) =>
        prisma.post.update({
          where: { id },
          data: {
            commentCount: await prisma.postComment.count({
              where: { postId: id, status: "PUBLISHED" },
            }),
          },
        }),
      ),
      ...articleIds.map(async (id) =>
        prisma.article.update({
          where: { id },
          data: {
            commentCount: await prisma.articleComment.count({
              where: { articleId: id, status: "PUBLISHED" },
            }),
          },
        }),
      ),
      ...clipIds.map(async (id) =>
        prisma.clip.update({
          where: { id },
          data: {
            commentCount: await prisma.clipComment.count({
              where: { clipId: id, status: "PUBLISHED" },
            }),
          },
        }),
      ),
    ].map((q) => q.catch(() => undefined)),
  );

  return { count: comments.count };
}

export async function deleteAccount(userId: string): Promise<DeleteAccountResult> {
  // 1. Posts, one at a time, through the same path the delete button
  //    uses — so the media and video assets go too, with the same
  //    ownership checks. Slower than a deleteMany, and the only way
  //    the files on disk actually leave.
  const posts = await prisma.post.findMany({
    where: { authorId: userId },
    select: { id: true },
  });
  for (const p of posts) {
    await deletePost(userId, p.id).catch(() => {});
  }

  // 2. Comments they left on other people's posts, articles and
  //    clips. Each parent carries a cached commentCount, so every one
  //    that loses a comment here has to be recounted — a deleteMany
  //    does not touch them, and a count that says 4 above a thread of
  //    2 is the drift the rest of the codebase recounts to avoid.
  const comments = await deleteCommentsAndRecount(userId);

  // 3. Their gratitude entries.
  const gratitude = await prisma.gratitudeEntry.deleteMany({ where: { authorId: userId } });

  // 4. Conversations. Their own messages go; the other person's stay
  //    in their own inbox, which is theirs and not ours to delete.
  const messages = await prisma.directMessage.deleteMany({ where: { senderId: userId } });
  await prisma.conversationParticipant.deleteMany({ where: { userId } }).catch(() => {});

  // 5. Chatroom messages.
  const chatMessages = await prisma.chatMessage.deleteMany({ where: { authorId: userId } });
  await prisma.chatMembership.deleteMany({ where: { userId } }).catch(() => {});

  // 6. Clips and the files behind them. `discardVideo` owns the
  //    knowledge of which files an asset has and re-checks ownership,
  //    so it is the only thing that should be deleting them.
  const clipRows = await prisma.videoAsset.findMany({
    where: { ownerId: userId },
    select: { id: true },
  });
  for (const v of clipRows) {
    await discardVideo(v.id, { id: userId, isAdmin: false }).catch(() => {});
  }

  // 6a. WHOSE COUNTERS THIS DELETION IS ABOUT TO BREAK.
  //
  //    Everything in step 7 — plus the PostLike / PostSave rows the
  //    User cascade takes in step 10 — belongs to OTHER PEOPLE'S
  //    posts, clips, rooms and campaigns. Deleting them silently left
  //    every one of those counters too high, forever. This was the one
  //    thing `deleteAccount` never cleaned up, and nothing anywhere
  //    else corrected it.
  //
  //    The ids have to be read BEFORE the rows go, so they are
  //    collected here and the recount runs at the very end, once the
  //    children are actually gone. @/lib/recount holds the definition
  //    of every counter, copied from the write path that owns it.
  const counterScope = new Map<string, string[]>();
  const note = (model: string, ids: string[]) => {
    if (!ids.length) return;
    counterScope.set(model, [...(counterScope.get(model) ?? []), ...ids]);
  };

  await Promise.all(
    [
      prisma.postLike.findMany({ where: { userId }, select: { postId: true } })
        .then((r) => note("Post", r.map((x) => x.postId))),
      prisma.postSave.findMany({ where: { userId }, select: { postId: true } })
        .then((r) => note("Post", r.map((x) => x.postId))),
      prisma.articleLike.findMany({ where: { userId }, select: { articleId: true } })
        .then((r) => note("Article", r.map((x) => x.articleId))),
      prisma.articleSave.findMany({ where: { userId }, select: { articleId: true } })
        .then((r) => note("Article", r.map((x) => x.articleId))),
      prisma.articleCommentLike.findMany({ where: { userId }, select: { commentId: true } })
        .then((r) => note("ArticleComment", r.map((x) => x.commentId))),
      prisma.clipLike.findMany({ where: { userId }, select: { clipId: true } })
        .then((r) => note("Clip", r.map((x) => x.clipId))),
      prisma.clipSave.findMany({ where: { userId }, select: { clipId: true } })
        .then((r) => note("Clip", r.map((x) => x.clipId))),
      prisma.clipCommentLike.findMany({ where: { userId }, select: { commentId: true } })
        .then((r) => note("ClipComment", r.map((x) => x.commentId))),
      prisma.themeFollow.findMany({ where: { userId }, select: { themeId: true } })
        .then((r) => note("LibraryTheme", r.map((x) => x.themeId))),
      prisma.gratitudeHeart.findMany({ where: { userId }, select: { entryId: true } })
        .then((r) => note("GratitudeEntry", r.map((x) => x.entryId))),
      prisma.campaignSupport.findMany({ where: { userId }, select: { campaignId: true } })
        .then((r) => note("Campaign", r.map((x) => x.campaignId))),
      prisma.eventRsvp.findMany({ where: { userId }, select: { eventId: true } })
        .then((r) => note("Event", r.map((x) => x.eventId))),
      prisma.placeSave.findMany({ where: { userId }, select: { placeId: true } })
        .then((r) => note("Place", r.map((x) => x.placeId))),
      prisma.petitionSignature.findMany({ where: { userId }, select: { petitionId: true } })
        .then((r) => note("Petition", r.map((x) => x.petitionId))),
      // Rooms they belonged to and rooms they spoke in: memberCount and
      // messageCount are two counters on the same row.
      prisma.chatMembership.findMany({ where: { userId }, select: { roomId: true } })
        .then((r) => note("ChatRoom", r.map((x) => x.roomId))),
      prisma.chatMessage.findMany({ where: { authorId: userId }, select: { roomId: true } })
        .then((r) => note("ChatRoom", r.map((x) => x.roomId))),
    ].map((q) => q.catch(() => undefined)),
  );

  // 7. Everything else they own outright, and every trace of who they
  //    followed, blocked, saved or supported.
  await Promise.all([
    prisma.userFollow.deleteMany({ where: { OR: [{ followerId: userId }, { followingId: userId }] } }),
    prisma.userBlock.deleteMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } }),
    prisma.userNotification.deleteMany({ where: { userId } }),
    prisma.placeSave.deleteMany({ where: { userId } }),
    prisma.placeFilterSet.deleteMany({ where: { userId } }),
    prisma.articleLike.deleteMany({ where: { userId } }),
    prisma.articleSave.deleteMany({ where: { userId } }),
    prisma.campaignSupport.deleteMany({ where: { userId } }),
    prisma.eventRsvp.deleteMany({ where: { userId } }),
    prisma.clipLike.deleteMany({ where: { userId } }),
    prisma.clipSave.deleteMany({ where: { userId } }),
    prisma.themeFollow.deleteMany({ where: { userId } }),
    prisma.gratitudeHeart.deleteMany({ where: { userId } }),
    prisma.chatMessageReaction.deleteMany({ where: { userId } }),
  ].map((p) => p.catch(() => undefined)));

  // 8. Detach, don't delete — see the header.
  await Promise.all([
    prisma.place.updateMany({ where: { submittedByUserId: userId }, data: { submittedByUserId: null } }),
    prisma.event.updateMany({ where: { hostUserId: userId }, data: { hostUserId: null } }),
    prisma.placeReport.updateMany({ where: { reporterId: userId }, data: { reporterId: null } }),
    prisma.postReport.updateMany({ where: { reporterId: userId }, data: { reporterId: null } }),
    prisma.chatMessageReport.updateMany({ where: { reporterId: userId }, data: { reporterId: null } }),
  ].map((p) => p.catch(() => undefined)));

  // 9. Their avatar, cover, and anything else they uploaded that the
  //    steps above didn't already claim.
  const profile = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true, coverUrl: true },
  });
  await deleteMediaByUrls([profile?.avatarUrl, profile?.coverUrl], {
    ownerId: userId,
  }).catch(() => {});

  // 10. The row itself. Tokens, activity, likes, saves and reflections
  //     go with it by cascade.
  await prisma.user.delete({ where: { id: userId } });

  // 11. Every child row is gone now, cascades included. Put the
  //     counters back. Best-effort on purpose: the account IS deleted
  //     by this point, and a failure here must not turn a completed
  //     deletion into an error the person is told to retry.
  await recountCounters({ scopeIds: counterScope }).catch(() => undefined);

  return {
    posts: posts.length,
    comments: comments.count,
    gratitude: gratitude.count,
    messages: messages.count,
    chatMessages: chatMessages.count,
  };
}

/** Re-exported so callers don't reach past this module for it. */
export { postImageUrls };
