"use client";

/**
 * Campaign editor.
 *
 * Left column: the campaign's own words. Right column: everything it
 * points at. That split is the feature in miniature — the only content
 * an admin writes here is a title, a summary and the case for the
 * cause; the rest is choosing which existing articles, events and
 * chatroom belong on the page.
 *
 * Attachments save immediately rather than on Save, because they are
 * relationships rather than fields, and a half-saved list of links is
 * a confusing thing to reason about.
 */

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/admin/image-upload";
import { GalleryUpload, type GalleryPhoto } from "@/components/admin/gallery-upload";
import { MarkdownToolbar } from "@/components/admin/markdown-toolbar";
import { useRef } from "react";
import { Img } from "@/components/ui/img";

const LABEL = "mb-1 block text-[12px] font-medium text-[color:var(--color-text-muted)]";
const SELECT =
  "h-10 w-full rounded-[10px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 text-[14px]";

interface ArticleRef {
  id: string;
  title: string;
  slug: string;
  status: string;
  coverUrl: string | null;
}
interface EventRef {
  id: string;
  title: string;
  slug: string;
  status: string;
  startsAt: string;
  coverUrl: string | null;
}
interface RoomRef {
  id: string;
  name: string;
  slug: string;
}

export function CampaignForm({ campaignId }: { campaignId?: string }) {
  const router = useRouter();
  const isEdit = !!campaignId;
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [emoji, setEmoji] = useState("");
  const [callToAction, setCallToAction] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [status, setStatus] = useState("DRAFT");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [chatRoomId, setChatRoomId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<
    Array<{ id: string; name: string; emoji: string | null }>
  >([]);

  const [articles, setArticles] = useState<ArticleRef[]>([]);
  const [events, setEvents] = useState<EventRef[]>([]);
  const [room, setRoom] = useState<RoomRef | null>(null);

  const [pickerQuery, setPickerQuery] = useState("");
  const [options, setOptions] = useState<{
    articles: ArticleRef[];
    events: EventRef[];
    rooms: RoomRef[];
  } | null>(null);

  const load = useCallback(async () => {
    if (!campaignId) return;
    const res = await fetch(`/api/admin/campaigns/${campaignId}`, { cache: "no-store" });
    if (!res.ok) {
      setError("Could not load this campaign.");
      setLoading(false);
      return;
    }
    const { campaign: c } = (await res.json()) as { campaign: Record<string, unknown> };
    setTitle((c.title as string) ?? "");
    setSlug((c.slug as string) ?? "");
    setSummary((c.summary as string) ?? "");
    setBody((c.body as string) ?? "");
    setCoverUrl((c.coverUrl as string) ?? "");
    setPhotos(Array.isArray(c.photos) ? (c.photos as GalleryPhoto[]) : []);
    setEmoji((c.emoji as string) ?? "");
    setCallToAction((c.callToAction as string) ?? "");
    setCtaUrl((c.ctaUrl as string) ?? "");
    setStatus((c.status as string) ?? "DRAFT");
    setStartsAt(c.startsAt ? String(c.startsAt).slice(0, 10) : "");
    setEndsAt(c.endsAt ? String(c.endsAt).slice(0, 10) : "");
    setChatRoomId((c.chatRoomId as string) ?? "");
    setCategoryId((c.categoryId as string) ?? "");
    setRoom((c.room as RoomRef | null) ?? null);
    setArticles(
      ((c.articles as Array<{ article: ArticleRef }>) ?? []).map((a) => a.article).filter(Boolean),
    );
    setEvents(((c.events as Array<{ event: EventRef }>) ?? []).map((e) => e.event).filter(Boolean));
    setLoading(false);
  }, [campaignId]);

  useEffect(() => {
    void load();
  }, [load]);

  // The picker's options. Fetched rather than passed down because this
  // form is a client component reached from two different pages; the
  // list is twelve rows and is not worth threading through both.
  useEffect(() => {
    void fetch("/api/public/campaign-categories", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { categories?: Array<{ id: string; name: string; emoji: string | null }> } | null) =>
        setCategories(d?.categories ?? []),
      )
      .catch(() => {});
  }, []);

  // Attachment options, debounced so typing doesn't hammer the search.
  useEffect(() => {
    if (!isEdit) return;
    const t = setTimeout(() => {
      void fetch(`/api/admin/campaigns/attachables?q=${encodeURIComponent(pickerQuery)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setOptions(d))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [pickerQuery, isEdit]);

  const save = async () => {
    setError(null);
    setNotice(null);
    if (!title.trim()) {
      setError("Give the campaign a title.");
      return;
    }
    setSaving(true);
    const payload = {
      title,
      summary: summary || null,
      body: body || null,
      coverUrl: coverUrl || null,
      photos,
      emoji: emoji || null,
      callToAction: callToAction || null,
      ctaUrl: ctaUrl || null,
      status,
      startsAt: startsAt || null,
      endsAt: endsAt || null,
      chatRoomId: chatRoomId || null,
      categoryId: categoryId || null,
    };
    const res = await fetch(isEdit ? `/api/admin/campaigns/${campaignId}` : "/api/admin/campaigns", {
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
      router.push(`/admin/campaigns/${d.id}`);
      return;
    }
    setNotice("Saved");
    await load();
  };

  const attach = async (kind: "articles" | "events", targetId: string) => {
    await fetch(`/api/admin/campaigns/${campaignId}/attachments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "attach", kind, targetId }),
    });
    await load();
  };

  const detach = async (kind: "articles" | "events", targetId: string) => {
    await fetch(`/api/admin/campaigns/${campaignId}/attachments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "detach", kind, targetId }),
    });
    await load();
  };

  const remove = async () => {
    const res = await fetch(`/api/admin/campaigns/${campaignId}`, { method: "DELETE" });
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setError(d.error ?? "Could not delete.");
      return;
    }
    router.push("/admin/campaigns");
  };

  if (loading) {
    return <p className="p-6 text-[13px] text-[color:var(--color-text-subtle)]">Loading…</p>;
  }

  const attachedArticleIds = new Set(articles.map((a) => a.id));
  const attachedEventIds = new Set(events.map((e) => e.id));

  return (
    <div className="space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] sm:text-[26px]">
            {isEdit ? title || "Edit campaign" : "New campaign"}
          </h1>
          <p className="mt-0.5 text-[13px] text-[color:var(--color-text-muted)]">
            {isEdit && slug ? (
              <>
                Live at{" "}
                <Link href={`/campaigns/${slug}`} className="text-[color:var(--color-brand)] hover:underline">
                  /campaigns/{slug}
                </Link>
              </>
            ) : (
              "Name the cause, not the activity — “Safe housing for care leavers”, not “Housing week”."
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/campaigns">
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
        {/* ── the campaign's own words ─────────────────────── */}
        <div className="space-y-4">
          <Card>
            <CardBody className="space-y-3 p-4">
              <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-3">
                <label className="block">
                  <span className={LABEL}>Emoji</span>
                  <Input
                    value={emoji}
                    onChange={(e) => setEmoji(e.target.value.slice(0, 8))}
                    placeholder="📣"
                    className="text-center text-[18px]"
                  />
                </label>
                <label className="block">
                  <span className={LABEL}>Title</span>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </label>
              </div>
              <label className="block">
                <span className={LABEL}>Summary — one line on the index card</span>
                <Input value={summary} onChange={(e) => setSummary(e.target.value.slice(0, 400))} />
              </label>
              <div>
                <span className={LABEL}>The case — Markdown</span>
                <div className="rounded-t-[10px] border border-b-0 border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] px-2 py-1.5">
                  <MarkdownToolbar
                    textareaRef={bodyRef}
                    value={body}
                    onChange={setBody}
                    uploadCategory="campaigns"
                  />
                </div>
                <Textarea
                  ref={bodyRef}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={12}
                  className="rounded-t-none font-mono text-[13.5px]"
                  placeholder={"Why this matters, what has happened so far, what you're asking people to do."}
                />
              </div>
            </CardBody>
          </Card>

          {/* ── attachments ──────────────────────────────── */}
          {isEdit ? (
            <Card>
              <CardBody className="space-y-4 p-4">
                <div>
                  <p className="text-[14px] font-semibold">What&apos;s on the page</p>
                  <p className="text-[12px] text-[color:var(--color-text-muted)]">
                    Changes here save straight away. Nothing is copied — each block links to the
                    real article, event or room.
                  </p>
                </div>

                <Input
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                  placeholder="Search articles, events and rooms to attach…"
                />

                <AttachedList
                  title="Articles"
                  empty="No articles attached."
                  items={articles.map((a) => ({
                    id: a.id,
                    label: a.title,
                    sub: a.status === "PUBLISHED" ? "Published" : `${a.status} — hidden on the campaign page`,
                    warn: a.status !== "PUBLISHED",
                    coverUrl: a.coverUrl,
                  }))}
                  onRemove={(id) => void detach("articles", id)}
                />
                {options && (
                  <Options
                    label="Add an article"
                    items={options.articles
                      .filter((a) => !attachedArticleIds.has(a.id))
                      .map((a) => ({ id: a.id, label: a.title, sub: a.status }))}
                    onPick={(id) => void attach("articles", id)}
                  />
                )}

                <AttachedList
                  title="Events"
                  empty="No events attached."
                  items={events.map((e) => ({
                    id: e.id,
                    label: e.title,
                    sub:
                      e.status === "APPROVED"
                        ? new Date(e.startsAt).toLocaleDateString()
                        : `${e.status} — hidden on the campaign page`,
                    warn: e.status !== "APPROVED",
                    coverUrl: e.coverUrl,
                  }))}
                  onRemove={(id) => void detach("events", id)}
                />
                {options && (
                  <Options
                    label="Add an event"
                    items={options.events
                      .filter((e) => !attachedEventIds.has(e.id))
                      .map((e) => ({ id: e.id, label: e.title, sub: e.status }))}
                    onPick={(id) => void attach("events", id)}
                  />
                )}

                <label className="block">
                  <span className={LABEL}>Chatroom</span>
                  <select
                    value={chatRoomId}
                    onChange={(e) => setChatRoomId(e.target.value)}
                    className={SELECT}
                  >
                    <option value="">None</option>
                    {room && !options?.rooms.some((r) => r.id === room.id) && (
                      <option value={room.id}>{room.name}</option>
                    )}
                    {options?.rooms.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  <span className="mt-1 block text-[11px] text-[color:var(--color-text-subtle)]">
                    Saved with the campaign, not immediately — press Save.
                  </span>
                </label>
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardBody className="p-6 text-center">
                <p className="text-[14px] font-medium">Attachments come next</p>
                <p className="mt-1 text-[13px] text-[color:var(--color-text-muted)]">
                  Save the campaign first — then you can pick the articles, events and chatroom that
                  belong to it.
                </p>
              </CardBody>
            </Card>
          )}
        </div>

        {/* ── sidebar ──────────────────────────────────────── */}
        <div className="space-y-4">
          <Card>
            <CardBody className="space-y-3 p-4">
              {/*
                ABOVE STATUS, because it gates it: the server refuses to
                publish a campaign with no category — it would go live
                under no tile and nobody would arrive at it — so the
                field that has to be filled in comes before the one that
                would be rejected without it.
              */}
              <label className="block">
                <span className={LABEL}>Category</span>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className={SELECT}
                >
                  <option value="">No category — can&apos;t be published</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji ? `${c.emoji} ` : ""}
                      {c.name}
                    </option>
                  ))}
                </select>
                {categories.length === 0 && (
                  <span className="mt-1 block text-[11px] text-[color:var(--color-danger)]">
                    No categories exist yet. Run `npm run db:seed-campaign-categories`.
                  </span>
                )}
              </label>

              <label className="block">
                <span className={LABEL}>Status</span>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={SELECT}>
                  <option value="DRAFT">Draft — not visible</option>
                  <option value="PUBLISHED">Published</option>
                  <option value="ARCHIVED">Archived — hidden</option>
                  {/* PENDING and REJECTED are review outcomes, not
                      things to set by hand: they belong to a member's
                      submission and carry a notification with them.
                      Shown only when the row is already in one, so the
                      select never silently rewrites the status. */}
                  {status === "PENDING" && <option value="PENDING">Waiting for review</option>}
                  {status === "REJECTED" && <option value="REJECTED">Rejected</option>}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className={LABEL}>Starts</span>
                  <Input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                </label>
                <label className="block">
                  <span className={LABEL}>Ends</span>
                  <Input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
                </label>
              </div>
              <p className="text-[11px] text-[color:var(--color-text-subtle)]">
                Past the end date the campaign reads as finished rather than disappearing.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="p-4">
              <ImageUpload
                value={coverUrl}
                onChange={setCoverUrl}
                category="campaigns"
                label="Cover image"
                hint="Shown on the index card and across the top of the page."
                aspect="wide"
              />
            </CardBody>
          </Card>

          <Card>
            <CardBody className="p-4">
              <GalleryUpload
                value={photos}
                onChange={setPhotos}
                category="campaigns"
                label="Photos"
                hint="Shown under the case on the campaign's page. The cover above is separate."
                max={10}
              />
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3 p-4">
              <p className="text-[13px] font-semibold">Call to action — optional</p>
              <label className="block">
                <span className={LABEL}>Button label</span>
                <Input
                  value={callToAction}
                  onChange={(e) => setCallToAction(e.target.value.slice(0, 120))}
                  placeholder="Sign the pledge"
                />
              </label>
              <label className="block">
                <span className={LABEL}>Link</span>
                <Input value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://…" />
              </label>
              <p className="text-[11px] text-[color:var(--color-text-subtle)]">
                An external link for the campaign&apos;s call to action. To attach a petition
                hosted here, set its id in the Petition field instead — it renders as a signable
                card on the campaign page.
              </p>
            </CardBody>
          </Card>

          {isEdit && (
            <Card>
              <CardBody className="p-4">
                <p className="text-[13px] font-semibold">Delete this campaign</p>
                <p className="mt-1 text-[11.5px] text-[color:var(--color-text-subtle)]">
                  Its articles, events and chatroom are left alone — they belong to other features.
                  Only the campaign page and its supporter list go.
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

function AttachedList({
  title,
  empty,
  items,
  onRemove,
}: {
  title: string;
  empty: string;
  items: Array<{ id: string; label: string; sub: string; warn?: boolean; coverUrl?: string | null }>;
  onRemove: (id: string) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[12px] font-medium text-[color:var(--color-text-muted)]">{title}</p>
      {items.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-[color:var(--color-border)] px-3 py-2.5 text-[12.5px] text-[color:var(--color-text-subtle)]">
          {empty}
        </p>
      ) : (
        <ul className="divide-y divide-[color:var(--color-border-soft)] rounded-[10px] border border-[color:var(--color-border-soft)]">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-2.5 px-2.5 py-2">
              <div className="h-9 w-12 shrink-0 overflow-hidden rounded-[8px] bg-[color:var(--color-surface-muted)]">
                {item.coverUrl ? (
                  <Img src={item.coverUrl} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">{item.label}</p>
                <p
                  className={`text-[11px] ${
                    item.warn ? "text-[color:var(--color-warning)]" : "text-[color:var(--color-text-subtle)]"
                  }`}
                >
                  {item.sub}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                aria-label={`Remove ${item.label}`}
                className="flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--color-text-subtle)] hover:bg-[color:var(--color-danger)]/10 hover:text-[color:var(--color-danger)]"
              >
                <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden>
                  <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Options({
  label,
  items,
  onPick,
}: {
  label: string;
  items: Array<{ id: string; label: string; sub: string }>;
  onPick: (id: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-[11.5px] text-[color:var(--color-text-subtle)]">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.slice(0, 8).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onPick(item.id)}
            className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[color:var(--color-border)] px-2.5 py-1 text-[12px] transition-colors duration-200 hover:border-[color:var(--color-brand)] hover:text-[color:var(--color-brand)]"
          >
            <span className="truncate">{item.label}</span>
            <span className="text-[10px] text-[color:var(--color-text-subtle)]">{item.sub}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
