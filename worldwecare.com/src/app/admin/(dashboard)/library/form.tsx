"use client";

/**
 * Theme editor, plus the clip manager for that theme.
 *
 * The two live on one screen because managing a theme IS managing its
 * clips — bouncing between two pages to add three videos is the kind
 * of friction that stops a curated feed from being curated.
 *
 * Clips are only creatable once the theme exists, so on /new the clip
 * panel is replaced by a note rather than a disabled form nobody can
 * use.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/admin/image-upload";
import { ClipManager } from "./clips";

const LABEL = "mb-1 block text-[12px] font-medium text-[color:var(--color-text-muted)]";

export function LibraryForm({ themeId }: { themeId?: string }) {
  const router = useRouter();
  const isEdit = !!themeId;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [about, setAbout] = useState("");
  const [emoji, setEmoji] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [slug, setSlug] = useState("");

  useEffect(() => {
    if (!themeId) return;
    void (async () => {
      const res = await fetch(`/api/admin/library/${themeId}`);
      if (!res.ok) {
        setError("Could not load this theme.");
        setLoading(false);
        return;
      }
      const { theme } = (await res.json()) as { theme: Record<string, unknown> };
      setName((theme.name as string) ?? "");
      setTagline((theme.tagline as string) ?? "");
      setAbout((theme.about as string) ?? "");
      setEmoji((theme.emoji as string) ?? "");
      setCoverUrl((theme.coverUrl as string) ?? "");
      setIsActive(theme.isActive !== false);
      setSlug((theme.slug as string) ?? "");
      setLoading(false);
    })();
  }, [themeId]);

  const save = useCallback(async () => {
    setError(null);
    setNotice(null);
    if (!name.trim()) {
      setError("Give the theme a name.");
      return;
    }
    setSaving(true);
    const payload = {
      name,
      tagline: tagline || null,
      about: about || null,
      emoji: emoji || null,
      coverUrl: coverUrl || null,
      isActive,
    };
    const res = await fetch(isEdit ? `/api/admin/library/${themeId}` : "/api/admin/library", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = (await res.json().catch(() => ({}))) as { error?: string; id?: string };
    setSaving(false);
    if (!res.ok) {
      setError(d.error ?? "Save failed");
      return;
    }
    if (!isEdit && d.id) {
      // Straight into the clip manager — an empty theme is not the
      // finished job.
      router.push(`/admin/library/${d.id}`);
      return;
    }
    setNotice("Saved");
  }, [about, coverUrl, emoji, themeId, isActive, isEdit, name, router, tagline]);

  const remove = async () => {
    if (!themeId) return;
    const res = await fetch(`/api/admin/library/${themeId}`, { method: "DELETE" });
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setError(d.error ?? "Could not delete this theme.");
      return;
    }
    router.push("/admin/library");
  };

  if (loading) {
    return <p className="p-6 text-[13px] text-[color:var(--color-text-subtle)]">Loading…</p>;
  }

  return (
    <div className="space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] sm:text-[26px]">
            {isEdit ? name || "Edit theme" : "New theme"}
          </h1>
          <p className="mt-0.5 text-[13px] text-[color:var(--color-text-muted)]">
            {isEdit && slug ? (
              <>
                Live at{" "}
                <Link href={`/library/${slug}`} className="text-[color:var(--color-brand)] hover:underline">
                  /library/{slug}
                </Link>
              </>
            ) : (
              "Name it after what someone would search for — Exercise, Recovery, Spirituality."
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/library">
            <Button variant="secondary" size="sm">Back</Button>
          </Link>
          <Button size="sm" loading={saving} onClick={save}>Save</Button>
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-[color:var(--color-danger)]/10 px-3 py-2 text-[13px] text-[color:var(--color-danger)]">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-xl bg-[color:var(--color-brand)]/10 px-3 py-2 text-[13px] text-[color:var(--color-brand)]">
          {notice}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardBody className="space-y-3 p-4">
              <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-3">
                <label className="block">
                  <span className={LABEL}>Emoji</span>
                  <Input
                    value={emoji}
                    onChange={(e) => setEmoji(e.target.value.slice(0, 8))}
                    placeholder="🏃"
                    className="text-center text-[18px]"
                  />
                </label>
                <label className="block">
                  <span className={LABEL}>Name</span>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Exercise" />
                </label>
              </div>
              <label className="block">
                <span className={LABEL}>Tagline — one line, shown on the card</span>
                <Input
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value.slice(0, 240))}
                  placeholder="Movement that lifts the day, not just the body."
                />
              </label>
              <label className="block">
                <span className={LABEL}>About — Markdown, shown on the theme page</span>
                <Textarea
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  rows={5}
                  placeholder="Who this is for and what belongs here."
                />
              </label>
            </CardBody>
          </Card>

          {isEdit && themeId ? (
            <ClipManager themeId={themeId} />
          ) : (
            <Card>
              <CardBody className="p-6 text-center">
                <p className="text-[14px] font-medium">Clips come next</p>
                <p className="mt-1 text-[13px] text-[color:var(--color-text-muted)]">
                  Save the theme first — then you can paste video links or upload files into it.
                </p>
              </CardBody>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardBody className="p-4">
              <ImageUpload
                value={coverUrl}
                onChange={setCoverUrl}
                category="theme"
                label="Cover image"
                hint="Shown on the index card and the theme header. Optional — the emoji stands in."
                aspect="wide"
              />
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3 p-4">
              <label className="flex items-start gap-2.5 text-[13px]">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[color:var(--color-brand)]"
                />
                <span>
                  Visible to members
                  <span className="mt-0.5 block text-[11.5px] text-[color:var(--color-text-subtle)]">
                    Unticking hides the theme and its clips without deleting anything.
                  </span>
                </span>
              </label>
            </CardBody>
          </Card>

          {isEdit && (
            <Card>
              <CardBody className="p-4">
                <p className="text-[13px] font-semibold">Delete this theme</p>
                <p className="mt-1 text-[11.5px] text-[color:var(--color-text-subtle)]">
                  Its clips, followers, likes and saves go with it. Hiding it is almost always the
                  better move.
                </p>
                <Button variant="secondary" size="sm" className="mt-2.5" onClick={remove}>
                  Delete
                </Button>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
