/**
 * POST — read the code and update the catalogue.
 *
 * The same work as `npm run i18n:extract`, behind a button, because
 * the person who keeps translations current is not the person with a
 * shell on the server.
 *
 * DRY UNLESS ASKED. `{ apply: true }` writes; anything else reports
 * what would happen and changes nothing. The page runs a dry pass
 * first and shows the numbers, so nobody presses a button whose
 * effect they cannot see — writing changed English un-reviews its
 * translations, which is real work being undone.
 *
 * `{ prune: true }` is separate again and deletes: a key that has
 * left the code takes its translations with it, including ones a
 * person typed.
 *
 * NOT `force-dynamic` BY ACCIDENT — it reads the filesystem and the
 * database and must never be cached.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { extractStrings } from "@/lib/i18n-extract";
import { clearI18nCache } from "@/lib/i18n";

export const dynamic = "force-dynamic";
// Around 700 files to read and a row per string to upsert. Well
// inside this on any real machine; the default is not always.
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as {
    apply?: unknown;
    prune?: unknown;
  };
  const apply = body.apply === true;
  const prune = body.prune === true;

  /*
     PRUNING IS NOT A MODERATOR'S CALL.

     Reading the code and adding rows is harmless and anybody keeping
     translations current should be able to do it. Deleting a string
     takes its translations with it, including ones a person sat and
     typed — the same reason a moderator cannot delete a library
     theme. The line is drawn at destruction, not at the button.
  */
  if (prune && auth.role === "MODERATOR") {
    return NextResponse.json(
      { error: "Moderators can't remove strings — it deletes their translations too." },
      { status: 403 },
    );
  }

  try {
    const report = await extractStrings({ apply, prune });
    // The reader-facing catalogue is cached for a minute; after a
    // write, a minute is long enough for somebody to press the button,
    // reload the site and conclude it did nothing.
    if (apply && report.wrote) clearI18nCache();
    return NextResponse.json({ ok: true, ...report });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not read the code." },
      { status: 500 },
    );
  }
}
