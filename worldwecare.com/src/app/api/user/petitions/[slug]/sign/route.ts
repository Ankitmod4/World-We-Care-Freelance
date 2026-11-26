/**
 * POST /api/user/petitions/[slug]/sign — sign, or withdraw.
 *
 * One endpoint, toggling, because a signature is one row keyed on
 * (petition, user) — there is no second one to add. Withdrawing is
 * allowed even after the petition closes: a signature is consent, and
 * consent has to be revocable after the fact.
 */
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/user-auth";
import { toggleSignature } from "@/lib/petitions";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const viewer = await getCurrentUser();
  // A count anyone can add to without an account is a number nobody
  // can defend, which discredits the cause rather than helping it.
  if (!viewer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    comment?: unknown;
    anonymous?: unknown;
  };

  const result = await toggleSignature({
    slug,
    user: { id: viewer.id, displayName: viewer.displayName, avatarUrl: viewer.avatarUrl },
    comment: typeof body.comment === "string" ? body.comment : null,
    anonymous: body.anonymous === true,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error:
          result.error === "CLOSED"
            ? "This petition has closed."
            : "Not found",
      },
      { status: result.error === "CLOSED" ? 409 : 404 },
    );
  }

  return NextResponse.json(result);
}
