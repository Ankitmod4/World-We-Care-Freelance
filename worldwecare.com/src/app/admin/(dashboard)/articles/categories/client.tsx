"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  emoji: string | null;
  color: string | null;
  sortOrder: number;
  articleCount: number;
}

export function AdminArticleCategoriesClient() {
  const [cats, setCats] = useState<Category[] | null>(null);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [color, setColor] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/article-categories");
    const d = (await res.json().catch(() => ({ categories: [] }))) as { categories: Category[] };
    setCats(d.categories);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/article-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        emoji: emoji || null,
        color: color || null,
        sortOrder: Number.parseInt(sortOrder, 10) || 0,
      }),
    });
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (!res.ok) {
      setError(d.error ?? "Create failed");
      return;
    }
    setName("");
    setEmoji("");
    setColor("");
    setSortOrder("0");
    void load();
  };

  /**
   * Set the tile's icon and tint.
   *
   * Two prompts rather than a modal: this is a screen an admin visits
   * to set up a taxonomy once, and a colour picker for a field that
   * accepts six hex characters is more chrome than the job needs. A
   * bad colour is dropped server-side rather than saved, because the
   * value goes into an inline style.
   */
  const restyle = async (id: string, currentEmoji: string | null, currentColor: string | null) => {
    const nextEmoji = window.prompt("Emoji for the tile — blank to clear", currentEmoji ?? "");
    if (nextEmoji === null) return;
    const nextColor = window.prompt(
      "Accent colour as hex, e.g. #10b981 — blank to clear",
      currentColor ?? "",
    );
    if (nextColor === null) return;
    await fetch(`/api/admin/article-categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji: nextEmoji || null, color: nextColor || null }),
    });
    void load();
  };

  const rename = async (id: string, current: string) => {
    const next = window.prompt("Rename category", current);
    if (next === null || !next.trim()) return;
    await fetch(`/api/admin/article-categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: next }),
    });
    void load();
  };

  const remove = async (id: string, count: number) => {
    const msg =
      count > 0
        ? `Delete this category? Its ${count} article(s) stay published but become uncategorised.`
        : "Delete this category?";
    if (!window.confirm(msg)) return;
    await fetch(`/api/admin/article-categories/${id}`, { method: "DELETE" });
    void load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Article categories</h1>
          <p className="mt-0.5 text-[13px] text-[color:var(--color-text-muted)]">
            Sections readers can browse by — sobriety, meditation, spiritual therapy, and so on.
          </p>
        </div>
        <Link href="/admin/articles">
          <Button variant="secondary" size="sm">Back to articles</Button>
        </Link>
      </div>

      <Card>
        <CardBody className="p-4">
          <div className="flex flex-wrap items-end gap-2">
            <label className="block min-w-[180px] flex-1">
              <span className="mb-1 block text-[12px] font-medium text-[color:var(--color-text-muted)]">New category</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sobriety" />
            </label>
            {/* Both feed the tile on /articles — the emoji sits in the
                circle, the colour tints it. Optional: a tile with
                neither falls back to a bullet on a grey circle. */}
            <label className="block w-20">
              <span className="mb-1 block text-[12px] font-medium text-[color:var(--color-text-muted)]">Emoji</span>
              <Input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="🌱" />
            </label>
            <label className="block w-28">
              <span className="mb-1 block text-[12px] font-medium text-[color:var(--color-text-muted)]">Colour</span>
              <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="#10b981" />
            </label>
            <label className="block w-24">
              <span className="mb-1 block text-[12px] font-medium text-[color:var(--color-text-muted)]">Order</span>
              <Input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} inputMode="numeric" />
            </label>
            <Button onClick={create} loading={saving}>Add</Button>
          </div>
          {error && <p className="mt-2 text-[12.5px] text-[color:var(--color-danger)]">{error}</p>}
        </CardBody>
      </Card>

      {cats === null ? (
        <p className="text-[13px] text-[color:var(--color-text-subtle)]">Loading…</p>
      ) : cats.length === 0 ? (
        <Card>
          <CardBody>
            <p className="py-4 text-center text-[14px] text-[color:var(--color-text-muted)]">No categories yet.</p>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="divide-y divide-[color:var(--color-border-soft)] p-0">
            {cats.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[16px]"
                  style={{
                    backgroundColor: c.color ? `${c.color}1f` : "var(--color-surface-muted)",
                  }}
                  aria-hidden
                >
                  {c.emoji ?? "•"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium">{c.name}</p>
                  <p className="text-[11.5px] tabular-nums text-[color:var(--color-text-subtle)]">
                    order {c.sortOrder} · {c.articleCount} {c.articleCount === 1 ? "article" : "articles"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => rename(c.id, c.name)}
                  className="text-[12.5px] font-medium text-[color:var(--color-brand)] hover:underline"
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => restyle(c.id, c.emoji, c.color)}
                  className="text-[12.5px] font-medium text-[color:var(--color-brand)] hover:underline"
                >
                  Icon
                </button>
                <button
                  type="button"
                  onClick={() => remove(c.id, c.articleCount)}
                  className="text-[12.5px] font-medium text-[color:var(--color-danger)] hover:underline"
                >
                  Delete
                </button>
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
