"use client";

/**
 * /gratitude/[id] — one entry, in full, with its thread.
 *
 * THE FULL TEXT LIVES HERE. The wall clamps to a fixed-height tile so
 * it reads as a wall; this is where the clamp is undone. Nothing is
 * truncated on this page.
 *
 * THE THREAD MOVED HERE TOO. It used to expand inside the wall's card,
 * which stopped being possible the moment tiles had a fixed height —
 * and was never great anyway, since a reply box inside a 266px column
 * is not somewhere anybody wants to write.
 */

import { useState } from "react";
import Link from "next/link";
import { SiteShell, type ShellViewer } from "./site-shell";
import { SupportCard } from "./support-card";
import { useCountry } from "./country-context";
import { ReactionButton } from "./reaction-button";
import { ThreadedComments } from "./threaded-comments";
import { EntryImage } from "./photo-attach";
import { VideoPlayer } from "@/components/ui/video-player";
import { RichText } from "@/lib/rich-text";
import { timeAgo } from "@/lib/time-ago";
import { Img } from "@/components/ui/img";
import type { ReactionType } from "@/lib/reactions";
import type { GratitudeItem } from "@/lib/gratitude";
import { useT } from "./locale-context";
import { TranslatedRichText } from "./translated-markdown";

export function GratitudeDetailClient({
  viewer,
  item,
}: {
  viewer: ShellViewer;
  item: GratitudeItem;
}) {
  const t = useT();
  const { country } = useCountry();
  const [myReaction, setMyReaction] = useState<ReactionType | null>(item.myReaction);
  const [count, setCount] = useState(item.heartCount);
  const [comments, setComments] = useState(item.commentCount);

  const react = async (type: ReactionType) => {
    const hadType = myReaction;
    const hadCount = count;
    const removing = hadType === type;
    setMyReaction(removing ? null : type);
    setCount(removing ? Math.max(0, count - 1) : hadType ? count : count + 1);
    const res = await fetch(`/api/user/gratitude/${item.id}/heart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    }).catch(() => null);
    if (!res?.ok) {
      setMyReaction(hadType);
      setCount(hadCount);
      return;
    }
    const d = (await res.json()) as { heartCount: number; myReaction: ReactionType | null };
    setCount(d.heartCount);
    setMyReaction(d.myReaction);
  };

  return (
    <SiteShell viewer={viewer}>
      <nav className="mb-3 text-[13px]">
        <Link href="/gratitude" className="text-[color:var(--color-brand)] hover:underline">
          ← Gratitude wall
        </Link>
      </nav>

      <article className="rounded-[16px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-2.5">
          {item.authorAvatar ? (
            <Img src={item.authorAvatar} alt="" variant="thumb" className="h-10 w-10 rounded-full object-cover" />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--color-brand-soft)] text-[13px] font-semibold text-[color:var(--color-brand-ink)]">
              {item.isAnonymous ? "··" : item.authorName.slice(0, 2).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold">{item.authorName}</p>
            <p className="text-[12px] text-[color:var(--color-text-subtle)]">{timeAgo(t, item.createdAt)}</p>
          </div>
          {item.category && (
            <Link
              href={`/gratitude/category/${item.category.slug}`}
              className="ml-auto shrink-0 rounded-full bg-[color:var(--color-brand-tint)] px-2.5 py-1 text-[11.5px] font-medium text-[color:var(--color-brand-ink)] hover:underline"
            >
              {item.category.emoji ? `${item.category.emoji} ` : ""}
              {item.category.name}
            </Link>
          )}
        </div>

        <TranslatedRichText
          kind="gratitude"
          id={item.id}
          text={item.body}
          className="mt-3 text-[15px] leading-relaxed"
        />
        {item.imageUrl && <EntryImage src={item.imageUrl} whole />}
        {/*
          THE REAL PLAYER LIVES HERE, not on the wall card.

          The card is wrapped in a <Link> to this page, and controls
          inside a link are unusable — every press of play or the
          scrubber navigates instead. So the wall shows the poster with
          a play badge and this is where it actually plays.

          `maxHeight` because a 16:9 frame in a full-width column is
          enormous on a laptop: the entry's text would be pushed off
          the screen by the video under it.
        */}
        {item.video && (
          <div className="mt-3">
            <VideoPlayer
              src={item.video.url}
              poster={item.video.posterUrl}
              width={item.video.width}
              height={item.video.height}
              maxHeight="70vh"
            />
          </div>
        )}

        <div className="mt-3 flex items-center gap-1 border-t border-[color:var(--color-border-soft)] pt-3">
          <ReactionButton mine={myReaction} count={count} onPick={react} />
          <span className="text-[12.5px] text-[color:var(--color-text-subtle)]">
            {comments === 0
              ? t("entry.noReplies", "No replies yet")
              : comments === 1
                ? t("entry.oneReply", "1 reply")
                : t("entry.nReplies", "{n} replies", { n: comments })}
          </span>
        </div>
      </article>

      <div className="mt-4 rounded-[16px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
        <ThreadedComments
          contentKind="gratitudeComment"
          resetKey={item.id}
          listUrl={`/api/user/gratitude/${item.id}/comments`}
          commentUrlFor={(id) => `/api/user/gratitude/comments/${id}`}
          viewer={viewer}
          signInHref={`/login?next=/gratitude/${item.id}`}
          onCountChange={setComments}
        />
      </div>

      {/*
        BELOW xl, OR WHENEVER THE RAIL IS COLLAPSED.

        The crisis card lives in the right rail. The rail is `hidden
        xl:block`, so this copy exists to cover the widths where there
        is no rail — and since the rail became collapsible, "no rail"
        is a choice as well as a screen size. `rail-fallback` is what
        brings this back when somebody hides the panel; see the rule
        in globals.css. Without it, collapsing the rail on this page
        takes the 988 number off the screen altogether.
      */}
      <div className="rail-fallback mt-4 xl:hidden">
        <SupportCard compact />
      </div>
    </SiteShell>
  );
}
