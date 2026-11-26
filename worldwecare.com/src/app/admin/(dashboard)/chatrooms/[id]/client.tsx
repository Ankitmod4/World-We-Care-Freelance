"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type Tier = "PUBLIC" | "SUPPORT" | "CRISIS" | "CAVALRY";
const TIERS: Tier[] = ["PUBLIC", "SUPPORT", "CRISIS", "CAVALRY"];

interface RoomDetail {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  tier: Tier;
  status: "ACTIVE" | "ARCHIVED";
  categoryId: string | null;
  categoryName: string | null;
  emoji: string | null;
  color: string | null;
  allowAnonymous: boolean;
  isFeatured: boolean;
  sortOrder: number;
  slowModeSeconds: number;
  rulesText: string | null;
  memberCount: number;
  messageCount: number;
  pendingMessages: number;
  pendingMembers: number;
}
interface Category { id: string; name: string }

export function AdminChatRoomDetailClient({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tab, setTab] = useState<"settings" | "members" | "messages">("settings");

  const loadRoom = useCallback(async () => {
    const res = await fetch(`/api/admin/chat/rooms/${roomId}`);
    if (!res.ok) {
      setRoom(null);
      return;
    }
    const d = (await res.json()) as { room: RoomDetail };
    setRoom(d.room);
  }, [roomId]);

  useEffect(() => {
    void loadRoom();
    fetch("/api/admin/chat/categories").then((r) => r.json()).then((d) => setCategories(d.categories ?? [])).catch(() => {});
  }, [loadRoom]);

  if (room === null) {
    return <p className="text-[13px] text-[color:var(--color-text-subtle)]">Loading room…</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <Link href="/admin/chatrooms" className="text-[13px] font-medium text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]">← All rooms</Link>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-11 w-11 rounded-[12px] bg-[color:var(--color-brand-soft)] flex items-center justify-center text-[20px]">{room.emoji ?? "💬"}</div>
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold tracking-[-0.02em] truncate">{room.name}</h1>
            <p className="text-[12.5px] text-[color:var(--color-text-subtle)]">/{room.slug} · {room.memberCount} members · {room.messageCount} messages</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-[color:var(--color-border-soft)]">
        <Tab active={tab === "settings"} onClick={() => setTab("settings")} label="Settings" />
        <Tab active={tab === "members"} onClick={() => setTab("members")} label="Members" badge={room.pendingMembers} />
        <Tab active={tab === "messages"} onClick={() => setTab("messages")} label="Messages" badge={room.pendingMessages} />
      </div>

      {tab === "settings" && (
        <SettingsTab room={room} categories={categories} onSaved={loadRoom} onDeleted={() => router.push("/admin/chatrooms")} />
      )}
      {tab === "members" && <MembersTab roomId={room.id} onChange={loadRoom} />}
      {tab === "messages" && <MessagesTab roomId={room.id} onChange={loadRoom} />}
    </div>
  );
}

/* ── Settings ────────────────────────────────────────────────── */

function SettingsTab({
  room,
  categories,
  onSaved,
  onDeleted,
}: {
  room: RoomDetail;
  categories: Category[];
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const [name, setName] = useState(room.name);
  const [description, setDescription] = useState(room.description ?? "");
  const [tier, setTier] = useState<Tier>(room.tier);
  const [categoryId, setCategoryId] = useState(room.categoryId ?? "");
  const [emoji, setEmoji] = useState(room.emoji ?? "");
  const [color, setColor] = useState(room.color ?? "");
  const [allowAnonymous, setAllowAnonymous] = useState(room.allowAnonymous);
  const [isFeatured, setIsFeatured] = useState(room.isFeatured);
  const [sortOrder, setSortOrder] = useState(String(room.sortOrder));
  const [slowMode, setSlowMode] = useState(String(room.slowModeSeconds ?? 0));
  const [rules, setRules] = useState(room.rulesText ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const res = await fetch(`/api/admin/chat/rooms/${room.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description,
        tier,
        categoryId: categoryId || null,
        emoji,
        color,
        allowAnonymous,
        isFeatured,
        sortOrder: Number.parseInt(sortOrder, 10) || 0,
        slowModeSeconds: Number.parseInt(slowMode, 10) || 0,
        rulesText: rules,
      }),
    });
    setSaving(false);
    setMsg(res.ok ? "Saved." : "Save failed.");
    if (res.ok) onSaved();
  };

  const toggleArchive = async () => {
    await fetch(`/api/admin/chat/rooms/${room.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: room.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE" }),
    });
    onSaved();
  };

  const del = async () => {
    if (!window.confirm("Delete this room and all its messages? This can't be undone.")) return;
    const res = await fetch(`/api/admin/chat/rooms/${room.id}`, { method: "DELETE" });
    if (res.ok) onDeleted();
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <Card><CardBody className="p-4 space-y-3">
        <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Description"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tier"><Select value={tier} onChange={(v) => setTier(v as Tier)} options={TIERS.map((t) => [t, t[0] + t.slice(1).toLowerCase()] as [string, string])} /></Field>
          <Field label="Category"><Select value={categoryId} onChange={setCategoryId} options={[["", "Uncategorised"], ...categories.map((c) => [c.id, c.name] as [string, string])]} /></Field>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Emoji"><Input value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} placeholder="💬" /></Field>
          <Field label="Accent (hex)"><Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="#1777b8" /></Field>
          <Field label="Sort order"><Input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} inputMode="numeric" /></Field>
        </div>
        <Field label="Slow mode (seconds between messages, 0 = off)">
          <Input value={slowMode} onChange={(e) => setSlowMode(e.target.value)} inputMode="numeric" />
        </Field>
        <Field label="Room rules / welcome (shown at the top of the room)">
          <Textarea value={rules} onChange={(e) => setRules(e.target.value)} rows={3} placeholder="e.g. Be kind. No promotion. Anonymous is welcome." />
        </Field>
        <label className="flex items-center justify-between"><span className="text-[13px] text-[color:var(--color-text-muted)]">Allow anonymous posting</span><Switch checked={allowAnonymous} onChange={setAllowAnonymous} /></label>
        <label className="flex items-center justify-between"><span className="text-[13px] text-[color:var(--color-text-muted)]">Featured (top of browse)</span><Switch checked={isFeatured} onChange={setIsFeatured} /></label>
        <div className="flex items-center gap-2 pt-1">
          <Button onClick={save} loading={saving}>Save changes</Button>
          {msg && <span className="text-[12.5px] text-[color:var(--color-text-muted)]">{msg}</span>}
        </div>
      </CardBody></Card>

      <Card><CardBody className="p-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[14px] font-medium">{room.status === "ACTIVE" ? "Archive room" : "Re-activate room"}</p>
          <p className="text-[12.5px] text-[color:var(--color-text-subtle)]">{room.status === "ACTIVE" ? "Hidden from browse; messages become read-only." : "Make the room live and postable again."}</p>
        </div>
        <Button variant="secondary" onClick={toggleArchive}>{room.status === "ACTIVE" ? "Archive" : "Activate"}</Button>
      </CardBody></Card>

      <Card><CardBody className="p-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[14px] font-medium text-[color:var(--color-danger)]">Delete room</p>
          <p className="text-[12.5px] text-[color:var(--color-text-subtle)]">Permanently removes the room, its members, and every message.</p>
        </div>
        <Button variant="danger" onClick={del}>Delete</Button>
      </CardBody></Card>
    </div>
  );
}

/* ── Members ─────────────────────────────────────────────────── */

interface Member {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  role: "MEMBER" | "MODERATOR";
  status: "PENDING" | "ACTIVE" | "BANNED";
  firstPostApproved: boolean;
  joinedAt: string;
}

function MembersTab({ roomId, onChange }: { roomId: string; onChange: () => void }) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "pending" | "banned">("all");

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/chat/rooms/${roomId}/members?status=${filter}`);
    const d = (await res.json().catch(() => ({ members: [] }))) as { members: Member[] };
    setMembers(d.members);
  }, [roomId, filter]);
  useEffect(() => { void load(); }, [load]);

  const act = async (memberId: string, patch: Record<string, unknown>) => {
    await fetch(`/api/admin/chat/rooms/${roomId}/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    void load();
    onChange();
  };
  const remove = async (memberId: string) => {
    if (!window.confirm("Remove this member from the room?")) return;
    await fetch(`/api/admin/chat/rooms/${roomId}/members/${memberId}`, { method: "DELETE" });
    void load();
    onChange();
  };

  return (
    <div className="space-y-3">
      <Select value={filter} onChange={(v) => setFilter(v as typeof filter)} options={[["all", "All"], ["active", "Active"], ["pending", "Pending"], ["banned", "Banned"]]} />
      {members === null ? (
        <p className="text-[13px] text-[color:var(--color-text-subtle)]">Loading…</p>
      ) : members.length === 0 ? (
        <Card><CardBody><p className="text-[13px] text-[color:var(--color-text-muted)] py-4 text-center">No members.</p></CardBody></Card>
      ) : (
        <Card><CardBody className="p-0 divide-y divide-[color:var(--color-border-soft)]">
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-4 py-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[14px] font-medium truncate">{m.userName}</p>
                  {m.role === "MODERATOR" && <Chip text="Mod" tone="sky" />}
                  {m.status === "BANNED" && <Chip text="Banned" tone="rose" />}
                  {m.status === "ACTIVE" && !m.firstPostApproved && <Chip text="1st post pending" tone="amber" />}
                </div>
                <p className="text-[11.5px] text-[color:var(--color-text-subtle)]">joined {new Date(m.joinedAt).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {!m.firstPostApproved && m.status === "ACTIVE" && (
                  <MiniBtn onClick={() => act(m.id, { approveFirstPost: true })}>Approve posts</MiniBtn>
                )}
                <MiniBtn onClick={() => act(m.id, { role: m.role === "MODERATOR" ? "MEMBER" : "MODERATOR" })}>
                  {m.role === "MODERATOR" ? "Remove mod" : "Make mod"}
                </MiniBtn>
                {m.status === "BANNED" ? (
                  <MiniBtn onClick={() => act(m.id, { status: "ACTIVE" })}>Unban</MiniBtn>
                ) : (
                  <MiniBtn tone="danger" onClick={() => act(m.id, { status: "BANNED" })}>Ban</MiniBtn>
                )}
                <MiniBtn tone="danger" onClick={() => remove(m.id)}>Remove</MiniBtn>
              </div>
            </div>
          ))}
        </CardBody></Card>
      )}
    </div>
  );
}

/* ── Messages ────────────────────────────────────────────────── */

interface AdminMsg {
  id: string;
  authorName: string;
  isAnonymous: boolean;
  body: string;
  status: "PUBLISHED" | "PENDING" | "REMOVED";
  isPinned: boolean;
  reportCount: number;
  removedReason: string | null;
  createdAt: string;
}

function MessagesTab({ roomId, onChange }: { roomId: string; onChange: () => void }) {
  const [msgs, setMsgs] = useState<AdminMsg[] | null>(null);
  const [filter, setFilter] = useState<"all" | "published" | "pending" | "removed" | "reported">("all");

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/chat/rooms/${roomId}/messages?status=${filter}`);
    const d = (await res.json().catch(() => ({ messages: [] }))) as { messages: AdminMsg[] };
    setMsgs(d.messages);
  }, [roomId, filter]);
  useEffect(() => { void load(); }, [load]);

  const act = async (id: string, action: string) => {
    await fetch(`/api/admin/chat/rooms/${roomId}/messages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    void load();
    onChange();
  };
  const del = async (id: string) => {
    if (!window.confirm("Permanently delete this message?")) return;
    await fetch(`/api/admin/chat/rooms/${roomId}/messages/${id}`, { method: "DELETE" });
    void load();
    onChange();
  };

  return (
    <div className="space-y-3">
      <Select value={filter} onChange={(v) => setFilter(v as typeof filter)} options={[["all", "All"], ["published", "Published"], ["pending", "Pending"], ["reported", "Reported"], ["removed", "Removed"]]} />
      {msgs === null ? (
        <p className="text-[13px] text-[color:var(--color-text-subtle)]">Loading…</p>
      ) : msgs.length === 0 ? (
        <Card><CardBody><p className="text-[13px] text-[color:var(--color-text-muted)] py-4 text-center">No messages.</p></CardBody></Card>
      ) : (
        <Card><CardBody className="p-0 divide-y divide-[color:var(--color-border-soft)]">
          {msgs.map((m) => (
            <div key={m.id} className="px-4 py-3">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[13px] font-medium">{m.isAnonymous ? `${m.authorName} (anon)` : m.authorName}</p>
                {m.isPinned && <Chip text="Pinned" tone="amber" />}
                {m.reportCount > 0 && <Chip text={`${m.reportCount} report${m.reportCount === 1 ? "" : "s"}`} tone="rose" />}
                {m.status === "PENDING" && <Chip text="Pending" tone="amber" />}
                {m.status === "REMOVED" && <Chip text="Removed" tone="rose" />}
                <span className="text-[11px] text-[color:var(--color-text-subtle)] ml-auto">{new Date(m.createdAt).toLocaleString()}</span>
              </div>
              <p className={cn("mt-1 text-[13.5px] leading-relaxed whitespace-pre-wrap break-words", m.status === "REMOVED" && "line-through opacity-60")}>{m.body}</p>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                {m.status === "PENDING" && <MiniBtn onClick={() => act(m.id, "approve")}>Approve</MiniBtn>}
                {m.status === "REMOVED" && <MiniBtn onClick={() => act(m.id, "restore")}>Restore</MiniBtn>}
                {m.status === "PUBLISHED" && <MiniBtn onClick={() => act(m.id, m.isPinned ? "unpin" : "pin")}>{m.isPinned ? "Unpin" : "Pin"}</MiniBtn>}
                {m.status !== "REMOVED" && <MiniBtn tone="danger" onClick={() => act(m.id, "remove")}>Remove</MiniBtn>}
                <MiniBtn tone="danger" onClick={() => del(m.id)}>Delete</MiniBtn>
              </div>
            </div>
          ))}
        </CardBody></Card>
      )}
    </div>
  );
}

/* ── shared bits ─────────────────────────────────────────────── */

function Tab({ active, onClick, label, badge }: { active: boolean; onClick: () => void; label: string; badge?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative px-3 py-2 text-[13.5px] font-medium -mb-px border-b-2 transition-colors",
        active ? "border-[color:var(--color-brand)] text-[color:var(--color-text)]" : "border-transparent text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]",
      )}
    >
      {label}
      {badge ? <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full bg-[color:var(--color-warning-soft)] text-[color:var(--color-warning-ink)] font-semibold tabular-nums">{badge}</span> : null}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[12px] font-medium text-[color:var(--color-text-muted)] mb-1">{label}</span>
      {children}
    </label>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: Array<[string, string]> }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-11 w-full rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 text-[14px] focus:outline-none focus:border-[color:var(--color-brand)] focus:ring-4 focus:ring-[color:var(--color-brand-soft)]"
    >
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

function MiniBtn({ children, onClick, tone }: { children: React.ReactNode; onClick: () => void; tone?: "danger" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-8 px-2.5 rounded-[9px] text-[12px] font-medium border transition-colors",
        tone === "danger"
          ? "border-[color:var(--color-border)] text-[color:var(--color-danger)] hover:bg-[color:var(--color-danger-soft)]"
          : "border-[color:var(--color-border)] text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-hover)] hover:text-[color:var(--color-text)]",
      )}
    >
      {children}
    </button>
  );
}

function Chip({ text, tone }: { text: string; tone: "sky" | "rose" | "amber" | "slate" }) {
  const map = {
    sky: "bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-ink)]",
    rose: "bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger-ink)]",
    amber: "bg-[color:var(--color-warning-soft)] text-[color:var(--color-warning-ink)]",
    slate: "bg-[color:var(--color-surface-hover)] text-[color:var(--color-text-muted)]",
  } as const;
  return <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full", map[tone])}>{text}</span>;
}
