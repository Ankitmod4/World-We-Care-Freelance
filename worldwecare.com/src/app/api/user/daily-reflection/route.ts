import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, requireUser } from "@/lib/user-auth";
import { getTodayReflection, saveReflection } from "@/lib/daily-reflection";

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json(await getTodayReflection(user?.id));
}

export async function POST(request: NextRequest) {
  const user = await requireUser(request);
  if (user instanceof NextResponse) return user;
  const body = await request.json().catch(() => ({}));
  try {
    const reflection = await saveReflection(user.id, String(body.questionId ?? ""), String(body.body ?? ""));
    return NextResponse.json({ reflection });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not save reflection." }, { status: 400 });
  }
}
