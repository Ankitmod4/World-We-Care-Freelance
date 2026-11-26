/**
 * GET — is member-content translation actually working?
 *
 * Everything in `content-translate.ts` fails softly, because a reader
 * should never see a broken page over a translation. The cost is that
 * a missing table, a rejected key and a perfectly healthy system all
 * look the same from outside: original text, no complaint. This is
 * the one place that says which.
 *
 * `?probe=ru` spends a few characters at Google to prove the key
 * works, rather than only that one is set.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { contentTranslationHealth } from "@/lib/content-translate";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;
  const probe = request.nextUrl.searchParams.get("probe");
  return NextResponse.json(await contentTranslationHealth(probe));
}
