/**
 * GET  /api/admin/users — paginated list with search, status filter,
 *                        sort.
 * POST /api/admin/users — admin-create a new user.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { createUserAdmin, listUsersAdmin } from "@/lib/users-admin";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const statusRaw = searchParams.get("status") ?? "all";
  const status =
    statusRaw === "active" ||
    statusRaw === "inactive" ||
    statusRaw === "banned" ||
    statusRaw === "unverified"
      ? statusRaw
      : "all";
  const sortRaw = searchParams.get("sort") ?? "created_desc";
  const sort =
    sortRaw === "created_asc" ||
    sortRaw === "created_desc" ||
    sortRaw === "last_login" ||
    sortRaw === "name"
      ? sortRaw
      : "created_desc";
  const page = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const perPage = Number.parseInt(searchParams.get("perPage") ?? "25", 10);

  const result = await listUsersAdmin({ q, status, sort, page, perPage });
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    displayName?: string;
    password?: string;
    emailVerified?: boolean;
  };
  const email = (body.email ?? "").trim().toLowerCase();
  const displayName = (body.displayName ?? "").trim();
  const password = body.password ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required." }, { status: 400 });
  }
  if (displayName.length < 2 || displayName.length > 40) {
    return NextResponse.json({ error: "Display name must be 2–40 characters." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  try {
    const user = await createUserAdmin(auth.id, {
      email,
      displayName,
      password,
      emailVerified: body.emailVerified === true,
    });
    return NextResponse.json({ item: user }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Create failed" },
      { status: 400 },
    );
  }
}
