import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getUserAdmin } from "@/lib/users-admin";
import { UserDetailClient } from "./client";

// Dynamic title — includes the user's display name so browser tabs
// stay useful when the admin has several open.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const user = await getUserAdmin(id);
  return { title: user ? user.displayName : "User" };
}

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getUserAdmin(id);
  if (!user) notFound();

  // Fetch template slugs so the "Send email" panel can list them.
  const templates = await prisma.emailTemplate.findMany({
    where: { enabled: true },
    orderBy: { name: "asc" },
    select: { slug: true, name: true },
  });

  return <UserDetailClient initialUser={user} templates={templates} />;
}
