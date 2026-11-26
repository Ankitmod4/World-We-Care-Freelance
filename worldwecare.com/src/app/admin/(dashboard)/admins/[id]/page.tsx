import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { getAdmin } from "@/lib/admins-admin";
import { AdminDetailClient } from "./client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const admin = await getAdmin(id);
  return { title: admin ? admin.displayName : "Admin" };
}

export default async function AdminDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [admin, viewer] = await Promise.all([getAdmin(id), getCurrentAdmin()]);
  if (!admin || !viewer) notFound();

  return <AdminDetailClient initial={admin} viewerId={viewer.id} />;
}
