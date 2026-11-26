"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatusPill, Th } from "./_ui";
import { Toast, useToast } from "./_toast";

interface Country {
  id: string;
  slug: string;
  name: string;
  code: string;
  code3: string | null;
  emojiFlag: string | null;
  flagUrl: string | null;
  phoneCode: string | null;
  currency: string | null;
  language: string | null;
  subRegionId: string;
  subRegionName: string;
  regionId: string;
  regionName: string;
  sortOrder: number;
  isActive: boolean;
  stateCount: number;
}

interface RegionOpt { id: string; name: string }
interface SubRegionOpt { id: string; name: string; regionId: string; regionName: string }

export function CountriesTab({ onChange }: { onChange: () => void }) {
  const [q, setQ] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");
  const [subRegionFilter, setSubRegionFilter] = useState("all");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Country[]; total: number; totalPages: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Country | null>(null);
  const [creating, setCreating] = useState(false);
  const [regions, setRegions] = useState<RegionOpt[]>([]);
  const [subRegions, setSubRegions] = useState<SubRegionOpt[]>([]);
  const { toast, pushToast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      status,
      page: String(page),
      perPage: "50",
    });
    if (q.trim()) params.set("q", q.trim());
    if (regionFilter !== "all") params.set("regionId", regionFilter);
    if (subRegionFilter !== "all") params.set("subRegionId", subRegionFilter);
    const res = await fetch(`/api/admin/geography/countries?${params}`);
    const d = await res.json().catch(() => null);
    setData(d);
    setLoading(false);
  }, [q, status, page, regionFilter, subRegionFilter]);

  useEffect(() => {
    fetch("/api/admin/geography/options?level=regions")
      .then((r) => r.json())
      .then((d: { items: RegionOpt[] }) => setRegions(d.items ?? []));
    fetch("/api/admin/geography/options?level=sub-regions")
      .then((r) => r.json())
      .then((d: { items: SubRegionOpt[] }) => setSubRegions(d.items ?? []));
  }, []);

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  useEffect(() => {
    setPage(1);
  }, [q, status, regionFilter, subRegionFilter]);

  const filteredSubRegions = useMemo(
    () => (regionFilter === "all" ? subRegions : subRegions.filter((s) => s.regionId === regionFilter)),
    [regionFilter, subRegions],
  );

  const onDelete = async (c: Country) => {
    if (!confirm(`Delete country "${c.name}"?`)) return;
    const res = await fetch(`/api/admin/geography/countries/${c.id}`, {
      method: "DELETE",
    });
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) pushToast(false, d.error ?? "Delete failed");
    else {
      pushToast(true, "Country deleted.");
      load();
      onChange();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center gap-2">
        <div className="flex-1">
          <Input placeholder="Search by name, ISO code, or slug…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select
          value={regionFilter}
          onChange={(e) => {
            setRegionFilter(e.target.value);
            setSubRegionFilter("all");
          }}
          className="h-11 pl-3 pr-9 rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-sm appearance-none focus:outline-none focus:border-[color:var(--color-brand)] focus:ring-4 focus:ring-[color:var(--color-brand-soft)]"
        >
          <option value="all">All regions</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <select
          value={subRegionFilter}
          onChange={(e) => setSubRegionFilter(e.target.value)}
          className="h-11 pl-3 pr-9 rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-sm appearance-none focus:outline-none focus:border-[color:var(--color-brand)] focus:ring-4 focus:ring-[color:var(--color-brand-soft)]"
        >
          <option value="all">All sub-regions</option>
          {filteredSubRegions.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
          className="h-11 pl-3 pr-9 rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-sm appearance-none focus:outline-none focus:border-[color:var(--color-brand)] focus:ring-4 focus:ring-[color:var(--color-brand-soft)]"
        >
          <option value="all">All statuses</option>
          <option value="active">Active only</option>
          <option value="inactive">Inactive only</option>
        </select>
        <Button onClick={() => setCreating(true)}>Add country</Button>
      </div>

      <Card>
        <CardBody className="p-0 overflow-hidden">
          <div className="hidden md:block">
            <table className="w-full text-[13.5px]">
              <thead className="bg-[color:var(--color-surface-muted)]">
                <tr>
                  <Th>Country</Th>
                  <Th>Sub-region</Th>
                  <Th>ISO</Th>
                  <Th>States</Th>
                  <Th>Status</Th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {!loading && data?.items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-[color:var(--color-text-subtle)]">
                      No countries match.
                    </td>
                  </tr>
                )}
                {data?.items.map((c) => (
                  <tr key={c.id} className="border-t border-[color:var(--color-border-soft)]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-[18px]">{c.emojiFlag ?? "🏳️"}</span>
                        <div>
                          <p className="font-medium">{c.name}</p>
                          <p className="text-[11.5px] text-[color:var(--color-text-subtle)] font-mono">{c.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[color:var(--color-text-muted)]">
                      <p>{c.subRegionName}</p>
                      <p className="text-[11px] text-[color:var(--color-text-subtle)]">{c.regionName}</p>
                    </td>
                    <td className="px-4 py-3 text-[color:var(--color-text-muted)] font-mono text-[12px]">
                      {c.code}{c.code3 ? ` · ${c.code3}` : ""}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {c.code === "US" ? c.stateCount : <span className="text-[color:var(--color-text-subtle)]">—</span>}
                    </td>
                    <td className="px-4 py-3"><StatusPill active={c.isActive} /></td>
                    <td className="px-4 py-3 text-right pr-4">
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="secondary" onClick={() => setEditing(c)}>Edit</Button>
                        <Button size="sm" variant="ghost" onClick={() => onDelete(c)}>Delete</Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y divide-[color:var(--color-border-soft)]">
            {!loading && data?.items.length === 0 && (
              <div className="text-center py-12 text-[color:var(--color-text-subtle)] text-[13px]">
                No countries match.
              </div>
            )}
            {data?.items.map((c) => (
              <div key={c.id} className="p-4 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[18px]">{c.emojiFlag ?? "🏳️"}</span>
                  <p className="font-medium">{c.name}</p>
                  <StatusPill active={c.isActive} />
                </div>
                <p className="text-[12px] text-[color:var(--color-text-muted)]">
                  {c.subRegionName} · {c.code}
                </p>
                <div className="flex gap-1">
                  <button onClick={() => setEditing(c)} className="min-h-11 px-3 text-[12.5px] font-medium text-[color:var(--color-brand)]">Edit</button>
                  <button onClick={() => onDelete(c)} className="min-h-11 px-3 text-[12.5px] font-medium text-[color:var(--color-text-muted)]">Delete</button>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between text-[13px]">
          <p className="text-[color:var(--color-text-muted)]">
            Page {page} of {data.totalPages} · {data.total.toLocaleString()} total
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </Button>
            <Button size="sm" variant="secondary" disabled={page >= data.totalPages} onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}>
              Next
            </Button>
          </div>
        </div>
      )}

      {(creating || editing) && (
        <CountryModal
          initial={editing}
          regions={regions}
          subRegions={subRegions}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={() => {
            setEditing(null);
            setCreating(false);
            load();
            onChange();
            pushToast(true, "Country saved.");
          }}
          onError={(m) => pushToast(false, m)}
        />
      )}
      <Toast toast={toast} />
    </div>
  );
}

function CountryModal({
  initial,
  regions,
  subRegions,
  onClose,
  onSaved,
  onError,
}: {
  initial: Country | null;
  regions: RegionOpt[];
  subRegions: SubRegionOpt[];
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [regionId, setRegionId] = useState(
    initial ? initial.regionId : (regions[0]?.id ?? ""),
  );
  const [subRegionId, setSubRegionId] = useState(
    initial ? initial.subRegionId : (subRegions[0]?.id ?? ""),
  );
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [code3, setCode3] = useState(initial?.code3 ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [emojiFlag, setEmojiFlag] = useState(initial?.emojiFlag ?? "");
  const [flagUrl, setFlagUrl] = useState(initial?.flagUrl ?? "");
  const [phoneCode, setPhoneCode] = useState(initial?.phoneCode ?? "");
  const [currency, setCurrency] = useState(initial?.currency ?? "");
  const [language, setLanguage] = useState(initial?.language ?? "");
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [saving, setSaving] = useState(false);

  const filteredSubs = useMemo(
    () => (regionId ? subRegions.filter((s) => s.regionId === regionId) : subRegions),
    [regionId, subRegions],
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    const url = initial
      ? `/api/admin/geography/countries/${initial.id}`
      : "/api/admin/geography/countries";
    const res = await fetch(url, {
      method: initial ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subRegionId,
        name,
        code,
        code3: code3 || undefined,
        slug: slug || undefined,
        emojiFlag: emojiFlag || undefined,
        flagUrl: flagUrl || undefined,
        phoneCode: phoneCode || undefined,
        currency: currency || undefined,
        language: language || undefined,
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
        className="relative w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-[color:var(--color-surface)] rounded-t-2xl sm:rounded-2xl border border-[color:var(--color-border)] shadow-[var(--shadow-elevated)]"
      >
        <div className="px-5 py-4 border-b border-[color:var(--color-border-soft)] sticky top-0 frost-strong z-10">
          <h2 className="text-[16px] font-semibold tracking-[-0.01em]">
            {initial ? "Edit country" : "Add country"}
          </h2>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FieldRow label="Region">
              <select
                value={regionId}
                onChange={(e) => {
                  setRegionId(e.target.value);
                  const firstSub = subRegions.find((s) => s.regionId === e.target.value);
                  if (firstSub) setSubRegionId(firstSub.id);
                }}
                className="w-full h-11 pl-3 pr-9 rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-sm appearance-none focus:outline-none focus:border-[color:var(--color-brand)] focus:ring-4 focus:ring-[color:var(--color-brand-soft)]"
              >
                <option value="">—</option>
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </FieldRow>
            <FieldRow label="Sub-region">
              <select
                value={subRegionId}
                onChange={(e) => setSubRegionId(e.target.value)}
                required
                className="w-full h-11 pl-3 pr-9 rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-sm appearance-none focus:outline-none focus:border-[color:var(--color-brand)] focus:ring-4 focus:ring-[color:var(--color-brand-soft)]"
              >
                <option value="">Choose sub-region…</option>
                {filteredSubs.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </FieldRow>
          </div>

          <FieldRow label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="United States" />
          </FieldRow>

          <div className="grid grid-cols-3 gap-3">
            <FieldRow label="Alpha-2">
              <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={2} required placeholder="US" />
            </FieldRow>
            <FieldRow label="Alpha-3">
              <Input value={code3 ?? ""} onChange={(e) => setCode3(e.target.value.toUpperCase())} maxLength={3} placeholder="USA" />
            </FieldRow>
            <FieldRow label="Slug (optional)">
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="united-states" />
            </FieldRow>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <FieldRow label="Flag emoji">
              <Input value={emojiFlag ?? ""} onChange={(e) => setEmojiFlag(e.target.value)} placeholder="🇺🇸" />
            </FieldRow>
            <FieldRow label="Phone">
              <Input value={phoneCode ?? ""} onChange={(e) => setPhoneCode(e.target.value)} placeholder="+1" />
            </FieldRow>
            <FieldRow label="Currency">
              <Input value={currency ?? ""} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} placeholder="USD" />
            </FieldRow>
            <FieldRow label="Language">
              <Input value={language ?? ""} onChange={(e) => setLanguage(e.target.value)} placeholder="English" />
            </FieldRow>
          </div>

          <FieldRow label="Flag image URL (optional)">
            <Input value={flagUrl ?? ""} onChange={(e) => setFlagUrl(e.target.value)} placeholder="https://…/flags/us.svg" />
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
        <div className="px-5 py-4 border-t border-[color:var(--color-border-soft)] flex gap-2 sticky bottom-0 frost-strong">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" loading={saving}>
            {saving ? "Saving…" : "Save country"}
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
