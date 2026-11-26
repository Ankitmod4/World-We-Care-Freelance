"use client";

/**
 * The language icon in the header.
 *
 * NEXT TO THE COUNTRY PICKER, and shaped exactly like it: a line-art
 * icon when nothing has been chosen, a tinted pill with the language's
 * own name once something has. Two controls that answer "where am I
 * and how do I read" belong together and should not be two different
 * kinds of control.
 *
 * THE LIST SHOWS EACH LANGUAGE IN ITSELF — "Espanol", not "Spanish".
 * Somebody looking for their own language is scanning for the word
 * they would use for it, not the English one. The English name rides
 * along underneath for the case where a member is setting the phone
 * up for somebody else.
 *
 * HIDDEN ENTIRELY WHEN ONLY ENGLISH IS LIVE. A picker with one option
 * is a control that cannot do anything, and this site will run
 * English-only until somebody switches a language on in the admin.
 *
 * THE CHOICE IS A COOKIE, not an account setting: it has to work
 * before anyone signs in, which is exactly when somebody is deciding
 * whether this site is for them.
 *
 * ── TWO SHAPES, BECAUSE A POPOVER CANNOT LIVE IN THE PHONE MENU ──
 *
 * In the header this is an icon with a menu hanging off it. In the
 * phone menu that shape was broken and looked it: the row sits inside
 * a card with `overflow-hidden`, nested inside the sheet's own
 * scrolling area, so an absolutely-positioned list was clipped twice
 * over — what reached the screen was a sliver of one language lying
 * across "Sign out". No z-index fixes that; a clip is a clip.
 *
 * So `variant="row"` renders no popover at all. It is a full-width
 * row that expands a list beneath it, exactly like the country picker
 * directly above it in that same menu — the whole row is the target,
 * the list grows the card, and the sheet scrolls it into view the way
 * it scrolls everything else.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useT } from "./locale-context";

export interface PickerLocale {
  code: string;
  name: string;
  nativeName: string;
  direction: "LTR" | "RTL";
}

/*
 * NOT RE-EXPORTED FROM HERE, and that is the point.
 *
 * This file is a client module. When a Server Component imports a
 * plain VALUE from one, Next hands it a client-reference proxy rather
 * than the value — so a root layout that read the cookie name from
 * here looked up a cookie by the wrong name, found nothing, and fell
 * back to English on every request however many times somebody picked
 * a language. It type-checked perfectly.
 *
 * The constant lives in `@/lib/i18n-core`, which has no "use client",
 * and both sides import it from there. `npm run check:boundary`
 * fails the build if anything crosses back.
 */
import { LOCALE_COOKIE } from "@/lib/i18n-core";

export function LanguagePicker({
  variant = "icon",
}: {
  /** `row` is the phone menu — see the note above. */
  variant?: "icon" | "row";
} = {}) {
  const { locales, locale: current } = useLocale();
  const t = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // The row variant is part of the page, not floating above it, so
    // it dismisses the way the country picker beside it does: by
    // being pressed again, or by choosing something.
    if (!open || variant === "row") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    // pointerdown, not click: a click listener fires after the
    // button's own handler has toggled it back open.
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, variant]);

  // One language is English. Nothing to pick.
  if (locales.length < 2) return null;

  const active = locales.find((l) => l.code === current) ?? locales[0];
  const chosen = active.code !== "en";

  const choose = (code: string) => {
    // A year, and site-wide. SameSite=Lax so it survives arriving from
    // a shared link, which is how most people reach this site.
    document.cookie = `${LOCALE_COOKIE}=${encodeURIComponent(code)};path=/;max-age=31536000;samesite=lax`;
    setOpen(false);
    // The server renders the text, so the page has to come from the
    // server again. `refresh` re-renders in place rather than
    // reloading, so scroll position and open panels survive.
    router.refresh();
  };

  const options = locales.map((l) => {
    const on = l.code === active.code;
    return (
      <li key={l.code}>
        <button
          type="button"
          role="option"
          aria-selected={on}
          onClick={() => choose(l.code)}
          dir={l.direction === "RTL" ? "rtl" : "ltr"}
          className={
            "flex min-h-11 w-full items-center gap-2 px-3.5 py-2.5 text-start text-[14px] transition-colors hover:bg-[color:var(--color-surface-muted)] " +
            (on ? "font-semibold text-[color:var(--color-brand)]" : "")
          }
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate">{l.nativeName}</span>
            {l.nativeName !== l.name && (
              <span className="block truncate text-[11.5px] font-normal text-[color:var(--color-text-subtle)]">
                {l.name}
              </span>
            )}
          </span>
          {on && (
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden className="shrink-0">
              <path d="M4 10.5l4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </li>
    );
  });

  if (variant === "row") {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="listbox"
          className="flex min-h-12 w-full items-center justify-between gap-3 px-3.5 text-left"
        >
          <span className="text-[14px] text-[color:var(--color-text-muted)]">
            {t("menu.language", "Language")}
          </span>
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[14px] font-semibold">{active.nativeName}</span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 20 20"
              fill="none"
              aria-hidden
              className={
                "shrink-0 text-[color:var(--color-text-subtle)] transition-transform duration-200 " +
                (open ? "rotate-180" : "")
              }
            >
              <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </button>
        {open && (
          <ul
            role="listbox"
            aria-label={t("common.language", "Language")}
            className="max-h-56 overflow-y-auto border-t border-[color:var(--color-border-soft)] py-1"
          >
            {options}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={chosen ? `Language: ${active.nativeName}. Change` : "Choose language"}
        aria-expanded={open}
        aria-haspopup="listbox"
        title={active.nativeName}
        className={
          "inline-flex items-center rounded-full transition-colors duration-200 " +
          (chosen
            ? "min-h-9 gap-1.5 bg-[color:var(--color-brand)]/10 px-2.5 text-[13px] font-medium text-[color:var(--color-brand)] hover:bg-[color:var(--color-brand)]/15"
            : "min-h-11 min-w-11 justify-center text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-muted)] hover:text-[color:var(--color-text)]") +
          (open && !chosen ? " bg-[color:var(--color-surface-muted)] text-[color:var(--color-text)]" : "")
        }
      >
        {chosen ? (
          <span className="max-w-[9rem] truncate">{active.nativeName}</span>
        ) : (
          <TranslateIcon />
        )}
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={t("common.language", "Language")}
          className="absolute end-0 top-[calc(100%+6px)] z-40 max-h-[60vh] w-60 overflow-y-auto rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] py-1 shadow-elevated"
        >
          {options}
        </ul>
      )}
    </div>
  );
}

/** The standard translate glyph — two scripts and an arrow. */
function TranslateIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 5h9M8.5 5v1.5c0 3-1.9 5.6-4.5 6.5M6 9.5c.8 2 2.4 3.6 4.5 4.3"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.5 20l4-9 4 9M14 17.2h5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
