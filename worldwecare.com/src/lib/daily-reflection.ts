import { prisma } from "./db";

function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function getTodayReflection(userId?: string | null) {
  const date = todayUtc();
  const [quote, question] = await Promise.all([
    prisma.dailyQuote.findFirst({ where: { displayDate: date, isActive: true }, select: { id: true, body: true, attribution: true } }),
    prisma.dailyQuestion.findFirst({
      where: { displayDate: date, isActive: true },
      select: { id: true, body: true, reflections: userId ? { where: { userId }, select: { body: true, updatedAt: true } } : false },
    }),
  ]);
  return {
    quote,
    question: question && {
      id: question.id,
      body: question.body,
      reflection: userId ? question.reflections[0] ?? null : null,
    },
  };
}

export async function saveReflection(userId: string, questionId: string, body: string) {
  const clean = body.trim();
  if (!clean || clean.length > 2_000) throw new Error("Reflection must be between 1 and 2,000 characters.");
  const question = await prisma.dailyQuestion.findFirst({ where: { id: questionId, displayDate: todayUtc(), isActive: true }, select: { id: true } });
  if (!question) throw new Error("That question is no longer available.");
  return prisma.dailyReflection.upsert({
    where: { userId_questionId: { userId, questionId } },
    create: { userId, questionId, body: clean },
    update: { body: clean },
    select: { body: true, updatedAt: true },
  });
}
