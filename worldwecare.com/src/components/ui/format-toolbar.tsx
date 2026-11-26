"use client";

/**
 * Compact formatting toolbar for member-facing textareas.
 *
 * The admin editor's toolbar carries uploads, embeds and an overflow
 * menu — too much for a submission dialog, and it drags the embed
 * machinery into the member bundle. This is the short list someone
 * writing an event description actually reaches for: headings,
 * bold/italic, lists, a quote and a link.
 *
 * Every action goes through the shared caret helpers, so a click with
 * nothing selected inserts a placeholder *and selects it* — the next
 * keystroke replaces it, which is what makes a toolbar faster than
 * typing the syntax by hand.
 *
 * The buttons are labelled H1/H2/H3 because that is what people look
 * for, and they emit `#`/`##`/`###` — which the renderer in
 * src/lib/rich-text.tsx turns into `<h2>`/`<h3>`/`<h4>`, since the page
 * has already spent its only `<h1>` on the event title. It stops
 * recognising headings past `####`, so three levels is the whole
 * useful range anyway.
 */

import {
  insertBlockAt,
  prefixSelectedLines,
  wrapSelection,
} from "@/lib/markdown-edit";
import { useT } from "@/components/site/locale-context";

type Ref = React.RefObject<HTMLTextAreaElement | null>;

export function FormatToolbar({
  textareaRef,
  value,
  onChange,
  disabled,
}: {
  textareaRef: Ref;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const t = useT();
  const apply = (r: { next: string; selStart: number; selEnd: number }) => {
    onChange(r.next);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(r.selStart, r.selEnd);
    });
  };

  const surround = (before: string, after: string, placeholder: string) => {
    const el = textareaRef.current;
    if (!el) return;
    apply(wrapSelection(value, el.selectionStart, el.selectionEnd, before, after, placeholder));
  };

  const prefixLines = (prefix: string | ((i: number) => string), placeholder: string) => {
    const el = textareaRef.current;
    if (!el) return;
    apply(prefixSelectedLines(value, el.selectionStart, el.selectionEnd, prefix, placeholder));
  };

  const insertBlock = (text: string) => {
    const el = textareaRef.current;
    if (!el) return;
    apply(insertBlockAt(value, el.selectionStart, el.selectionEnd, text));
  };

  const btn =
    "inline-flex h-8 min-w-8 items-center justify-center rounded-[8px] px-1.5 text-[12.5px] font-semibold text-[color:var(--color-text-muted)] transition-colors duration-200 hover:bg-[color:var(--color-surface-hover)] hover:text-[color:var(--color-text)] active:scale-[0.98] disabled:opacity-40";
  const divider = <span className="mx-0.5 h-4 w-px shrink-0 bg-[color:var(--color-border)]" aria-hidden />;

  return (
    <div className="flex flex-wrap items-center gap-0.5">
      <button
        type="button"
        disabled={disabled}
        className={btn}
        title={t("fmt.h1", "Big heading")}
        aria-label={t("fmt.h1", "Big heading")}
        onClick={() => prefixLines("# ", t("fmt.headingText", "Heading"))}
      >
        H1
      </button>
      <button
        type="button"
        disabled={disabled}
        className={btn}
        title={t("fmt.h2", "Medium heading")}
        aria-label={t("fmt.h2", "Medium heading")}
        onClick={() => prefixLines("## ", t("fmt.headingText", "Heading"))}
      >
        H2
      </button>
      <button
        type="button"
        disabled={disabled}
        className={btn}
        title={t("fmt.h3", "Small heading")}
        aria-label={t("fmt.h3", "Small heading")}
        onClick={() => prefixLines("### ", t("fmt.headingText", "Heading"))}
      >
        H3
      </button>

      {divider}

      <button
        type="button"
        disabled={disabled}
        className={`${btn} font-bold`}
        title={t("composer.bold", "Bold")}
        aria-label={t("composer.bold", "Bold")}
        onClick={() => surround("**", "**", "bold text")}
      >
        B
      </button>
      <button
        type="button"
        disabled={disabled}
        className={`${btn} italic`}
        title={t("composer.italic", "Italic")}
        aria-label={t("composer.italic", "Italic")}
        onClick={() => surround("*", "*", "italic text")}
      >
        I
      </button>

      {divider}

      <button
        type="button"
        disabled={disabled}
        className={btn}
        title={t("fmt.bullets", "Bullet list")}
        aria-label={t("fmt.bullets", "Bullet list")}
        onClick={() => prefixLines("- ", t("fmt.listItem", "List item"))}
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
          <circle cx="4" cy="6" r="1.3" fill="currentColor" />
          <circle cx="4" cy="10" r="1.3" fill="currentColor" />
          <circle cx="4" cy="14" r="1.3" fill="currentColor" />
          <path d="M8 6h9M8 10h9M8 14h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      <button
        type="button"
        disabled={disabled}
        className={btn}
        title={t("fmt.numbers", "Numbered list")}
        aria-label={t("fmt.numbers", "Numbered list")}
        onClick={() => prefixLines((i) => `${i + 1}. `, t("fmt.firstItem", "First item"))}
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M8 6h9M8 10h9M8 14h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <text x="1.5" y="8" fontSize="6" fill="currentColor">1</text>
          <text x="1.5" y="16" fontSize="6" fill="currentColor">2</text>
        </svg>
      </button>
      <button
        type="button"
        disabled={disabled}
        className={btn}
        title={t("fmt.quote", "Quote")}
        aria-label={t("fmt.quote", "Quote")}
        onClick={() => prefixLines("> ", t("fmt.quoteText", "Something worth quoting"))}
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M4 5v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M8 7h9M8 11h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      {divider}

      <button
        type="button"
        disabled={disabled}
        className={btn}
        title={t("fmt.link", "Link")}
        aria-label={t("fmt.link", "Link")}
        onClick={() => surround("[", "](https://)", "link text")}
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M8.5 11.5a3 3 0 004.2 0l2.3-2.3a3 3 0 10-4.2-4.2l-1 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M11.5 8.5a3 3 0 00-4.2 0L5 10.8a3 3 0 104.2 4.2l1-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      <button
        type="button"
        disabled={disabled}
        className={btn}
        title={t("fmt.divider", "Divider")}
        aria-label={t("fmt.divider", "Divider")}
        onClick={() => insertBlock("---")}
      >
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M3 10h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
