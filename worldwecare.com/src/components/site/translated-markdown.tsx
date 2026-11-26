"use client";

/**
 * A long body — an article, an event's details, a petition — in the
 * reader's language, with the way back to the original underneath.
 *
 * ── WHY THIS IS NOT JUST `<TranslatedContent>` ──
 *
 * That one renders text into a span. A body goes through `Markdown`,
 * which turns it into headings, lists and links, so the translation
 * has to be handed to that renderer rather than printed. The Markdown
 * survives translation because Google is being sent the source text,
 * not HTML — asterisks and brackets come back where they went in.
 *
 * ── AND WHY IT IS A COMPONENT RATHER THAN A HOOK CALL ──
 *
 * Half the pages that show a body are server components — the article
 * page, the event page — where no hook can run. Composing a client
 * component into a server one is ordinary; making those pages client
 * components to translate one paragraph would not be.
 *
 * THE TOGGLE IS ON, unlike titles and tab strips. A body is where a
 * machine translation is most likely to be subtly wrong, and where a
 * reader most needs to be able to check.
 */

import { Markdown, RichText } from "@/lib/rich-text";
import { TranslationToggle, useTranslatedContent } from "./translated-content";
import type { ContentKind } from "@/lib/content-kinds";

export function TranslatedMarkdown({
  kind,
  id,
  field = "body",
  text,
  className,
}: {
  kind: ContentKind;
  id: string;
  field?: string;
  text: string;
  className?: string;
}) {
  const body = useTranslatedContent(kind, id, field, text);
  return (
    <>
      <Markdown text={body.text} className={className} />
      {body.translated && (
        <p className="mt-2">
          <TranslationToggle state={body} />
        </p>
      )}
    </>
  );
}

/**
 * The same, for `RichText` — the lighter renderer used for things
 * people typed into a box rather than wrote in Markdown: post bodies,
 * comments, confessions, gratitude notes.
 *
 * Separate from the Markdown one rather than taking the renderer as a
 * prop, because a component that picks its renderer from a prop is a
 * component every call site has to think about, and there are forty
 * of them.
 */
export function TranslatedRichText({
  kind,
  id,
  field = "body",
  text,
  className,
  toggleClassName,
}: {
  kind: ContentKind;
  id: string;
  field?: string;
  text: string;
  className?: string;
  /** The toggle sits in a tight row of controls on some cards. */
  toggleClassName?: string;
}) {
  const body = useTranslatedContent(kind, id, field, text);
  return (
    <>
      <RichText text={body.text} className={className} />
      {body.translated && (
        <p className="mt-1">
          <TranslationToggle state={body} className={toggleClassName} />
        </p>
      )}
    </>
  );
}

/**
 * The same thing for a plain string — a title, a summary, a heading
 * that is not Markdown but still wants the toggle.
 */
export function TranslatedBlock({
  kind,
  id,
  field,
  text,
  className,
}: {
  kind: ContentKind;
  id: string;
  field: string;
  text: string;
  className?: string;
}) {
  const body = useTranslatedContent(kind, id, field, text);
  return (
    <>
      <span className={className}>{body.text}</span>
      {body.translated && <TranslationToggle state={body} />}
    </>
  );
}
