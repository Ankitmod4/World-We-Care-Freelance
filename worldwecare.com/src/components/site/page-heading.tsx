/**
 * A page's title and the sentence under it.
 *
 * This is the no-image branch of what used to be `PageBanner`, kept
 * verbatim — the same markup, the same sizes, the same `{country}`
 * substitution. The photo, the gradient, the admin screen that let
 * somebody upload one and the `page_banners` table behind it are all
 * gone; what is left is the heading those pages had before any of that
 * existed, and it is prop-driven exactly as before.
 *
 * ── THE COPY IS IN THE CODE AGAIN ──
 *
 * The banner system's whole purpose was that the words lived in the
 * database so a non-developer could rewrite them without a deploy.
 * With it removed, each page passes its own title and intro, and they
 * go through `t()` like every other interface string — LITERAL keys,
 * so the extractor can see them. A computed key (`t(\`page.${x}Title\`)`)
 * typechecks, runs, and is invisible to extraction, which means the
 * string can never be translated into anything.
 *
 * NO HOOKS, AND SO NOT "use client". It takes strings that are already
 * translated, which means it needs no locale context — and that is what
 * lets /articles, the one server-rendered page of the set, compose it
 * with `await getT()` exactly the way the client pages compose it with
 * `useT`. A version that called the hook itself would have forced that
 * page to grow a client wrapper for a heading.
 */

/**
 * Substitute `{country}` and tidy up after it.
 *
 * With a country: " in Ireland". Without: nothing at all — and the
 * space in front of the token has to go with it, or the sentence reads
 * "Ask for something to change , and see who else wants it."
 *
 * Runs on the TRANSLATED sentence, not before it, or every language
 * would read "... in Ireland" in English word order.
 */
export function fillIntro(text: string, country: string | null | undefined): string {
  return text
    .replace(/\s*\{country\}/g, country ? ` in ${country}` : "")
    .replace(/\s+([,.!?])/g, "$1")
    .trim();
}

export function PageHeading({
  title,
  intro,
  country,
  actions,
  note,
}: {
  /** Already translated by the caller, via a literal `t()` key. */
  title: string;
  /** Likewise. May still contain `{country}`; filled below. */
  intro?: string;
  /** From useCountry, where the page has it. */
  country?: string | null;
  /** Buttons that used to sit beside the title — "Submit an event". */
  actions?: React.ReactNode;
  /** A third line some pages carry, e.g. the live count or a notice. */
  note?: React.ReactNode;
}) {
  const line = intro ? fillIntro(intro, country) : "";

  return (
    <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{title}</h1>
        {line && (
          <p className="mt-0.5 max-w-[62ch] text-[13.5px] text-[color:var(--color-text-muted)]">
            {line}
          </p>
        )}
        {note && <p className="mt-2 text-[12px] text-[color:var(--color-text-subtle)]">{note}</p>}
      </div>
      {actions}
    </header>
  );
}
