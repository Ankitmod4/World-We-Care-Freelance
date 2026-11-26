/**
 * "This place is wrong" — the directory's own report queue.
 *
 * Deliberately not PostReport. That queue exists to moderate people;
 * this one exists because a food bank changed its opening hours and
 * somebody who walked to a locked door is telling us so. Different
 * reasons, different resolution, different columns.
 *
 * Three rules worth keeping:
 *
 *  1. One open report per member per place. Without it, the queue fills
 *     with the same person clicking the button twice, and the count on
 *     the admin page stops meaning anything. A second report from the
 *     same member updates the first.
 *  2. The reporter is a loose FK plus a name snapshot, same as places
 *     and events — deleting the member must not delete the evidence.
 *  3. Everything a member typed is clamped here, not at the edge, so
 *     there is exactly one place to check.
 */

import { prisma } from "./db";
import { createForAllAdmins } from "./admin-notifications";
import { reportKindLabel, type PlaceReportKindValue } from "./place-report-kinds";

// Re-exported so server callers have one import, while the modal takes
// them from the constants-only module and never pulls Prisma into the
// browser bundle.
export {
  PLACE_REPORT_KINDS,
  isReportKind,
  reportKindLabel,
  type PlaceReportKindValue,
} from "./place-report-kinds";

/* ── member side ─────────────────────────────────────────────── */

export async function reportPlace(input: {
  placeId: string;
  kind: PlaceReportKindValue;
  notes?: string | null;
  user: { id: string; displayName: string };
}) {
  const place = await prisma.place.findFirst({
    // A member can only report something they can actually see.
    where: { id: input.placeId, status: "APPROVED" },
    select: { id: true, name: true, slug: true },
  });
  if (!place) throw new Error("Place not found");

  const notes = input.notes?.trim().slice(0, 2000) || null;

  const existing = await prisma.placeReport.findFirst({
    where: { placeId: place.id, reporterId: input.user.id, status: "OPEN" },
    select: { id: true },
  });

  if (existing) {
    await prisma.placeReport.update({
      where: { id: existing.id },
      data: { kind: input.kind, notes, createdAt: new Date() },
    });
    // Deliberately no second notification: the admins already have one
    // open row for this member and this place.
    return { ok: true, updated: true };
  }

  await prisma.placeReport.create({
    data: {
      placeId: place.id,
      kind: input.kind,
      notes,
      reporterId: input.user.id,
      reporterSnapshot: input.user.displayName.slice(0, 120),
    },
  });

  await createForAllAdmins({
    type: "PLACE_REPORTED",
    title: "A place was reported",
    message: `${input.user.displayName} flagged “${place.name}” — ${reportKindLabel(input.kind)}.`,
    actionUrl: "/admin/places?reports=1",
  }).catch(() => {});

  return { ok: true, updated: false };
}

/* ── admin side ──────────────────────────────────────────────── */

export async function listPlaceReports(
  filters: { status?: "OPEN" | "RESOLVED" | "DISMISSED" | "ALL"; take?: number } = {},
) {
  const status = filters.status ?? "OPEN";
  const rows = await prisma.placeReport.findMany({
    where: status === "ALL" ? {} : { status },
    orderBy: { createdAt: "desc" },
    take: Math.min(200, Math.max(1, filters.take ?? 50)),
    select: {
      id: true,
      kind: true,
      notes: true,
      status: true,
      reporterSnapshot: true,
      createdAt: true,
      resolvedAt: true,
      resolution: true,
      place: { select: { id: true, slug: true, name: true, city: true, status: true } },
    },
  });
  const open = await prisma.placeReport.count({ where: { status: "OPEN" } });
  return { reports: rows, open };
}

export async function resolvePlaceReport(
  id: string,
  adminId: string,
  action: "resolve" | "dismiss",
  resolution?: string,
) {
  const report = await prisma.placeReport.findUnique({ where: { id }, select: { id: true } });
  if (!report) throw new Error("Report not found");

  await prisma.placeReport.update({
    where: { id },
    data: {
      status: action === "resolve" ? "RESOLVED" : "DISMISSED",
      resolution: resolution?.trim().slice(0, 2000) || null,
      resolvedByAdminId: adminId,
      resolvedAt: new Date(),
    },
  });
  return { status: action === "resolve" ? "RESOLVED" : "DISMISSED" };
}
