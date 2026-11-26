/**
 * POST — attach, detach or reorder a campaign's parts.
 *
 * One endpoint rather than six: every operation is "change what this
 * campaign points at", and splitting that across routes would mean the
 * same ownership check written six times.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  attachArticle,
  attachEvent,
  detachArticle,
  detachEvent,
  reorderAttachments,
} from "@/lib/campaigns-admin";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const body = (await request.json().catch(() => ({}))) as {
    action?: unknown;
    kind?: unknown;
    targetId?: unknown;
    ids?: unknown;
  };
  const action = String(body.action ?? "");
  const kind = body.kind === "events" ? "events" : "articles";
  const targetId = typeof body.targetId === "string" ? body.targetId : "";

  try {
    if (action === "attach") {
      if (!targetId) throw new Error("Nothing to attach");
      if (kind === "articles") await attachArticle(id, targetId);
      else await attachEvent(id, targetId);
    } else if (action === "detach") {
      if (!targetId) throw new Error("Nothing to detach");
      if (kind === "articles") await detachArticle(id, targetId);
      else await detachEvent(id, targetId);
    } else if (action === "reorder") {
      const ids = Array.isArray(body.ids)
        ? body.ids.filter((x): x is string => typeof x === "string")
        : [];
      if (ids.length === 0) throw new Error("Nothing to reorder");
      await reorderAttachments(id, kind, ids);
    } else {
      throw new Error("Unknown action");
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 400 },
    );
  }
}
