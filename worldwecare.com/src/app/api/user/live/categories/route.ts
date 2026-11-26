/** GET — active live-stream categories, with what's on in each. */
import { NextResponse } from "next/server";
import { listPublicCategories } from "@/lib/live-categories";

export const dynamic = "force-dynamic";

export async function GET() {
  // Public, like the live list itself: the filter chips have to render
  // for a signed-out visitor or the taxonomy is invisible to exactly
  // the person still deciding whether to join.
  try {
    return NextResponse.json({ categories: await listPublicCategories() });
  } catch {
    // An empty list degrades the picker to "no categories yet" rather
    // than breaking the page someone is trying to broadcast from.
    return NextResponse.json({ categories: [] });
  }
}
