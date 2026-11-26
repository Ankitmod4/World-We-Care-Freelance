"use client";

/**
 * Photo dropzone — drag a file in, or click to browse.
 *
 * The previous event uploaders were a bare icon button (member form)
 * and a small "+" tile (admin form). Neither told you what was
 * acceptable, neither took a drop, and neither showed progress on a
 * slow connection. This is one component both use: the endpoint is a
 * prop because members upload through /api/user/upload and admins
 * through /api/admin/upload, and everything else — validation,
 * previews, ordering, removal — is identical.
 */

import { useCallback, useId, useRef, useState } from "react";
import { Img } from "@/components/ui/img";
import { useT } from "@/components/site/locale-context";
import { serverText } from "@/lib/i18n-core";

export interface DropzonePhoto {
  url: string;
  alt?: string;
}

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,image/avif";
const MAX_BYTES = 10 * 1024 * 1024;

export function PhotoDropzone({
  value,
  onChange,
  endpoint,
  category,
  label,
  hint,
  max = 12,
  disabled,
  coverBadge,
}: {
  value: DropzonePhoto[];
  onChange: (next: DropzonePhoto[]) => void;
  /** Where the multipart POST goes. Must answer `{ url }`. */
  endpoint: string;
  /** Sent as the `category` field when the endpoint wants one. */
  category?: string;
  label?: string;
  hint?: string;
  max?: number;
  disabled?: boolean;
  /** Mark the first photo as the one used as the cover. */
  coverBadge?: boolean;
}) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const room = Math.max(0, max - value.length);
  const busy = progress !== null;
  const locked = disabled || busy;

  const upload = useCallback(
    async (files: File[]) => {
      setError(null);
      if (!files.length) return;

      const skipped: string[] = [];
      const picked: File[] = [];
      for (const file of files) {
        if (picked.length >= room) {
          skipped.push(`${file.name} (limit is ${max})`);
          continue;
        }
        if (!file.type.startsWith("image/")) {
          skipped.push(`${file.name} (not an image)`);
          continue;
        }
        if (file.size > MAX_BYTES) {
          skipped.push(`${file.name} (over 10 MB)`);
          continue;
        }
        picked.push(file);
      }

      if (!picked.length) {
        setError(
          skipped.length
            ? t("upload.skipped", "Skipped {names}.", { names: skipped.join(", ") })
            : t("upload.pickImage", "Pick an image file."),
        );
        return;
      }

      const added: DropzonePhoto[] = [];
      let failure: string | null = null;

      // Sequential rather than parallel: a member on a phone uploading
      // four photos at once is how you get a timeout on all four.
      for (let i = 0; i < picked.length; i += 1) {
        setProgress({ done: i, total: picked.length });
        const file = picked[i];
        const form = new FormData();
        form.append("file", file);
        if (category) form.append("category", category);
        try {
          const res = await fetch(endpoint, { method: "POST", body: form });
          const d = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
          if (!res.ok || !d.url) {
            failure =
              serverText(t, d?.error) ||
              t("upload.photoFailed", "Couldn\u2019t upload {name}.", { name: file.name });
            break;
          }
          added.push({ url: d.url });
        } catch {
          failure = "Upload failed — check your connection.";
          break;
        }
      }

      setProgress(null);
      if (added.length) onChange([...value, ...added]);
      const notes = [failure, skipped.length ? `Skipped ${skipped.join(", ")}.` : null].filter(
        Boolean,
      );
      setError(notes.length ? notes.join(" ") : null);
    },
    [category, endpoint, max, onChange, room, value],
  );

  const openPicker = () => {
    if (!locked && room > 0) inputRef.current?.click();
  };

  const remove = (index: number) => onChange(value.filter((_, i) => i !== index));

  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div>
      {label && (
        <span className="mb-1.5 block text-[12px] font-medium text-[color:var(--color-text-muted)]">
          {label}
        </span>
      )}

      {value.length > 0 && (
        <ul className="mb-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {value.map((photo, i) => (
            <li
              key={`${photo.url}-${i}`}
              className="group relative aspect-square overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)]"
            >
              <Img
                src={photo.url}
                alt={photo.alt ?? ""}
                className="h-full w-full object-cover"
              />

              {coverBadge && i === 0 && (
                <span className="absolute left-1 top-1 rounded-full bg-black/65 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-white">
                  {t("upload.cover", "Cover")}
                </span>
              )}

              <button
                type="button"
                aria-label={t("upload.removePhoto", "Remove photo")}
                onClick={() => remove(i)}
                disabled={locked}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-30 max-sm:opacity-100"
              >
                <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>

              {value.length > 1 && (
                <div className="absolute inset-x-1 bottom-1 flex justify-between opacity-0 transition-opacity duration-200 group-hover:opacity-100 focus-within:opacity-100 max-sm:opacity-100">
                  <button
                    type="button"
                    aria-label={t("upload.moveEarlier", "Move photo earlier")}
                    onClick={() => move(i, -1)}
                    disabled={locked || i === 0}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-25"
                  >
                    <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden>
                      <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label={t("upload.moveLater", "Move photo later")}
                    onClick={() => move(i, 1)}
                    disabled={locked || i === value.length - 1}
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white disabled:opacity-25"
                  >
                    <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden>
                      <path d="M8 4l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {room > 0 && (
        <div
          role="button"
          tabIndex={locked ? -1 : 0}
          aria-controls={inputId}
          aria-disabled={locked}
          onClick={openPicker}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openPicker();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!locked) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (locked) return;
            const files = Array.from(e.dataTransfer.files ?? []);
            if (files.length) void upload(files);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 py-6 text-center transition-colors duration-200 ${
            dragging
              ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand)]/5"
              : "border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] hover:border-[color:var(--color-brand)]"
          } ${locked ? "pointer-events-none opacity-60" : ""}`}
        >
          {busy ? (
            <>
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-[color:var(--color-border)] border-t-[color:var(--color-brand)]" />
              <span className="text-[13px] font-medium">
                Uploading {Math.min(progress.done + 1, progress.total)} of {progress.total}…
              </span>
            </>
          ) : (
            <>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden className="text-[color:var(--color-text-subtle)]">
                <path d="M12 16V4m0 0L8 8m4-4l4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
              <span className="text-[13.5px] font-medium">
                Drag {max === 1 ? "a photo" : "photos"} here, or{" "}
                <span className="text-[color:var(--color-brand)] underline underline-offset-2">browse</span>
              </span>
              <span className="text-[11.5px] text-[color:var(--color-text-subtle)]">
                JPG, PNG, WebP or GIF · up to 10 MB each
                {max > 1
              ? " \u00b7 " +
                t("upload.nAdded", "{n}/{max} added", { n: value.length, max })
              : ""}
              </span>
            </>
          )}
        </div>
      )}

      {room === 0 && (
        <p className="text-[11.5px] text-[color:var(--color-text-subtle)]">
          That's the limit of {max}. Remove one to add another.
        </p>
      )}

      {hint && !error && (
        <p className="mt-1.5 text-[11.5px] text-[color:var(--color-text-subtle)]">{hint}</p>
      )}
      {error && <p className="mt-1.5 text-[12px] text-[color:var(--color-danger)]">{error}</p>}

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple={max > 1}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (files.length) void upload(files);
        }}
      />
    </div>
  );
}
