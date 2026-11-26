/**
 * Central source of truth for `<title>`, `<meta description>`, and
 * favicon across the app.
 *
 * Reads from platform_settings so an admin edit to General → Site
 * name flows into every page's title tag on the next render (the
 * settings cache is 30s TTL).
 *
 * Root layout uses `getSiteMetadata()` in its `generateMetadata` so:
 *   • Pages that don't set a title show `siteName`.
 *   • Pages that do set a title show `Page title - siteName` via
 *     the template.
 *   • The favicon is picked up from general.faviconUrl if set,
 *     otherwise falls back to the default /favicon.ico.
 */

import type { Metadata } from "next";
import { getSetting } from "./settings";

export async function getSiteMetadata(): Promise<Metadata> {
  const [siteName, description, faviconUrl] = await Promise.all([
    getSetting<string>("general.siteName", "WorldWeCare"),
    getSetting<string>(
      "general.description",
      "A community platform where people who need help and people who want to help find each other.",
    ),
    getSetting<string>("general.faviconUrl", ""),
  ]);

  return {
    title: {
      // Bare visits (no per-page title) show the site name.
      default: siteName,
      // "%s" gets replaced with whatever a child page's title is.
      // Format matches the user's spec: `Page - SITENAME`.
      template: `%s - ${siteName}`,
    },
    description,
    // Only override the default favicon when the admin uploaded one.
    icons: faviconUrl
      ? {
          icon: faviconUrl,
        }
      : undefined,
  };
}

/**
 * Read just the site name — for pages that want to bake it into
 * body copy (e.g. login screens saying "Sign in to <siteName>").
 */
export async function getSiteName(): Promise<string> {
  return getSetting<string>("general.siteName", "WorldWeCare");
}
