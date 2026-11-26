/** POST — ask to change the email. DELETE — call it off. */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { cancelEmailChange, requestEmailChange } from "@/lib/account";
import { appBaseUrl } from "@/lib/app-url";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json().catch(() => ({}))) as {
    email?: unknown;
    currentPassword?: unknown;
  };

  try {
    const result = await requestEmailChange({
      userId: auth.id,
      newEmail: typeof body.email === "string" ? body.email : "",
      currentPassword:
        typeof body.currentPassword === "string" ? body.currentPassword : "",
      appUrl: appBaseUrl(request),
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't do that" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  await cancelEmailChange(auth.id);
  return NextResponse.json({ ok: true });
}
