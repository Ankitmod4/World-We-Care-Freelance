import { redirect } from "next/navigation";

/**
 * /places/category/[slug] — kept, and redirecting.
 *
 * The categories are a tab strip on /places now, and a tab is a view of
 * that page rather than a page of its own. This route stays because
 * links to it exist — in notifications, in other people's messages,
 * in whatever someone bookmarked — and a 404 is a worse answer than
 * the thing they asked for.
 *
 * A permanent redirect, because the move is permanent. The slug goes
 * through untouched, including one that no longer matches a category:
 * the index simply shows everything, which is the right answer to a
 * stale link and better than an error page about a category that has
 * been retired.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/places?category=${encodeURIComponent(slug)}`);
}
