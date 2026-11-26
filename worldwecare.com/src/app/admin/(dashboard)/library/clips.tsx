"use client";

/**
 * Clip manager for one theme.
 *
 * A clip is either a pasted link or an uploaded file, and the two are
 * presented as one "Add a clip" flow with a toggle — because from the
 * curator's point of view it is one job. The upload path reuses the
 * conversion pipeline, so the Add button stays disabled until the
 * asset is READY; a clip pointing at a still-converting video would
 * render a broken player for every reader.
 */

import { useCallback, useEffect, useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { VideoUpload, type UploadedVideo } from "@/components/ui/video-upload";
import { EMBED_PROVIDERS, toEmbed } from "@/lib/embeds";
import { Img } from "@/components/ui/img";
import { ClipCommentsPanel } from "./clip-comments-panel";

interface ClipRow {
  id: string;
  title: string;
  caption: string | null;
  kind: "EMBED" | "UPLOAD";
  embedUrl: string | null;
  videoUrl: string | null;
  posterUrl: string | null;
  durationSec: number | null;
  isPublished: boolean;
  sortOrder: number;
  likeCount: number;
  saveCount: number;
  viewCount: number;
  commentCount: number;
}

const LABEL = "mb-1 block text-[12px] font-medium text-[color:var(--color-text-muted)]";

export function ClipManager({ themeId }: { themeId: string }) {
  const [clips, setClips] = useState<ClipRow[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Which clip's thread is open. One at a time — this is a side task. */
  const [openThread, setOpenThread] = useState<string | null>(null);

  const [kind, setKind] = useState<"EMBED" | "UPLOAD">("EMBED");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [embedUrl, setEmbedUrl] = useState("");
  const [video, setVideo] = useState<UploadedVideo | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/library/${themeId}`, { cache: "no-store" });
    const d = (await res.json().catch(() => ({ clips: [] }))) as { clips: ClipRow[] };
    setClips(d.clips ?? []);
  }, [themeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const reset = () => {
    setTitle("");
    setCaption("");
    setEmbedUrl("");
    setVideo(null);
    setError(null);
  };

  // Same whitelist the server enforces — checking here just means the
  // curator finds out while the link is still in front of them.
  const embedPreview = kind === "EMBED" ? toEmbed(embedUrl) : null;
  const canAdd =
    title.trim().length > 0 &&
    (kind === "EMBED" ? !!embedPreview : !!video?.id);

  const add = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/library/clips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        themeId,
        title,
        caption: caption || null,
        kind,
        embedUrl: kind === "EMBED" ? embedUrl : null,
        videoAssetId: kind === "UPLOAD" ? video?.id : null,
      }),
    });
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(d.error ?? "Could not add the clip");
      return;
    }
    reset();
    setAdding(false);
    await load();
  };

  const patch = async (id: string, data: Partial<ClipRow>) => {
    setClips((prev) => prev?.map((c) => (c.id === id ? { ...c, ...data } : c)) ?? prev);
    await fetch(`/api/admin/library/clips/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).catch(() => {});
    await load();
  };

  const remove = async (id: string) => {
    setClips((prev) => prev?.filter((c) => c.id !== id) ?? prev);
    await fetch(`/api/admin/library/clips/${id}`, { method: "DELETE" }).catch(() => {});
    await load();
  };

  const move = async (index: number, delta: number) => {
    if (!clips) return;
    const target = index + delta;
    if (target < 0 || target >= clips.length) return;
    const next = [...clips];
    [next[index], next[target]] = [next[target], next[index]];
    setClips(next);
    await fetch("/api/admin/library/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ themeId, ids: next.map((c) => c.id) }),
    }).catch(() => {});
  };

  return (
    <Card>
      <CardBody className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[14px] font-semibold">Clips</p>
            <p className="text-[12px] text-[color:var(--color-text-muted)]">
              Order here is the order members see.
            </p>
          </div>
          <Button size="sm" variant={adding ? "secondary" : "primary"} onClick={() => { setAdding((a) => !a); reset(); }}>
            {adding ? "Cancel" : "Add a clip"}
          </Button>
        </div>

        {adding && (
          <div className="space-y-3 rounded-xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)] p-3.5">
            <div className="flex gap-2">
              {(["EMBED", "UPLOAD"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  className={`inline-flex min-h-9 items-center rounded-full border px-3.5 text-[12.5px] font-medium transition-colors duration-200 ${
                    kind === k
                      ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)]"
                      : "border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-muted)]"
                  }`}
                >
                  {k === "EMBED" ? "Paste a link" : "Upload a file"}
                </button>
              ))}
            </div>

            {kind === "EMBED" ? (
              <label className="block">
                <span className={LABEL}>Video link</span>
                <Input
                  value={embedUrl}
                  onChange={(e) => setEmbedUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=…"
                />
                <span className="mt-1 block text-[11.5px] text-[color:var(--color-text-subtle)]">
                  {embedUrl.trim() === ""
                    ? `Supported: ${EMBED_PROVIDERS}.`
                    : embedPreview
                      ? `✓ ${embedPreview.provider} — nothing is hosted or converted.`
                      : `That link can't be embedded. Supported: ${EMBED_PROVIDERS}.`}
                </span>
              </label>
            ) : (
              <VideoUpload
                value={video}
                onChange={setVideo}
                endpoint="/api/admin/upload/video?category=clips"
                statusBase="/api/admin/upload/video"
                label="Video file"
                hint="Converted to MP4 with a thumbnail so it plays on every device."
              />
            )}

            <label className="block">
              <span className={LABEL}>Title</span>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ten minutes that change the morning" />
            </label>
            <label className="block">
              <span className={LABEL}>Caption — optional, Markdown</span>
              <Textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} />
            </label>

            {error && <p className="text-[12.5px] text-[color:var(--color-danger)]">{error}</p>}

            <div className="flex justify-end">
              <Button size="sm" loading={busy} disabled={!canAdd} onClick={add}>
                Add clip
              </Button>
            </div>
          </div>
        )}

        {clips === null ? (
          <p className="text-[13px] text-[color:var(--color-text-subtle)]">Loading…</p>
        ) : clips.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[color:var(--color-border)] p-6 text-center text-[13px] text-[color:var(--color-text-muted)]">
            No clips yet. Paste a YouTube link to get started.
          </p>
        ) : (
          <ul className="divide-y divide-[color:var(--color-border-soft)]">
            {clips.map((clip, i) => (
              <li key={clip.id} className="flex items-start gap-3 py-3">
                <div className="flex flex-col pt-1">
                  <button
                    type="button"
                    aria-label="Move up"
                    disabled={i === 0}
                    onClick={() => void move(i, -1)}
                    className="flex h-5 w-5 items-center justify-center rounded text-[color:var(--color-text-subtle)] hover:bg-[color:var(--color-surface-muted)] disabled:opacity-25"
                  >
                    <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden>
                      <path d="M5 12l5-5 5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    aria-label="Move down"
                    disabled={i === clips.length - 1}
                    onClick={() => void move(i, 1)}
                    className="flex h-5 w-5 items-center justify-center rounded text-[color:var(--color-text-subtle)] hover:bg-[color:var(--color-surface-muted)] disabled:opacity-25"
                  >
                    <svg width="12" height="12" viewBox="0 0 20 20" fill="none" aria-hidden>
                      <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>

                <div className="h-12 w-20 shrink-0 overflow-hidden rounded-[10px] bg-[color:var(--color-surface-muted)]">
                  {clip.posterUrl ?? (clip.kind === "EMBED" ? toEmbed(clip.embedUrl)?.thumbnail : null) ? (
                    <Img
                      src={clip.posterUrl ?? toEmbed(clip.embedUrl)?.thumbnail ?? ""}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-[16px]">🎬</span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium leading-snug">{clip.title}</p>
                  <p className="mt-0.5 truncate text-[11.5px] text-[color:var(--color-text-subtle)]">
                    {clip.kind === "EMBED" ? clip.embedUrl : "Uploaded · MP4"}
                  </p>
                  <p className="mt-0.5 text-[11px] tabular-nums text-[color:var(--color-text-subtle)]">
                    {clip.viewCount} views · {clip.likeCount} likes · {clip.saveCount} saves
                  </p>
                  <button
                    type="button"
                    onClick={() => setOpenThread(openThread === clip.id ? null : clip.id)}
                    className="mt-1 text-[11.5px] font-medium text-[color:var(--color-brand)] hover:underline"
                  >
                    {openThread === clip.id
                      ? "Hide comments"
                      : `${clip.commentCount} comment${clip.commentCount === 1 ? "" : "s"}`}
                  </button>

                  {openThread === clip.id && (
                    <div className="mt-2">
                      <ClipCommentsPanel
                        clipId={clip.id}
                        // The count on the row is the published count,
                        // and removing a comment changes it.
                        onCountChange={(n) =>
                          setClips((prev) =>
                            (prev ?? []).map((c) =>
                              c.id === clip.id ? { ...c, commentCount: n } : c,
                            ),
                          )
                        }
                      />
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void patch(clip.id, { isPublished: !clip.isPublished })}
                    className={`rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors duration-200 ${
                      clip.isPublished
                        ? "border-[color:var(--color-border)] text-[color:var(--color-text-muted)]"
                        : "border-[color:var(--color-brand)] text-[color:var(--color-brand)]"
                    }`}
                  >
                    {clip.isPublished ? "Live" : "Hidden"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(clip.id)}
                    aria-label="Delete clip"
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--color-text-subtle)] transition-colors duration-200 hover:bg-[color:var(--color-danger)]/10 hover:text-[color:var(--color-danger)]"
                  >
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
                      <path d="M4 6h12M8 6V4.5h4V6M6.5 6l.6 9.5h5.8L13.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
