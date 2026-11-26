"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { RegionsTab } from "./tabs/regions";
import { SubRegionsTab } from "./tabs/sub-regions";
import { CountriesTab } from "./tabs/countries";
import { StatesTab } from "./tabs/states";

type Tab = "regions" | "sub-regions" | "countries" | "states";

const TABS: Array<{ v: Tab; label: string; hint: string }> = [
  { v: "regions",     label: "Regions",     hint: "Top-level buckets like Africa or Americas." },
  { v: "sub-regions", label: "Sub-regions", hint: "UN sub-regions inside each region." },
  { v: "countries",   label: "Countries",   hint: "ISO countries, grouped by sub-region." },
  { v: "states",      label: "States",      hint: "United States only — 50 states plus D.C." },
];

interface Stats {
  regions: { total: number; active: number };
  subRegions: { total: number; active: number };
  countries: { total: number; active: number };
  states: { total: number; active: number };
}

/**
 * Geography hub — the four levels live under tabs so each tab keeps
 * its own toolbar and paging. The stats strip up top is one query;
 * everything else lazy-loads per tab.
 */
export function GeographyClient() {
  const [tab, setTab] = useState<Tab>("regions");
  const [stats, setStats] = useState<Stats | null>(null);

  const loadStats = useCallback(async () => {
    const res = await fetch("/api/admin/geography/stats");
    if (res.ok) setStats(await res.json());
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const activeHint = useMemo(() => TABS.find((t) => t.v === tab)!.hint, [tab]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <header>
        <h1 className="text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em]">Geography</h1>
        <p className="mt-1 text-[14px] text-[color:var(--color-text-muted)]">
          Regions, sub-regions, countries, and U.S. states — the geographic scaffolding every WorldWeCare feature filters against.
        </p>
      </header>

      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Regions"     total={stats?.regions.total}     active={stats?.regions.active} />
        <StatCard label="Sub-regions" total={stats?.subRegions.total}  active={stats?.subRegions.active} />
        <StatCard label="Countries"   total={stats?.countries.total}   active={stats?.countries.active} />
        <StatCard label="States"      total={stats?.states.total}      active={stats?.states.active} suffix="US only" />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.v}
            type="button"
            onClick={() => setTab(t.v)}
            className={cn(
              "px-4 h-10 rounded-full text-[13px] font-medium border transition-colors",
              tab === t.v
                ? "bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)] border-transparent shadow-[var(--shadow-brand)]"
                : "bg-[color:var(--color-surface)] text-[color:var(--color-text-muted)] border-[color:var(--color-border)] hover:text-[color:var(--color-text)]",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-[12.5px] text-[color:var(--color-text-subtle)] -mt-3">
        {activeHint}
      </p>

      {tab === "regions"     && <RegionsTab     onChange={loadStats} />}
      {tab === "sub-regions" && <SubRegionsTab  onChange={loadStats} />}
      {tab === "countries"   && <CountriesTab   onChange={loadStats} />}
      {tab === "states"      && <StatesTab      onChange={loadStats} />}
    </div>
  );
}

function StatCard({
  label,
  total,
  active,
  suffix,
}: {
  label: string;
  total?: number;
  active?: number;
  suffix?: string;
}) {
  return (
    <Card>
      <CardBody className="px-4 py-3">
        <p className="text-[10.5px] uppercase tracking-[0.08em] text-[color:var(--color-text-subtle)] font-semibold">
          {label}
        </p>
        <div className="mt-1 flex items-baseline gap-2">
          <p className="text-[22px] font-semibold tabular-nums tracking-[-0.02em]">
            {total ?? "—"}
          </p>
          <p className="text-[12px] text-[color:var(--color-text-muted)]">
            {active !== undefined ? `${active} active` : ""}
            {suffix ? ` · ${suffix}` : ""}
          </p>
        </div>
      </CardBody>
    </Card>
  );
}

