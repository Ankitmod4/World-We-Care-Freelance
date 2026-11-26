import type { Metadata } from "next";
import { PostsClient } from "./client";

export const metadata: Metadata = { title: "Community wall" };

export default function PostsPage() {
  return <PostsClient />;
}
