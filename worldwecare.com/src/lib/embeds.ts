/**
 * Embed resolution for article bodies and the article video field.
 *
 * SECURITY: only whitelisted hosts ever become an <iframe>. Dropping an
 * arbitrary author-supplied URL into an iframe src is a clickjacking /
 * drive-by vector, so anything unrecognised is rendered as a plain link
 * instead. IDs are additionally restricted to [A-Za-z0-9_-] so a crafted
 * path can't smuggle query params or a different origin into the src.
 */

export interface EmbedInfo {
  /** Fully-qualified, safe iframe src. */
  src: string;
  provider: string;
  /** Videos size by aspect ratio; audio players have a fixed height. */
  kind: "video" | "audio";
  /** Pixel height for audio embeds. */
  height?: number;
  title: string;
  /**
   * A poster image, where the provider exposes one from the id alone.
   * Only YouTube does without an API call; everything else gets a
   * placeholder rather than a network round trip at render time.
   */
  thumbnail?: string;
}

const ID = /^[A-Za-z0-9_-]+$/;

function safeId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const id = raw.trim();
  return ID.test(id) ? id : null;
}

export function toEmbed(raw: string | null | undefined): EmbedInfo | null {
  if (!raw?.trim()) return null;
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;

  const host = u.hostname.replace(/^www\./, "");
  const parts = u.pathname.split("/").filter(Boolean);

  // ── YouTube ──
  if (host === "youtu.be") {
    const id = safeId(parts[0]);
    return id
      ? {
          src: `https://www.youtube.com/embed/${id}`,
          provider: "YouTube",
          kind: "video",
          title: "YouTube video",
          thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        }
      : null;
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    let id: string | null = null;
    if (u.pathname === "/watch") id = safeId(u.searchParams.get("v"));
    else if (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live") id = safeId(parts[1]);
    return id
      ? {
          src: `https://www.youtube.com/embed/${id}`,
          provider: "YouTube",
          kind: "video",
          title: "YouTube video",
          thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
        }
      : null;
  }

  // ── Vimeo ──
  if (host === "vimeo.com") {
    const id = safeId(parts[0]);
    return id && /^\d+$/.test(id)
      ? { src: `https://player.vimeo.com/video/${id}`, provider: "Vimeo", kind: "video", title: "Vimeo video" }
      : null;
  }
  if (host === "player.vimeo.com" && parts[0] === "video") {
    const id = safeId(parts[1]);
    return id
      ? { src: `https://player.vimeo.com/video/${id}`, provider: "Vimeo", kind: "video", title: "Vimeo video" }
      : null;
  }

  // ── Loom ──
  if (host === "loom.com" && (parts[0] === "share" || parts[0] === "embed")) {
    const id = safeId(parts[1]);
    return id
      ? { src: `https://www.loom.com/embed/${id}`, provider: "Loom", kind: "video", title: "Loom recording" }
      : null;
  }

  // ── Dailymotion ──
  if (host === "dailymotion.com" || host === "dai.ly") {
    const id = safeId(host === "dai.ly" ? parts[0] : parts[parts[0] === "embed" ? 2 : 1]);
    return id
      ? { src: `https://www.dailymotion.com/embed/video/${id}`, provider: "Dailymotion", kind: "video", title: "Dailymotion video" }
      : null;
  }

  // ── Spotify ── (track/episode are short players; the rest are tall)
  if (host === "open.spotify.com") {
    const type = parts[0];
    const id = safeId(parts[1]);
    const allowed = ["track", "album", "playlist", "episode", "show", "artist"];
    if (!id || !allowed.includes(type)) return null;
    return {
      src: `https://open.spotify.com/embed/${type}/${id}`,
      provider: "Spotify",
      kind: "audio",
      height: type === "track" || type === "episode" ? 152 : 352,
      title: "Spotify player",
    };
  }

  // ── SoundCloud ── (the widget takes the original URL as a param)
  if (host === "soundcloud.com") {
    return {
      src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(u.toString())}&color=%230ea5e9&hide_related=true&show_comments=false&show_teaser=false`,
      provider: "SoundCloud",
      kind: "audio",
      height: 166,
      title: "SoundCloud player",
    };
  }

  return null;
}

/** Providers we can embed — surfaced in the editor's help text. */
export const EMBED_PROVIDERS = "YouTube, Vimeo, Loom, Dailymotion, Spotify, SoundCloud";
