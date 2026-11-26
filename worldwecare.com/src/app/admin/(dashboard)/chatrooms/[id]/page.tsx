import type { Metadata } from "next";
import { AdminChatRoomDetailClient } from "./client";

export const metadata: Metadata = { title: "Manage room" };

export default async function AdminChatRoomDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <AdminChatRoomDetailClient roomId={id} />
    </div>
  );
}
