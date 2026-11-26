"use client";

/**
 * Town Hero categories.
 *
 * Bespoke rather than the shared CategoryManager for the same reason
 * the article categories screen is: these carry a colour, which that
 * component has no field for.
 *
 * DELETING IS DELIBERATELY HARD. A category in use cannot be deleted,
 * because the relation is `onDelete: SetNull` and removing one would
 * silently strip the label off every hero filed under it — an odd
 * thing to have happen because somebody was tidying a settings screen.
 * The server refuses and says how many; the fix is the Active toggle,
 * which hides the tile and leaves the labels alone.
 */

import { useCallback, useEffect, useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Row {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  emoji: string | null;
  color: string | null;
  sortOrder: number;
  isActive: boolean;
  heroCount: number;
  publicCount: number;
}

const LABEL = "mb-1 block text-[12px] font-medium text-[color:var(--color-text-muted)]";

export function HeroCategoriesClient() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [color, setColor] = useState("#f59e0b");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/town-hero-categories", { cache: "no-store" }).catch(
      () => null,
    );
    const d = (await res?.json().catch(() => ({}))) as { categories?: Row[] };
    setRows(d?.categories ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    setError(null);
    setBusy(true);
    const res = await fetch("/api/admin/town-hero-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        emoji: emoji || null,
        color: color || null,
        description: description || null,
        sortOrder: (rows?.length ?? 0) * 10,
      }),
    }).catch(() => null);
    const d = (await res?.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res?.ok) {
      setError(d?.error ?? "Couldn't create that.");
      return;
    }
    setName("");
    setEmoji("");
    setDescription("");
    void load();
  };

  const patch = async (row: Row, body: Record<string, unknown>) => {
    setError(null);
    await fetch(`/api/admin/town-hero-categories/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    void load();
  };

  const remove = async (row: Row) => {
    setError(null);
    const res = await fetch(`/api/admin/town-hero-categories/${row.id}`, {
      method: "DELETE",
    }).catch(() => null);
    const d = (await res?.json().catch(() => ({}))) as { error?: string };
    if (!res?.ok) {
      setError(d?.error ?? "Couldn't delete that.");
      return;
    }
    void load();
  };

  return (
    <div>
      <header className="mb-4">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Town Hero categories</h1>
        <p className="mt-0.5 text-[13.5px] text-[color:var(--color-text-muted)]">
          What kind of quiet work it is. These become the tiles on the Town Heroes page.
        </p>
      </header>

      <Card className="mb-4">
        <CardBody className="p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[80px_110px_1fr]">
            <label className="block">
              <span className={LABEL}>Emoji</span>
              <Input value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} placeholder="🍲" />
            </label>
            <label className="block">
              <span className={LABEL}>Colour</span>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-11 w-full cursor-pointer rounded-[10px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-1"
              />
            </label>
            <label className="block">
              <span className={LABEL}>Name</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Food & meals" />
            </label>
          </div>
          <label className="mt-3 block">
            <span className={LABEL}>Description</span>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Soup runs, food banks, community kitchens."
              maxLength={300}
            />
          </label>
          {error && <p className="mt-2 text-[12.5px] text-[color:var(--color-danger)]">{error}</p>}
          <div className="mt-3">
            <Button size="sm" onClick={create} loading={busy} disabled={!name.trim()}>
              Add category
            </Button>
          </div>
        </CardBody>
      </Card>

      {rows === null ? (
        <p className="text-[13px] text-[color:var(--color-text-subtle)]">Loading…</p>
      ) : rows.length === 0 ? (
        <Card>
          <CardBody className="p-10 text-center">
            <p className="text-[15px] font-medium">No categories yet</p>
            <p className="mt-1 text-[13.5px] text-[color:var(--color-text-muted)]">
              Add one above, or run <code>npm run db:seed-town-hero-categories</code> for a starter set.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardBody className="flex flex-wrap items-center gap-3 p-3.5">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[18px]"
                  style={{ backgroundColor: `${r.color ?? "#94a3b8"}1f` }}
                >
                  {r.emoji ?? "•"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-semibold">
                    {r.name}
                    {!r.isActive && (
                      <span className="ml-2 rounded-full bg-[color:var(--color-surface-muted)] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--color-text-subtle)]">
                        Off
                      </span>
                    )}
                  </p>
                  <p className="text-[12px] text-[color:var(--color-text-subtle)]">
                    /{r.slug} · {r.publicCount} shown
                    {r.heroCount !== r.publicCount && ` · ${r.heroCount} in total`}
                  </p>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-[13px]">
                  <input
                    type="checkbox"
                    checked={r.isActive}
                    onChange={(e) => void patch(r, { isActive: e.target.checked })}
                    className="h-4 w-4 accent-[color:var(--color-brand)]"
                  />
                  Active
                </label>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void remove(r)}
                  disabled={r.heroCount > 0}
                  title={r.heroCount > 0 ? "In use — turn it off instead" : "Delete"}
                >
                  Delete
                </Button>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
