"use client";

import { useEffect, useState } from "react";
import { Img } from "@/components/ui/img";

interface Preview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

/** Finds the first http(s) URL in a block of text. */
export function firstUrl(text: string): string | null {
  const m = text.match(/(https?:\/\/[^\s<]+)/i);
  return m ? m[1].replace(/[.,)\]]+$/, "") : null;
}

/** Fetches an Open-Graph preview for a URL and renders a card.
 *  Renders nothing while loading or if there's no usable preview. */
export function LinkPreview({ url }: { url: string }) {
  const [preview, setPreview] = useState<Preview | null>(null);

  useEffect(() => {
    let alive = true;
    setPreview(null);
    fetch(`/api/user/link-preview?url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((d) => { if (alive) setPreview(d.preview ?? null); })
      .catch(() => {});
    return () => { alive = false; };
  }, [url]);

  if (!preview || (!preview.title && !preview.description && !preview.image)) return null;

  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 block overflow-hidden rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] hover:border-[color:var(--color-border-strong)] transition-colors max-w-sm"
    >
      {preview.image && (
        <Img src={preview.image} alt="" className="w-full h-32 object-cover bg-[color:var(--color-surface-muted)]" />
      )}
      <div className="p-2.5">
        {preview.siteName && (
          <p className="text-[10.5px] uppercase tracking-[0.06em] text-[color:var(--color-text-subtle)]">{preview.siteName}</p>
        )}
        {preview.title && <p className="text-[13px] font-semibold tracking-[-0.01em] line-clamp-2">{preview.title}</p>}
        {preview.description && (
          <p className="text-[12px] text-[color:var(--color-text-muted)] line-clamp-2 mt-0.5">{preview.description}</p>
        )}
      </div>
    </a>
  );
}
