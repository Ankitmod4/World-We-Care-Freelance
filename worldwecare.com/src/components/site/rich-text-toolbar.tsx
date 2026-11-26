"use client";

import type { ReactNode, RefObject } from "react";
import { cn } from "@/lib/utils";
import { useT } from "./locale-context";

/**
 * Bold / Italic / Strikethrough toolbar shared by the gratitude and
 * confession composers (the feed composer has its own inline copy).
 * Wraps the textarea's current selection with markdown syntax and keeps
 * focus + selection intact. Rendering is handled by <RichText/>.
 */
export function RichTextToolbar({
  textareaRef,
  value,
  onChange,
  className,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
  className?: string;
}) {
  const t = useT();
  const surround = (before: string, after: string, placeholder: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? value.length;
    const end = ta.selectionEnd ?? value.length;
    const sel = value.slice(start, end) || placeholder;
    onChange(value.slice(0, start) + before + sel + after + value.slice(end));
    requestAnimationFrame(() => {
      ta.focus();
      const s = start + before.length;
      ta.setSelectionRange(s, s + sel.length);
    });
  };

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      <FmtButton label={t("composer.bold", "Bold")} onClick={() => surround("**", "**", t("fmt.boldText", "bold text"))}>
        <span className="font-bold text-[13px]">B</span>
      </FmtButton>
      <FmtButton label={t("composer.italic", "Italic")} onClick={() => surround("*", "*", t("fmt.italicText", "italic text"))}>
        <span className="italic text-[13px] font-serif">I</span>
      </FmtButton>
      <FmtButton
        label={t("composer.strikethrough", "Strikethrough")}
        onClick={() => surround("~~", "~~", t("fmt.strikeText", "strikethrough"))}
      >
        <span className="line-through text-[13px]">S</span>
      </FmtButton>
    </div>
  );
}

function FmtButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="h-8 min-w-8 px-1.5 inline-flex items-center justify-center rounded-[8px] text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-muted)] hover:text-[color:var(--color-text)] transition-colors"
    >
      {children}
    </button>
  );
}
