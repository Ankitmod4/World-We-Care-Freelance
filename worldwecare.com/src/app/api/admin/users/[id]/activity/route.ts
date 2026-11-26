/**
 * GET /api/admin/users/[id]/activity?page=&perPage=&kind=user|admin
 *
 * Two feeds — user's own activity (login, signup, password changes)
 * or the admin-side action log for this user. Split by `kind` so
 * the client can render two clean tabs.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import {
  getAdminActionsForUser,
  getUserActivityAdmin,
} from "@/lib/users-admin";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const { searchParams } = new URL(request.url);
  const page = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const perPage = Number.parseInt(searchParams.get("perPage") ?? "25", 10);
  const kind = searchParams.get("kind") === "admin" ? "admin" : "user";

  const result =
    kind === "admin"
      ? await getAdminActionsForUser(id, page, perPage)
      : await getUserActivityAdmin(id, page, perPage);

  return NextResponse.json(result);
}
