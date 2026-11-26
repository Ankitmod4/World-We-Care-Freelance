"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { VideoUpload, type UploadedVideo } from "@/components/ui/video-upload";
import { cn } from "@/lib/utils";
import type { FeedPost } from "./post-card";
import type { FeedViewer } from "./feed-page";
import { Img } from "@/components/ui/img";
import { useT } from "./locale-context";
import { serverText } from "@/lib/i18n-core";

const BODY_MAX = 5000;
const MAX_IMAGES = 6;

interface PendingImage {
  url: string;
}

/**
 * Sticky-ish composer at the top of the feed. Two states:
 *   • collapsed placeholder (single-line pill) — the default
 *   • expanded card with textarea + image attach + anonymous toggle
 *
 * New posts are stamped with the viewer's currently-selected country
 * (passed down from the shell) so the country-filtered feed actually
 * has local content to show. Posting with "All countries" selected
 * leaves the post global (countryId null).
 */
export function Composer({
  viewer,
  countryId,
  countryName,
  countryCode,
  onPosted,
  onToast,
}: {
  viewer: FeedViewer;
  countryId: string | null;
  countryName: string | null;
  /** Beside the name, so the optimistic post matches what the feed
      will render once the server answers. */
  countryCode: string | null;
  onPosted: (post: FeedPost) => void;
  onToast: (tone: "ok" | "warn" | "info", msg: string) => void;
}) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const [body, setBody] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [images, setImages] = useState<PendingImage[]>([]);
  // One video per post, and never alongside images — two different
  // media layouts in one card is a mess to read and a mess to build.
  const [video, setVideo] = useState<UploadedVideo | null>(null);
  const [videoOpen, setVideoOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const remaining = BODY_MAX - body.length;
  const canSubmit =
    (body.trim().length > 0 || images.length > 0 || !!video) &&
    remaining >= 0 &&
    !submitting &&
    !uploading;

  const collapse = () => {
    setExpanded(false);
    setBody("");
    setIsAnonymous(false);
    setImages([]);
    setVideo(null);
    setVideoOpen(false);
  };

  const onPickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const room = MAX_IMAGES - images.length;
    if (room <= 0) {
      onToast("warn", `You can attach up to ${MAX_IMAGES} images.`);
      return;
    }
    const chosen = Array.from(files).slice(0, room);
    setUploading(true);
    for (const file of chosen) {
      const form = new FormData();
      form.append("file", file);
      try {
        const res = await fetch("/api/user/upload", { method: "POST", body: form });
        const d = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string };
        if (!res.ok || !d.url) {
          onToast("warn", serverText(t, d?.error) || t("composer.uploadFailed", "Couldn't upload that image."));
          continue;
        }
        setImages((prev) => (prev.length < MAX_IMAGES ? [...prev, { url: d.url! }] : prev));
      } catch {
        onToast("warn", t("composer.uploadOffline", "Upload failed. Check your connection."));
      }
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removeImage = (url: string) => {
    setImages((prev) => prev.filter((i) => i.url !== url));
  };

  // ── Formatting helpers (markdown-style) ─────────────────────────
  const surround = (before: string, after: string, placeholder: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? body.length;
    const end = ta.selectionEnd ?? body.length;
    const sel = body.slice(start, end) || placeholder;
    const next = body.slice(0, start) + before + sel + after + body.slice(end);
    setBody(next);
    requestAnimationFrame(() => {
      ta.focus();
      const s = start + before.length;
      ta.setSelectionRange(s, s + sel.length);
    });
  };

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    const res = await fetch("/api/user/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body,
        isAnonymous,
        images,
        videoAssetId: video?.id ?? null,
        countryId: countryId ?? undefined,
      }),
    });
    const d = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      id?: string;
      error?: string;
    };
    setSubmitting(false);
    if (!res.ok || !d.id) {
      onToast("warn", serverText(t, d?.error) || t("composer.postFailed", "Couldn't post. Try again."));
      return;
    }
    // Build a client-side representation of the row that just went
    // in so we can prepend it without a full feed refetch. It's the
    // same shape the server would return on the next GET.
    onPosted({
      id: d.id,
      authorId: viewer.id,
      authorName: viewer.displayName,
      authorAvatar: viewer.avatarUrl ?? null,
      body: body.trim(),
      images: images.map((i) => ({ url: i.url, alt: null })),
      video: video
        ? {
            assetId: video.id,
            url: video.url,
            posterUrl: video.posterUrl,
            width: video.width,
            height: video.height,
            durationSec: video.durationSec,
          }
        : null,
      isAnonymous,
      isFeatured: false,
      likeCount: 0,
      myReaction: null,
      commentCount: 0,
      saveCount: 0,
      liked: false,
      saved: false,
      isOwn: true,
      countryName: countryName,
      countryCode: countryCode,
      createdAt: new Date().toISOString(),
    });
    collapse();
    onToast("ok", t("composer.posted", "Posted."));
  };

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="w-full flex items-center gap-3 rounded-[16px] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] p-3.5 text-left hover:border-[color:var(--color-border-strong)] transition-colors"
      >
        <Avatar name={viewer.displayName} url={viewer.avatarUrl} />
        <span className="text-[14px] text-[color:var(--color-text-muted)]">
          {t("composer.collapsedPrompt", "Share what\u2019s on your mind\u2026")}
        </span>
      </button>
    );
  }

  return (
    <div className="rounded-[16px] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] p-4 shadow-[var(--shadow-elevated)]">
      <div className="flex items-start gap-3">
        <Avatar name={isAnonymous ? "?" : viewer.displayName} url={isAnonymous ? null : viewer.avatarUrl} />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium">
            {isAnonymous
              ? t("composer.postingAnon", "Posting anonymously")
              : t("composer.postingAs", "Posting as {name}", { name: viewer.displayName })}
            {countryName && (
              <span className="text-[color:var(--color-text-subtle)] font-normal">
                {" "}· {t("composer.toCountry", "to {country}", { country: countryName })}
              </span>
            )}
          </p>
          {/* The textarea and its formatting buttons share one bordered
              box. Borderless, the writing area had no edge at all — the
              placeholder just floated in the card — and the toolbar
              underneath read as unrelated. `focus-within` lights the
              whole thing up, matching how every other field in the app
              behaves on focus. */}
          <div
            className={cn(
              "mt-2 overflow-hidden rounded-[12px] border bg-[color:var(--color-surface)] transition-shadow duration-150",
              "border-[color:var(--color-border)]",
              "focus-within:border-[color:var(--color-brand)]",
              "focus-within:ring-4 focus-within:ring-[color:var(--color-brand-soft)]",
              remaining < 0 &&
                "border-[color:var(--color-danger)] focus-within:border-[color:var(--color-danger)] focus-within:ring-[color:var(--color-danger-soft)]",
            )}
          >
            <textarea
              ref={textareaRef}
              autoFocus
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t("composer.placeholder", "Share a small win, a struggle, a question.")}
              rows={4}
              className={cn(
                "block w-full resize-y border-0 bg-transparent px-3.5 py-3 text-[14.5px] leading-relaxed",
                "focus:outline-none placeholder:text-[color:var(--color-text-subtle)]",
              )}
              maxLength={BODY_MAX + 200 /* forgiving overflow, validated below */}
            />

            {/* Formatting toolbar */}
            <div className="flex flex-wrap items-center gap-0.5 border-t border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)] px-1.5 py-1">
              <FmtButton label={t("composer.bold", "Bold")} onClick={() => surround("**", "**", "bold text")}>
                <span className="font-bold text-[13px]">B</span>
              </FmtButton>
              <FmtButton label={t("composer.italic", "Italic")} onClick={() => surround("*", "*", "italic text")}>
                <span className="italic text-[13px] font-serif">I</span>
              </FmtButton>
              <FmtButton label={t("composer.strikethrough", "Strikethrough")} onClick={() => surround("~~", "~~", "strikethrough")}>
                <span className="line-through text-[13px]">S</span>
              </FmtButton>
            </div>
          </div>

          {/* Attached video */}
          {videoOpen && (
            <div className="mt-3">
              <VideoUpload
                value={video}
                onChange={(next) => {
                  setVideo(next);
                  if (!next) setVideoOpen(false);
                }}
                label={t("composer.video", "Video")}
                hint={t(
                  "composer.videoHint",
                  "Converted to MP4 with a thumbnail so it plays on every device, including iPhones.",
                )}
              />
            </div>
          )}

          {/* Attached images */}
          {images.length > 0 && (
            <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 gap-2">
              {images.map((img) => (
                <div key={img.url} className="relative group">
                  <Img
                    src={img.url}
                    alt=""
                    className="h-28 w-full object-contain rounded-[10px] bg-[color:var(--color-surface-muted)] border border-[color:var(--color-border-soft)]"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(img.url)}
                    aria-label={t("composer.removeImage", "Remove image")}
                    className="absolute top-1 right-1 h-6 w-6 flex items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path d="M4 4l8 8M12 4L4 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {/* Image attach */}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => onPickFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading || images.length >= MAX_IMAGES || videoOpen}
            aria-label={t("composer.addPhotos", "Add photos")}
            title={videoOpen ? "A post can have photos or a video, not both." : undefined}
            className="inline-flex items-center gap-1.5 min-h-9 px-2.5 rounded-[10px] text-[13px] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-brand)] hover:bg-[color:var(--color-surface-hover)] disabled:opacity-50 transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
              <rect x="3" y="4" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="7.5" cy="8.5" r="1.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M4 14l4-3.5 3 2.5 3-3 2 2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            <span className="hidden sm:inline">{uploading ? "Uploading…" : "Photo"}</span>
          </button>

          <button
            type="button"
            onClick={() => setVideoOpen((o) => !o)}
            disabled={images.length > 0}
            aria-pressed={videoOpen}
            aria-label={t("composer.addVideo", "Add a video")}
            title={images.length > 0 ? "A post can have photos or a video, not both." : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 min-h-9 px-2.5 rounded-[10px] text-[13px] transition-colors disabled:opacity-50",
              videoOpen
                ? "text-[color:var(--color-brand)] bg-[color:var(--color-surface-hover)]"
                : "text-[color:var(--color-text-muted)] hover:text-[color:var(--color-brand)] hover:bg-[color:var(--color-surface-hover)]",
            )}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
              <rect x="2.5" y="4.5" width="11" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M13.5 8.5l4-2.25v7.5l-4-2.25" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
            <span className="hidden sm:inline">{t("composer.video", "Video")}</span>
          </button>

          {/* Anonymous toggle */}
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <span className="relative inline-flex items-center">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(e) => setIsAnonymous(e.target.checked)}
                className="sr-only peer"
              />
              <span className="h-5 w-9 rounded-full bg-[color:var(--color-border-strong)] peer-checked:bg-[color:var(--color-brand)] transition-colors" />
              <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4" />
            </span>
            <span className="text-[13px] text-[color:var(--color-text-muted)]">
              {t("common.postAnonymously", "Post anonymously")}
            </span>
          </label>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <span
            className={cn(
              "text-[11.5px] tabular-nums",
              remaining < 100
                ? remaining < 0
                  ? "text-[color:var(--color-danger)] font-medium"
                  : "text-[color:var(--color-warning)]"
                : "text-[color:var(--color-text-subtle)]",
            )}
          >
            {remaining >= 0 ? remaining : `${remaining}`}
          </span>
          <Button variant="ghost" size="sm" onClick={collapse} disabled={submitting}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button size="sm" loading={submitting} disabled={!canSubmit} onClick={submit}>
            {submitting ? t("composer.posting", "Posting…") : t("composer.post", "Post")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
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
        className="h-10 w-10 shrink-0 rounded-full object-cover bg-[color:var(--color-surface-muted)]"
        variant="thumb"
      />
    );
  }
  return (
    <div className="shrink-0 h-10 w-10 rounded-full bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-ink)] flex items-center justify-center text-[13px] font-semibold">
      {initials || "?"}
    </div>
  );
}

function FmtButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      // preventDefault on mousedown keeps the textarea selection intact
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      // Hover is white, not surface-muted: the toolbar strip itself is
      // surface-muted now, so the old hover colour was invisible
      // against it.
      className="h-8 min-w-8 px-1.5 inline-flex items-center justify-center rounded-[8px] text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface)] hover:text-[color:var(--color-text)] transition-colors"
    >
      {children}
    </button>
  );
}
