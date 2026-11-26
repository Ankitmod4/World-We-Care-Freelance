/** GET — everything the settings page needs, in one round trip. */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/user-auth";
import { listBlocked } from "@/lib/blocks";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) return auth;

  const [user, blocked] = await Promise.all([
    prisma.user.findUnique({
      where: { id: auth.id },
      // Note what is absent: passwordHash. There is no reason for it to
      // leave the database, and a select that names every column is how
      // it eventually does.
      select: {
        email: true,
        pendingEmail: true,
        displayName: true,
        countryId: true,
        anonymousByDefault: true,
        emailVerifiedAt: true,
        createdAt: true,
      },
    }),
    listBlocked(auth.id),
  ]);

  if (!user) return NextResponse.json({ error: "Account not found" }, { status: 404 });
  return NextResponse.json({ settings: user, blocked });
}
