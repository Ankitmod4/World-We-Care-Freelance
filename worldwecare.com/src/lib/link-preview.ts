/**
 * Minimal Open-Graph link preview fetcher. Server-only.
 *
 * Safety: only http(s), a short timeout, a response-size cap, and a
 * block-list for localhost / private ranges so it can't be used to
 * probe the internal network (basic SSRF guard).
 */

export interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h === "localhost" ||
    h === "::1" ||
    h.endsWith(".local") ||
    /^127\./.test(h) ||
    /^10\./.test(h) ||
    /^192\.168\./.test(h) ||
    /^169\.254\./.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
    /^0\./.test(h)
  );
}

function meta(html: string, key: string): string | undefined {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`, "i"),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) return decode(m[1].trim());
  }
  return undefined;
}

function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export async function fetchLinkPreview(rawUrl: string): Promise<LinkPreview | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (isPrivateHost(url.hostname)) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "WorldWeCareBot/1.0 (+link-preview)", Accept: "text/html" },
    });
    clearTimeout(timer);
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html")) return { url: url.toString() };
    const html = (await res.text()).slice(0, 300_000);

    const title = meta(html, "og:title") ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
    return {
      url: url.toString(),
      title: title ? decode(title) : undefined,
      description: meta(html, "og:description") ?? meta(html, "description"),
      image: meta(html, "og:image"),
      siteName: meta(html, "og:site_name") ?? url.hostname.replace(/^www\./, ""),
    };
  } catch {
    return null;
  }
}
