"use client";

/**
 * Member-written text, in the reader's language.
 *
 * ── WHY A QUEUE AND NOT A FETCH PER ITEM ──
 *
 * A feed screen mounts twenty post bodies at once. Twenty requests
 * would be twenty round trips and twenty Google calls; one request
 * with twenty references is one of each. So every mounted instance
 * drops its reference into a module-level queue, a short timer closes
 * the batch, and one request answers all of them.
 *
 * ── THE ORIGINAL IS ALWAYS WHAT RENDERS FIRST ──
 *
 * No spinner, no skeleton, no empty box. Until the translation
 * arrives — and if it never arrives, because there is no API key, or
 * the reader is on English, or Google is down — what shows is the
 * sentence somebody actually wrote. A translation is an improvement
 * on that, never a precondition for it.
 *
 * ── AND IT IS ALWAYS ONE CLICK AWAY ──
 *
 * Machine translation of something personal gets things wrong in ways
 * that matter here more than most places. "Show original" is not a
 * power-user affordance; it is how a reader checks what a person
 * meant. It appears only once a translation is actually showing, so it
 * never advertises a feature that did nothing.
 *
 * ── THE CACHE IS PER PAGE LOAD ──
 *
 * Keyed by reference AND locale, so switching language re-asks rather
 * than showing the last language's answer. The server has the durable
 * cache; this one only stops a scroll-back from re-requesting.
 */

import { useEffect, useState } from "react";
import { useLocale, useT } from "./locale-context";
import { DEFAULT_LOCALE } from "@/lib/i18n-core";
import type { ContentKind } from "@/lib/content-kinds";

export type { ContentKind } from "@/lib/content-kinds";

interface Ref {
  kind: ContentKind;
  id: string;
  field: string;
}

const keyOf = (r: Ref, locale: string) => `${locale}|${r.kind}:${r.id}:${r.field}`;

/* ── the batching queue ──────────────────────────────────────── */

type Listener = (value: string | null) => void;

const cache = new Map<string, string | null>();
const waiting = new Map<string, Set<Listener>>();
let pending: Array<{ ref: Ref; locale: string }> = [];
/**
 * What one request may carry — the same number the route accepts.
 * The two have to agree: the server silently drops the overflow, so
 * a client that posts more than this loses the difference without an
 * error to notice. See the note in `flush`.
 */
const PER_REQUEST = 60;
let timer: ReturnType<typeof setTimeout> | null = null;

function deliver(key: string, value: string | null) {
  cache.set(key, value);
  const set = waiting.get(key);
  if (!set) return;
  waiting.delete(key);
  for (const fn of set) fn(value);
}

async function flush() {
  timer = null;
  const batch = pending;
  pending = [];
  if (!batch.length) return;

  // One request per locale, though in practice a page only ever has
  // one. Grouping is defensive: a mismatched locale in the same batch
  // would be answered in the wrong language.
  const byLocale = new Map<string, Ref[]>();
  for (const item of batch) {
    const list = byLocale.get(item.locale) ?? [];
    list.push(item.ref);
    byLocale.set(item.locale, list);
  }

  for (const [locale, all] of byLocale) {
    /*
      SENT IN CHUNKS THE SERVER WILL ACTUALLY READ.

      The route takes the first `PER_REQUEST` references and drops the
      rest — rightly, since it is a public endpoint that spends money.
      But this side used to post the whole queue in one body, so
      anything past that line vanished with no error anywhere: the
      request succeeded, the response was missing those keys, and the
      components resolved to null and went on showing English.

      It bites exactly where a screen mounts a lot at once — a chat
      room is thirty messages plus the room name plus every room in
      the sidebar, and "Load earlier" adds thirty more — which is why
      the thing that looked broken was always the busiest page.

      Chunking here rather than raising the cap there keeps the
      server's limit meaningful against a caller that is not this one.
    */
    for (let i = 0; i < all.length; i += PER_REQUEST) {
      const refs = all.slice(i, i + PER_REQUEST);
      let values: Record<string, string> = {};
      try {
        const res = await fetch("/api/user/translate-content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refs }),
        });
        if (res.ok) {
          const d = (await res.json()) as { values?: Record<string, string> };
          values = d.values ?? {};
        }
      } catch {
        // Leave `values` empty: every reference in this chunk resolves
        // to null and every component keeps showing its original.
      }
      for (const r of refs) {
        const got = values[`${r.kind}:${r.id}:${r.field}`];
        deliver(keyOf(r, locale), typeof got === "string" && got ? got : null);
      }
    }
  }
}

function request(ref: Ref, locale: string, fn: Listener): () => void {
  const key = keyOf(ref, locale);
  if (cache.has(key)) {
    fn(cache.get(key)!);
    return () => {};
  }
  const set = waiting.get(key);
  if (set) {
    set.add(fn);
    return () => set.delete(fn);
  }
  waiting.set(key, new Set([fn]));
  pending.push({ ref, locale });
  // 30ms is long enough for a list to finish mounting and short enough
  // that nobody reads an untranslated post first.
  if (!timer) timer = setTimeout(() => void flush(), 30);
  return () => waiting.get(key)?.delete(fn);
}

/* ── the hook ────────────────────────────────────────────────── */

/**
 * The translated text, or null while there isn't one.
 *
 * Callers that render their own markup — a post body that needs
 * `whitespace-pre-wrap`, a room name inside a link — use this and
 * decide for themselves. `<TranslatedContent>` below is the common
 * case wrapped up.
 */
export function useTranslatedContent(
  kind: ContentKind,
  id: string,
  field: string,
  original: string,
): TranslationState {
  const { locale } = useLocale();
  const [value, setValue] = useState<string | null>(null);
  const [wantOriginal, setWantOriginal] = useState(false);

  const off = locale === DEFAULT_LOCALE || !id || !original.trim();

  useEffect(() => {
    /*
      DROP THE LAST LANGUAGE'S ANSWER FIRST.

      `router.refresh()` re-renders the server's half of the page but
      deliberately keeps client state, which is what makes switching
      language feel instant instead of a reload. The cost is that this
      `value` survives the switch — so going Russian → English hit the
      `off` early-return below with the Russian text still in state,
      and the post stayed Russian on an English page until somebody
      reloaded. Half the screen changed and half did not, because the
      half that changed was server-rendered.

      Clearing on every change of locale or reference fixes both
      directions: English keeps the original (there is nothing to
      fetch), and Russian → Spanish shows the original for the moment
      before the Spanish arrives rather than the Russian it replaces.
    */
    setValue(null);
    if (off) return;
    let live = true;
    const cancel = request({ kind, id, field }, locale, (v) => {
      if (live) setValue(v);
    });
    return () => {
      live = false;
      cancel();
    };
  }, [off, kind, id, field, locale]);

  // A translation identical to the original is not a translation; the
  // post was already in this language. Showing "Show original" on it
  // would be a button that does nothing.
  const usable = value && value.trim() !== original.trim() ? value : null;
  const showing = usable && !wantOriginal ? "translation" : "original";

  return {
    text: showing === "translation" ? usable! : original,
    textOriginal: original,
    translated: !!usable,
    showing,
    toggle: () => setWantOriginal((v) => !v),
  };
}

/* ── the toggle, on its own ──────────────────────────────────── */

export interface TranslationState {
  text: string;
  /** Always the text as written, whichever is being shown. */
  textOriginal: string;
  translated: boolean;
  showing: "original" | "translation";
  toggle: () => void;
}

/**
 * "Show original" for callers that render the text themselves.
 *
 * A post body goes through `RichText` (links, mentions, line breaks),
 * so it cannot be wrapped by `<TranslatedContent>` — it takes the
 * text from the hook and puts this underneath.
 *
 * Renders NOTHING when there is no translation showing, which is the
 * whole point: an English reader, a post already in their language,
 * or a platform with no API key all get a card with no stray link on
 * it.
 */
export function TranslationToggle({
  state,
  className,
}: {
  state: TranslationState;
  className?: string;
}) {
  const t = useT();
  if (!state.translated) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        state.toggle();
      }}
      className={
        className ??
        "text-[12.5px] font-medium text-[color:var(--color-text-subtle)] underline underline-offset-2 hover:text-[color:var(--color-text-muted)]"
      }
    >
      {state.showing === "translation"
        ? t("content.showOriginal", "Show original")
        : t("content.showTranslation", "Show translation")}
    </button>
  );
}

/* ── the component ───────────────────────────────────────────── */

export function TranslatedContent({
  kind,
  id,
  field = "body",
  text,
  className,
  toggle = true,
}: {
  kind: ContentKind;
  id: string;
  field?: string;
  text: string;
  className?: string;
  /** Off for short labels — a room name does not need a link under it. */
  toggle?: boolean;
}) {
  const t = useT();
  const c = useTranslatedContent(kind, id, field, text);

  if (!c.translated || !toggle) return <span className={className}>{c.text}</span>;

  return (
    <span className={className}>
      {c.text}{" "}
      <button
        type="button"
        onClick={(e) => {
          // These sit inside cards that are themselves links.
          e.preventDefault();
          e.stopPropagation();
          c.toggle();
        }}
        className="text-[12px] font-medium text-[color:var(--color-text-subtle)] underline underline-offset-2 hover:text-[color:var(--color-text-muted)]"
      >
        {c.showing === "translation"
          ? t("content.showOriginal", "Show original")
          : t("content.showTranslation", "Show translation")}
      </button>
    </span>
  );
}
