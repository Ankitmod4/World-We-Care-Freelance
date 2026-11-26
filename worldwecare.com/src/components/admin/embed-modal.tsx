"use client";

/**
 * Embed picker for the article editor.
 *
 * Replaces window.prompt so the author gets three things a prompt
 * can't give them: the list of supported providers, live validation as
 * they paste, and a real preview of what readers will see. An unusable
 * link is caught here rather than silently rendering as a bare link
 * after publish.
 *
 * Validation runs through the SAME `toEmbed` whitelist the renderer
 * uses, so the preview can't disagree with the published article.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toEmbed, EMBED_PROVIDERS } from "@/lib/embeds";

export function EmbedModal({
  open,
  onClose,
  onInsert,
}: {
  open: boolean;
  onClose: () => void;
  onInsert: (url: string) => void;
}) {
  const [url, setUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const info = useMemo(() => toEmbed(url), [url]);
  const touched = url.trim().length > 0;

  useEffect(() => {
    if (!open) return;
    setUrl("");
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const insert = () => {
    if (!info) return;
    onInsert(url.trim());
    onClose();
  };

  return (
    // Bottom sheet on phones, centred dialog from sm: up — the modal
    // pattern DESIGN_RULES rule 2 asks for.
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Embed a link"
        className="w-full max-w-lg rounded-t-2xl bg-[color:var(--color-surface)] p-4 shadow-elevated sm:rounded-2xl sm:p-5"
      >
        <h2 className="text-[17px] font-semibold tracking-[-0.01em]">Embed a link</h2>
        <p className="mt-1 text-[12.5px] text-[color:var(--color-text-muted)]">
          Paste a link from {EMBED_PROVIDERS}.
        </p>

        <label className="mt-4 block">
          <span className="mb-1 block text-[12px] font-medium text-[color:var(--color-text-muted)]">
            Link
          </span>
          <Input
            ref={inputRef}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && info) {
                e.preventDefault();
                insert();
              }
            }}
            placeholder="https://www.youtube.com/watch?v=…"
          />
        </label>

        {/* Live feedback — provider on success, a plain reason on failure. */}
        {touched && (
          <p
            className={`mt-2 text-[12.5px] ${
              info ? "text-[color:var(--color-brand)]" : "text-[color:var(--color-danger)]"
            }`}
          >
            {info
              ? `${info.provider} detected`
              : "That link isn't from a supported provider — it would publish as a plain link."}
          </p>
        )}

        {info && (
          <div className="mt-3 overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)]">
            {info.kind === "video" ? (
              <div className="relative aspect-video w-full bg-black">
                <iframe
                  src={info.src}
                  title={info.title}
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
                  allowFullScreen
                  className="absolute inset-0 h-full w-full"
                />
              </div>
            ) : (
              <iframe
                src={info.src}
                title={info.title}
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                allow="clipboard-write; encrypted-media"
                style={{ height: info.height ?? 166 }}
                className="w-full border-0"
              />
            )}
          </div>
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={insert} disabled={!info}>
            Insert embed
          </Button>
        </div>
      </div>
    </div>
  );
}
