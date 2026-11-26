"use client";

/**
 * Formatting toolbar for the article body textarea.
 *
 * Operates directly on the textarea's selection so the cursor lands
 * somewhere sensible after every action — wrapping keeps the selected
 * text selected, inserting a placeholder selects the placeholder so the
 * next keystroke replaces it. Without that, a toolbar is slower than
 * just typing the syntax.
 *
 * The image button uploads through the same /api/admin/upload endpoint
 * as the cover picker and inserts the Markdown for you.
 */

import { useEffect, useRef, useState } from "react";
import { EMBED_PROVIDERS } from "@/lib/embeds";
import {
  insertBlockAt,
  prefixSelectedLines,
  wrapSelection,
  type EditResult,
} from "@/lib/markdown-edit";
import { EmbedModal } from "./embed-modal";

type Ref = React.RefObject<HTMLTextAreaElement | null>;

// The caret arithmetic lives in @/lib/markdown-edit so the compact
// member toolbar shares it. Re-exported here because this module was
// the original home.
export type { EditResult };
export { wrapSelection, prefixSelectedLines, insertBlockAt };

interface ToolbarActions {
  surround: (before: string, after: string, placeholder: string) => void;
  prefixLines: (prefix: string | ((i: number) => string), placeholder: string) => void;
  insertBlock: (text: string) => void;
}

const TABLE_TEMPLATE = [
  "| Column | Column |",
  "| --- | --- |",
  "| Cell | Cell |",
  "| Cell | Cell |",
].join("\n");

const MORE_ITEMS: { label: string; hint: string; run: (a: ToolbarActions) => void }[] = [
  { label: "Heading 4", hint: "####", run: (a) => a.prefixLines("#### ", "Small heading") },
  { label: "Highlight", hint: "==text==", run: (a) => a.surround("==", "==", "highlighted") },
  { label: "Task list", hint: "- [ ]", run: (a) => a.prefixLines("- [ ] ", "Something to do") },
  { label: "Table", hint: "| a | b |", run: (a) => a.insertBlock(TABLE_TEMPLATE) },
  { label: "Inline code", hint: "`code`", run: (a) => a.surround("`", "`", "code") },
  { label: "Code block", hint: "```", run: (a) => a.insertBlock("```\ncode\n```") },
  { label: "Divider", hint: "---", run: (a) => a.insertBlock("---") },
  {
    label: "Image from URL",
    hint: "![]()",
    run: (a) => {
      const url = window.prompt("Image URL");
      if (url?.trim()) a.insertBlock(`![](${url.trim()})`);
    },
  },
];

export function MarkdownToolbar({
  textareaRef,
  value,
  onChange,
  uploadCategory = "articles",
}: {
  textareaRef: Ref;
  value: string;
  onChange: (next: string) => void;
  /** Bucket inserted images land in — "articles", "events", … */
  uploadCategory?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [embedOpen, setEmbedOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // The overflow menu opens on hover, but hover alone is dead on touch
  // and invisible to keyboards — so click toggles it and focus opens it
  // too. Escape and outside-click close it.
  useEffect(() => {
    if (!moreOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  /** Apply a change and restore focus + selection on the next tick. */
  const apply = (next: string, selStart: number, selEnd: number) => {
    onChange(next);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(selStart, selEnd);
    });
  };

  const surround = (before: string, after: string, placeholder: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const r = wrapSelection(value, el.selectionStart, el.selectionEnd, before, after, placeholder);
    apply(r.next, r.selStart, r.selEnd);
  };

  const prefixLines = (prefix: string | ((i: number) => string), placeholder: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const r = prefixSelectedLines(value, el.selectionStart, el.selectionEnd, prefix, placeholder);
    apply(r.next, r.selStart, r.selEnd);
  };

  const insertBlock = (text: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const r = insertBlockAt(value, el.selectionStart, el.selectionEnd, text);
    apply(r.next, r.selStart, r.selEnd);
  };

  const pickImage = async (file: File) => {
    setUploading(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("category", uploadCategory);
    const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
    const d = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    setUploading(false);
    if (!res.ok || !d.url) {
      setError(d.error ?? "Upload failed");
      return;
    }
    insertBlock(`![${file.name.replace(/\.[^.]+$/, "")}](${d.url})`);
  };

  const btn =
    "inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-[8px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-2 text-[12px] font-semibold text-[color:var(--color-text-muted)] transition-colors duration-200 hover:border-[color:var(--color-brand)] hover:text-[color:var(--color-text)] active:scale-[0.98] disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button type="button" className={btn} title="Heading 1" onClick={() => prefixLines("# ", "Main heading")}>
        H1
      </button>
      <button type="button" className={btn} title="Heading 2" onClick={() => prefixLines("## ", "Section heading")}>
        H2
      </button>
      <button type="button" className={btn} title="Heading 3" onClick={() => prefixLines("### ", "Subheading")}>
        H3
      </button>

      <span className="mx-0.5 h-5 w-px bg-[color:var(--color-border)]" aria-hidden />

      <button type="button" className={`${btn} font-bold`} title="Bold (**text**)" onClick={() => surround("**", "**", "bold text")}>
        B
      </button>
      <button type="button" className={`${btn} italic`} title="Italic (*text*)" onClick={() => surround("*", "*", "italic text")}>
        I
      </button>
      <button type="button" className={`${btn} line-through`} title="Strikethrough (~~text~~)" onClick={() => surround("~~", "~~", "strikethrough")}>
        S
      </button>
      <span className="mx-0.5 h-5 w-px bg-[color:var(--color-border)]" aria-hidden />

      <button type="button" className={btn} title="Bullet list" onClick={() => prefixLines("- ", "List item")}>
        • List
      </button>
      <button type="button" className={btn} title="Numbered list" onClick={() => prefixLines((i) => `${i + 1}. `, "First item")}>
        1. List
      </button>
      <button type="button" className={btn} title="Blockquote" onClick={() => prefixLines("> ", "A quote worth pulling out")}>
        &ldquo; Quote
      </button>

      <span className="mx-0.5 h-5 w-px bg-[color:var(--color-border)]" aria-hidden />

      <button type="button" className={btn} title="Link" onClick={() => surround("[", "](https://)", "link text")}>
        Link
      </button>
      <button
        type="button"
        className={btn}
        title="Upload an image and insert it"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
      >
        {uploading ? "Uploading…" : "Image"}
      </button>
      <button
        type="button"
        className={btn}
        title={`Embed a video or track (${EMBED_PROVIDERS})`}
        onClick={() => setEmbedOpen(true)}
      >
        Embed
      </button>

      {/* Overflow: the syntax you reach for less often. Every item here
          is syntax the reader actually renders — checked against
          src/lib/rich-text.tsx, so nothing publishes as literal text. */}
      <div
        ref={moreRef}
        className="relative"
        onMouseEnter={() => setMoreOpen(true)}
        onMouseLeave={() => setMoreOpen(false)}
      >
        <button
          type="button"
          className={btn}
          title="More formatting"
          aria-haspopup="menu"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((o) => !o)}
          onFocus={() => setMoreOpen(true)}
        >
          More
          <svg
            width="12"
            height="12"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden
            className={`transition-transform duration-200 ${moreOpen ? "rotate-180" : ""}`}
          >
            <path d="M5.5 8l4.5 4.5L14.5 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {moreOpen && (
          <div
            role="menu"
            className="absolute right-0 z-30 mt-1 w-56 rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-1.5 shadow-elevated"
          >
            {MORE_ITEMS.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  item.run({ surround, prefixLines, insertBlock });
                  setMoreOpen(false);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-[8px] px-2.5 py-2 text-left text-[13px] text-[color:var(--color-text-muted)] transition-colors duration-200 hover:bg-[color:var(--color-surface-hover)] hover:text-[color:var(--color-text)]"
              >
                <span>{item.label}</span>
                <span className="font-mono text-[11px] text-[color:var(--color-text-subtle)]">
                  {item.hint}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void pickImage(file);
        }}
      />

      {error && <span className="text-[12px] text-[color:var(--color-danger)]">{error}</span>}

      <EmbedModal
        open={embedOpen}
        onClose={() => setEmbedOpen(false)}
        onInsert={(url) => insertBlock(`@[embed](${url})`)}
      />
    </div>
  );
}
