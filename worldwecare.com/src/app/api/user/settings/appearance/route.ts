/**
 * PATCH — the member's colour theme, tone, and light/dark mode.
 *
 * Separate from /preferences because the two controls that call it
 * live outside the settings page: the mode toggle is in the header
 * menu and the mobile drawer, and asking those to POST to an endpoint
 * named "preferences" alongside country and anonymity would make the
 * next person reading the network tab wonder what else they changed.
 *
 * Send either key on its own. Omitting one leaves it untouched.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { setAppearance } from "@/lib/account";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as {
    colorThemeId?: unknown;
    appearanceMode?: unknown;
    brandTone?: unknown;
  };

  try {
    await setAppearance(auth.id, {
      colorThemeId:
        body.colorThemeId === undefined
          ? undefined
          : typeof body.colorThemeId === "string"
            ? body.colorThemeId
            : null,
      appearanceMode:
        body.appearanceMode === undefined
          ? undefined
          : typeof body.appearanceMode === "string"
            ? body.appearanceMode
            : null,
      brandTone:
        body.brandTone === undefined ? undefined : Number(body.brandTone),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't save that" },
      { status: 400 },
    );
  }
}
