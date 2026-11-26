"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StatusPill, Th } from "./_ui";
import { Toast, useToast } from "./_toast";

interface Region {
  id: string;
  slug: string;
  name: string;
  code: string;
  sortOrder: number;
  isActive: boolean;
  subRegionCount: number;
  countryCount: number;
}

export function RegionsTab({ onChange }: { onChange: () => void }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Region | null>(null);
  const [creating, setCreating] = useState(false);
  const { toast, pushToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/admin/geography/regions?${params}`);
    const d = (await res.json().catch(() => ({ items: [] }))) as { items: Region[] };
    setRows(d.items ?? []);
    setLoading(false);
  }, [q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const onDelete = async (r: Region) => {
    if (!confirm(`Delete region "${r.name}"?`)) return;
    const res = await fetch(`/api/admin/geography/regions/${r.id}`, {
      method: "DELETE",
    });
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) pushToast(false, d.error ?? "Delete failed");
    else {
      pushToast(true, "Region deleted.");
      load();
      onChange();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex-1">
          <Input
            placeholder="Search regions by name, slug, or M49 code…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Button onClick={() => setCreating(true)}>Add region</Button>
      </div>

      <Card>
        <CardBody className="p-0 overflow-hidden">
          {/* Desktop table */}
          <div className="hidden md:block">
            <table className="w-full text-[13.5px]">
              <thead className="bg-[color:var(--color-surface-muted)]">
                <tr>
                  <Th>Region</Th>
                  <Th>M49</Th>
                  <Th>Slug</Th>
                  <Th>Sub-regions</Th>
                  <Th>Countries</Th>
                  <Th>Status</Th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-[color:var(--color-text-subtle)]">
                      {q ? "No matches." : "No regions yet — add the first one."}
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-[color:var(--color-border-soft)]">
                    <td className="px-4 py-3 font-medium">{r.name}</td>
                    <td className="px-4 py-3 text-[color:var(--color-text-muted)] font-mono text-[12px]">{r.code}</td>
                    <td className="px-4 py-3 text-[color:var(--color-text-muted)] font-mono text-[12px]">{r.slug}</td>
                    <td className="px-4 py-3 tabular-nums">{r.subRegionCount}</td>
                    <td className="px-4 py-3 tabular-nums">{r.countryCount}</td>
                    <td className="px-4 py-3"><StatusPill active={r.isActive} /></td>
                    <td className="px-4 py-3 text-right pr-4">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="secondary" onClick={() => setEditing(r)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => onDelete(r)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-[color:var(--color-border-soft)]">
            {!loading && rows.length === 0 && (
              <div className="text-center py-12 text-[color:var(--color-text-subtle)] text-[13px]">
                {q ? "No matches." : "No regions yet."}
              </div>
            )}
            {rows.map((r) => (
              <div key={r.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{r.name}</p>
                      <StatusPill active={r.isActive} />
                    </div>
                    <p className="text-[12px] text-[color:var(--color-text-muted)] mt-0.5 font-mono">
                      {r.code} · {r.slug}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[12px] text-[color:var(--color-text-muted)]">
                  <span>{r.subRegionCount} sub-regions · {r.countryCount} countries</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditing(r)}
                      className={cn("min-h-11 px-3 text-[12.5px] font-medium text-[color:var(--color-brand)]")}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(r)}
                      className="min-h-11 px-3 text-[12.5px] font-medium text-[color:var(--color-text-muted)]"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {(creating || editing) && (
        <RegionModal
          initial={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={() => {
            setEditing(null);
            setCreating(false);
            load();
            onChange();
            pushToast(true, "Region saved.");
          }}
          onError={(m) => pushToast(false, m)}
        />
      )}
      <Toast toast={toast} />
    </div>
  );
}

/* ── Modal ────────────────────────────────────────────────────── */

function RegionModal({
  initial,
  onClose,
  onSaved,
  onError,
}: {
  initial: Region | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    const url = initial
      ? `/api/admin/geography/regions/${initial.id}`
      : "/api/admin/geography/regions";
    const method = initial ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, code, slug: slug || undefined, sortOrder, isActive }),
    });
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      onError(d.error ?? "Save failed");
      setSaving(false);
      return;
    }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={onSubmit}
        className="relative w-full sm:max-w-md bg-[color:var(--color-surface)] rounded-t-2xl sm:rounded-2xl border border-[color:var(--color-border)] shadow-[var(--shadow-elevated)]"
      >
        <div className="px-5 py-4 border-b border-[color:var(--color-border-soft)]">
          <h2 className="text-[16px] font-semibold tracking-[-0.01em]">
            {initial ? "Edit region" : "Add region"}
          </h2>
          <p className="text-[12px] text-[color:var(--color-text-muted)] mt-0.5">
            Regions are the top level — Africa, Americas, Asia, and so on.
          </p>
        </div>
        <div className="p-5 space-y-3">
          <FieldRow label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Africa" required />
          </FieldRow>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="M49 code">
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="002" required />
            </FieldRow>
            <FieldRow label="Slug (optional)">
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="africa" />
            </FieldRow>
          </div>
          <div className="grid grid-cols-2 gap-3 items-center">
            <FieldRow label="Sort order">
              <Input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number.parseInt(e.target.value, 10) || 0)}
              />
            </FieldRow>
            <label className="flex items-center gap-2 mt-6">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 accent-[color:var(--color-brand)]"
              />
              <span className="text-[13.5px]">Active</span>
            </label>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-[color:var(--color-border-soft)] flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" loading={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[13px] font-medium mb-1.5">{label}</label>
      {children}
    </div>
  );
}
