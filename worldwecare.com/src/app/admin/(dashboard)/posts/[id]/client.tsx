"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PostImages } from "@/components/admin/post-images";
import { VideoPlayer } from "@/components/ui/video-player";
import { Img } from "@/components/ui/img";

interface Post {
  id: string;
  authorId: string | null;
  authorName: string;
  authorAvatar: string | null;
  authorEmail: string | null;
  body: string;
  images: Array<{ url: string; alt?: string | null }>;
  video: {
    assetId: string;
    url: string;
    posterUrl: string | null;
    width: number | null;
    height: number | null;
    durationSec: number | null;
  } | null;
  isAnonymous: boolean;
  status: "PUBLISHED" | "PENDING" | "REMOVED" | "DRAFT";
  isFeatured: boolean;
  removedReason: string | null;
  likeCount: number;
  commentCount: number;
  saveCount: number;
  reportCount: number;
  countryName: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Comment {
  id: string;
  authorId: string | null;
  authorName: string;
  authorAvatar: string | null;
  body: string;
  isAnonymous: boolean;
  status: "PUBLISHED" | "PENDING" | "REMOVED" | "DRAFT";
  likeCount: number;
  reportCount: number;
  removedReason: string | null;
  createdAt: string;
}

/**
 * Post detail — the moderator's magnifying glass. Left column is the
 * post + comments thread. Right rail sticks with the safety actions
 * (remove, restore, feature, jump to author).
 */
export function PostDetailClient({ postId }: { postId: string }) {
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/posts/${postId}`);
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const d = (await res.json()) as { item: Post; comments: Comment[] };
    setPost(d.item);
    setComments(d.comments);
    setLoading(false);
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  const pushToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  if (loading || !post) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <p className="text-[13px] text-[color:var(--color-text-muted)]">Loading…</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="text-[12.5px]">
        <Link href="/admin/posts" className="text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]">
          ← All posts
        </Link>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
        <div className="xl:col-span-2 space-y-4 sm:space-y-6">
          <PostCard post={post} onChange={load} onToast={pushToast} />
          <CommentsList
            comments={comments}
            onChange={load}
            onToast={pushToast}
          />
        </div>
        <div className="xl:col-span-1">
          <ActionsRail
            post={post}
            onChange={load}
            onDelete={() => router.replace("/admin/posts")}
            onToast={pushToast}
          />
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-40 rounded-[12px] bg-[color:var(--color-success)] text-[color:var(--color-on-success)] px-4 py-3 shadow-[var(--shadow-elevated)] text-[13.5px]">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ── Post block ──────────────────────────────────────────────── */

function PostCard({
  post,
  onChange,
  onToast,
}: {
  post: Post;
  onChange: () => void;
  onToast: (msg: string) => void;
}) {
  return (
    <Card>
      <CardBody className="p-5">
        <div className="flex items-start gap-3">
          <Avatar url={post.authorAvatar} name={post.authorName} size={44} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-[15px]">
                {post.isAnonymous ? "Anonymous member" : post.authorName}
              </p>
              {post.isAnonymous && (
                <span className="text-[10.5px] uppercase tracking-[0.08em] text-[color:var(--color-text-subtle)] font-semibold px-1.5 py-0.5 rounded-full bg-[color:var(--color-surface-hover)]">
                  Anon
                </span>
              )}
              <StatusChip status={post.status} />
              {post.isFeatured && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-ink)] text-[10.5px] font-medium">
                  Featured
                </span>
              )}
              {post.reportCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[color:var(--color-warning-soft)] text-[color:var(--color-warning-ink)] border border-[color:var(--color-warning-soft)] text-[10.5px] font-medium">
                  {post.reportCount} report{post.reportCount === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <p className="text-[12px] text-[color:var(--color-text-subtle)] mt-0.5">
              {post.authorEmail ?? "unknown@—"} · {new Date(post.createdAt).toLocaleString()}
              {post.countryName && ` · ${post.countryName}`}
            </p>
          </div>
        </div>

        <p className="mt-4 text-[15px] leading-relaxed whitespace-pre-wrap break-words">
          {post.body}
        </p>

        {post.video && (
          <div className="mt-4 max-w-2xl">
            <VideoPlayer
              src={post.video.url}
              poster={post.video.posterUrl}
              width={post.video.width}
              height={post.video.height}
            />
          </div>
        )}

        {post.images.length > 0 && (
          <div className="mt-4">
            <PostImages images={post.images} thumbHeightClass="h-40" />
          </div>
        )}

        {post.status === "REMOVED" && post.removedReason && (
          <div className="mt-4 rounded-[10px] bg-[color:var(--color-danger-soft)] border border-[color:var(--color-danger-soft)] text-[color:var(--color-danger)] text-[12.5px] px-3 py-2">
            <strong>Removed:</strong> {post.removedReason}
          </div>
        )}

        <div className="mt-4 flex items-center gap-4 text-[12px] text-[color:var(--color-text-muted)]">
          <span>♥ {post.likeCount} likes</span>
          <span>💬 {post.commentCount} comments</span>
          <span>🔖 {post.saveCount} saves</span>
        </div>
      </CardBody>
    </Card>
  );
}

/* ── Comments ────────────────────────────────────────────────── */

function CommentsList({
  comments,
  onChange,
  onToast,
}: {
  comments: Comment[];
  onChange: () => void;
  onToast: (msg: string) => void;
}) {
  return (
    <Card>
      <CardBody className="p-5">
        <p className="text-[15px] font-semibold tracking-[-0.01em]">
          Comments <span className="text-[13px] text-[color:var(--color-text-muted)] font-normal">· {comments.length}</span>
        </p>
        {comments.length === 0 && (
          <p className="mt-3 text-[13px] text-[color:var(--color-text-subtle)]">
            No comments yet.
          </p>
        )}
        <div className="mt-3 space-y-3">
          {comments.map((c) => (
            <CommentRow key={c.id} comment={c} onChange={onChange} onToast={onToast} />
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

function CommentRow({
  comment,
  onChange,
  onToast,
}: {
  comment: Comment;
  onChange: () => void;
  onToast: (msg: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [reason, setReason] = useState("");
  const removed = comment.status === "REMOVED";

  const call = async (action: "remove" | "restore", why?: string) => {
    setBusy(action);
    const res = await fetch(`/api/admin/posts/comments/${comment.id}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason: why }),
    });
    setBusy(null);
    setConfirmingRemove(false);
    setReason("");
    if (res.ok) {
      onToast(action === "remove" ? "Comment removed." : "Comment restored.");
      onChange();
    }
  };

  return (
    <div className="rounded-[12px] border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-3">
      <div className="flex items-start gap-2.5">
        <Avatar url={comment.authorAvatar} name={comment.authorName} size={32} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-[13.5px] font-medium">
              {comment.isAnonymous ? "Anonymous member" : comment.authorName}
            </p>
            {removed && <StatusChip status="REMOVED" />}
            {comment.reportCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[color:var(--color-warning-soft)] text-[color:var(--color-warning-ink)] border border-[color:var(--color-warning-soft)] text-[10.5px] font-medium">
                {comment.reportCount}
              </span>
            )}
            <p className="text-[11px] text-[color:var(--color-text-subtle)] ml-auto">
              {new Date(comment.createdAt).toLocaleString()}
            </p>
          </div>
          <p className="mt-1 text-[13.5px] leading-relaxed whitespace-pre-wrap break-words">
            {comment.body}
          </p>
          {removed && comment.removedReason && (
            <p className="mt-1 text-[11.5px] text-[color:var(--color-danger)]">
              Removed: {comment.removedReason}
            </p>
          )}
          {confirmingRemove && (
            <div className="mt-2 space-y-1.5">
              <Input
                placeholder="Reason (optional)"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                autoFocus
              />
              <div className="flex gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => { setConfirmingRemove(false); setReason(""); }}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  loading={busy === "remove"}
                  onClick={() => call("remove", reason.trim() || undefined)}
                >
                  Remove comment
                </Button>
              </div>
            </div>
          )}
          {!confirmingRemove && (
            <div className="mt-1.5 flex gap-1">
              {removed ? (
                <button
                  className="min-h-9 px-2 text-[12px] font-medium text-[color:var(--color-brand)]"
                  onClick={() => call("restore")}
                  disabled={busy === "restore"}
                >
                  {busy === "restore" ? "…" : "Restore"}
                </button>
              ) : (
                <button
                  className="min-h-9 px-2 text-[12px] font-medium text-[color:var(--color-danger)]"
                  onClick={() => setConfirmingRemove(true)}
                >
                  Remove
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Right rail ──────────────────────────────────────────────── */

function ActionsRail({
  post,
  onChange,
  onDelete,
  onToast,
}: {
  post: Post;
  onChange: () => void;
  onDelete: () => void;
  onToast: (msg: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [confirmingPurge, setConfirmingPurge] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgeError, setPurgeError] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const removed = post.status === "REMOVED";

  const call = async (action: string, why?: string) => {
    setBusy(action);
    const res = await fetch(`/api/admin/posts/${post.id}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason: why }),
    });
    setBusy(null);
    setConfirmingRemove(false);
    setReason("");
    if (res.ok) {
      onToast(
        action === "remove" ? "Post removed."
        : action === "restore" ? "Post restored."
        : action === "feature" ? "Post featured."
        : "Updated.",
      );
      onChange();
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 xl:sticky xl:top-24 xl:self-start">
      <Card>
        <CardBody className="p-5 space-y-3">
          <p className="text-[15px] font-semibold tracking-[-0.01em]">Actions</p>

          {removed ? (
            <Button className="w-full" loading={busy === "restore"} onClick={() => call("restore")}>
              Restore post
            </Button>
          ) : (
            <>
              {!confirmingRemove && (
                <Button
                  variant="danger"
                  className="w-full"
                  onClick={() => setConfirmingRemove(true)}
                >
                  Remove post
                </Button>
              )}
              {confirmingRemove && (
                <div className="space-y-2">
                  <p className="text-[12.5px] text-[color:var(--color-text-muted)]">
                    Reason will be recorded and (later) shown to the author.
                  </p>
                  <Input
                    placeholder="e.g. Violates community guidelines"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      className="flex-1"
                      onClick={() => { setConfirmingRemove(false); setReason(""); }}
                      disabled={busy === "remove"}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="danger"
                      className="flex-1"
                      loading={busy === "remove"}
                      onClick={() => call("remove", reason.trim() || undefined)}
                    >
                      Confirm remove
                    </Button>
                  </div>
                </div>
              )}

              <Button
                variant={post.isFeatured ? "secondary" : "primary"}
                className="w-full"
                loading={busy === (post.isFeatured ? "unfeature" : "feature")}
                onClick={() => call(post.isFeatured ? "unfeature" : "feature")}
              >
                {post.isFeatured ? "Unfeature" : "Feature on homepage"}
              </Button>
            </>
          )}
        </CardBody>
      </Card>

      {/* Permanent delete is kept away from the moderation buttons on
          purpose. "Remove" is reversible and keeps the files; this
          takes the row and its media and cannot be undone. */}
      <Card>
        <CardBody className="p-5 space-y-2">
          <p className="text-[15px] font-semibold tracking-[-0.01em]">Danger zone</p>
          <p className="text-[12px] text-[color:var(--color-text-muted)]">
            Deletes the post and frees its images and video from disk. Removing is usually the
            right call — it can be undone and keeps the evidence.
          </p>
          {purgeError && (
            <p className="text-[12.5px] text-[color:var(--color-danger)]">{purgeError}</p>
          )}
          {confirmingPurge ? (
            <div className="flex gap-2 pt-1">
              <Button
                variant="secondary"
                className="flex-1"
                disabled={purging}
                onClick={() => setConfirmingPurge(false)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                loading={purging}
                onClick={async () => {
                  setPurging(true);
                  setPurgeError(null);
                  const res = await fetch(`/api/admin/posts/${post.id}`, { method: "DELETE" });
                  const d = (await res.json().catch(() => ({}))) as {
                    error?: string;
                    bytesFreed?: number;
                  };
                  setPurging(false);
                  if (!res.ok) {
                    setPurgeError(d.error ?? "Could not delete this post.");
                    setConfirmingPurge(false);
                    return;
                  }
                  onDelete();
                }}
              >
                Delete permanently
              </Button>
            </div>
          ) : (
            <Button variant="secondary" className="w-full" onClick={() => setConfirmingPurge(true)}>
              Delete permanently
            </Button>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-5 space-y-2">
          <p className="text-[15px] font-semibold tracking-[-0.01em]">Author</p>
          <p className="text-[13.5px] font-medium">{post.authorName}</p>
          <p className="text-[12px] text-[color:var(--color-text-muted)] break-all">
            {post.authorEmail ?? "unknown@—"}
          </p>
          {post.authorId && (
            <Link
              href={`/admin/users/${post.authorId}`}
              className="inline-flex items-center min-h-9 text-[12.5px] font-medium text-[color:var(--color-brand)] hover:underline"
            >
              Open user profile →
            </Link>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-5 space-y-1.5">
          <p className="text-[15px] font-semibold tracking-[-0.01em]">Meta</p>
          <MetaRow label="Post id" value={post.id} mono />
          <MetaRow label="Created" value={new Date(post.createdAt).toLocaleString()} />
          <MetaRow label="Updated" value={new Date(post.updatedAt).toLocaleString()} />
          {post.countryName && <MetaRow label="Country" value={post.countryName} />}
        </CardBody>
      </Card>
    </div>
  );
}

/* ── Small primitives ────────────────────────────────────────── */

function MetaRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
      <p className="text-[color:var(--color-text-subtle)]">{label}</p>
      <p className={cn("text-right text-[color:var(--color-text-muted)] break-all", mono && "font-mono text-[11.5px]")}>
        {value}
      </p>
    </div>
  );
}

function StatusChip({ status }: { status: Post["status"] | "REMOVED" }) {
  const map: Record<string, { label: string; cls: string }> = {
    PUBLISHED: { label: "Live",     cls: "bg-[color:var(--color-success-soft)] text-[color:var(--color-success-ink)] border-[color:var(--color-success-soft)]" },
    PENDING:   { label: "Pending",  cls: "bg-[color:var(--color-warning-soft)] text-[color:var(--color-warning-ink)] border-[color:var(--color-warning-soft)]" },
    REMOVED:   { label: "Removed",  cls: "bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger)] border-[color:var(--color-danger-soft)]" },
    DRAFT:     { label: "Draft",    cls: "bg-[color:var(--color-surface-hover)] text-[color:var(--color-text-muted)] border-transparent" },
  };
  const c = map[status] ?? map.PUBLISHED!;
  return (
    <span className={cn("inline-flex px-2 py-0.5 rounded-full border text-[10.5px] font-medium", c.cls)}>
      {c.label}
    </span>
  );
}

function Avatar({ url, name, size = 40 }: { url: string | null; name: string; size?: number }) {
  const initials = useMemo(
    () =>
      name
        .split(/\s+/)
        .map((s) => s[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase(),
    [name],
  );
  if (url) {
    return (
      <Img
        src={url}
        alt=""
        className="shrink-0 rounded-full object-cover bg-[color:var(--color-surface-muted)]"
        style={{ width: size, height: size }}
        variant="thumb"
      />
    );
  }
  return (
    <div
      className="shrink-0 rounded-full bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-ink)] flex items-center justify-center font-semibold"
      style={{ width: size, height: size, fontSize: size < 36 ? 11 : 13 }}
    >
      {initials || "?"}
    </div>
  );
}
