"use client";

/**
 * Article editor — shared by /admin/articles/new and
 * /admin/articles/[id].
 *
 * The body is the same Markdown subset the reader renders, so the
 * live preview uses the *actual* renderer (`Markdown`) rather than an
 * approximation. What an author sees here is exactly what ships.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/admin/image-upload";
import { GalleryUpload, type GalleryPhoto } from "@/components/admin/gallery-upload";
import { MarkdownToolbar } from "@/components/admin/markdown-toolbar";
import { Markdown, estimateReadMinutes } from "@/lib/rich-text";

type Status = "DRAFT" | "PUBLISHED" | "ARCHIVED";

interface CategoryOption {
  id: string;
  name: string;
}

const FIELD_LABEL = "mb-1 block text-[12px] font-medium text-[color:var(--color-text-muted)]";
const SELECT_CLASS =
  "h-10 w-full rounded-[10px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 text-[14px]";

export function ArticleEditor({ articleId }: { articleId?: string }) {
  const router = useRouter();
  const isEdit = !!articleId;

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [bodyMode, setBodyMode] = useState<"write" | "preview">("write");
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [body, setBody] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [coverAlt, setCoverAlt] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState<Status>("DRAFT");
  const [isFeatured, setIsFeatured] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/article-categories");
      const d = (await res.json().catch(() => ({ categories: [] }))) as { categories: CategoryOption[] };
      setCategories(d.categories);
    })();
  }, []);

  useEffect(() => {
    if (!articleId) return;
    void (async () => {
      const res = await fetch(`/api/admin/articles/${articleId}`);
      if (!res.ok) {
        setError("Could not load this article.");
        setLoading(false);
        return;
      }
      const d = (await res.json()) as {
        article: {
          title: string;
          excerpt: string | null;
          body: string;
          coverUrl: string | null;
          coverAlt: string | null;
          videoUrl: string | null;
          photos: GalleryPhoto[] | null;
          categoryId: string | null;
          status: Status;
          isFeatured: boolean;
        };
      };
      const a = d.article;
      setTitle(a.title);
      setExcerpt(a.excerpt ?? "");
      setBody(a.body);
      setCoverUrl(a.coverUrl ?? "");
      setCoverAlt(a.coverAlt ?? "");
      setVideoUrl(a.videoUrl ?? "");
      setPhotos(Array.isArray(a.photos) ? a.photos : []);
      setCategoryId(a.categoryId ?? "");
      setStatus(a.status);
      setIsFeatured(a.isFeatured);
      setLoading(false);
    })();
  }, [articleId]);

  const readMinutes = useMemo(() => estimateReadMinutes(body), [body]);

  const save = useCallback(
    async (overrideStatus?: Status) => {
      if (!title.trim()) {
        setError("Title is required");
        return;
      }
      if (!body.trim()) {
        setError("Body is required");
        return;
      }
      setSaving(true);
      setError(null);
      setNotice(null);

      const payload = {
        title,
        body,
        excerpt: excerpt || null,
        coverUrl: coverUrl || null,
        coverAlt: coverAlt || null,
        videoUrl: videoUrl || null,
        photos,
        categoryId: categoryId || null,
        status: overrideStatus ?? status,
        isFeatured,
      };

      const res = await fetch(isEdit ? `/api/admin/articles/${articleId}` : "/api/admin/articles", {
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
      if (overrideStatus) setStatus(overrideStatus);
      if (!isEdit && d.id) {
        router.push(`/admin/articles/${d.id}`);
        return;
      }
      setNotice("Saved");
    },
    [articleId, body, categoryId, coverAlt, coverUrl, excerpt, isEdit, isFeatured, photos, router, status, title, videoUrl],
  );

  const remove = async () => {
    if (!articleId) return;
    if (!window.confirm("Delete this article? Comments, likes and saves go with it.")) return;
    await fetch(`/api/admin/articles/${articleId}`, { method: "DELETE" });
    router.push("/admin/articles");
  };

  if (loading) {
    return <p className="text-[13px] text-[color:var(--color-text-subtle)]">Loading…</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
            {isEdit ? "Edit article" : "New article"}
          </h1>
          <p className="mt-0.5 text-[13px] tabular-nums text-[color:var(--color-text-muted)]">
            {readMinutes} min read · Markdown supported
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/articles">
            <Button variant="secondary" size="sm">Back</Button>
          </Link>
          <Button size="sm" loading={saving} onClick={() => save()}>
            Save
          </Button>
          {status !== "PUBLISHED" && (
            <Button size="sm" loading={saving} onClick={() => save("PUBLISHED")}>
              Publish
            </Button>
          )}
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
        {/* ── main column ── */}
        <div className="space-y-4">
          <Card>
            <CardBody className="space-y-3 p-4">
              <label className="block">
                <span className={FIELD_LABEL}>Title</span>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Article title" />
              </label>
              <label className="block">
                <span className={FIELD_LABEL}>Excerpt — shown on cards and in search</span>
                <Textarea
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value.slice(0, 400))}
                  rows={2}
                  placeholder="One or two sentences summarising the piece."
                />
                <span className="mt-1 block text-right text-[11px] tabular-nums text-[color:var(--color-text-subtle)]">
                  {excerpt.length}/400
                </span>
              </label>
            </CardBody>
          </Card>

          {/* Write / Preview tabs rather than a toggle in the page
              header: the preview used to render BELOW a 20-row textarea,
              so clicking "Preview" changed something ~600px off-screen
              and read as doing nothing. Swapping in place keeps it where
              the author is already looking. */}
          <Card>
            <CardBody className="space-y-2 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className={FIELD_LABEL}>Body</span>
                <div className="flex items-center gap-1 rounded-full bg-[color:var(--color-surface-muted)] p-0.5">
                  {(["write", "preview"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setBodyMode(m)}
                      aria-pressed={bodyMode === m}
                      className={`rounded-full px-3 py-1 text-[12.5px] font-medium capitalize transition-colors duration-200 ${
                        bodyMode === m
                          ? "bg-[color:var(--color-surface)] text-[color:var(--color-text)] shadow-card"
                          : "text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {bodyMode === "write" ? (
                <>
                  <MarkdownToolbar textareaRef={bodyRef} value={body} onChange={setBody} />
                  <Textarea
                    ref={bodyRef}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={20}
                    className="font-mono text-[13.5px]"
                    placeholder={"## A section heading\n\nWrite the article here.\n\n- a point\n- another point\n\n> A quote that matters."}
                  />
                  <p className="text-[11px] text-[color:var(--color-text-subtle)]">
                    Markdown is supported. Select text first to wrap it, or click a button to insert
                    a placeholder.
                  </p>
                </>
              ) : (
                <div className="min-h-[420px] rounded-[12px] border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-4 sm:p-6">
                  {body.trim() ? (
                    <Markdown text={body} />
                  ) : (
                    <p className="py-10 text-center text-[13.5px] text-[color:var(--color-text-subtle)]">
                      Nothing to preview yet — write something first.
                    </p>
                  )}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* ── settings column ── */}
        <div className="space-y-4">
          <Card>
            <CardBody className="space-y-3 p-4">
              <label className="block">
                <span className={FIELD_LABEL}>Status</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Status)}
                  className={SELECT_CLASS}
                >
                  <option value="DRAFT">Draft — not visible to readers</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="ARCHIVED">Archived — hidden from the magazine</option>
                </select>
              </label>

              <label className="block">
                <span className={FIELD_LABEL}>Category</span>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className={SELECT_CLASS}
                >
                  <option value="">Uncategorised</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>

              <label className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                  className="h-4 w-4 accent-[color:var(--color-brand)]"
                />
                <span className="text-[13.5px]">Feature this article</span>
              </label>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3 p-4">
              <ImageUpload
                value={coverUrl}
                onChange={setCoverUrl}
                category="articles"
                label="Cover image"
                hint="Shown on the article card and at the top of the reader."
                aspect="wide"
              />
              <label className="block">
                <span className={FIELD_LABEL}>Cover alt text</span>
                <Input
                  value={coverAlt}
                  onChange={(e) => setCoverAlt(e.target.value)}
                  placeholder="Describe the image for screen readers"
                />
              </label>
            </CardBody>
          </Card>

          {/*
            SEPARATE FROM THE INLINE IMAGES IN THE BODY, and the hint
            says so. Markdown images sit where the author put them, in
            the middle of the argument; these are the photographs that
            go with the piece, shown together at the end.
          */}
          <Card>
            <CardBody className="p-4">
              <GalleryUpload
                value={photos}
                onChange={setPhotos}
                category="articles"
                label="Photo gallery"
                hint="Shown under the article. Separate from the cover above and from images placed inside the text."
                max={10}
              />
            </CardBody>
          </Card>

          <Card>
            <CardBody className="p-4">
              <label className="block">
                <span className={FIELD_LABEL}>Video (YouTube or Vimeo)</span>
                <Input
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=…"
                />
                <span className="mt-1 block text-[11px] text-[color:var(--color-text-subtle)]">
                  Optional. Embedded above the article body.
                </span>
              </label>
            </CardBody>
          </Card>

          {isEdit && (
            <Card>
              <CardBody className="p-4">
                <button
                  type="button"
                  onClick={remove}
                  className="text-[13px] font-medium text-[color:var(--color-danger)] hover:underline"
                >
                  Delete this article
                </button>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
