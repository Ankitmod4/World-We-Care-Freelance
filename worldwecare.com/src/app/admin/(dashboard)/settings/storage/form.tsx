"use client";

import { useState } from "react";
import {
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SettingsFooter } from "@/components/admin/settings-footer";
import {
  DEFAULT_MAX_FILE_MB,
  DEFAULT_MAX_VIDEO_MB,
  DEFAULT_MAX_VIDEO_SECONDS,
} from "@/lib/upload-limits";

/**
 * Storage settings — provider selection and the knobs that gate
 * uploads. Kept intentionally narrow so the shape does not need to
 * change if a second provider is ever added.
 */
export function StorageForm({
  initial,
  bodyLimitMB,
}: {
  initial: Record<string, string | number>;
  /** Build-time request body ceiling — the video cap cannot exceed it. */
  bodyLimitMB: number;
}) {
  const [provider, setProvider] = useState(
    (initial["storage.provider"] as string) ?? "local",
  );
  const [localPath, setLocalPath] = useState(
    (initial["storage.localPath"] as string) ?? "/uploads",
  );
  const [maxFileMB, setMaxFileMB] = useState(
    String((initial["storage.maxFileMB"] as number) ?? DEFAULT_MAX_FILE_MB),
  );
  const [maxVideoMB, setMaxVideoMB] = useState(
    String((initial["storage.maxVideoMB"] as number) ?? DEFAULT_MAX_VIDEO_MB),
  );
  const [maxVideoMinutes, setMaxVideoMinutes] = useState(() => {
    const seconds = (initial["storage.maxVideoSeconds"] as number) ?? DEFAULT_MAX_VIDEO_SECONDS;
    return seconds > 0 ? String(Math.round(seconds / 60)) : "";
  });
  const [publicBaseUrl, setPublicBaseUrl] = useState(
    (initial["storage.publicBaseUrl"] as string) ?? "",
  );

  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    const mb = Number.parseInt(maxFileMB, 10);
    if (!Number.isFinite(mb) || mb <= 0 || mb > 1024) {
      setError("Max image size must be between 1 and 1024 MB.");
      setSaving(false);
      return;
    }
    const videoMB = Number.parseInt(maxVideoMB, 10);
    if (!Number.isFinite(videoMB) || videoMB <= 0 || videoMB > bodyLimitMB) {
      setError(
        `Max video size must be between 1 and ${bodyLimitMB} MB — that ceiling is fixed at build time.`,
      );
      setSaving(false);
      return;
    }
    // Blank means no limit, which is a real choice rather than a bug.
    const minutes = maxVideoMinutes.trim() === "" ? 0 : Number.parseInt(maxVideoMinutes, 10);
    if (!Number.isFinite(minutes) || minutes < 0 || minutes > 1440) {
      setError("Max video length must be a number of minutes between 0 and 1440, or blank.");
      setSaving(false);
      return;
    }
    try {
      const res = await fetch("/api/admin/settings/storage", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          "storage.provider": provider,
          "storage.localPath": localPath,
          "storage.maxFileMB": mb,
          "storage.maxVideoMB": videoMB,
          "storage.maxVideoSeconds": minutes * 60,
          "storage.publicBaseUrl": publicBaseUrl,
        }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "Save failed");
      } else {
        setSavedAt(Date.now());
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Provider</CardTitle>
            <CardDescription>
              Files are stored on local disk, served from the path below.
            </CardDescription>
          </CardHeader>
          <CardBody className="space-y-4">
            <Field label="Storage provider">
              {/*
                ONE COLUMN, NOT THREE.

                This grid held three buttons: Local disk, plus two
                greyed-out placeholders for object-storage providers that
                were never implemented and could not be clicked. Those two
                are gone, and the column count went with them — left at
                `sm:grid-cols-3` the single remaining button renders a
                third of the width with two empty columns beside it,
                which reads as a layout bug rather than as one choice.

                The picker is kept rather than replaced with static
                text: it is still what writes `storage.provider`, and a
                real second provider is a one-line addition here.
              */}
              <div className="grid grid-cols-1 gap-2">
                {[
                  { v: "local", label: "Local disk" },
                ].map((opt) => (
                  // `disabled` went with the two placeholders — they were
                  // the only options that had it, and the greyed-out
                  // styling existed for them alone. Typecheck caught the
                  // leftover `opt.disabled` read; the dead
                  // `disabled:*` classes would have sat here silently.
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setProvider(opt.v)}
                    className={`h-12 rounded-[12px] border text-[13px] font-medium transition-colors ${
                      provider === opt.v
                        ? "bg-[color:var(--color-brand-soft)] border-[color:var(--color-brand)] text-[color:var(--color-brand-ink)]"
                        : "bg-[color:var(--color-surface)] border-[color:var(--color-border)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-border-strong)]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </Field>
            <Field
              label="Local upload path"
              hint="URL served by the app — physical files land under public/uploads."
            >
              <Input
                value={localPath}
                onChange={(e) => setLocalPath(e.target.value)}
                placeholder="/uploads"
              />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Limits &amp; delivery</CardTitle>
            <CardDescription>
              Guardrails on upload size and the URL used to serve files.
              Changes apply to the next upload — no restart needed.
            </CardDescription>
          </CardHeader>
          <CardBody className="space-y-4">
            <Field label="Max image size" hint="Photos, covers and avatars.">
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={1024}
                  value={maxFileMB}
                  onChange={(e) => setMaxFileMB(e.target.value)}
                  className="max-w-[120px]"
                />
                <span className="text-[13px] text-[color:var(--color-text-muted)]">MB</span>
              </div>
            </Field>

            <Field
              label="Max video size"
              hint={`Uploaded video, before conversion. This build accepts request bodies up to ${bodyLimitMB} MB — to go higher, set MAX_UPLOAD_BODY_MB and rebuild.`}
            >
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={bodyLimitMB}
                  value={maxVideoMB}
                  onChange={(e) => setMaxVideoMB(e.target.value)}
                  className="max-w-[120px]"
                />
                <span className="text-[13px] text-[color:var(--color-text-muted)]">
                  MB <span className="text-[color:var(--color-text-subtle)]">of {bodyLimitMB}</span>
                </span>
              </div>
            </Field>

            <Field
              label="Max video length"
              hint="Leave blank for no limit. Checked after upload, when the duration is known — a long video costs real CPU to convert."
            >
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={1440}
                  value={maxVideoMinutes}
                  onChange={(e) => setMaxVideoMinutes(e.target.value)}
                  placeholder="No limit"
                  className="max-w-[120px]"
                />
                <span className="text-[13px] text-[color:var(--color-text-muted)]">minutes</span>
              </div>
            </Field>
            <Field
              label="Public base URL (CDN)"
              hint="Optional — prepended to file URLs. Leave empty to serve directly from the app."
            >
              <Input
                value={publicBaseUrl}
                onChange={(e) => setPublicBaseUrl(e.target.value)}
                placeholder="https://cdn.yourdomain.com"
              />
            </Field>
          </CardBody>
        </Card>
      </div>

      <SettingsFooter
        saving={saving}
        savedAt={savedAt}
        error={error}
        hint="Changes apply to the next upload — no restart needed."
      />
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[13px] font-medium mb-1.5">{label}</label>
      {children}
      {hint && (
        <p className="mt-1.5 text-[11.5px] text-[color:var(--color-text-subtle)]">
          {hint}
        </p>
      )}
    </div>
  );
}
