/**
 * PATCH /api/user/settings/digest — the daily email, and progress
 * visibility.
 *
 * Turning the digest ON captures the browser's timezone in the same
 * request, because "whatever time of day the user picks" is meaningless
 * without one and asking a person to find their IANA zone in a dropdown
 * is a good way to lose them at the last step.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/user-auth";
import { prisma } from "@/lib/db";

/** Trust it only if the runtime recognises it. */
function cleanTimezone(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim() || raw.length > 64) return null;
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: raw });
    return raw;
  } catch {
    return null;
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;

  const data: {
    digestEnabled?: boolean;
    digestHour?: number;
    timezone?: string | null;
  } = {};

  if (typeof b.digestEnabled === "boolean") data.digestEnabled = b.digestEnabled;
  if (typeof b.digestHour === "number" && Number.isInteger(b.digestHour)) {
    data.digestHour = Math.min(23, Math.max(0, b.digestHour));
  }
  const tz = cleanTimezone(b.timezone);
  if (tz) data.timezone = tz;

  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: auth.id },
    data,
    select: {
      digestEnabled: true,
      digestHour: true,
      timezone: true,
    },
  });
  return NextResponse.json({ settings: user });
}
