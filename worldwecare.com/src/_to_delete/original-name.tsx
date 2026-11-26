"use client";

/**
 * The name as it is actually written, under a translated one.
 *
 * ── THE ONE FIELD WHERE BEING WRONG HAS SOMEWHERE TO WALK TO ──
 *
 * Place names are translated, by decision. The cost of that decision
 * is concrete rather than theoretical: "The Grove Centre" is painted
 * on the door, printed on the leaflet and filed in every map, so a
 * member who sets out with "Центр Роща" on their phone is carrying a
 * name that matches nothing at the other end. Every other translated
 * string on this site is read and then done with; this one gets
 * walked to.
 *
 * So the translation leads — it is what the page is for — and the
 * original follows it in small type, the way a bilingual street sign
 * works. Nobody has to press anything, because somebody standing
 * outside the wrong building is not in a position to go looking for a
 * toggle.
 *
 * It renders NOTHING when there is no translation showing: an English
 * reader, or a name Google left alone, gets one heading and no
 * repetition of it.
 */

import type { TranslationState } from "./translated-content";

export function OriginalName({
  state,
  className,
}: {
  state: TranslationState;
  className?: string;
}) {
  if (!state.translated || state.showing === "original") return null;
  return (
    <p
      className={
        "mt-1 text-[13px] " + (className ?? "text-[color:var(--color-text-subtle)]")
      }
    >
      {state.text === state.textOriginal ? null : state.textOriginal}
    </p>
  );
}
