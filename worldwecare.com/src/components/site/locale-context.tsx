"use client";

/**
 * The active language, available anywhere without threading props.
 *
 * SET ONCE IN THE ROOT LAYOUT, from the cookie, on the server. The
 * header is a client component several levels below a shell that is
 * used by sixty pages; passing the locale down by prop would mean
 * touching every one of those call sites to deliver something that
 * never changes within a render. Context is the right shape for a
 * value that is global, read-only and decided before anything paints.
 *
 * The same reason the country picker has one.
 *
 * THE MESSAGES RIDE ALONG. A client component cannot await a database
 * read, so the only way `t()` works in one is for the strings to be
 * in the payload already. That sounds expensive and is not: for an
 * English reader `messages` is `{}` — English lives at the call site,
 * never in the map — so the overwhelmingly common case ships nothing
 * at all, and a translated reader ships a few hundred short strings
 * once per document rather than per component.
 */

import { createContext, useContext, useMemo } from "react";
import { makeT, type TFunction } from "@/lib/i18n-core";
import type { PickerLocale } from "./language-picker";

interface LocaleValue {
  locale: string;
  direction: "LTR" | "RTL";
  locales: PickerLocale[];
  messages: Record<string, string>;
}

const Ctx = createContext<LocaleValue>({
  locale: "en",
  direction: "LTR",
  locales: [],
  messages: {},
});

export function LocaleProvider({
  value,
  children,
}: {
  value: LocaleValue;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocale(): LocaleValue {
  return useContext(Ctx);
}

/**
 * `t()` for client components.
 *
 * Same signature as the server's, deliberately: a component that
 * moves across the boundary should not have to have its strings
 * rewritten to come with it.
 */
export function useT(): TFunction {
  const { messages } = useContext(Ctx);
  return useMemo(() => makeT(messages), [messages]);
}
