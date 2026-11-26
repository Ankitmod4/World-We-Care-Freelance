"use client";

/**
 * An HLS player for live broadcasts.
 *
 * Three things make this less trivial than <video src>:
 *
 *  1. SAFARI NEEDS NOTHING. iOS and macOS Safari play HLS natively,
 *     and on iOS that is the ONLY way — there is no Media Source
 *     Extensions support in the browser, so hls.js cannot work there.
 *     So: try native first, and only reach for the library when the
 *     browser can't do it itself.
 *
 *  2. THE LIBRARY LOADS LAZILY. hls.js is ~150KB. Fetching it on
 *     every page that might one day show a video is a cost paid by
 *     people who never watch one, so it is pulled in from a CDN the
 *     first time a non-Safari browser actually needs it.
 *
 *  3. THE MANIFEST ARRIVES LATE. A broadcaster clicks "Go live" and
 *     the manifest does not exist for a second or two. Attaching too
 *     early gives a 404 and a player stuck on an error, so this
 *     retries quietly and says "waiting for the stream" meanwhile —
 *     which is also what a viewer who arrives early should see.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "./locale-context";

const HLS_CDN = "https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js";
const RETRY_MS = 3000;

interface HlsInstance {
  loadSource: (url: string) => void;
  attachMedia: (el: HTMLMediaElement) => void;
  destroy: () => void;
  on: (event: string, cb: (e: unknown, data: { fatal?: boolean; type?: string }) => void) => void;
}
interface HlsCtor {
  new (config?: Record<string, unknown>): HlsInstance;
  isSupported: () => boolean;
  Events: { ERROR: string; MANIFEST_PARSED: string };
}

let loader: Promise<HlsCtor | null> | null = null;

function loadHls(): Promise<HlsCtor | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  const existing = (window as unknown as { Hls?: HlsCtor }).Hls;
  if (existing) return Promise.resolve(existing);
  if (loader) return loader;

  loader = new Promise<HlsCtor | null>((resolve) => {
    const script = document.createElement("script");
    script.src = HLS_CDN;
    script.async = true;
    script.onload = () => resolve((window as unknown as { Hls?: HlsCtor }).Hls ?? null);
    script.onerror = () => {
      // Let a later attempt try again rather than caching the failure
      // for the life of the page.
      loader = null;
      resolve(null);
    };
    document.head.appendChild(script);
  });
  return loader;
}

type State = "waiting" | "playing" | "error";

export function HlsPlayer({
  src,
  poster,
  className = "",
  muted = false,
  onState,
}: {
  /** The .m3u8 manifest. Null while the stream isn't live yet. */
  src: string | null;
  poster?: string | null;
  className?: string;
  muted?: boolean;
  onState?: (s: State) => void;
}) {
  const t = useT();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<HlsInstance | null>(null);
  const [state, setState] = useState<State>("waiting");

  const report = useCallback(
    (s: State) => { setState(s); onState?.(s); },
    [onState],
  );

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) { report("waiting"); return; }

    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const teardown = () => {
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };

    const attach = async () => {
      if (cancelled) return;

      // 1. Native first — required on iOS, and lighter everywhere else.
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = src;
        video.play().catch(() => undefined);
        return;
      }

      const Hls = await loadHls();
      if (cancelled) return;
      if (!Hls || !Hls.isSupported()) {
        report("error");
        return;
      }

      teardown();
      const hls = new Hls({
        // Live: stay near the edge rather than buffering a comfortable
        // distance behind, which on a broadcast reads as lag.
        lowLatencyMode: true,
        backBufferLength: 30,
      });
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (cancelled) return;
        report("playing");
        video.play().catch(() => undefined);
      });

      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (cancelled || !data?.fatal) return;
        // 3. A fatal error early on is usually "not started yet".
        teardown();
        report("waiting");
        retry = setTimeout(() => void attach(), RETRY_MS);
      });

      hls.loadSource(src);
      hls.attachMedia(video);
    };

    const onPlaying = () => report("playing");
    const onWaiting = () => report("waiting");
    const onNativeError = () => {
      report("waiting");
      retry = setTimeout(() => void attach(), RETRY_MS);
    };
    video.addEventListener("playing", onPlaying);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("error", onNativeError);

    void attach();

    return () => {
      cancelled = true;
      if (retry) clearTimeout(retry);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("error", onNativeError);
      teardown();
    };
  }, [src, report]);

  return (
    <div className={`relative overflow-hidden bg-[#0b0f10] ${className}`}>
      <video
        ref={videoRef}
        className="h-full w-full object-contain"
        playsInline
        controls
        muted={muted}
        poster={poster ?? undefined}
      />
      {state !== "playing" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6 text-center">
          <p className="text-[13.5px] text-white/70">
            {state === "error"
              ? t("live.cannotPlay", "This browser can\u2019t play the stream.")
              : src
                ? "Waiting for the stream…"
                : t("live.notLiveNow", "Not live right now.")}
          </p>
        </div>
      )}
    </div>
  );
}
