"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type Tier = "PUBLIC" | "SUPPORT" | "CRISIS" | "CAVALRY";
const TIERS: Tier[] = ["PUBLIC", "SUPPORT", "CRISIS", "CAVALRY"];

interface Room {
  id: string;
  slug: string;
  name: string;
  tier: Tier;
  status: "ACTIVE" | "ARCHIVED";
  categoryName: string | null;
  emoji: string | null;
  memberCount: number;
  messageCount: number;
  isFeatured: boolean;
}
interface Category {
  id: string;
  name: string;
}

export function AdminChatRoomsClient() {
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [q, setQ] = useState("");
  const [tier, setTier] = useState<Tier | "all">("all");
  const [status, setStatus] = useState<"all" | "active" | "archived">("all");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (tier !== "all") sp.set("tier", tier);
    if (status !== "all") sp.set("status", status);
    const res = await fetch(`/api/admin/chat/rooms?${sp.toString()}`);
    const d = (await res.json().catch(() => ({ rooms: [] }))) as { rooms: Room[] };
    setRooms(d.rooms);
  }, [q, tier, status]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    fetch("/api/admin/chat/categories")
      .then((r) => r.json())
      .then((d) => setCategories(d.categories ?? []))
      .catch(() => {});
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Chatrooms</h1>
          <p className="text-[13px] text-[color:var(--color-text-muted)] mt-0.5">
            Create and manage community rooms across every tier.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/chatrooms/categories">
            <Button variant="secondary" size="sm">Categories</Button>
          </Link>
          <Button size="sm" onClick={() => setCreating(true)}>New room</Button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Input
          placeholder="Search rooms…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-9 max-w-xs"
        />
        <Select value={tier} onChange={(v) => setTier(v as Tier | "all")} options={[["all", "All tiers"], ...TIERS.map((t) => [t, t[0] + t.slice(1).toLowerCase()] as [string, string])]} />
        <Select value={status} onChange={(v) => setStatus(v as typeof status)} options={[["all", "All status"], ["active", "Active"], ["archived", "Archived"]]} />
      </div>

      {rooms === null ? (
        <p className="text-[13px] text-[color:var(--color-text-subtle)]">Loading…</p>
      ) : rooms.length === 0 ? (
        <Card><CardBody><p className="text-[14px] text-[color:var(--color-text-muted)] py-6 text-center">No rooms match. Create your first room.</p></CardBody></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
          {rooms.map((r) => (
            <Link key={r.id} href={`/admin/chatrooms/${r.id}`} className="block">
              <Card className="hover:border-[color:var(--color-border-strong)] transition-colors h-full">
                <CardBody className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="shrink-0 h-10 w-10 rounded-[12px] bg-[color:var(--color-brand-soft)] flex items-center justify-center text-[19px]">
                      {r.emoji ?? "💬"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[14.5px] font-semibold tracking-[-0.01em] truncate">{r.name}</p>
                        <TierChip tier={r.tier} />
                        {r.status === "ARCHIVED" && <Chip text="Archived" tone="slate" />}
                        {r.isFeatured && <Chip text="Featured" tone="amber" />}
                      </div>
                      <p className="mt-1 text-[12px] text-[color:var(--color-text-subtle)]">
                        {r.categoryName ?? "Uncategorised"} · {r.memberCount} members · {r.messageCount} messages
                      </p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {creating && (
        <CreateRoomModal
          categories={categories}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

function CreateRoomModal({
  categories,
  onClose,
  onCreated,
}: {
  categories: Category[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [tier, setTier] = useState<Tier>("PUBLIC");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("");
  const [allowAnonymous, setAllowAnonymous] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/chat/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        tier,
        categoryId: categoryId || undefined,
        description: description || undefined,
        emoji: emoji || undefined,
        allowAnonymous,
      }),
    });
    const d = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    setSaving(false);
    if (!res.ok) {
      setError(d.error ?? "Create failed");
      return;
    }
    onCreated();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={saving ? undefined : onClose} />
      <div className="relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto bg-[color:var(--color-surface)] rounded-t-2xl sm:rounded-2xl border border-[color:var(--color-border)] shadow-[var(--shadow-elevated)] p-5">
        <h2 className="text-[17px] font-semibold tracking-[-0.01em]">New chatroom</h2>
        <div className="mt-4 space-y-3">
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sobriety support" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tier">
              <Select value={tier} onChange={(v) => setTier(v as Tier)} options={TIERS.map((t) => [t, t[0] + t.slice(1).toLowerCase()] as [string, string])} full />
            </Field>
            <Field label="Category">
              <Select value={categoryId} onChange={setCategoryId} options={[["", "Uncategorised"], ...categories.map((c) => [c.id, c.name] as [string, string])]} full />
            </Field>
          </div>
          <div className="grid grid-cols-[80px_1fr] gap-3">
            <Field label="Emoji">
              <Input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="💬" maxLength={4} />
            </Field>
            <Field label="Description">
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What is this room for?" />
            </Field>
          </div>
          <label className="flex items-center justify-between">
            <span className="text-[13px] text-[color:var(--color-text-muted)]">Allow anonymous posting</span>
            <Switch checked={allowAnonymous} onChange={setAllowAnonymous} />
          </label>
          {error && <p className="text-[12.5px] text-[color:var(--color-danger)]">{error}</p>}
        </div>
        <div className="mt-5 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button className="flex-1" loading={saving} onClick={submit}>Create room</Button>
        </div>
      </div>
    </div>
  );
}

/* ── little bits ─────────────────────────────────────────────── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[12px] font-medium text-[color:var(--color-text-muted)] mb-1">{label}</span>
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
  full,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
  full?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-9 rounded-[10px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-2.5 text-[13px] focus:outline-none focus:border-[color:var(--color-brand)] focus:ring-4 focus:ring-[color:var(--color-brand-soft)]",
        full && "w-full h-11",
      )}
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </select>
  );
}

function TierChip({ tier }: { tier: Tier }) {
  const map: Record<Tier, string> = {
    PUBLIC: "bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-ink)]",
    SUPPORT: "bg-[color:var(--color-success-soft)] text-[color:var(--color-success-ink)]",
    CRISIS: "bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger-ink)]",
    CAVALRY: "bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent-ink)]",
  };
  return <span className={cn("text-[10px] font-semibold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded-full", map[tier])}>{tier[0] + tier.slice(1).toLowerCase()}</span>;
}

function Chip({ text, tone }: { text: string; tone: "slate" | "amber" }) {
  return (
    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full", tone === "amber" ? "bg-[color:var(--color-warning-soft)] text-[color:var(--color-warning-ink)]" : "bg-[color:var(--color-surface-hover)] text-[color:var(--color-text-muted)]")}>
      {text}
    </span>
  );
}
