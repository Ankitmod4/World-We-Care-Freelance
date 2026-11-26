/**
 * POST — fill in what Google can, for one language.
 *
 * Never touches a human translation or a reviewed one; the lib
 * enforces that rather than the caller, so a future second caller
 * cannot get it wrong.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { machineTranslateMissing } from "@/lib/translations-admin";

export const dynamic = "force-dynamic";
// 623 strings is seven batched requests to Google; the default
// serverless timeout is not always enough.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const body = (await request.json().catch(() => ({}))) as {
    locale?: string;
    includeStale?: boolean;
    limit?: number;
  };
  if (!body.locale) return NextResponse.json({ error: "Which language?" }, { status: 400 });

  try {
    return NextResponse.json({
      ok: true,
      ...(await machineTranslateMissing(body.locale, {
        includeStale: body.includeStale !== false,
        limit: body.limit,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Translation failed." },
      { status: 400 },
    );
  }
}
