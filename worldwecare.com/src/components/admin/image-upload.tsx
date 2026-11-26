"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Img } from "@/components/ui/img";

/**
 * Compact image uploader.
 *
 * Empty state: dashed drop zone with icon + call-to-action. Accepts
 * both click-to-select and drag-drop.
 *
 * Filled state: image fills the frame. Hovering (or focusing) the
 * frame reveals a translucent overlay with Replace + Remove buttons
 * — clearer than a text link floating above the label.
 *
 * Sizing: `min-h-[160px]` instead of `aspect-square` so content
 * never gets clipped when the caller uses tight max widths.
 */
export function ImageUpload({
  value,
  onChange,
  category,
  label,
  hint,
  accept = "image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon",
  aspect = "wide",
}: {
  value: string;
  onChange: (next: string) => void;
  category: string;
  label: string;
  hint?: string;
  accept?: string;
  aspect?: "square" | "wide";
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploadedName, setUploadedName] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("category", category);
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        url?: string;
        error?: string;
      };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Upload failed");
      } else {
        onChange(data.url);
        setUploadedName(file.name);
      }
    } catch {
      setError("Network error");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const openPicker = () => inputRef.current?.click();

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div>
      <label className="block text-[13px] font-medium mb-1.5">{label}</label>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />

      {value ? (
        // ── FILLED STATE ──────────────────────────────────────────
        <div
          className={cn(
            "group relative rounded-[14px] overflow-hidden bg-[color:var(--color-surface-muted)]",
            "border border-[color:var(--color-border)]",
            aspect === "square"
              ? "aspect-square max-w-[200px]"
              : "aspect-[16/7] max-w-[320px]",
          )}
        >
          <Img
            src={value}
            alt=""
            className="w-full h-full object-contain p-3"
          />
          {/* Hover overlay — subtle blur + two clear actions */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={openPicker}
              className="h-9 px-3.5 rounded-[10px] bg-[color:var(--color-surface)] text-[color:var(--color-text)] text-[13px] font-medium hover:bg-[color:var(--color-surface-hover)] transition-colors shadow-[var(--shadow-card)]"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={() => {
                onChange("");
                setUploadedName(null);
              }}
              className="h-9 px-3.5 rounded-[10px] bg-[color:var(--color-danger)] text-[color:var(--color-on-danger)] text-[13px] font-medium hover:brightness-95 transition-all shadow-[var(--shadow-card)]"
            >
              Remove
            </button>
          </div>
          {/* Uploading spinner overlay */}
          {uploading && (
            <div className="absolute inset-0 frost flex items-center justify-center">
              <span
                aria-hidden
                className="inline-block h-6 w-6 rounded-full border-[3px] border-[color:var(--color-brand-soft)] border-t-[color:var(--color-brand)] animate-spin"
              />
            </div>
          )}
        </div>
      ) : (
        // ── EMPTY STATE ───────────────────────────────────────────
        <button
          type="button"
          onClick={openPicker}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={cn(
            "w-full rounded-[14px] border-2 border-dashed transition-all",
            "flex flex-col items-center justify-center gap-2 px-4 py-6 min-h-[160px]",
            aspect === "square" ? "max-w-[200px]" : "max-w-[320px]",
            dragOver
              ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-soft)] scale-[1.01]"
              : "border-[color:var(--color-border)] hover:border-[color:var(--color-brand)] hover:bg-[color:var(--color-brand-tint)]",
            uploading && "opacity-70 pointer-events-none",
          )}
        >
          <span
            className={cn(
              "flex items-center justify-center h-10 w-10 rounded-full",
              dragOver
                ? "bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)]"
                : "bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand)]",
              "transition-colors",
            )}
          >
            {uploading ? (
              <span
                aria-hidden
                className="inline-block h-4 w-4 rounded-full border-[2px] border-current border-t-transparent animate-spin"
              />
            ) : (
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
                <path
                  d="M10 3v10m0 0l-3.5-3.5M10 13l3.5-3.5M4 16h12"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </span>
          <div className="text-center">
            <p className="text-[13.5px] font-medium text-[color:var(--color-text)]">
              {uploading
                ? "Uploading…"
                : dragOver
                  ? "Drop to upload"
                  : "Click or drop a file"}
            </p>
            {hint && (
              <p className="text-[11.5px] text-[color:var(--color-text-subtle)] mt-1">
                {hint}
              </p>
            )}
          </div>
        </button>
      )}

      {/* Metadata line under the frame */}
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[11.5px]">
        {error ? (
          <p className="text-[color:var(--color-danger)]">{error}</p>
        ) : value ? (
          <p className="text-[color:var(--color-text-subtle)] truncate">
            {uploadedName ?? deriveNameFromUrl(value)}
          </p>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}

function deriveNameFromUrl(url: string): string {
  try {
    const last = url.split("/").pop() ?? url;
    return last;
  } catch {
    return url;
  }
}
