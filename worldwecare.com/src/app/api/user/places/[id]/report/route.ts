/** POST — a member tells us this listing is wrong. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { isReportKind, reportPlace } from "@/lib/place-reports";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const body = (await request.json().catch(() => ({}))) as { kind?: unknown; notes?: unknown };
  if (!isReportKind(body.kind)) {
    return NextResponse.json({ error: "Pick what's wrong" }, { status: 400 });
  }

  try {
    return NextResponse.json(
      await reportPlace({
        placeId: id,
        kind: body.kind,
        notes: typeof body.notes === "string" ? body.notes : null,
        user: { id: auth.id, displayName: auth.displayName },
      }),
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not send that" },
      { status: 400 },
    );
  }
}
