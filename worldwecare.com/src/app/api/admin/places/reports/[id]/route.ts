/** POST — resolve or dismiss one place report. */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { resolvePlaceReport } from "@/lib/place-reports";

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
    resolution?: unknown;
  };
  const action =
    body.action === "resolve" ? "resolve" : body.action === "dismiss" ? "dismiss" : null;
  if (!action) return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  try {
    return NextResponse.json(
      await resolvePlaceReport(
        id,
        auth.id,
        action,
        typeof body.resolution === "string" ? body.resolution : undefined,
      ),
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not update" },
      { status: 400 },
    );
  }
}
