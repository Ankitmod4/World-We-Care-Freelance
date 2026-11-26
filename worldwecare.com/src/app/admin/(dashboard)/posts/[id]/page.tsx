import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPost } from "@/lib/posts-admin";
import { PostDetailClient } from "./client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) return { title: "Post" };
  const preview = post.body.replace(/\s+/g, " ").trim().slice(0, 40);
  return { title: preview || "Post" };
}

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const post = await getPost(id);
  if (!post) notFound();
  return <PostDetailClient postId={id} />;
}
