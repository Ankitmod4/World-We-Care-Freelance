"use client";

/**
 * Video upload with live progress and honest conversion feedback.
 *
 * Two phases, and the difference matters to the person watching:
 *
 *  1. UPLOAD — XHR, not fetch. `fetch` still cannot report upload
 *     progress in any browser, and a 2 GB upload with no bar is
 *     indistinguishable from a hang. XHR gives bytes-sent events, from
 *     which we derive speed and a time remaining.
 *
 *  2. CONVERSION — polled from the server, which reports the real
 *     ffmpeg position rather than a spinner and a prayer. The stage
 *     messages come from the server too, so what someone reads matches
 *     what the machine is doing.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { VideoPlayer } from "./video-player";
import { useT } from "@/components/site/locale-context";
import { serverText } from "@/lib/i18n-core";
import type { TFunction } from "@/lib/i18n-core";

export interface UploadedVideo {
  id: string;
  url: string;
  posterUrl: string | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
}

type Phase = "idle" | "uploading" | "processing" | "ready" | "error";

interface StatusPayload {
  id: string;
  status: "UPLOADING" | "QUEUED" | "PROCESSING" | "READY" | "FAILED";
  percent: number;
  etaSeconds: number | null;
  stage: string;
  message: string;
  url: string | null;
  posterUrl: string | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  error: string | null;
}

function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/**
 * Takes `t` rather than reading it: this is a plain function called
 * from a render, and the sentence it builds is the one somebody
 * stares at while a video uploads.
 */
function humanEta(t: TFunction, seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return null;
  if (seconds < 10) return t("upload.etaSeconds", "a few seconds left");
  if (seconds < 60) {
    return t("upload.etaAboutSeconds", "about {n} seconds left", {
      n: Math.round(seconds / 5) * 5,
    });
  }
  const mins = Math.round(seconds / 60);
  if (mins < 60) {
    return mins === 1
      ? t("upload.etaOneMinute", "about a minute left")
      : t("upload.etaMinutes", "about {n} minutes left", { n: mins });
  }
  const hours = Math.floor(mins / 60);
  return hours === 1
    ? t("upload.etaOneHour", "about an hour left")
    : t("upload.etaHours", "about {n} hours left", { n: hours });
}

/**
 * The trigger that opens a VideoUpload panel, styled as PhotoAttach's
 * twin.
 *
 * Lives here rather than in either composer because the confession
 * wall and the gratitude wall both grew one on the same day, and a
 * button that has to look identical to the one beside it is exactly
 * the thing that drifts when it is copied — one of them ends up 8px
 * shorter than the Photo button next to it and nobody can say which
 * change did it.
 *
 * NO UPLOAD LOGIC HERE. It opens a panel; VideoUpload does the work.
 * The two are separate because the panel has to stay mounted, and
 * keep polling, while a conversion finishes — a button that owned the
 * upload would unmount it the moment somebody collapsed the panel.
 */
export function VideoAttachButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  const t = useT();
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={t("composer.addVideo", "Add a video")}
      className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium text-[color:var(--color-text-muted)] transition-colors duration-200 hover:bg-[color:var(--color-surface-muted)] disabled:opacity-50"
    >
      <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
        <rect x="2.5" y="5" width="11" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path d="M13.5 9l4-2.5v7L13.5 11V9z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      {t("composer.video", "Video")}
    </button>
  );
}

export function VideoUpload({
  value,
  onChange,
  endpoint = "/api/user/upload/video",
  statusBase = "/api/user/upload/video",
  label,
  hint,
  disabled,
}: {
  value: UploadedVideo | null;
  onChange: (next: UploadedVideo | null) => void;
  /** POST target for the raw upload. */
  endpoint?: string;
  /** Base path for `${statusBase}/${id}` polling and deletion. */
  statusBase?: string;
  label?: string;
  hint?: string;
  disabled?: boolean;
}) {
  const t = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aliveRef = useRef(true);

  const [phase, setPhase] = useState<Phase>(value ? "ready" : "idle");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // upload phase
  const [sent, setSent] = useState(0);
  const [total, setTotal] = useState(0);
  const [uploadEta, setUploadEta] = useState<number | null>(null);
  const [speed, setSpeed] = useState(0);

  // conversion phase
  const [status, setStatus] = useState<StatusPayload | null>(null);

  // Server-side limits, so the hint shows the real number and an
  // oversized file is refused before the bytes go anywhere.
  const [limits, setLimits] = useState<{ maxMB: number; maxSeconds: number } | null>(null);

  useEffect(() => {
    let alive = true;
    void fetch(endpoint, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { maxMB?: number; maxSeconds?: number } | null) => {
        if (alive && d && typeof d.maxMB === "number") {
          setLimits({ maxMB: d.maxMB, maxSeconds: d.maxSeconds ?? 0 });
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [endpoint]);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (pollRef.current) clearTimeout(pollRef.current);
      xhrRef.current?.abort();
    };
  }, []);

  /* ── polling ────────────────────────────────────────────── */
  const poll = useCallback(
    async (id: string) => {
      if (!aliveRef.current) return;
      try {
        const res = await fetch(`${statusBase}/${id}`, { cache: "no-store" });
        if (!res.ok) throw new Error("status");
        const d = (await res.json()) as StatusPayload;
        if (!aliveRef.current) return;
        setStatus(d);

        if (d.status === "READY" && d.url) {
          setPhase("ready");
          onChange({
            id: d.id,
            url: d.url,
            posterUrl: d.posterUrl,
            width: d.width,
            height: d.height,
            durationSec: d.durationSec,
          });
          return;
        }
        if (d.status === "FAILED") {
          setPhase("error");
          setError(serverText(t, d?.error) || t("upload.videoFailed", "The video could not be processed."));
          return;
        }
        pollRef.current = setTimeout(() => void poll(id), 1500);
      } catch {
        if (!aliveRef.current) return;
        // A single failed poll is usually a redeploy or a flaky
        // connection, not a dead job — back off and keep asking.
        pollRef.current = setTimeout(() => void poll(id), 4000);
      }
    },
    [onChange, statusBase],
  );

  /* ── upload ─────────────────────────────────────────────── */
  const upload = useCallback(
    (file: File) => {
      setError(null);
      if (!file.type.startsWith("video/") && !/\.(mp4|mov|m4v|webm|mkv|avi|3gp)$/i.test(file.name)) {
        setError(t("upload.notVideo", "That does not look like a video file."));
        return;
      }
      if (limits && file.size > limits.maxMB * 1024 * 1024) {
        setError(
          `That video is ${humanBytes(file.size)} — the limit is ${limits.maxMB} MB. The server enforces this too; this check just saves you the upload.`,
        );
        return;
      }

      setPhase("uploading");
      setSent(0);
      setTotal(file.size);
      setUploadEta(null);
      setSpeed(0);
      setStatus(null);

      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      const started = Date.now();

      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        setSent(e.loaded);
        setTotal(e.total);
        const elapsed = (Date.now() - started) / 1000;
        if (elapsed > 1 && e.loaded > 0) {
          const bps = e.loaded / elapsed;
          setSpeed(bps);
          setUploadEta((e.total - e.loaded) / bps);
        }
      };

      xhr.onload = () => {
        xhrRef.current = null;
        let body: { id?: string; error?: string } = {};
        try {
          body = JSON.parse(xhr.responseText) as typeof body;
        } catch {
          /* fall through to the status-code message */
        }
        if (xhr.status >= 200 && xhr.status < 300 && body.id) {
          setPhase("processing");
          void poll(body.id);
        } else {
          setPhase("error");
          setError(
            serverText(t, body?.error) ||
              t("upload.failedWithStatus", "Upload failed ({status}).", { status: xhr.status }),
          );
        }
      };

      xhr.onerror = () => {
        xhrRef.current = null;
        setPhase("error");
        setError(t("upload.failed", "The upload failed. Check your connection and try again."));
      };

      xhr.onabort = () => {
        xhrRef.current = null;
        setPhase("idle");
      };

      xhr.open("POST", endpoint);
      // Raw body, not multipart — see src/lib/video-upload.ts.
      xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
      xhr.setRequestHeader("x-filename", encodeURIComponent(file.name));
      xhr.send(file);
    },
    [endpoint, limits, poll],
  );

  const cancel = useCallback(async () => {
    xhrRef.current?.abort();
    if (pollRef.current) clearTimeout(pollRef.current);
    const id = status?.id;
    setStatus(null);
    setPhase("idle");
    setError(null);
    if (id) await fetch(`${statusBase}/${id}`, { method: "DELETE" }).catch(() => {});
  }, [status?.id, statusBase]);

  const remove = useCallback(async () => {
    const id = value?.id;
    onChange(null);
    setPhase("idle");
    setStatus(null);
    if (id) await fetch(`${statusBase}/${id}`, { method: "DELETE" }).catch(() => {});
  }, [onChange, statusBase, value?.id]);

  /* ── render ─────────────────────────────────────────────── */
  const uploadPct = total > 0 ? Math.min(100, Math.round((sent / total) * 100)) : 0;

  if (phase === "ready" && value) {
    return (
      <div>
        {label && (
          <span className="mb-1.5 block text-[12px] font-medium text-[color:var(--color-text-muted)]">
            {label}
          </span>
        )}
        <VideoPlayer
          src={value.url}
          poster={value.posterUrl}
          width={value.width}
          height={value.height}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-full border border-[color:var(--color-border)] px-3 py-1.5 text-[12.5px] font-medium text-[color:var(--color-text-muted)] transition-colors duration-200 hover:border-[color:var(--color-brand)] hover:text-[color:var(--color-text)]"
          >
            {t("upload.replace", "Replace")}
          </button>
          <button
            type="button"
            onClick={remove}
            className="rounded-full border border-[color:var(--color-border)] px-3 py-1.5 text-[12.5px] font-medium text-[color:var(--color-danger)] transition-colors duration-200 hover:border-[color:var(--color-danger)]"
          >
            {t("payouts.remove", "Remove")}
          </button>
          <span className="text-[11.5px] text-[color:var(--color-text-subtle)]">
            MP4 · H.264 · plays on every device
          </span>
        </div>
        <FileInput inputRef={inputRef} onPick={upload} />
      </div>
    );
  }

  return (
    <div>
      {label && (
        <span className="mb-1.5 block text-[12px] font-medium text-[color:var(--color-text-muted)]">
          {label}
        </span>
      )}

      {phase === "idle" && (
        <div
          role="button"
          tabIndex={disabled ? -1 : 0}
          onClick={() => !disabled && inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); }
          }}
          onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file && !disabled) upload(file);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed px-4 py-8 text-center transition-colors duration-200 ${
            dragging
              ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand)]/5"
              : "border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] hover:border-[color:var(--color-brand)]"
          } ${disabled ? "pointer-events-none opacity-60" : ""}`}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden className="text-[color:var(--color-text-subtle)]">
            <rect x="2.75" y="5.5" width="13.5" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
            <path d="M16.25 10.5l5-2.75v8.5l-5-2.75" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
          <span className="text-[13.5px] font-medium">
            Drag a video here, or{" "}
            <span className="text-[color:var(--color-brand)] underline underline-offset-2">browse</span>
          </span>
          <span className="text-[11.5px] text-[color:var(--color-text-subtle)]">
            {t("upload.videoFormats", "MP4, MOV, WebM, MKV \u2014 we convert it so it plays everywhere")}
            {limits ? " \u00b7 " + t("upload.upToMb", "up to {n} MB", { n: limits.maxMB }) : ""}
            {limits && limits.maxSeconds > 0
              ? " \u00b7 " +
                t("upload.upToMin", "up to {n} min", {
                  n: Math.round(limits.maxSeconds / 60),
                })
              : ""}
          </span>
        </div>
      )}

      {phase === "uploading" && (
        <Panel
          title={t("upload.uploading", "Uploading…")}
          percent={uploadPct}
          lines={[
            t("upload.sentOfTotal", "{sent} of {total}", {
              sent: humanBytes(sent),
              total: humanBytes(total),
            }) + (speed > 0 ? ` \u00b7 ${humanBytes(speed)}/s` : ""),
            humanEta(t, uploadEta) ??
              t("upload.workingOutEta", "Working out how long this will take\u2026"),
          ]}
          onCancel={cancel}
        />
      )}

      {phase === "processing" && (
        <Panel
          /*
             `status.message` comes from the conversion job on the
             server, so it goes through `serverText` like any other
             sentence the server wrote.
          */
          title={
            serverText(t, status?.message) || t("upload.processing", "Processing video\u2026")
          }
          percent={status?.percent ?? 0}
          lines={[
            t(
              "upload.onServer",
              "Your video is on the server \u2014 you can keep this tab open while we convert it.",
            ),
            humanEta(t, status?.etaSeconds ?? null) ?? t("upload.estimating", "Estimating\u2026"),
          ]}
          onCancel={cancel}
        />
      )}

      {phase === "error" && (
        <div className="rounded-xl border border-[color:var(--color-danger)]/40 bg-[color:var(--color-danger)]/5 p-4">
          <p className="text-[13.5px] font-medium text-[color:var(--color-danger)]">
            {error ?? t("common.wentWrong", "Something went wrong.")}
          </p>
          <button
            type="button"
            onClick={() => { setPhase("idle"); setError(null); setStatus(null); }}
            className="mt-2 rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-1.5 text-[12.5px] font-medium hover:border-[color:var(--color-brand)]"
          >
            {t("upload.tryAnother", "Try another file")}
          </button>
        </div>
      )}

      {hint && phase === "idle" && (
        <p className="mt-1.5 text-[11.5px] text-[color:var(--color-text-subtle)]">{hint}</p>
      )}

      <FileInput inputRef={inputRef} onPick={upload} />
    </div>
  );
}

function FileInput({
  inputRef,
  onPick,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  onPick: (file: File) => void;
}) {
  return (
    <input
      ref={inputRef}
      type="file"
      accept="video/*,.mkv,.mov,.m4v"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (file) onPick(file);
      }}
    />
  );
}

function Panel({
  title,
  percent,
  lines,
  onCancel,
}: {
  title: string;
  percent: number;
  lines: (string | null)[];
  onCancel: () => void;
}) {
  const t = useT();
  return (
    <div className="rounded-xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-[color:var(--color-border)] border-t-[color:var(--color-brand)]" />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[14px] font-medium">{title}</p>
            <span className="text-[12.5px] tabular-nums text-[color:var(--color-text-muted)]">
              {percent}%
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--color-surface-muted)]">
            <div
              className="h-full rounded-full bg-[color:var(--color-brand)] transition-[width] duration-500 ease-out"
              style={{ width: `${Math.max(2, percent)}%` }}
            />
          </div>
          {lines.filter(Boolean).map((line, i) => (
            <p key={i} className="mt-1.5 text-[12px] text-[color:var(--color-text-subtle)]">
              {line}
            </p>
          ))}
          <button
            type="button"
            onClick={onCancel}
            className="mt-2 text-[12px] font-medium text-[color:var(--color-text-muted)] hover:text-[color:var(--color-danger)]"
          >
            {t("common.cancel", "Cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
