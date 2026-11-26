"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusPill, Th } from "./_ui";
import { Toast, useToast } from "./_toast";

interface SubRegion {
  id: string;
  slug: string;
  name: string;
  code: string;
  regionId: string;
  regionName: string;
  regionSlug: string;
  sortOrder: number;
  isActive: boolean;
  countryCount: number;
}

interface RegionOpt {
  id: string;
  name: string;
  slug: string;
}

export function SubRegionsTab({ onChange }: { onChange: () => void }) {
  const [q, setQ] = useState("");
  const [regionFilter, setRegionFilter] = useState<string>("all");
  const [rows, setRows] = useState<SubRegion[]>([]);
  const [regions, setRegions] = useState<RegionOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<SubRegion | null>(null);
  const [creating, setCreating] = useState(false);
  const { toast, pushToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (regionFilter !== "all") params.set("regionId", regionFilter);
    const res = await fetch(`/api/admin/geography/sub-regions?${params}`);
    const d = (await res.json().catch(() => ({ items: [] }))) as { items: SubRegion[] };
    setRows(d.items ?? []);
    setLoading(false);
  }, [q, regionFilter]);

  useEffect(() => {
    fetch("/api/admin/geography/options?level=regions")
      .then((r) => r.json())
      .then((d: { items: RegionOpt[] }) => setRegions(d.items ?? []))
      .catch(() => setRegions([]));
  }, []);

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const onDelete = async (r: SubRegion) => {
    if (!confirm(`Delete sub-region "${r.name}"?`)) return;
    const res = await fetch(`/api/admin/geography/sub-regions/${r.id}`, {
      method: "DELETE",
    });
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) pushToast(false, d.error ?? "Delete failed");
    else {
      pushToast(true, "Sub-region deleted.");
      load();
      onChange();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex-1">
          <Input
            placeholder="Search by name, slug, or M49 code…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <select
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          className="h-11 pl-3 pr-9 rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-sm appearance-none focus:outline-none focus:border-[color:var(--color-brand)] focus:ring-4 focus:ring-[color:var(--color-brand-soft)]"
        >
          <option value="all">All regions</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <Button onClick={() => setCreating(true)}>Add sub-region</Button>
      </div>

      <Card>
        <CardBody className="p-0 overflow-hidden">
          <div className="hidden md:block">
            <table className="w-full text-[13.5px]">
              <thead className="bg-[color:var(--color-surface-muted)]">
                <tr>
                  <Th>Sub-region</Th>
                  <Th>Region</Th>
                  <Th>M49</Th>
                  <Th>Countries</Th>
                  <Th>Status</Th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-[color:var(--color-text-subtle)]">
                      No sub-regions match.
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-[color:var(--color-border-soft)]">
                    <td className="px-4 py-3">
                      <p className="font-medium">{r.name}</p>
                      <p className="text-[11.5px] text-[color:var(--color-text-subtle)] font-mono">{r.slug}</p>
                    </td>
                    <td className="px-4 py-3 text-[color:var(--color-text-muted)]">{r.regionName}</td>
                    <td className="px-4 py-3 text-[color:var(--color-text-muted)] font-mono text-[12px]">{r.code}</td>
                    <td className="px-4 py-3 tabular-nums">{r.countryCount}</td>
                    <td className="px-4 py-3"><StatusPill active={r.isActive} /></td>
                    <td className="px-4 py-3 text-right pr-4">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="secondary" onClick={() => setEditing(r)}>Edit</Button>
                        <Button size="sm" variant="ghost" onClick={() => onDelete(r)}>Delete</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y divide-[color:var(--color-border-soft)]">
            {!loading && rows.length === 0 && (
              <div className="text-center py-12 text-[color:var(--color-text-subtle)] text-[13px]">
                No sub-regions match.
              </div>
            )}
            {rows.map((r) => (
              <div key={r.id} className="p-4 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">{r.name}</p>
                  <StatusPill active={r.isActive} />
                </div>
                <p className="text-[12px] text-[color:var(--color-text-muted)]">
                  {r.regionName} · {r.code} · {r.countryCount} countries
                </p>
                <div className="flex gap-1">
                  <button onClick={() => setEditing(r)} className="min-h-11 px-3 text-[12.5px] font-medium text-[color:var(--color-brand)]">Edit</button>
                  <button onClick={() => onDelete(r)} className="min-h-11 px-3 text-[12.5px] font-medium text-[color:var(--color-text-muted)]">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {(creating || editing) && (
        <SubRegionModal
          initial={editing}
          regions={regions}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={() => {
            setEditing(null);
            setCreating(false);
            load();
            onChange();
            pushToast(true, "Sub-region saved.");
          }}
          onError={(m) => pushToast(false, m)}
        />
      )}
      <Toast toast={toast} />
    </div>
  );
}

function SubRegionModal({
  initial,
  regions,
  onClose,
  onSaved,
  onError,
}: {
  initial: SubRegion | null;
  regions: RegionOpt[];
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [regionId, setRegionId] = useState(initial?.regionId ?? regions[0]?.id ?? "");
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
      ? `/api/admin/geography/sub-regions/${initial.id}`
      : "/api/admin/geography/sub-regions";
    const res = await fetch(url, {
      method: initial ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regionId, name, code, slug: slug || undefined, sortOrder, isActive }),
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
            {initial ? "Edit sub-region" : "Add sub-region"}
          </h2>
        </div>
        <div className="p-5 space-y-3">
          <FieldRow label="Region">
            <select
              value={regionId}
              onChange={(e) => setRegionId(e.target.value)}
              required
              className="w-full h-11 pl-3 pr-9 rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-sm appearance-none focus:outline-none focus:border-[color:var(--color-brand)] focus:ring-4 focus:ring-[color:var(--color-brand-soft)]"
            >
              <option value="">Choose a region…</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </FieldRow>
          <FieldRow label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Northern America" />
          </FieldRow>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="M49 code">
              <Input value={code} onChange={(e) => setCode(e.target.value)} required placeholder="021" />
            </FieldRow>
            <FieldRow label="Slug (optional)">
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="northern-america" />
            </FieldRow>
          </div>
          <div className="grid grid-cols-2 gap-3 items-center">
            <FieldRow label="Sort order">
              <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number.parseInt(e.target.value, 10) || 0)} />
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
