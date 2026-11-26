/** PATCH — country and the anonymous-by-default toggle. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { setAnonymousDefault, setCountry } from "@/lib/account";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as {
    countryId?: unknown;
    anonymousByDefault?: unknown;
  };

  try {
    if (body.countryId !== undefined) {
      const id =
        typeof body.countryId === "string" && body.countryId.trim()
          ? body.countryId.trim()
          : null;
      await setCountry(auth.id, id);
    }
    if (typeof body.anonymousByDefault === "boolean") {
      await setAnonymousDefault(auth.id, body.anonymousByDefault);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't save that" },
      { status: 400 },
    );
  }
}
