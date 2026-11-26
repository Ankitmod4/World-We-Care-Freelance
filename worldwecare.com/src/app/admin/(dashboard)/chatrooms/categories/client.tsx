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
  sortOrder: number;
  roomCount: number;
}

export function AdminChatCategoriesClient() {
  const [cats, setCats] = useState<Category[] | null>(null);
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/chat/categories");
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
    const res = await fetch("/api/admin/chat/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, sortOrder: Number.parseInt(sortOrder, 10) || 0 }),
    });
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (!res.ok) {
      setError(d.error ?? "Create failed");
      return;
    }
    setName("");
    setSortOrder("0");
    void load();
  };

  const rename = async (id: string, current: string) => {
    const next = window.prompt("Rename category", current);
    if (next === null || !next.trim()) return;
    await fetch(`/api/admin/chat/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: next }),
    });
    void load();
  };

  const remove = async (id: string) => {
    await fetch(`/api/admin/chat/categories/${id}`, { method: "DELETE" });
    void load();
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Chat categories</h1>
          <p className="text-[13px] text-[color:var(--color-text-muted)] mt-0.5">
            Group rooms so members can browse by topic.
          </p>
        </div>
        <Link href="/admin/chatrooms"><Button variant="secondary" size="sm">Back to rooms</Button></Link>
      </div>

      <Card>
        <CardBody className="p-4">
          <div className="flex items-end gap-2 flex-wrap">
            <label className="block flex-1 min-w-[180px]">
              <span className="block text-[12px] font-medium text-[color:var(--color-text-muted)] mb-1">New category</span>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Recovery" />
            </label>
            <label className="block w-24">
              <span className="block text-[12px] font-medium text-[color:var(--color-text-muted)] mb-1">Order</span>
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
        <Card><CardBody><p className="text-[14px] text-[color:var(--color-text-muted)] py-4 text-center">No categories yet.</p></CardBody></Card>
      ) : (
        <Card>
          <CardBody className="p-0 divide-y divide-[color:var(--color-border-soft)]">
            {cats.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-medium truncate">{c.name}</p>
                  <p className="text-[11.5px] text-[color:var(--color-text-subtle)]">
                    order {c.sortOrder} · {c.roomCount} {c.roomCount === 1 ? "room" : "rooms"}
                  </p>
                </div>
                <button type="button" onClick={() => rename(c.id, c.name)} className="text-[12.5px] font-medium text-[color:var(--color-brand)] hover:underline">Rename</button>
                <button type="button" onClick={() => remove(c.id)} className="text-[12.5px] font-medium text-[color:var(--color-danger)] hover:underline">Delete</button>
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
