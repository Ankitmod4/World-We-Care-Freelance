/**
 * GET  /api/admin/admins — paginated list (search, role, status)
 * POST /api/admin/admins — create (invite) a new admin
 */

import { AdminRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireOwner } from "@/lib/admin-auth";
import {
  createAdmin,
  listAdmins,
  suggestPassword,
  type RoleFilter,
  type StatusFilter,
} from "@/lib/admins-admin";

const ROLES = new Set<string>(Object.values(AdminRole));

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const statusRaw = searchParams.get("status") ?? "all";
  const status: StatusFilter =
    statusRaw === "active" || statusRaw === "inactive" ? statusRaw : "all";
  const roleRaw = searchParams.get("role") ?? "all";
  const role: RoleFilter =
    roleRaw !== "all" && ROLES.has(roleRaw)
      ? (roleRaw as AdminRole)
      : "all";
  const page = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const perPage = Number.parseInt(searchParams.get("perPage") ?? "25", 10);

  const result = await listAdmins({ q, status, role, page, perPage });
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const denied = requireOwner(auth);
  if (denied) return denied;

  const body = (await request.json().catch(() => ({}))) as {
    email?: string;
    displayName?: string;
    password?: string;
    role?: string;
  };

  const email = (body.email ?? "").trim().toLowerCase();
  const displayName = (body.displayName ?? "").trim();
  const password = body.password && body.password.trim() ? body.password : "";
  const role = body.role && ROLES.has(body.role) ? (body.role as AdminRole) : "ADMIN";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required." }, { status: 400 });
  }
  if (displayName.length < 2 || displayName.length > 60) {
    return NextResponse.json({ error: "Display name must be 2–60 characters." }, { status: 400 });
  }
  const finalPassword = password || suggestPassword();
  if (finalPassword.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  try {
    const admin = await createAdmin(auth.id, {
      email,
      displayName,
      password: finalPassword,
      role,
    });
    // Return the plaintext password EXACTLY once so the inviting
    // admin can share it out of band. Never stored, never re-shown.
    return NextResponse.json(
      { item: admin, initialPassword: finalPassword },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Create failed" },
      { status: 400 },
    );
  }
}
