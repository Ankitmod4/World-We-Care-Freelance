import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user-auth";
import { getRoomForUser } from "@/lib/chat-user";
import { ChatRoomView } from "@/components/site/chat-room";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const viewer = await getCurrentUser();
  if (!viewer) return { title: "Chatroom" };
  const room = await getRoomForUser({ viewerId: viewer.id, slug });
  return { title: room ? room.name : "Chatroom" };
}

export default async function ChatRoomPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const viewer = await getCurrentUser();
  if (!viewer) redirect(`/login?next=/chatrooms/${slug}`);
  const room = await getRoomForUser({ viewerId: viewer.id, slug });
  if (!room) notFound();
  return <ChatRoomView viewer={viewer} initialRoom={room} />;
}
