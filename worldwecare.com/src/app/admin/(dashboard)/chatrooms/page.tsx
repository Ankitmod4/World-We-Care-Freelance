import type { Metadata } from "next";
import { AdminChatRoomsClient } from "./client";

export const metadata: Metadata = { title: "Chatrooms" };

export default function AdminChatroomsPage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <AdminChatRoomsClient />
    </div>
  );
}
