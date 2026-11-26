import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/user-auth";
import { getPost } from "@/lib/posts-feed";
import { PostDetail } from "@/components/site/post-detail";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.post.id.title", "Post"),
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await getCurrentUser();
  if (!viewer) redirect(`/login?next=/post/${id}`);
  const post = await getPost(viewer.id, id);
  if (!post) notFound();
  return <PostDetail viewer={viewer} post={post} />;
}
