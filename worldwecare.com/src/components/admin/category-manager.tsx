"use client";

/**
 * Category management, for confessions and gratitude.
 *
 * One component, two mount points — the two sets are separate tables
 * with identical shapes, and writing this twice would mean two places
 * to fix the next bug in it.
 *
 * THE IMPORTANT BIT IS DELETE. A category with posts under it is not
 * really deletable: the relation is SetNull, so removing it silently
 * un-categorises every post filed there, and nothing records where
 * they were. So the row shows its post count, delete says the number
 * out loud before it happens, and the gentler option — Hide — sits
 * next to it doing what most people actually want: stop offering it,
 * keep the history.
 */

import { useCallback, useEffect, useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  emoji: string | null;
  sortOrder: number;
  isActive: boolean;
  count: number;
}

export function CategoryManager({
  endpoint,
  noun,
  placeholder,
}: {
  /** e.g. "/api/admin/confession-categories" */
  endpoint: string;
  /** What sits under a category, for the copy: "confession" / "entry". */
  noun: string;
  placeholder: string;
}) {
  const [cats, setCats] = useState<AdminCategory[] | null>(null);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(endpoint, { cache: "no-store" }).catch(() => null);
    if (!res?.ok) {
      setError("Could not load categories.");
      return;
    }
    const d = (await res.json()) as { categories: AdminCategory[] };
    setCats(d.categories ?? []);
  }, [endpoint]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy("new");
    setError(null);
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        emoji: emoji || null,
        sortOrder: Number.parseInt(sortOrder, 10) || 0,
      }),
    }).catch(() => null);
    setBusy(null);
    if (!res?.ok) {
      const d = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
      setError(d?.error ?? "Create failed.");
      return;
    }
    setName("");
    setEmoji("");
    setSortOrder("0");
    void load();
  };

  const patch = async (id: string, data: Record<string, unknown>) => {
    setBusy(id);
    setError(null);
    const res = await fetch(`${endpoint}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).catch(() => null);
    setBusy(null);
    if (!res?.ok) {
      const d = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
      setError(d?.error ?? "Update failed.");
      return;
    }
    void load();
  };

  const remove = async (cat: AdminCategory) => {
    // The count is why this asks. Deleting a category with posts under
    // it un-categorises them permanently, and there is no undo.
    const warning =
      cat.count > 0
        ? `Delete "${cat.name}"?\n\n${cat.count} ${noun}${cat.count === 1 ? "" : "s"} ` +
          `will lose their category. They are not deleted, but nothing records where they were, ` +
          `so this cannot be undone.\n\nHide it instead if you just want to stop offering it.`
        : `Delete "${cat.name}"? Nothing is filed under it.`;
    if (!window.confirm(warning)) return;

    setBusy(cat.id);
    const res = await fetch(`${endpoint}/${cat.id}`, { method: "DELETE" }).catch(() => null);
    setBusy(null);
    if (!res?.ok) {
      setError("Delete failed.");
      return;
    }
    void load();
  };

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-xl bg-[color:var(--color-danger)]/10 px-3 py-2 text-[13px] text-[color:var(--color-danger)]">
          {error}
        </p>
      )}

      <Card>
        <CardBody>
          <form onSubmit={create} className="flex flex-wrap items-end gap-2">
            <label className="min-w-[180px] flex-1">
              <span className="mb-1.5 block text-[12.5px] font-medium">New category</span>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={placeholder}
                maxLength={60}
              />
            </label>
            <label className="w-[86px]">
              <span className="mb-1.5 block text-[12.5px] font-medium">Emoji</span>
              <Input
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                placeholder="🌱"
                maxLength={8}
              />
            </label>
            <label className="w-[86px]">
              <span className="mb-1.5 block text-[12.5px] font-medium">Order</span>
              <Input
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                inputMode="numeric"
              />
            </label>
            <Button type="submit" loading={busy === "new"} disabled={!name.trim()}>
              Add
            </Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-0">
          {cats === null ? (
            <p className="px-4 py-6 text-[13px] text-[color:var(--color-text-subtle)]">Loading…</p>
          ) : cats.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-[color:var(--color-text-subtle)]">
              No categories yet. The first one you add starts appearing on the composer.
            </p>
          ) : (
            <ul>
              {cats.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center gap-3 border-b border-[color:var(--color-border-soft)] px-4 py-3 last:border-b-0"
                >
                  <span className="w-7 shrink-0 text-center text-[17px]" aria-hidden>
                    {c.emoji ?? "—"}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-1.5 text-[14px] font-medium">
                      {c.name}
                      {!c.isActive && (
                        <span className="rounded-full bg-[color:var(--color-surface-muted)] px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
                          Hidden
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[11.5px] tabular-nums text-[color:var(--color-text-subtle)]">
                      /{c.slug} · {c.count} {noun}
                      {c.count === 1 ? "" : "s"} · order {c.sortOrder}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy === c.id}
                      onClick={() => {
                        const next = window.prompt("Rename category", c.name);
                        if (next?.trim()) void patch(c.id, { name: next });
                      }}
                    >
                      Rename
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy === c.id}
                      onClick={() => void patch(c.id, { isActive: !c.isActive })}
                    >
                      {c.isActive ? "Hide" : "Show"}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={busy === c.id}
                      onClick={() => void remove(c)}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <p className="px-1 text-[12px] leading-relaxed text-[color:var(--color-text-muted)]">
        <strong>Hide</strong> stops a category being offered on new posts and removes it from
        the filter row, while everything already filed under it keeps its category.{" "}
        <strong>Delete</strong> removes it for good — the {noun}s survive but become
        uncategorised, and there is no record of where they were.
      </p>
    </div>
  );
}
