"use client";

/**
 * Going live.
 *
 * The camera preview is local and starts immediately; publishing is a
 * deliberate second step. Someone about to broadcast to strangers
 * should see themselves, fix their hair and read the visibility line
 * before anything leaves the room.
 *
 * ── THE CONTROLS SIT ON THE PICTURE ──
 *
 * Mute and camera live over the video rather than in a toolbar
 * underneath it, for the same reason every video call puts them
 * there: the thing you check before hitting them is your own face,
 * and a control bar in a different part of the screen makes you look
 * away to answer "am I muted" — the one question this page must never
 * make anybody guess at.
 *
 * ── WHY NOT AUTO-PUBLISH ──
 *
 * A page that starts broadcasting the moment it loads means one
 * misclick puts a person's bedroom in front of an audience. Preview
 * first, then a button that says exactly what it does.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getLocalMedia, publish, StreamError, type StreamHandle } from "@/lib/whip";
import { LiveChat } from "./live-chat";
import { useT } from "./locale-context";
import { serverText } from "@/lib/i18n-core";

interface Ticket {
  streamId: string;
  slug: string;
  token: string;
  expiresAt: string;
  publishUrl: string;
  watchUrl: string;
  maxHeight: number;
  maxDurationMin: number;
  recording: boolean;
}

type Phase = "preview" | "starting" | "live" | "ended" | "error";

/**
 * The height the stage and the chat both take once they are side by
 * side. One constant, used twice — see the note at the stage.
 */
const STAGE_H = "lg:h-[min(calc(100dvh_-_13rem),620px)]";

export function BroadcastClient({
  slug,
  title,
  visibility,
  shareUrl,
}: {
  slug: string;
  title: string;
  visibility: "PUBLIC" | "UNLISTED";
  shareUrl: string;
}) {
  const t = useT();
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const handleRef = useRef<StreamHandle | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [phase, setPhase] = useState<Phase>("preview");
  const [error, setError] = useState<string | null>(null);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [recording, setRecording] = useState(false);
  const [viewers, setViewers] = useState(0);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const teardown = useCallback(async () => {
    await handleRef.current?.close().catch(() => undefined);
    handleRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  /* ── preview ───────────────────────────────────────────────── */

  const openCamera = useCallback(async () => {
    setError(null);
    try {
      const stream = await getLocalMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setPhase("preview");
    } catch (err) {
      setError(err instanceof StreamError ? err.message : t("broadcast.cameraFailed", "Couldn't start your camera."));
      setPhase("error");
    }
  }, []);

  useEffect(() => {
    void openCamera();
    return () => { void teardown(); };
    // Once. Retrying is a button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Closing the tab must free the camera light and the server path.
  useEffect(() => {
    const bye = () => { void teardown(); };
    window.addEventListener("pagehide", bye);
    return () => window.removeEventListener("pagehide", bye);
  }, [teardown]);

  /* ── viewers ───────────────────────────────────────────────── */

  useEffect(() => {
    if (phase !== "live") return;
    const tick = () =>
      void fetch(`/api/user/live/${slug}/viewers`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { viewers?: number } | null) => {
          if (typeof d?.viewers === "number") setViewers(d.viewers);
        })
        .catch(() => undefined);
    tick();
    const timer = setInterval(tick, 10_000);
    return () => clearInterval(timer);
  }, [phase, slug]);

  /* ── going live ────────────────────────────────────────────── */

  const goLive = async () => {
    const stream = streamRef.current;
    if (!stream) { await openCamera(); return; }

    setPhase("starting");
    setError(null);

    const res = await fetch(`/api/user/live/${slug}/start`, { method: "POST" }).catch(() => null);
    if (!res?.ok) {
      const d = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
      setError(serverText(t, d?.error) || t("broadcast.startFailed", "Couldn't start the broadcast."));
      setPhase("preview");
      return;
    }
    // Named `ticketRow`, not `t`: `t` is the translator now, and a
    // local shadow of it is a page that silently stops translating.
    const ticketRow = (await res.json()) as Ticket;
    setTicket(ticketRow);
    setRecording(ticketRow.recording);

    try {
      handleRef.current = await publish(ticketRow.publishUrl, ticketRow.token, stream);
    } catch (err) {
      setError(
        err instanceof StreamError
          ? err.message
          : t("broadcast.serverUnreachable", "Couldn't reach the streaming server."),
      );
      setPhase("preview");
      return;
    }

    // The WHIP POST succeeding is not the same as media arriving. Ask
    // the server to confirm with MediaMTX before anyone is told this
    // is live — a stream that says LIVE with nothing behind it shows
    // a black player to whoever clicks it.
    const confirmed = await confirmLive();
    if (!confirmed.live) {
      await handleRef.current?.close().catch(() => undefined);
      handleRef.current = null;
      // `problem` is the server saying what actually arrived — no
      // video, or a codec viewers can't play. Only fall back to the
      // generic network guess when nothing reached MediaMTX at all,
      // which is the case that guess was written for.
      setError(
        confirmed.problem ??
          t(
            "broadcast.noVideo",
            "Your camera connected but the streaming server never received any video. This is usually a blocked UDP port (8189) or a cross-origin rule on the media server.",
          ),
      );
      setPhase("preview");
      return;
    }
    setPhase("live");
  };

  /**
   * Poll the confirm endpoint for a few seconds.
   *
   * MediaMTX takes a moment to register a new publisher, so a single
   * check right after the handshake reports "no" on a broadcast that
   * is about to be perfectly fine.
   */
  const confirmLive = async (): Promise<{ live: boolean; problem?: string }> => {
    let problem: string | undefined;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const res = await fetch(`/api/user/live/${slug}/live`, { method: "POST" }).catch(() => null);
      if (res?.ok) {
        const d = (await res.json()) as { live?: boolean; problem?: string };
        if (d.live) return { live: true };
        // Keep the most recent explanation. A codec problem does not
        // resolve itself on the next poll, but the tracks can take a
        // moment to appear, so we keep polling and report at the end.
        if (d.problem) problem = d.problem;
      }
      await new Promise((r) => setTimeout(r, 1200));
    }
    return { live: false, problem };
  };

  const endBroadcast = async () => {
    if (
      !window.confirm(
        t("broadcast.endConfirm", "End this broadcast? Everyone watching will be disconnected."),
      )
    )
      return;
    setBusy(true);
    await fetch(`/api/user/live/${slug}/end`, { method: "POST" }).catch(() => undefined);
    await teardown();
    setBusy(false);
    setPhase("ended");
    router.push("/live");
  };


  const toggleMic = () => {
    const on = !micOn;
    streamRef.current?.getAudioTracks().forEach((t) => { t.enabled = on; });
    setMicOn(on);
  };
  const toggleCam = () => {
    const on = !camOn;
    streamRef.current?.getVideoTracks().forEach((t) => { t.enabled = on; });
    setCamOn(on);
  };

  const share = async () => {
    await navigator.clipboard?.writeText(shareUrl).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ── render ────────────────────────────────────────────────── */

  const liveNow = phase === "live";

  return (
    <div className="mx-auto w-full max-w-[1100px] px-3 py-4 sm:px-5 sm:py-6">
      {/*
       * Stage on the left, chat on the right from `lg` up.
       *
       * THE BROADCASTER NEEDS THIS MORE THAN THE VIEWER DOES. They
       * are the only person watching their own chat while it is
       * happening, and they are the one who can remove something from
       * it — a moderation control the owner cannot see during the
       * broadcast is not a moderation control.
       */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <div>
      {/*
        16:9 when the chat is stacked underneath, and the CHAT'S OWN
        HEIGHT once they sit side by side — two columns that end at
        different points look like one of them failed to load.

        `STAGE_H` is shared with the chat below rather than written
        twice: they only look deliberate while the two numbers agree,
        and two copies of a magic number is one copy and a future bug.

        Note the underscores. Tailwind turns them into spaces, and
        `calc()` REQUIRES the spaces around its operator — the version
        of this without them was invalid CSS, so the browser dropped
        the declaration and the height silently never applied.
      */}
      {/*
       * The stage and its controls are SIBLINGS, not parent and
       * child. On a phone the bar sits under the picture; from `sm`
       * up it floats on it. It cannot do both while it lives inside
       * an `overflow-hidden` box — CSS has no way to move a child out
       * of one — and rendering it twice would put two "Go live"
       * buttons in the accessibility tree.
       */}
      <div className="relative">
      <div
        className={`relative w-full overflow-hidden rounded-[14px] bg-[#0b0f10] shadow-card aspect-video lg:aspect-auto ${STAGE_H}`}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          // `contain`, not `cover`. While the stage was exactly 16:9
          // the two were identical; now that it is taller than the
          // camera's frame, `cover` would crop the sides — and a
          // preview that crops is showing the broadcaster something
          // different from what is going out, which is the one thing
          // a preview must never do.
          className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-200 ${
            camOn ? "opacity-100" : "opacity-0"
          }`}
        />

        {/* Camera off gets a face, not a void. */}
        {!camOn && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-[22px] font-semibold text-white/80 sm:h-20 sm:w-20 sm:text-[26px]">
              {title.trim().charAt(0).toUpperCase() || "?"}
            </span>
            <p className="text-[13px] text-white/60">{t("broadcast.cameraOff", "Your camera is off")}</p>
          </div>
        )}

        {/* ── state, top-right: the one thing you glance up to check ── */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-end gap-2 bg-gradient-to-b from-black/55 to-transparent p-3">
          {liveNow ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e5484d] px-2.5 py-1 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-white">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white motion-reduce:animate-none" aria-hidden />
                {t("nav.live", "Live")}
              </span>
              <span className="rounded-full bg-black/55 px-2.5 py-1 text-[12px] font-medium tabular-nums text-white backdrop-blur">
                {viewers} watching
              </span>
              {recording && (
                <span className="rounded-full bg-black/55 px-2.5 py-1 text-[12px] font-medium text-[#ff8f96] backdrop-blur">
                  {t("live.recording", "Recording")}
                </span>
              )}
            </>
          ) : (
            <span className="rounded-full bg-black/55 px-2.5 py-1 text-[12px] font-medium text-white/85 backdrop-blur">
              {t("broadcast.previewOnly", "Preview \u2014 nobody can see this yet")}
            </span>
          )}
        </div>

      </div>

        {/*
         * ── the controls ──
         *
         * ON THE PICTURE FROM `sm` UP, UNDER IT ON A PHONE. Overlaid,
         * this bar was covering roughly a fifth of a portrait video —
         * on the broadcaster's own preview, which is the one picture
         * they need to be able to see. There is empty page below it
         * and none to spare inside it.
         */}
        <div className="mt-2 flex flex-col items-center gap-2 sm:absolute sm:inset-x-0 sm:bottom-0 sm:mt-0 sm:bg-gradient-to-t sm:from-black/70 sm:to-transparent sm:px-3 sm:pb-4 sm:pt-10">
          {error && (
            <p
              role="alert"
              className="max-w-[62ch] rounded-[10px] bg-black/75 px-3 py-2 text-center text-[12.5px] leading-relaxed text-[#ff9aa1] backdrop-blur"
            >
              {error}
            </p>
          )}

          {/* On the page the black pill is invisible against a dark
              background, so it borrows a surface colour there and
              only goes black once it is over the video. */}
          <div className="flex items-center gap-1.5 rounded-full border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)] p-1.5 backdrop-blur sm:border-transparent sm:bg-black/55">
            <CircleButton
              label={
                micOn
                  ? t("broadcast.muteMic", "Mute your microphone")
                  : t("broadcast.unmuteMic", "Unmute your microphone")
              }
              pressed={!micOn}
              onClick={toggleMic}
              disabled={phase === "error"}
            >
              {micOn ? <MicIcon /> : <MicOffIcon />}
            </CircleButton>

            <CircleButton
              label={
                camOn
                  ? t("broadcast.camOff", "Turn your camera off")
                  : t("broadcast.camOn", "Turn your camera on")
              }
              pressed={!camOn}
              onClick={toggleCam}
              disabled={phase === "error"}
            >
              {camOn ? <CamIcon /> : <CamOffIcon />}
            </CircleButton>

            <CircleButton
              label={
                copied
                  ? t("campaignDetail.copied", "Link copied")
                  : t("broadcast.copyLink", "Copy the link to share")
              }
              onClick={() => void share()}
            >
              {copied ? <CheckIcon /> : <LinkIcon />}
            </CircleButton>

            <span className="mx-1 h-6 w-px bg-white/15" aria-hidden />

            {liveNow ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void endBroadcast()}
                className="inline-flex h-10 items-center rounded-full bg-[#e5484d] px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#d13840] disabled:opacity-60 sm:h-11 sm:px-5 sm:text-[14px]"
              >
                {t("live.end", "End")}
              </button>
            ) : (
              <button
                type="button"
                disabled={phase === "error" || phase === "starting"}
                onClick={() => void goLive()}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-[color:var(--color-brand)] px-4 text-[13.5px] font-semibold text-[color:var(--color-on-brand)] transition-colors hover:bg-[color:var(--color-brand-hover)] disabled:opacity-60 sm:h-11 sm:px-5 sm:text-[14px]"
              >
                {phase === "starting" && (
                  <span
                    className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none"
                    aria-hidden
                  />
                )}
                {phase === "starting" ? t("broadcast.connecting", "Connecting…") : t("live.goLive", "Go live")}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── below the player, like every video page you've used ── */}
      <div className="mt-4">
        <h1 className="text-[19px] font-semibold leading-snug tracking-[-0.02em] sm:text-[22px]">
          {title}
        </h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[color:var(--color-text-muted)]">
          <span>
            {visibility === "PUBLIC"
              ? t("broadcast.public", "Public — listed on Live while you're broadcasting")
              : t("broadcast.unlisted", "Unlisted — only people you send the link to")}
          </span>
          {liveNow && ticket && (
            <>
              <span aria-hidden>·</span>
              <span>
                {t("broadcast.endsAfter", "Ends automatically after {n} minutes", {
                  n: ticket.maxDurationMin,
                })}
              </span>
            </>
          )}
        </p>

        <p className="mt-3 max-w-[70ch] text-[13px] leading-relaxed text-[color:var(--color-text-subtle)]">
          {liveNow
            ? t(
                "broadcast.liveNote",
                "Anyone {where} can watch. {recording} Live video is relayed by our streaming server, so it's encrypted in transit but not end-to-end encrypted.",
                {
                  where:
                    visibility === "PUBLIC"
                      ? t("broadcast.onLivePage", "on the Live page")
                      : t("broadcast.withYourLink", "with your link"),
                  recording: recording
                    ? t("broadcast.isRecording", "This broadcast is being recorded.")
                    : t("broadcast.notRecording", "Nothing is being recorded."),
                },
              )
            : t(
                "broadcast.previewNote",
                "Your camera is only showing on this device until you press Go live. Nobody can see or hear you yet.",
              )}
        </p>

        {phase === "error" && (
          <button
            type="button"
            onClick={() => void openCamera()}
            className="mt-3 inline-flex h-10 items-center rounded-full border border-[color:var(--color-border)] px-4 text-[13.5px] font-medium transition-colors hover:border-[color:var(--color-brand)] hover:text-[color:var(--color-brand)]"
          >
            {t("broadcast.retryCamera", "Try the camera again")}
          </button>
        )}
      </div>
      </div>

        {/* Signed in by definition — this page redirects to login. */}
        <div className={STAGE_H}>
          <LiveChat slug={slug} status={liveNow ? "LIVE" : "IDLE"} signedIn />
        </div>
      </div>
    </div>
  );
}

/* ── control primitives ──────────────────────────────────────── */

/**
 * A round toggle on the player.
 *
 * `pressed` means the OFF state — muted, camera down, recording — and
 * it fills red, which is the convention every video call already
 * taught people. A control whose two states differ only by icon is
 * one people misread at a glance, and misreading "am I muted" is the
 * one mistake this page must not invite.
 */
function CircleButton({
  label,
  pressed,
  disabled,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={pressed === undefined ? undefined : pressed}
      title={label}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-40 ${
        pressed
          ? "bg-[#e5484d] text-white hover:bg-[#d13840]"
          : "bg-white/10 text-white hover:bg-white/20"
      }`}
    >
      {children}
    </button>
  );
}

const ICON = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

function MicIcon() {
  return (
    <svg {...ICON}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21M8.5 21h7" />
    </svg>
  );
}

function MicOffIcon() {
  return (
    <svg {...ICON}>
      <path d="M15 5a3 3 0 00-6 0v5m0 2.2A3 3 0 0015 12v-1" />
      <path d="M5.5 11a6.5 6.5 0 0010.9 4.8M18.5 11v.6M12 17.5V21M8.5 21h7" />
      <path d="M4 3l16 18" />
    </svg>
  );
}

function CamIcon() {
  return (
    <svg {...ICON}>
      <rect x="2.5" y="6.5" width="12" height="11" rx="2.5" />
      <path d="M14.5 11l6-3v8l-6-3z" />
    </svg>
  );
}

function CamOffIcon() {
  return (
    <svg {...ICON}>
      <path d="M14.5 11l6-3v8l-3-1.5" />
      <path d="M11 6.5h1a2.5 2.5 0 012.5 2.5v1m0 4.5a2.5 2.5 0 01-2.5 2.5H5A2.5 2.5 0 012.5 15V9a2.5 2.5 0 012.5-2.5" />
      <path d="M4 3l16 18" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg {...ICON}>
      <path d="M10 13.5a3.5 3.5 0 005 0l3-3a3.5 3.5 0 00-5-5l-1 1" />
      <path d="M14 10.5a3.5 3.5 0 00-5 0l-3 3a3.5 3.5 0 005 5l1-1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg {...ICON}>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}

