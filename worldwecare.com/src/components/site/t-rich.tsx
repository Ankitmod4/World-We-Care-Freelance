"use client";

/**
 * A translated sentence with something React-shaped inside it.
 *
 * WHY THIS EXISTS. Plenty of lines on this site are one sentence with
 * one word emphasised — "Showing posts from **Ireland** only",
 * "Waiting on **you@example.com**". The obvious way to write those is
 * to cut the sentence in half around the `<strong>`, which gives the
 * translator two fragments and no way to move the emphasised word to
 * where their language puts it. Russian and German both want it
 * somewhere English does not.
 *
 * So the whole sentence stays one string with a `{name}` in it, and
 * this fills the placeholder with a node instead of text. The
 * translator moves `{name}` wherever it belongs and the emphasis
 * follows it.
 *
 * UNFILLED PLACEHOLDERS ARE LEFT ALONE, exactly as `makeT` leaves
 * them — a translation that invents a `{total}` should show the
 * mistake, not swallow it.
 *
 * THE CALLER CALLS `t`, NOT THIS. An earlier version took the key and
 * the English and looked them up itself, which meant the only `t()`
 * call in the file was `t(k, english)` — a call site `i18n:extract`
 * cannot read, so none of these sentences would ever have reached the
 * catalogue. Taking the already-translated template puts a literal
 * `t("key", "English {name}")` at every call site, where the scanner
 * can see it.
 */

import { Fragment, type ReactNode } from "react";

export function TRich({
  text,
  vars,
}: {
  /** The translated template, placeholders intact: `t("k", "Hi {name}")`. */
  text: string;
  vars: Record<string, ReactNode>;
}) {
  const parts = text.split(/(\{\w+\})/g);
  return (
    <>
      {parts.map((piece, i) => {
        const m = /^\{(\w+)\}$/.exec(piece);
        if (m && m[1] in vars) return <Fragment key={i}>{vars[m[1]]}</Fragment>;
        return <Fragment key={i}>{piece}</Fragment>;
      })}
    </>
  );
}
