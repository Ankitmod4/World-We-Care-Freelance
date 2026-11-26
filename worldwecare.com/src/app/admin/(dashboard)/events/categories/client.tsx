"use client";

/**
 * Event categories.
 *
 * Choosing one is REQUIRED to post an event, which makes this page
 * load-bearing: with no active category here, nobody can add anything
 * at all. The empty state says so rather than looking like a page
 * nobody has got round to filling in.
 */

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
  isActive: boolean;
  eventCount: number;
  upcomingCount: number;
}

export function AdminEventCategoriesClient() {
  const [cats, setCats] = useState<Category[] | null>(null);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [color, setColor] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/event-categories", { cache: "no-store" });
    const d = (await res.json().catch(() => ({ categories: [] }))) as {
      categories: Category[];
    };
    setCats(d.categories ?? []);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/event-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        emoji: emoji || null,
        color: color || null,
        description: description || null,
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
    setDescription("");
    setSortOrder("0");
    void load();
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    setError(null);
    const res = await fetch(`/api/admin/event-categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setError(d.error ?? "Update failed");
      return;
    }
    void load();
  };

  const rename = (c: Category) => {
    const next = window.prompt("Rename category", c.name);
    if (next === null || !next.trim()) return;
    void patch(c.id, { name: next });
  };

  const remove = async (c: Category) => {
    if (!window.confirm(`Delete "${c.name}"? Retiring keeps it on past events.`)) return;
    setError(null);
    const res = await fetch(`/api/admin/event-categories/${c.id}`, { method: "DELETE" });
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setError(d.error ?? "Delete failed");
      return;
    }
    void load();
  };

  const activeCount = cats?.filter((c) => c.isActive).length ?? 0;

  return (
    <div className="max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Event categories</h1>
          <p className="mt-0.5 text-[13px] text-[color:var(--color-text-muted)]">
            Organisers pick one when they post, and the calendar can be filtered by them.
          </p>
        </div>
        <Link href="/admin/events">
          <Button variant="secondary" size="sm">Back to events</Button>
        </Link>
      </div>

      {cats !== null && activeCount === 0 && (
        <div className="rounded-[12px] border border-[color:var(--color-warning-soft)] bg-[color:var(--color-warning-soft)] px-3.5 py-2.5 text-[13px] leading-relaxed text-[color:var(--color-warning-ink)]">
          No active categories — <strong>nobody can post an event right now</strong>,
          because choosing one is required. Add at least one below.
        </div>
      )}

      <Card>
        <CardBody className="p-4">
          <div className="flex flex-wrap items-end gap-2">
            <label className="block min-w-[180px] flex-1">
              <span className="mb-1 block text-[12px] font-medium text-[color:var(--color-text-muted)]">
                New category
              </span>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Check-ins"
              />
            </label>
            <label className="block w-20">
              <span className="mb-1 block text-[12px] font-medium text-[color:var(--color-text-muted)]">
                Emoji
              </span>
              <Input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="☕" />
            </label>
            <label className="block w-28">
              <span className="mb-1 block text-[12px] font-medium text-[color:var(--color-text-muted)]">
                Colour
              </span>
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="#0ea5e9"
              />
            </label>
            <label className="block w-20">
              <span className="mb-1 block text-[12px] font-medium text-[color:var(--color-text-muted)]">
                Order
              </span>
              <Input
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                inputMode="numeric"
              />
            </label>
            <Button onClick={create} loading={saving}>Add</Button>
          </div>
          <label className="mt-2 block">
            <span className="mb-1 block text-[12px] font-medium text-[color:var(--color-text-muted)]">
              Description — shown under the picker when it&apos;s selected
            </span>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Quiet company while you get on with your day."
            />
          </label>
          {error && (
            <p className="mt-2 text-[12.5px] text-[color:var(--color-danger)]">{error}</p>
          )}
        </CardBody>
      </Card>

      {cats === null ? (
        <p className="text-[13px] text-[color:var(--color-text-subtle)]">Loading…</p>
      ) : cats.length === 0 ? (
        <Card>
          <CardBody>
            <p className="py-4 text-center text-[14px] text-[color:var(--color-text-muted)]">
              No categories yet.
            </p>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="divide-y divide-[color:var(--color-border-soft)] p-0">
            {cats.map((c) => (
              <div
                key={c.id}
                className={`flex items-center gap-3 px-4 py-3 ${c.isActive ? "" : "opacity-60"}`}
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[14px]"
                  style={
                    c.color
                      ? { backgroundColor: `${c.color}1f`, color: c.color }
                      : undefined
                  }
                >
                  {c.emoji ?? "•"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium">
                    {c.name}
                    {!c.isActive && (
                      <span className="ml-2 rounded-full bg-[color:var(--color-surface-muted)] px-2 py-0.5 text-[11px] font-medium text-[color:var(--color-text-subtle)]">
                        Retired
                      </span>
                    )}
                    {c.upcomingCount > 0 && (
                      <span className="ml-2 rounded-full bg-[color:var(--color-danger)] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--color-on-danger)]">
                        {c.upcomingCount} upcoming
                      </span>
                    )}
                  </p>
                  <p className="text-[11.5px] text-[color:var(--color-text-subtle)]">
                    /{c.slug} · order {c.sortOrder} · {c.eventCount}{" "}
                    {c.eventCount === 1 ? "event" : "events"}
                    {c.description ? ` · ${c.description}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => rename(c)}
                  className="text-[12.5px] font-medium text-[color:var(--color-brand)] hover:underline"
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => void patch(c.id, { isActive: !c.isActive })}
                  className="text-[12.5px] font-medium text-[color:var(--color-text-muted)] hover:underline"
                >
                  {c.isActive ? "Retire" : "Restore"}
                </button>
                <button
                  type="button"
                  onClick={() => void remove(c)}
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
