"use client";

import { useRef, useState } from "react";
import { Img } from "@/components/ui/img";
import { useT } from "./locale-context";
import { serverText } from "@/lib/i18n-core";

/**
 * Composer photo picker — uploads a single image to /api/user/upload
 * and hands the URL back via onChange. Shows a thumbnail with a remove
 * button once set. Shared by the gratitude + confession composers.
 */
export function PhotoAttach({
  value,
  onChange,
  disabled,
  compact,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (file: File) => {
    setError(null);
    if (!file.type.startsWith("image/")) { setError(t("upload.pickImage", "Pick an image file.")); return; }
    if (file.size > 10 * 1024 * 1024) { setError(t("upload.tooBig", "That's over 10 MB.")); return; }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/user/upload", { method: "POST", body: form });
      const d = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !d.url) { setError(serverText(t, d?.error) || t("chat.uploadFailed", "Upload failed.")); return; }
      onChange(d.url);
    } catch {
      setError(t("composer.uploadOffline", "Upload failed. Check your connection."));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  if (value) {
    return (
      <div className="relative inline-block">
        <Img src={value} alt="" className="h-16 w-16 rounded-[10px] object-cover border border-[color:var(--color-border)]"
          variant="thumb"
        />
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label={t("upload.removePhoto", "Remove photo")}
          className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-black/80 text-white flex items-center justify-center hover:bg-black"
        >
          <svg width="11" height="11" viewBox="0 0 20 20" fill="none" aria-hidden><path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
        </button>
      </div>
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f); }}
      />
      <button
        type="button"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
        aria-label={t("composer.addPhoto", "Add photo")}
        className={
          compact
            ? "inline-flex items-center justify-center h-9 w-9 rounded-full text-[color:var(--color-text-muted)] hover:text-[color:var(--color-brand)] hover:bg-[color:var(--color-surface-hover)] transition-colors disabled:opacity-50 shrink-0"
            : "inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[12.5px] font-medium text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-muted)] transition-colors disabled:opacity-50"
        }
      >
        <svg width={compact ? 20 : 16} height={compact ? 20 : 16} viewBox="0 0 20 20" fill="none" aria-hidden><rect x="3" y="4.5" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/><circle cx="7.5" cy="9" r="1.4" stroke="currentColor" strokeWidth="1.3"/><path d="M4 14l4-3.5 3 2 3-2.5 2 2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
        {!compact &&
          (uploading
            ? t("upload.uploading", "Uploading…")
            : t("composer.photo", "Photo"))}
        {error && <span className="sr-only">{error}</span>}
      </button>
    </>
  );
}

/**
 * Displays an attached image inside a feed card. Click opens a simple
 * full-screen lightbox.
 *
 * TWO WAYS TO SIT IN THE BOX, and the difference matters.
 *
 * By default the image is CROPPED to a tidy band — `object-cover` in a
 * 420px-tall box. That is right in a feed or a message thread, where a
 * run of pictures of wildly different shapes would otherwise make the
 * column lurch, and where the picture is an aside to the text.
 *
 * `whole` CONTAINS it instead, on a card of its own. That is right on
 * an entry's own page, where the picture IS the post: somebody who
 * opened a gratitude entry to look at the photo should see the photo,
 * not its middle third. A portrait was losing its top and bottom —
 * which, on a wall where people post pictures of the sky, was cutting
 * out the thing they had photographed.
 */
export function EntryImage({
  src,
  onLoaded,
  whole,
}: {
  src: string;
  onLoaded?: () => void;
  /** Show all of it, letterboxed on a card, rather than cropping. */
  whole?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          "mt-3 block w-full cursor-zoom-in overflow-hidden rounded-[14px] border border-[color:var(--color-border)] " +
          // The backdrop is what turns letterboxing from a bug into a
          // frame: a contained image on the card's own white leaves
          // two bands that read as broken spacing, and on a muted
          // ground they read as a mount.
          (whole ? "bg-[color:var(--color-surface-muted)] p-2" : "")
        }
      >
        <Img
          src={src}
          alt=""
          // `full`, not `thumb`, when the picture is the point — the
          // thumbnail is generated for a feed-sized box and shows it
          // at this size.
          variant={whole ? "full" : "thumb"}
          className={
            whole
              ? "mx-auto max-h-[520px] w-auto max-w-full rounded-[8px] object-contain"
              : "w-full max-h-[420px] object-cover"
          }
          onLoad={() => onLoaded?.()}
        />
      </button>
      {open && (
        <div className="fixed inset-0 z-[80] bg-black/90 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <button aria-label={t("common.close", "Close")} onClick={() => setOpen(false)} className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden><path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </button>
          <Img src={src} alt="" priority className="max-w-[92vw] max-h-[88vh] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
