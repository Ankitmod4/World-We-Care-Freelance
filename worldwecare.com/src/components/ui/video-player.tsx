"use client";

/**
 * Video player.
 *
 * Built on a plain <video> rather than a library: the whole surface is
 * one MP4 with a poster, which is the case every player ships in its
 * first 5 KB, and a dependency would drag in a stylesheet to fight with
 * the design tokens.
 *
 * iOS notes, which is where players usually break:
 *  • `playsInline` — without it Safari on iPhone hijacks playback into
 *    its own fullscreen player and none of these controls exist.
 *  • `webkitEnterFullscreen` on the video element is the only
 *    fullscreen iOS Safari honours; the Fullscreen API on a wrapper
 *    div silently does nothing.
 *  • `preload="metadata"` so the duration is known without pulling the
 *    whole file over cellular.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/components/site/locale-context";
import { clockDuration } from "@/lib/duration";

interface IosVideo extends HTMLVideoElement {
  webkitEnterFullscreen?: () => void;
  webkitSupportsPresentationMode?: boolean;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function VideoPlayer({
  src,
  poster,
  width,
  height,
  className,
  autoPlay,
  loop,
  muted: initialMuted,
  aspect = "16 / 9",
  maxHeight,
}: {
  src: string;
  poster?: string | null;
  /**
   * Intrinsic dimensions. NOT used for sizing — see `aspect` — only to
   * decide whether the frame needs a backdrop behind a letterboxed
   * video.
   */
  width?: number | null;
  height?: number | null;
  className?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  /**
   * The frame's aspect ratio, FIXED regardless of the video inside it.
   *
   * Sizing the frame to each video's own dimensions made the feed jump
   * around — a portrait phone clip is more than twice the height of a
   * landscape one, so every card was a different size and the page
   * reflowed as clips loaded. The frame is constant and the video is
   * letterboxed into it with `object-contain`, over a blurred copy of
   * its own poster so the bars read as deliberate rather than broken.
   */
  aspect?: string;
  /**
   * Optional ceiling on the frame's height, as a CSS length — "70vh",
   * "480px". Without it a 16:9 frame in a wide container is enormous:
   * a 1200px-wide modal is 675px tall before the caption, which on a
   * laptop fills the screen. The WIDTH is what shrinks, so the ratio
   * still holds exactly and nothing gets pillarboxed.
   */
  maxHeight?: string;
}) {
  const t = useT();
  const videoRef = useRef<HTMLVideoElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [muted, setMuted] = useState(!!initialMuted);
  const [volume, setVolume] = useState(1);
  const [speed, setSpeed] = useState(1);
  const [speedOpen, setSpeedOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [started, setStarted] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [scrubbing, setScrubbing] = useState(false);

  // A video narrower than its frame gets bars; fill them with a
  // blurred copy of the poster rather than flat black.
  const letterboxed = !!(width && height && Math.abs(width / height - 16 / 9) > 0.01);

  // Turn "16 / 9" into 1.777… so a height ceiling can be expressed as
  // a width one. Anything unparseable falls back to widescreen rather
  // than producing a NaN in the stylesheet.
  const aspectNumber = (() => {
    const [w, h] = aspect.split("/").map((part) => Number(part.trim()));
    return Number.isFinite(w) && Number.isFinite(h) && h > 0 ? w / h : 16 / 9;
  })();

  /* ── control visibility ─────────────────────────────────── */
  const showControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      // Never hide while paused — a paused video with no controls looks
      // like a broken image.
      if (videoRef.current && !videoRef.current.paused) setControlsVisible(false);
    }, 2600);
  }, []);

  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);

  /* ── element wiring ─────────────────────────────────────── */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onTime = () => { if (!scrubbing) setCurrent(v.currentTime); };
    const onDuration = () => setDuration(Number.isFinite(v.duration) ? v.duration : 0);
    const onPlay = () => { setPlaying(true); setStarted(true); showControls(); };
    const onPause = () => { setPlaying(false); setControlsVisible(true); };
    const onWaiting = () => setWaiting(true);
    const onPlaying = () => setWaiting(false);
    const onError = () => { setFailed(true); setWaiting(false); };
    const onProgress = () => {
      if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
    };
    const onVolume = () => { setMuted(v.muted); setVolume(v.volume); };

    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onDuration);
    v.addEventListener("durationchange", onDuration);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("waiting", onWaiting);
    v.addEventListener("playing", onPlaying);
    v.addEventListener("error", onError);
    v.addEventListener("progress", onProgress);
    v.addEventListener("volumechange", onVolume);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onDuration);
      v.removeEventListener("durationchange", onDuration);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("waiting", onWaiting);
      v.removeEventListener("playing", onPlaying);
      v.removeEventListener("error", onError);
      v.removeEventListener("progress", onProgress);
      v.removeEventListener("volumechange", onVolume);
    };
  }, [scrubbing, showControls]);

  useEffect(() => {
    const onFs = () => setFullscreen(document.fullscreenElement === shellRef.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  /* ── actions ────────────────────────────────────────────── */
  const toggle = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => setFailed(true));
    else v.pause();
  }, []);

  const seekBy = useCallback((delta: number) => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(v.duration)) return;
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + delta));
    showControls();
  }, [showControls]);

  const seekTo = useCallback((fraction: number) => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(v.duration) || v.duration <= 0) return;
    const t = Math.max(0, Math.min(1, fraction)) * v.duration;
    v.currentTime = t;
    setCurrent(t);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const shell = shellRef.current;
    const v = videoRef.current as IosVideo | null;
    if (!shell || !v) return;
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {});
      return;
    }
    if (shell.requestFullscreen) {
      void shell.requestFullscreen().catch(() => {
        v.webkitEnterFullscreen?.();
      });
    } else {
      // iOS Safari on iPhone: the only route is the video element's own.
      v.webkitEnterFullscreen?.();
    }
  }, []);

  const togglePip = useCallback(async () => {
    const v = videoRef.current;
    if (!v || !document.pictureInPictureEnabled) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await v.requestPictureInPicture();
    } catch {
      /* browser refused — nothing useful to say */
    }
  }, []);

  /* ── keyboard ───────────────────────────────────────────── */
  const onKeyDown = (e: React.KeyboardEvent) => {
    const key = e.key;
    if (key === " " || key === "k") { e.preventDefault(); toggle(); }
    else if (key === "ArrowRight") { e.preventDefault(); seekBy(5); }
    else if (key === "ArrowLeft") { e.preventDefault(); seekBy(-5); }
    else if (key === "l") seekBy(10);
    else if (key === "j") seekBy(-10);
    else if (key === "m") { const v = videoRef.current; if (v) v.muted = !v.muted; }
    else if (key === "f") { e.preventDefault(); toggleFullscreen(); }
    else if (/^[0-9]$/.test(key)) seekTo(Number(key) / 10);
    showControls();
  };

  /* ── scrubbing ──────────────────────────────────────────── */
  const barRef = useRef<HTMLDivElement>(null);
  const fractionFromEvent = (clientX: number): number => {
    const rect = barRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return (clientX - rect.left) / rect.width;
  };

  const played = duration > 0 ? current / duration : 0;
  const bufferedPct = duration > 0 ? Math.min(1, buffered / duration) : 0;

  const iconBtn =
    "flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition-colors duration-200 hover:bg-white/15 hover:text-white focus-visible:bg-white/15";

  return (
    <div
      ref={shellRef}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseMove={showControls}
      onMouseLeave={() => { if (playing) setControlsVisible(false); }}
      style={
        fullscreen
          ? undefined
          : {
              aspectRatio: aspect,
              ...(maxHeight
                ? {
                    // Cap the height by capping the width, so the box
                    // keeps its exact ratio instead of going letterbox.
                    width: `min(100%, calc(${maxHeight} * ${aspectNumber}))`,
                    marginInline: "auto",
                  }
                : null),
            }
      }
      className={`group relative w-full overflow-hidden rounded-2xl bg-black outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-brand)] ${
        fullscreen ? "h-full rounded-none" : ""
      } ${className ?? ""}`}
    >
      {poster && letterboxed && !fullscreen && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 scale-110 bg-cover bg-center opacity-40 blur-2xl"
          style={{ backgroundImage: `url(${JSON.stringify(poster)})` }}
        />
      )}

      <video
        ref={videoRef}
        src={src}
        poster={poster ?? undefined}
        preload="metadata"
        playsInline
        autoPlay={autoPlay}
        loop={loop}
        muted={initialMuted}
        onClick={toggle}
        onDoubleClick={toggleFullscreen}
        className="relative h-full w-full object-contain"
      />

      {/* Centre play — the affordance people actually look for. */}
      {!playing && !failed && (
        <button
          type="button"
          onClick={toggle}
          aria-label={t("player.play", "Play")}
          className="absolute inset-0 flex items-center justify-center"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur transition-transform duration-200 hover:scale-105">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M8 5.5v13l11-6.5-11-6.5z" />
            </svg>
          </span>
        </button>
      )}

      {waiting && !failed && (
        <span className="pointer-events-none absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 animate-spin rounded-full border-[3px] border-white/25 border-t-white" />
      )}

      {failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 px-6 text-center">
          <p className="text-[14px] font-medium text-white">
            {t("player.failed", "This video could not be played.")}
          </p>
          <button
            type="button"
            onClick={() => { setFailed(false); videoRef.current?.load(); }}
            className="rounded-full border border-white/30 px-3 py-1.5 text-[12.5px] font-medium text-white hover:bg-white/10"
          >
            {t("common.tryAgain", "Try again")}
          </button>
        </div>
      )}

      {/* ── controls ─────────────────────────────────────── */}
      <div
        className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-2.5 pb-2 pt-8 transition-opacity duration-200 ${
          controlsVisible || !started ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        {/* seek bar */}
        <div
          ref={barRef}
          role="slider"
          aria-label={t("player.seek", "Seek")}
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(current)}
          tabIndex={0}
          onPointerDown={(e) => {
            (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            setScrubbing(true);
            const f = fractionFromEvent(e.clientX);
            setCurrent(f * duration);
          }}
          onPointerMove={(e) => {
            if (!scrubbing) return;
            const f = fractionFromEvent(e.clientX);
            setCurrent(Math.max(0, Math.min(1, f)) * duration);
          }}
          onPointerUp={(e) => {
            if (!scrubbing) return;
            setScrubbing(false);
            seekTo(fractionFromEvent(e.clientX));
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") { e.preventDefault(); seekBy(5); }
            if (e.key === "ArrowLeft") { e.preventDefault(); seekBy(-5); }
          }}
          className="group/bar relative mx-1 cursor-pointer py-2"
        >
          <div className="h-1 w-full overflow-hidden rounded-full bg-white/25">
            <div className="h-full bg-white/30" style={{ width: `${bufferedPct * 100}%` }} />
          </div>
          <div
            className="pointer-events-none absolute inset-x-0 top-2 h-1 rounded-full bg-[color:var(--color-brand)]"
            style={{ width: `${Math.max(0, Math.min(1, played)) * 100}%` }}
          />
          <span
            className="pointer-events-none absolute top-2 -ml-1.5 h-1 w-3 -translate-y-1/4 rounded-full bg-white opacity-0 transition-opacity duration-150 group-hover/bar:opacity-100"
            style={{ left: `${Math.max(0, Math.min(1, played)) * 100}%`, height: 12, width: 12, marginTop: -4, borderRadius: 9999 }}
          />
        </div>

        <div className="flex items-center gap-1">
          <button type="button" onClick={toggle} aria-label={playing ? t("player.pause", "Pause") : t("player.play", "Play")} className={iconBtn}>
            {playing ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M8 5.5v13l11-6.5-11-6.5z" />
              </svg>
            )}
          </button>

          <div className="flex items-center">
            <button
              type="button"
              onClick={() => { const v = videoRef.current; if (v) v.muted = !v.muted; }}
              aria-label={muted ? t("player.unmute", "Unmute") : t("player.mute", "Mute")}
              className={iconBtn}
            >
              {muted || volume === 0 ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M4 9v6h3.5L12 19V5L7.5 9H4z" fill="currentColor" />
                  <path d="M16 9.5l4 5m0-5l-4 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M4 9v6h3.5L12 19V5L7.5 9H4z" fill="currentColor" />
                  <path d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              aria-label={t("player.volume", "Volume")}
              onChange={(e) => {
                const v = videoRef.current;
                if (!v) return;
                const next = Number(e.target.value);
                v.volume = next;
                v.muted = next === 0;
              }}
              className="hidden h-1 w-16 cursor-pointer accent-white sm:block"
            />
          </div>

          <span className="ml-1 select-none text-[12px] tabular-nums text-white/85">
            {clockDuration(current)} <span className="text-white/45">/ {clockDuration(duration)}</span>
          </span>

          <div className="ml-auto flex items-center gap-1">
            <div className="relative">
              <button
                type="button"
                onClick={() => setSpeedOpen((o) => !o)}
                aria-label={t("player.speed", "Playback speed")}
                aria-expanded={speedOpen}
                className={`${iconBtn} w-auto px-2 text-[12px] font-semibold tabular-nums`}
              >
                {speed}×
              </button>
              {speedOpen && (
                <div
                  role="menu"
                  className="absolute bottom-11 right-0 z-10 w-20 overflow-hidden rounded-xl bg-black/90 py-1 backdrop-blur"
                >
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      role="menuitemradio"
                      aria-checked={s === speed}
                      onClick={() => {
                        const v = videoRef.current;
                        if (v) v.playbackRate = s;
                        setSpeed(s);
                        setSpeedOpen(false);
                      }}
                      className={`block w-full px-3 py-1.5 text-left text-[12.5px] tabular-nums ${
                        s === speed ? "font-semibold text-white" : "text-white/70 hover:text-white"
                      }`}
                    >
                      {s}×
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button type="button" onClick={togglePip} aria-label={t("player.pip", "Picture in picture")} className={`${iconBtn} hidden sm:flex`}>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
                <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
                <rect x="12" y="11" width="7" height="6" rx="1.5" fill="currentColor" />
              </svg>
            </button>

            <button type="button" onClick={toggleFullscreen} aria-label={t("player.fullscreen", "Fullscreen")} className={iconBtn}>
              {fullscreen ? (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
