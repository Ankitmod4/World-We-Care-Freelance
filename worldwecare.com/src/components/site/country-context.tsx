"use client";

import { createContext, useContext } from "react";

export interface CountryOption {
  id: string;
  name: string;
  code: string;
  slug: string;
  emojiFlag: string | null;
}

interface CountryCtx {
  countries: CountryOption[];
  countryId: string | null;
  country: CountryOption | null;
  setCountryId: (id: string | null) => void;
  ready: boolean;
}

/**
 * Active country + the setter, provided by SiteShell.
 * Consumers use `useCountry()` — feed calls it to pass countryId
 * into /api/user/posts/feed, country-scoped pages read it, etc.
 *
 * Defaults kept safe (empty array, no selection) so components can
 * still render before the shell mounts, without a runtime error.
 */
export const CountryContext = createContext<CountryCtx>({
  countries: [],
  countryId: null,
  country: null,
  setCountryId: () => {},
  ready: false,
});

export function useCountry() {
  return useContext(CountryContext);
}
