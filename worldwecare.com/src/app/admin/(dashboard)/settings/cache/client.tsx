"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

/**
 * Cache page — combines the config knobs (enabled + default TTL)
 * with a manual purge button. Purge hits DELETE /api/admin/settings/
 * cache which wipes every in-process cache we know about.
 */
interface CacheStatus {
  name: string;
  ttlSeconds: number;
  enabled: boolean;
  warm: boolean;
  entries: number;
  ageSeconds: number | null;
}

export function CacheClient({
  initialEnabled,
  initialTtl,
}: {
  initialEnabled: boolean;
  initialTtl: number;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [ttl, setTtl] = useState(String(initialTtl));
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [purgeState, setPurgeState] = useState<"idle" | "purging" | "purged" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<CacheStatus | null>(null);

  // Read the live state rather than describing it in prose. This page
  // used to claim a "30-second TTL" in fixed text while the setting
  // above it governed nothing — the fastest way for a settings page to
  // become a lie.
  const loadStatus = useCallback(async () => {
    const res = await fetch("/api/admin/settings/cache", { cache: "no-store" }).catch(
      () => null,
    );
    if (!res?.ok) return;
    const d = (await res.json()) as { stats?: CacheStatus[] };
    setStatus(d.stats?.[0] ?? null);
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    const t = Number.parseInt(ttl, 10);
    if (!Number.isFinite(t) || t < 5 || t > 3600) {
      setError("TTL must be between 5 and 3600 seconds.");
      setSaving(false);
      return;
    }
    const res = await fetch("/api/admin/settings/cache", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "cache.enabled": enabled,
        "cache.defaultTtlSeconds": t,
      }),
    });
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      setError(d.error ?? "Save failed");
    } else {
      setSavedAt(Date.now());
      await loadStatus();
    }
    setSaving(false);
  };

  const onPurge = async () => {
    setPurgeState("purging");
    const res = await fetch("/api/admin/settings/cache", { method: "DELETE" });
    if (res.ok) {
      setPurgeState("purged");
      // Re-read, so the badge flips to Cold and the operator can see
      // the purge actually did something.
      await loadStatus();
      setTimeout(() => setPurgeState("idle"), 2500);
    } else {
      setPurgeState("error");
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Behavior</CardTitle>
            <CardDescription>
              Toggle caching entirely, or tune how long values live before
              a re-read hits the database.
            </CardDescription>
          </CardHeader>
          <CardBody className="space-y-4">
            <form onSubmit={onSave} className="space-y-4">
              <div className="flex items-center justify-between rounded-[12px] bg-[color:var(--color-surface-muted)] px-4 py-3">
                <div>
                  <p className="text-[14px] font-medium">Enable caching</p>
                  <p className="text-[12px] text-[color:var(--color-text-subtle)]">
                    Off = every read hits the database.
                  </p>
                </div>
                <Switch checked={enabled} onChange={setEnabled} label="Caching" />
              </div>
              <div>
                <label className="block text-[13px] font-medium mb-1.5">
                  Default TTL (seconds)
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={5}
                    max={3600}
                    value={ttl}
                    onChange={(e) => setTtl(e.target.value)}
                    className="max-w-[140px]"
                  />
                  <span className="text-[13px] text-[color:var(--color-text-muted)]">
                    seconds
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-[13px]">
                  {error ? (
                    <span className="text-[color:var(--color-danger)]">{error}</span>
                  ) : savedAt ? (
                    <span className="text-[color:var(--color-success)]">Saved.</span>
                  ) : null}
                </div>
                <Button type="submit" loading={saving}>
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active caches</CardTitle>
            <CardDescription>
              Purge wipes every in-process cache. Safe to press — the next
              read just re-fetches.
            </CardDescription>
          </CardHeader>
          <CardBody className="space-y-3">
            <div className="rounded-[12px] border border-[color:var(--color-border)] px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[14px] font-medium">Platform settings</p>
                {status && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      !status.enabled
                        ? "bg-[color:var(--color-surface-muted)] text-[color:var(--color-text-muted)]"
                        : status.warm
                          ? "bg-[color:var(--color-success)]/12 text-[color:var(--color-success)]"
                          : "bg-[color:var(--color-warning)]/12 text-[color:var(--color-warning)]"
                    }`}
                  >
                    {!status.enabled ? "Disabled" : status.warm ? "Warm" : "Cold"}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[12px] text-[color:var(--color-text-muted)]">
                Key/value store used across every admin page and email send.
              </p>
              {status && (
                <p className="mt-1.5 text-[12px] tabular-nums text-[color:var(--color-text-subtle)]">
                  {status.enabled ? `${status.ttlSeconds}s TTL` : "Every read hits the database"}
                  {status.warm
                    ? ` · ${status.entries} setting${status.entries === 1 ? "" : "s"} held` +
                      (status.ageSeconds !== null ? ` · loaded ${status.ageSeconds}s ago` : "")
                    : ""}
                </p>
              )}
            </div>
            <Button
              type="button"
              variant={purgeState === "purged" ? "secondary" : "danger"}
              onClick={onPurge}
              loading={purgeState === "purging"}
              className="w-full"
            >
              {purgeState === "purged"
                ? "Purged."
                : purgeState === "error"
                  ? "Failed — retry"
                  : "Purge all caches"}
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
