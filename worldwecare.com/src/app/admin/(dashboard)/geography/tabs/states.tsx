"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusPill, Th } from "./_ui";
import { Toast, useToast } from "./_toast";

interface State {
  id: string;
  slug: string;
  name: string;
  code: string;
  capital: string | null;
  countryId: string;
  countryCode: string;
  countryName: string;
  sortOrder: number;
  isActive: boolean;
}

/**
 * States tab — hard-scoped to the United States. Any attempt to
 * create a state under a non-US country is rejected server-side by
 * assertUsCountry(), so we don't offer a country picker at all.
 */
export function StatesTab({ onChange }: { onChange: () => void }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [rows, setRows] = useState<State[]>([]);
  const [usCountryId, setUsCountryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<State | null>(null);
  const [creating, setCreating] = useState(false);
  const { toast, pushToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ status });
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/admin/geography/states?${params}`);
    const d = (await res.json().catch(() => ({ items: [] }))) as {
      items: State[];
      countryId: string | null;
    };
    setRows(d.items ?? []);
    setUsCountryId(d.countryId ?? null);
    setLoading(false);
  }, [q, status]);

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const onDelete = async (s: State) => {
    if (!confirm(`Delete state "${s.name}"?`)) return;
    const res = await fetch(`/api/admin/geography/states/${s.id}`, {
      method: "DELETE",
    });
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) pushToast(false, d.error ?? "Delete failed");
    else {
      pushToast(true, "State deleted.");
      load();
      onChange();
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[12px] bg-[color:var(--color-brand-tint)] border border-[color:var(--color-brand)]/20 px-4 py-3 text-[13px] text-[color:var(--color-brand-ink)]">
        States are supported for the United States only. Add other countries under the <strong>Countries</strong> tab.
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="flex-1">
          <Input placeholder="Search by name, USPS code, or slug…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="h-11 pl-3 pr-9 rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-sm appearance-none focus:outline-none focus:border-[color:var(--color-brand)] focus:ring-4 focus:ring-[color:var(--color-brand-soft)]"
        >
          <option value="all">All statuses</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>
        <Button onClick={() => setCreating(true)} disabled={!usCountryId}>
          Add state
        </Button>
      </div>

      {!usCountryId && !loading && (
        <Card>
          <CardBody className="text-center py-10 text-[color:var(--color-text-muted)] text-[13.5px]">
            No United States country row was found. Add it under the Countries tab first.
          </CardBody>
        </Card>
      )}

      {usCountryId && (
        <Card>
          <CardBody className="p-0 overflow-hidden">
            <div className="hidden md:block">
              <table className="w-full text-[13.5px]">
                <thead className="bg-[color:var(--color-surface-muted)]">
                  <tr>
                    <Th>State</Th>
                    <Th>USPS</Th>
                    <Th>Capital</Th>
                    <Th>Status</Th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {!loading && rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-[color:var(--color-text-subtle)]">
                        No states match.
                      </td>
                    </tr>
                  )}
                  {rows.map((s) => (
                    <tr key={s.id} className="border-t border-[color:var(--color-border-soft)]">
                      <td className="px-4 py-3">
                        <p className="font-medium">{s.name}</p>
                        <p className="text-[11.5px] text-[color:var(--color-text-subtle)] font-mono">{s.slug}</p>
                      </td>
                      <td className="px-4 py-3 font-mono text-[12px] text-[color:var(--color-text-muted)]">{s.code}</td>
                      <td className="px-4 py-3 text-[color:var(--color-text-muted)]">{s.capital ?? "—"}</td>
                      <td className="px-4 py-3"><StatusPill active={s.isActive} /></td>
                      <td className="px-4 py-3 text-right pr-4">
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" variant="secondary" onClick={() => setEditing(s)}>Edit</Button>
                          <Button size="sm" variant="ghost" onClick={() => onDelete(s)}>Delete</Button>
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
                  No states match.
                </div>
              )}
              {rows.map((s) => (
                <div key={s.id} className="p-4 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{s.name}</p>
                    <StatusPill active={s.isActive} />
                  </div>
                  <p className="text-[12px] text-[color:var(--color-text-muted)]">
                    {s.code} · {s.capital ?? "—"}
                  </p>
                  <div className="flex gap-1">
                    <button onClick={() => setEditing(s)} className="min-h-11 px-3 text-[12.5px] font-medium text-[color:var(--color-brand)]">Edit</button>
                    <button onClick={() => onDelete(s)} className="min-h-11 px-3 text-[12.5px] font-medium text-[color:var(--color-text-muted)]">Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {(creating || editing) && usCountryId && (
        <StateModal
          initial={editing}
          countryId={usCountryId}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={() => {
            setEditing(null);
            setCreating(false);
            load();
            onChange();
            pushToast(true, "State saved.");
          }}
          onError={(m) => pushToast(false, m)}
        />
      )}
      <Toast toast={toast} />
    </div>
  );
}

function StateModal({
  initial,
  countryId,
  onClose,
  onSaved,
  onError,
}: {
  initial: State | null;
  countryId: string;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [capital, setCapital] = useState(initial?.capital ?? "");
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    const url = initial
      ? `/api/admin/geography/states/${initial.id}`
      : "/api/admin/geography/states";
    const res = await fetch(url, {
      method: initial ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        countryId,
        name,
        code,
        slug: slug || undefined,
        capital: capital || undefined,
        sortOrder,
        isActive,
      }),
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
            {initial ? "Edit state" : "Add state"}
          </h2>
        </div>
        <div className="p-5 space-y-3">
          <FieldRow label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="California" />
          </FieldRow>
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="USPS code">
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={2} required placeholder="CA" />
            </FieldRow>
            <FieldRow label="Slug (optional)">
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="california" />
            </FieldRow>
          </div>
          <FieldRow label="Capital">
            <Input value={capital} onChange={(e) => setCapital(e.target.value)} placeholder="Sacramento" />
          </FieldRow>
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
