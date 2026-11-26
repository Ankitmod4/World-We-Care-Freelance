"use client";

import { ReactionButton } from "./reaction-button";
import type { ReactionType } from "@/lib/reactions";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SiteShell, type ShellViewer } from "./site-shell";
import { ConfirmDialog } from "./confirm-dialog";
import { Button } from "@/components/ui/button";
import { PhotoAttach } from "./photo-attach";
import { VideoUpload, VideoAttachButton, type UploadedVideo } from "@/components/ui/video-upload";
import type { AttachedVideo } from "@/lib/attached-media";
import { RichTextToolbar } from "./rich-text-toolbar";
import { EntryCardShell, EntryCardBody, WALL, cardIsTall } from "./entry-card";
import { CategoryPicker, useCategories } from "./category-controls";
import { PageHeading } from "./page-heading";
import { SupportCard } from "./support-card";
import { useCountry } from "./country-context";
import { CategoryTabs, type TabCategory } from "./category-tabs";
import { useT } from "./locale-context";
import { serverText } from "@/lib/i18n-core";

interface GratitudeItem {
  id: string;
  authorId: string | null;
  authorName: string;
  authorAvatar: string | null;
  body: string;
  isAnonymous: boolean;
  heartCount: number;
  commentCount: number;
  hearted: boolean;
  myReaction: ReactionType | null;
  isOwn: boolean;
  imageUrl: string | null;
  video: AttachedVideo | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  category: { id: string; name: string; slug: string; emoji: string | null } | null;
  rejectionReason: string | null;
  createdAt: string;
}

const BODY_MAX = 1000;


export function GratitudeClient({
  viewer,
  categories: tabCategories,
}: {
  viewer: ShellViewer;
  /**
   * Rendered by the page, passed through as a node, so the tiles stay
   * a server component with their counts in the first paint. Importing
   * them here would drag them across the client boundary and make the
   * counts arrive after a fetch.
   */
  /**
   * Read on the server so the counts are right on the first
   * paint. DATA, not a rendered node: the strip drives this
   * component's filter, and a node handed down from the page
   * could not reach the state it has to set.
   */
  categories: TabCategory[];
}) {
  const t = useT();
  // For the crisis card's local-lines line — see SupportCard.
  const { country } = useCountry();

  const [items, setItems] = useState<GratitudeItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [body, setBody] = useState("");
  const [anon, setAnon] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  /*
   * A PHOTO OR A VIDEO, NOT BOTH — the same rule the server
   * enforces in the create function, mirrored here so the choice is
   * visible rather than a rejected submit. `videoOpen` is separate
   * from `video` because the panel has to exist, empty, while the
   * upload is still running.
   */
  const [video, setVideo] = useState<UploadedVideo | null>(null);
  const [videoOpen, setVideoOpen] = useState(false);
  const categories = useCategories("gratitude");
  // What the composer will file the next post under.
  const [postCategory, setPostCategory] = useState<string | null>(null);

  /*
   * A category is required — but only once there is one to pick.
   * `useCategories` starts empty and fills in after a fetch, so this
   * is false for the first frame and the button is briefly enabled;
   * that is fine, because the server applies the same rule and the
   * only way to beat the race is to have already typed a post and hit
   * Share inside one round trip.
   */
  const needsCategory = categories.length > 0 && !postCategory;
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<GratitudeItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  /*
   * THE WALL FILTERS ITSELF AGAIN, through the tab strip above it.
   *
   * This is a reversal, so it is worth saying why. The old pill row
   * was removed because it sat beside a grid of category TILES, and
   * its only job was to undo the control next to it. With the tiles
   * replaced by a strip there is no second control: the strip is the
   * filter, and "All" is one of its choices rather than an escape
   * hatch from another one.
   *
   * The cursor resets with the category, because a cursor is a
   * position in one particular list.
   */
  const [filter, setFilter] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = filter ? `?category=${encodeURIComponent(filter)}` : "";
      const res = await fetch(`/api/user/gratitude${qs}`);
      const d = await res.json();
      setItems(d.items ?? []);
      setCursor(d.nextCursor ?? null);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, [filter]);
  useEffect(() => { void load(); }, [load]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams({ cursor });
      if (filter) params.set("category", filter);
      const res = await fetch(`/api/user/gratitude?${params}`);
      const d = await res.json();
      setItems((prev) => [...prev, ...(d.items ?? [])]);
      setCursor(d.nextCursor ?? null);
    } finally {
      setLoadingMore(false);
    }
  };

  const post = async () => {
    if (!body.trim() || posting) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch("/api/user/gratitude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: body.trim(),
          isAnonymous: anon,
          imageUrl,
          // THE ID, NOT THE URL. The server turns it back into a video
          // after checking it is this member's and has finished
          // converting — see resolveAttachedVideo.
          videoAssetId: video?.id ?? null,
          categoryId: postCategory,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(serverText(t, d?.error) || t("common.couldNotPost", "Couldn't post.")); return; }
      setItems((prev) => [d.item, ...prev]);
      setBody("");
      setAnon(false);
      setImageUrl(null);
      setVideo(null);
      setVideoOpen(false);
      setPostCategory(null);
    } catch {
      setError(t("common.wentWrong", "Something went wrong."));
    } finally {
      setPosting(false);
    }
  };

  /** Three outcomes; a swap leaves the count alone. See reaction-toggle.ts. */
  const toggleHeart = async (item: GratitudeItem, type: ReactionType) => {
    const before = item;
    const removing = item.myReaction === type;
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id
          ? {
              ...i,
              myReaction: removing ? null : type,
              hearted: !removing,
              heartCount: removing
                ? Math.max(0, i.heartCount - 1)
                : i.myReaction
                  ? i.heartCount
                  : i.heartCount + 1,
            }
          : i,
      ),
    );
    try {
      const res = await fetch(`/api/user/gratitude/${item.id}/heart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) throw new Error();
      const d = await res.json();
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, hearted: d.hearted, heartCount: d.heartCount, myReaction: d.myReaction }
            : i,
        ),
      );
    } catch {
      setItems((prev) => prev.map((i) => (i.id === item.id ? before : i)));
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/user/gratitude/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) setItems((prev) => prev.filter((i) => i.id !== deleteTarget.id));
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  return (
    <SiteShell viewer={viewer}>
      {/*
        Outside the card, not inside it. The banner used to sit in a
        `hero-sky` strip within the composer card, which meant the
        photo was inset by the card's own padding and stopped short of
        the page's edges — a framed picture where every other page has
        a full-width one. Lifting it out is the whole fix.
      */}
      <PageHeading
        title={t("page.gratitudeTitle", "Gratitude wall")}
        intro={t("page.gratitudeIntro", "Share what you're grateful for today. Sometimes reading someone else's list is exactly what another person needs.")}
        note={t("gratitude.modNote", "Posts are reviewed by a moderator before they appear on the wall.")}
      />

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
      <div className="rail-fallback xl:hidden">
        <SupportCard compact />
      </div>

      <div className="rounded-[20px] overflow-hidden bg-[color:var(--color-surface)] border border-[color:var(--color-border)] shadow-[var(--shadow-card)] mb-4">
        {/* Composer */}
        <div className="px-5 sm:px-7 py-4">
          <textarea
            ref={composerRef}
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
            rows={3}
            placeholder={t("gratitude.placeholder", "Today I'm grateful for…")}
            className="w-full resize-none rounded-[14px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3.5 py-3 text-[14.5px] leading-relaxed text-[color:var(--color-text)] placeholder:text-[color:var(--color-text-subtle)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)]/25 focus:border-[color:var(--color-brand)] transition-all"
          />
          <RichTextToolbar textareaRef={composerRef} value={body} onChange={setBody} className="mt-1.5" />
          {error && <p className="mt-1.5 text-[12.5px] text-[color:var(--color-danger)]">{error}</p>}
          {imageUrl && <div className="mt-2.5"><PhotoAttach value={imageUrl} onChange={setImageUrl} /></div>}
          {/*
            THE PANEL STAYS MOUNTED WHILE A CONVERSION RUNS, which is
            why it is keyed off `videoOpen` rather than off `video`:
            `video` is null for the whole upload and encode, and a
            panel that appeared only once there was a finished video
            would unmount the thing doing the work.

            Closing it clears the attachment — `onChange(null)` from
            inside the panel also closes it, so the button and the
            panel cannot disagree about whether there is a video.
          */}
          {videoOpen && (
            <div className="mt-2.5">
              <VideoUpload
                value={video}
                onChange={(next) => {
                  setVideo(next);
                  if (!next) setVideoOpen(false);
                }}
                label={t("composer.video", "Video")}
                hint={t(
                  "gratitude.videoHint",
                  "Converted to MP4 with a thumbnail so it plays on every device, including iPhones.",
                )}
                disabled={posting}
              />
            </div>
          )}
          {/* Two rows on purpose. Photo and category are both "what am I
              attaching to this" and belong together; the anonymity toggle
              and the Share button are "how am I sending it". Cramming all
              five into one row is what wrapped the Photo button onto a
              line of its own at phone width. */}
          <div className="mt-2.5 space-y-2.5">
            <div className="flex flex-wrap items-center gap-2">
              {/*
                ONE OR THE OTHER, NEVER BOTH. The server refuses the
                pair (see the create function), so the composer must
                not offer it: with a video open the Photo button goes,
                and with a photo attached the Video button does.

                HIDDEN RATHER THAN DISABLED. A disabled button with a
                tooltip explaining why is how the post composer does
                it, and there it is right — that row has six controls
                and losing one shifts the rest. Here there are two, and
                a greyed-out button beside its live twin reads as
                broken rather than as a choice already made.
              */}
              {!imageUrl && !videoOpen && (
                <VideoAttachButton onClick={() => setVideoOpen(true)} disabled={posting} />
              )}
              {!imageUrl && !videoOpen && <PhotoAttach value={imageUrl} onChange={setImageUrl} disabled={posting} />}
              <CategoryPicker
                categories={categories}
                value={postCategory}
                onChange={setPostCategory}
                disabled={posting}
                required
              />
            </div>

            {needsCategory && body.trim() && (
              <p className="text-[12px] text-[color:var(--color-text-muted)]">
                {t("common.pickCategory", "Pick a category so people can find this.")}
              </p>
            )}

            {/*
              A VIDEO THAT HAS NOT FINISHED CONVERTING BLOCKS THE
              SHARE, and this is not politeness — it is the difference
              between attaching a video and appearing to.

              `video` is null for the whole upload and encode, so
              without this the composer happily posts with
              `videoAssetId: null`. The entry goes up, silently, with
              no video on it; the member watched a progress bar finish
              and got a text-only confession. The server cannot save
              them either, because null is exactly what "no video" looks
              like from there.

              `videoOpen && !video` also covers the panel being opened
              and nothing picked — in which case closing it is one tap,
              and the hint below says so.
            */}
            {videoOpen && !video && (
              <p className="text-[12px] text-[color:var(--color-text-muted)]">
                {t("composer.videoWaiting", "Wait for the video to finish, or close it to post without one.")}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <button
                type="button"
                onClick={() => setAnon((v) => !v)}
                aria-pressed={anon}
                className={
                  "relative w-9 h-5 rounded-full transition-colors " +
                  (anon ? "bg-[color:var(--color-brand)]" : "bg-[color:var(--color-surface-muted)]")
                }
                >
                <span className={"absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform " + (anon ? "translate-x-4" : "")} />
                </button>
                <span className="text-[12.5px] text-[color:var(--color-text-muted)]">{t("common.postAnonymously", "Post anonymously")}</span>
              </label>
              <div className="ml-auto flex items-center gap-3">
                <span className="text-[11.5px] tabular-nums text-[color:var(--color-text-subtle)]">{body.length}/{BODY_MAX}</span>
                <Button size="sm" loading={posting} disabled={!body.trim() || needsCategory || (videoOpen && !video)} onClick={post}>{t("common.share", "Share")}</Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <CategoryTabs
        kind="gratitudeCategory"
        categories={tabCategories}
        value={filter}
        onChange={setFilter}
        label={t("gratitude.categories", "Gratitude categories")}
      />

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-[16px] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] p-4 animate-pulse">
              <div className="h-4 w-32 bg-[color:var(--color-surface-muted)] rounded mb-3" />
              <div className="h-3.5 w-full bg-[color:var(--color-surface-muted)] rounded mb-1.5" />
              <div className="h-3.5 w-2/3 bg-[color:var(--color-surface-muted)] rounded" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-[16px] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] py-14 text-center">
          <div className="text-[26px] mb-2" aria-hidden>🙏</div>
          <p className="text-[15px] font-semibold text-[color:var(--color-text)]">{t("gratitude.empty", "Be the first to share")}</p>
          <p className="mt-1 text-[13px] text-[color:var(--color-text-muted)]">{t("gratitude.emptyBlurb", "Your gratitude might lift someone up today.")}</p>
        </div>
      ) : (
        <div className={WALL}>
          {items.map((item, i) => (
            <GratitudeCard
              key={item.id}
              item={item}
              index={i}
              onHeart={(t: ReactionType) => toggleHeart(item, t)}
              onDelete={item.isOwn ? () => setDeleteTarget(item) : undefined}
            />
          ))}
        </div>
      )}

      {/*
        OUTSIDE the wall. Inside it, "Load more" is another item in a
        CSS column and lands at the bottom of whichever column the
        browser puts it in — not under the wall, where a reader looks
        for it.
      */}
      {!loading && items.length > 0 && cursor && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="min-h-11 px-5 rounded-[12px] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] text-[13.5px] font-medium text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-hover)] disabled:opacity-50"
          >
            {loadingMore ? t("common.loading", "Loading…") : t("common.loadMore", "Load more")}
          </button>
        </div>
      )}
      {!loading && !cursor && items.length > 5 && (
        <p className="text-center text-[12px] text-[color:var(--color-text-subtle)] py-4">{t("common.allCaughtUp", "You\u2019re all caught up.")}</p>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title={t("gratitude.deleteTitle", "Delete this entry?")}
          message={t("gratitude.deleteBody", "This gratitude entry will be permanently removed.")}
          confirmLabel={t("common.delete", "Delete")}
          loading={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </SiteShell>
  );
}

function GratitudeCard({
  item,
  index,
  onHeart,
  onDelete,
}: {
  item: GratitudeItem;
  index: number;
  onHeart: (type: ReactionType) => void;
  onDelete?: () => void;
}) {
  /*
   * NO THREAD ON THE CARD any more. The wall's tiles are a fixed
   * height now, and a conversation that can be any length does not fit
   * in one — it used to push the card to whatever height the thread
   * happened to be, which is the ragged wall this replaced. The
   * comment control is a link to the entry's page, where the thread
   * has the room it needs.
   */
  const t = useT();
  const href = `/gratitude/${item.id}`;
  const approved = item.status === "APPROVED";

  return (
    <EntryCardShell index={index} href={approved ? href : null} footer={
      approved ? (
        <div className="flex items-center gap-1">
          {/*
            `placement="top"` because the footer sits at the bottom of
            a tile with tiles below it — a picker opening downwards
            would land on the next card.
          */}
          <ReactionButton mine={item.myReaction} count={item.heartCount} onPick={onHeart} size="sm" placement="top" />
          <Link
            href={href}
            aria-label={
              item.commentCount === 1
                ? t("comments.one", "1 comment")
                : t("comments.n", "{n} comments", { n: item.commentCount })
            }
            className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-medium text-[color:var(--color-text-muted)] transition-colors hover:bg-[color:var(--color-surface-muted)]"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path
                d="M4 5.5A1.5 1.5 0 015.5 4h9A1.5 1.5 0 0116 5.5v6A1.5 1.5 0 0114.5 13H8l-3 3v-3H5.5A1.5 1.5 0 014 11.5v-6z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
            </svg>
            {item.commentCount > 0 ? item.commentCount : ""}
          </Link>
          {onDelete && <DeleteButton onClick={onDelete} />}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <StatusPill status={item.status} />
          <span className="min-w-0 flex-1 truncate text-[11.5px] text-[color:var(--color-text-subtle)]">
            {item.status === "REJECTED"
              ? item.rejectionReason || t("common.notApprovedDot", "Not approved.")
              : t("common.pendingNote", "Only you can see this until it's approved.")}
          </span>
          {onDelete && <DeleteButton onClick={onDelete} />}
        </div>
      )
    }>
      <EntryCardBody
        authorName={item.authorName}
        authorAvatar={item.authorAvatar}
        isAnonymous={item.isAnonymous}
        body={item.body}
        contentKind="gratitude"
        contentId={item.id}
        imageUrl={item.imageUrl}
        video={item.video}
        createdAt={item.createdAt}
        tall={cardIsTall(index)}
      />
    </EntryCardShell>
  );
}

function DeleteButton({ onClick }: { onClick: () => void }) {
  const t = useT();
  return (
    <button
      onClick={onClick}
      aria-label={t("common.delete", "Delete")}
      className="ml-auto h-8 w-8 -mr-1 inline-flex shrink-0 items-center justify-center rounded-full text-[color:var(--color-text-subtle)] hover:text-[color:var(--color-danger)] hover:bg-[color:var(--color-surface-muted)] transition-colors"
    >
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden><path d="M4 6h12M8 6V4.5A1.5 1.5 0 019.5 3h1A1.5 1.5 0 0112 4.5V6m2 0v9a1.5 1.5 0 01-1.5 1.5h-5A1.5 1.5 0 016 15V6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
    </button>
  );
}

function StatusPill({ status }: { status: "PENDING" | "REJECTED" | "APPROVED" }) {
  const t = useT();
  if (status === "APPROVED") return null;
  const map = {
    PENDING: { label: t("common.pendingReview", "Pending review"), cls: "bg-[color:var(--color-warning-soft)] text-[color:var(--color-warning-ink)]" },
    REJECTED: { label: t("common.notApproved", "Not approved"), cls: "bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger-ink)]" },
    APPROVED: { label: "", cls: "" },
  } as const;
  const m = map[status];
  return <span className={"text-[10.5px] font-semibold px-1.5 py-0.5 rounded-full " + m.cls}>{m.label}</span>;
}

