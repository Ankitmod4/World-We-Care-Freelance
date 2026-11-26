/**
 * Petition moderation.
 *
 * Split from lib/petitions.ts on the same line as events: the reader
 * lib is imported by public pages, this one only by /admin routes, and
 * keeping approve/reject out of the bundle that renders a signed-out
 * page is worth one extra file.
 */

import { prisma } from "./db";
import { createUserNotification } from "./notifications";
import { attachedAssetId, attachedImageUrls } from "./attached-media";
import { deleteMediaByUrls, extractLocalImageUrls } from "./media";
import { discardVideo } from "./video-status";
import type { PetitionStatus } from "@prisma/client";

function clean(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t ? t.slice(0, 2000) : null;
}

export async function listAdminPetitions(
  filters: { status?: PetitionStatus | "ALL"; q?: string } = {},
) {
  const status = filters.status && filters.status !== "ALL" ? filters.status : undefined;
  const q = filters.q?.trim();

  return prisma.petition.findMany({
    where: {
      ...(status ? { status } : {}),
      // No `mode: "insensitive"` — that is a PostgreSQL feature and
      // this database is MySQL, where Prisma rejects it outright.
      // It is also unnecessary: MySQL's default collation makes
      // `contains` case-insensitive already. Same as lib/events.ts.
      ...(q
        ? {
            OR: [
              { title: { contains: q } },
              { target: { contains: q } },
              { creatorNameSnapshot: { contains: q } },
            ],
          }
        : {}),
    },
    // Pending first regardless of age — the queue is the job, and a
    // busy week must not bury a submission under approved ones.
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      slug: true,
      title: true,
      target: true,
      status: true,
      signatureCount: true,
      goal: true,
      creatorUserId: true,
      creatorNameSnapshot: true,
      createdAt: true,
      reviewedAt: true,
    },
  });
}

export async function getAdminPetition(id: string) {
  return prisma.petition.findUnique({ where: { id } });
}

export async function reviewPetition(
  id: string,
  adminId: string,
  action: "approve" | "reject",
  reason?: string,
) {
  const petition = await prisma.petition.findUnique({
    where: { id },
    select: { id: true, slug: true, title: true, creatorUserId: true },
  });
  if (!petition) throw new Error("Petition not found");

  const status: PetitionStatus = action === "approve" ? "APPROVED" : "REJECTED";
  const cleanReason = action === "reject" ? clean(reason) : null;

  await prisma.petition.update({
    where: { id },
    data: { status, rejectionReason: cleanReason, reviewedAt: new Date(), reviewedBy: adminId },
  });

  if (petition.creatorUserId) {
    await createUserNotification({
      userId: petition.creatorUserId,
      type: action === "approve" ? "PETITION_APPROVED" : "PETITION_REJECTED",
      title:
        action === "approve" ? "Your petition is live" : "Your petition wasn't approved",
      body:
        action === "approve"
          ? `“${petition.title}” is now open for signatures.`
          : cleanReason
            ? `Reason: ${cleanReason}`
            : "It didn't meet our community guidelines.",
      actionUrl: action === "approve" ? `/petitions/${petition.slug}` : "/petitions",
    });
  }

  return { status };
}

/** Close an approved petition without deleting it. */
export async function closePetitionAsAdmin(id: string) {
  await prisma.petition.update({ where: { id }, data: { status: "CLOSED" } });
}

/**
 * Delete a petition and its signatures.
 *
 * Reserved for content that should not exist at all. Closing is the
 * normal end of a petition — deleting destroys the record of who
 * signed what, which people were entitled to have counted.
 */
export async function deletePetition(id: string) {
  const petition = await prisma.petition.findUnique({
    where: { id },
    select: { coverUrl: true, photos: true, video: true, body: true },
  });

  // Signatures cascade.
  await prisma.petition.delete({ where: { id } });

  // The cover, the gallery and anything embedded in the markdown are
  // ours to free. `allowAnyOwner` because a member submitted it and an
  // admin is the one deleting it — the same reason deleteEvent does.
  await deleteMediaByUrls(
    [
      petition?.coverUrl,
      ...attachedImageUrls(petition?.photos),
      ...extractLocalImageUrls(petition?.body),
    ],
    { allowAnyOwner: true },
  ).catch(() => {});

  // `discardVideo` re-checks ownership itself, so a hand-edited video
  // blob naming somebody else's asset frees nothing.
  const assetId = attachedAssetId(petition?.video);
  if (assetId) {
    await discardVideo(assetId, { id: "", isAdmin: true }).catch(() => {});
  }
}
