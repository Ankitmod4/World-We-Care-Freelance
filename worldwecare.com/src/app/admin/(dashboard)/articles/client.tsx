"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Img } from "@/components/ui/img";

type Status = "DRAFT" | "PUBLISHED" | "ARCHIVED";

interface Row {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  status: Status;
  isFeatured: boolean;
  publishedAt: string | null;
  readMinutes: number;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  authorName: string;
  category: { id: string; name: string; slug: string } | null;
  updatedAt: string;
}

const STATUS_STYLES: Record<Status, string> = {
  PUBLISHED: "bg-[color:var(--color-success-soft)] text-[color:var(--color-success-ink)]",
  DRAFT: "bg-[color:var(--color-surface-muted)] text-[color:var(--color-text-muted)]",
  ARCHIVED: "bg-[color:var(--color-surface-muted)] text-[color:var(--color-text-subtle)]",
};

export function AdminArticlesClient() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status | "ALL">("ALL");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ status, perPage: "50" });
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/admin/articles?${params}`);
    const d = (await res.json().catch(() => ({ articles: [], total: 0 }))) as {
      articles: Row[];
      total: number;
    };
    setRows(d.articles);
    setTotal(d.total);
  }, [q, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = async (id: string, body: Record<string, unknown>) => {
    setBusy(id);
    await fetch(`/api/admin/articles/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(null);
    void load();
  };

  const remove = async (id: string, title: string) => {
    if (!window.confirm(`Delete “${title}”? This also removes its comments, likes and saves.`)) return;
    setBusy(id);
    await fetch(`/api/admin/articles/${id}`, { method: "DELETE" });
    setBusy(null);
    void load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Articles</h1>
          <p className="mt-0.5 text-[13px] text-[color:var(--color-text-muted)]">
            Long-form pieces for the magazine. {total} total.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/articles/categories">
            <Button variant="secondary" size="sm">Categories</Button>
          </Link>
          <Link href="/admin/articles/new">
            <Button size="sm">New article</Button>
          </Link>
        </div>
      </div>

      <Card>
        <CardBody className="p-4">
          <div className="flex flex-wrap items-end gap-2">
            <label className="block min-w-[180px] flex-1">
              <span className="mb-1 block text-[12px] font-medium text-[color:var(--color-text-muted)]">Search</span>
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Title or excerpt" />
            </label>
            <label className="block w-40">
              <span className="mb-1 block text-[12px] font-medium text-[color:var(--color-text-muted)]">Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Status | "ALL")}
                className="h-10 w-full rounded-[10px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 text-[14px]"
              >
                <option value="ALL">All</option>
                <option value="PUBLISHED">Published</option>
                <option value="DRAFT">Draft</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </label>
          </div>
        </CardBody>
      </Card>

      {rows === null ? (
        <p className="text-[13px] text-[color:var(--color-text-subtle)]">Loading…</p>
      ) : rows.length === 0 ? (
        <Card>
          <CardBody>
            <p className="py-6 text-center text-[14px] text-[color:var(--color-text-muted)]">
              No articles yet. Create the first one.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {rows.map((a) => (
            <Card key={a.id}>
              <CardBody className="flex gap-3 p-3">
                <div className="h-20 w-28 shrink-0 overflow-hidden rounded-xl bg-[color:var(--color-surface-muted)]">
                  {a.coverUrl ? (
                    <Img src={a.coverUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[11px] text-[color:var(--color-text-subtle)]">
                      No cover
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${STATUS_STYLES[a.status]}`}>
                      {a.status}
                    </span>
                    {a.isFeatured && (
                      <span className="rounded-full bg-[color:var(--color-brand)]/10 px-2 py-0.5 text-[10.5px] font-semibold text-[color:var(--color-brand)]">
                        Featured
                      </span>
                    )}
                    {a.category && (
                      <span className="text-[11px] text-[color:var(--color-text-subtle)]">{a.category.name}</span>
                    )}
                  </div>

                  <p className="mt-1 truncate text-[14.5px] font-semibold tracking-[-0.01em]">{a.title}</p>
                  <p className="mt-0.5 text-[11.5px] tabular-nums text-[color:var(--color-text-subtle)]">
                    {a.readMinutes} min · {a.viewCount} views · {a.likeCount} likes · {a.commentCount} comments
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Link
                      href={`/admin/articles/${a.id}`}
                      className="text-[12.5px] font-medium text-[color:var(--color-brand)] hover:underline"
                    >
                      Edit
                    </Link>
                    {a.status === "PUBLISHED" ? (
                      <button
                        type="button"
                        disabled={busy === a.id}
                        onClick={() => patch(a.id, { status: "DRAFT" })}
                        className="text-[12.5px] font-medium text-[color:var(--color-text-muted)] hover:underline"
                      >
                        Unpublish
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={busy === a.id}
                        onClick={() => patch(a.id, { status: "PUBLISHED" })}
                        className="text-[12.5px] font-medium text-[color:var(--color-brand)] hover:underline"
                      >
                        Publish
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy === a.id}
                      onClick={() => patch(a.id, { isFeatured: !a.isFeatured })}
                      className="text-[12.5px] font-medium text-[color:var(--color-text-muted)] hover:underline"
                    >
                      {a.isFeatured ? "Unfeature" : "Feature"}
                    </button>
                    {a.status === "PUBLISHED" && (
                      <a
                        href={`/articles/${a.slug}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[12.5px] font-medium text-[color:var(--color-text-muted)] hover:underline"
                      >
                        View
                      </a>
                    )}
                    <button
                      type="button"
                      disabled={busy === a.id}
                      onClick={() => remove(a.id, a.title)}
                      className="text-[12.5px] font-medium text-[color:var(--color-danger)] hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
