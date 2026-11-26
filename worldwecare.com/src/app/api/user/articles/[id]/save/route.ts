/** POST /api/user/articles/[id]/save — toggle bookmark. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { toggleArticleSave } from "@/lib/articles";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    return NextResponse.json({ ok: true, ...(await toggleArticleSave(id, auth.id)) });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Save failed" },
      { status: 400 },
    );
  }
}
