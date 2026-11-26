"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { SiteShell, type ShellViewer } from "./site-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TIER_META, TierBadge, tierText, type Tier } from "./chat-tier";
import { EmojiPicker } from "./emoji-picker";
import { Img } from "@/components/ui/img";
import { MessageRow, DayDivider, Avatar, type Msg } from "./chat-message";
import { groupMessages } from "@/lib/chat-grouping";
import { reportReasons } from "@/lib/report-reasons";
import { useT } from "./locale-context";
import { serverText } from "@/lib/i18n-core";
import { TranslatedContent } from "./translated-content";

const BODY_MAX = 2000;


interface RoomDto {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  rulesText: string | null;
  tier: Tier;
  status: "ACTIVE" | "ARCHIVED";
  emoji: string | null;
  color: string | null;
  allowAnonymous: boolean;
  slowModeSeconds: number;
  categoryName: string | null;
  memberCount: number;
  messageCount: number;
  membershipStatus: string | null;
  firstPostApproved: boolean;
  isMember: boolean;
  isModerator: boolean;
  banned: boolean;
  canRead: boolean;
  canPost: boolean;
  pinned: Array<{ id: string; authorName: string; body: string }>;
}

export function ChatRoomView({ viewer, initialRoom }: { viewer: ShellViewer; initialRoom: RoomDto }) {
  const t = useT();
  const [room, setRoom] = useState<RoomDto>(initialRoom);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(room.canRead);
  const [hasMoreBefore, setHasMoreBefore] = useState(false);
  const [beforeCursor, setBeforeCursor] = useState<string | null>(null);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [body, setBody] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [replyingTo, setReplyingTo] = useState<Msg | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [reportTarget, setReportTarget] = useState<Msg | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [attachments, setAttachments] = useState<Array<{ url: string }>>([]);
  const [uploading, setUploading] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mentions, setMentions] = useState<Array<{ userId: string; name: string }>>([]);
  const [panicOpen, setPanicOpen] = useState(false);

  const lastAfterRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback((smooth = false) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }, []);

  const updateMsg = (id: string, patch: Partial<Msg>) =>
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const removeMsgLocal = (id: string) => setMessages((prev) => prev.filter((m) => m.id !== id));

  const refetchRoom = useCallback(async () => {
    const res = await fetch(`/api/user/chatrooms/${room.slug}`);
    const d = (await res.json().catch(() => null)) as { room?: RoomDto } | null;
    if (d?.room) setRoom(d.room);
    return d?.room ?? null;
  }, [room.slug]);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/user/chatrooms/${room.slug}/messages?limit=30`);
    const d = (await res.json().catch(() => null)) as
      | { items: Msg[]; hasMoreBefore: boolean; beforeCursor: string | null }
      | null;
    if (d) {
      setMessages(d.items);
      setHasMoreBefore(d.hasMoreBefore);
      setBeforeCursor(d.beforeCursor);
      const last = d.items[d.items.length - 1];
      // "<iso>|<id>" — the id half is what stops a message sharing the
      // boundary millisecond from being skipped by the live poll.
      lastAfterRef.current = last
        ? `${last.createdAt}|${last.id}`
        : new Date(0).toISOString();
    }
    setLoading(false);
    fetch(`/api/user/chatrooms/${room.slug}/read`, { method: "POST" }).catch(() => {});
    setTimeout(() => scrollToBottom(false), 50);
  }, [room.slug, scrollToBottom]);

  // Live updates via SSE (auto-reconnects; dedupes by id).
  useEffect(() => {
    if (!room.canRead) {
      setLoading(false);
      return;
    }
    let alive = true;
    let es: EventSource | null = null;
    (async () => {
      await loadInitial();
      if (!alive) return;
      const after = lastAfterRef.current ?? new Date().toISOString();
      es = new EventSource(`/api/user/chatrooms/${room.slug}/stream?after=${encodeURIComponent(after)}`);
      es.addEventListener("messages", (ev) => {
        try {
          const items = JSON.parse((ev as MessageEvent).data) as Msg[];
          if (!items.length) return;
          setMessages((prev) => {
            const have = new Set(prev.map((m) => m.id));
            const fresh = items.filter((m) => !have.has(m.id));
            if (!fresh.length) return prev;
            const newest = items[items.length - 1];
            lastAfterRef.current = `${newest.createdAt}|${newest.id}`;
            return [...prev, ...fresh];
          });
          const el = scrollRef.current;
          const nearBottom = el ? el.scrollHeight - el.scrollTop - el.clientHeight < 160 : true;
          if (nearBottom) setTimeout(() => scrollToBottom(true), 50);
          fetch(`/api/user/chatrooms/${room.slug}/read`, { method: "POST" }).catch(() => {});
        } catch {
          /* ignore malformed frame */
        }
      });
    })();
    return () => {
      alive = false;
      es?.close();
    };
  }, [room.canRead, loadInitial, room.slug, scrollToBottom]);

  // Auto-grow the composer (X / Facebook style) up to a max, then scroll.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [body]);

  const loadOlder = async () => {
    if (!beforeCursor || loadingOlder) return;
    setLoadingOlder(true);
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const res = await fetch(`/api/user/chatrooms/${room.slug}/messages?before=${encodeURIComponent(beforeCursor)}&limit=30`);
    const d = (await res.json().catch(() => null)) as
      | { items: Msg[]; hasMoreBefore: boolean; beforeCursor: string | null }
      | null;
    if (d) {
      setMessages((prev) => [...d.items, ...prev]);
      setHasMoreBefore(d.hasMoreBefore);
      setBeforeCursor(d.beforeCursor);
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - prevHeight;
      });
    }
    setLoadingOlder(false);
  };

  const join = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/user/chatrooms/${room.slug}/join`, { method: "POST" });
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!res.ok) return setError(serverText(t, d?.error) || t("chat.joinFailed", "Couldn't join."));
    await refetchRoom();
  };
  const leave = async () => {
    setBusy(true);
    const res = await fetch(`/api/user/chatrooms/${room.slug}/leave`, { method: "POST" });
    setBusy(false);
    if (res.ok) {
      setMessages([]);
      await refetchRoom();
    }
  };

  const remaining = BODY_MAX - body.length;
  const canSend = (body.trim().length > 0 || attachments.length > 0) && remaining >= 0 && !sending && !uploading;

  const send = async () => {
    if (!canSend) return;
    setSending(true);
    setError(null);
    const res = await fetch(`/api/user/chatrooms/${room.slug}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, isAnonymous, replyToId: replyingTo?.id ?? undefined, attachments, mentions: mentions.map((m) => m.userId) }),
    });
    const d = (await res.json().catch(() => ({}))) as { message?: Msg; error?: string };
    setSending(false);
    if (!res.ok || !d.message) return setError(serverText(t, d?.error) || t("chat.sendFailed", "Couldn't send."));
    setMessages((prev) => [...prev, d.message!]);
    lastAfterRef.current = `${d.message.createdAt}|${d.message.id}`;
    setBody("");
    setIsAnonymous(false);
    setReplyingTo(null);
    setAttachments([]);
    setMentions([]);
    fetch(`/api/user/chatrooms/${room.slug}/read`, { method: "POST" }).catch(() => {});
    setTimeout(() => scrollToBottom(true), 50);
  };

  const react = async (id: string, emoji: string) => {
    const res = await fetch(`/api/user/chatrooms/${room.slug}/messages/${id}/react`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
    const d = (await res.json().catch(() => ({}))) as { emoji?: string; count?: number; mine?: boolean };
    if (!res.ok || d.emoji === undefined) return;
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const others = m.reactions.filter((r) => r.emoji !== d.emoji);
        const next = d.count && d.count > 0 ? [...others, { emoji: d.emoji!, count: d.count, mine: !!d.mine }] : others;
        return { ...m, reactions: next.sort((a, b) => b.count - a.count) };
      }),
    );
  };

  const saveEdit = async () => {
    if (!editing) return;
    const res = await fetch(`/api/user/chatrooms/${room.slug}/messages/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "edit", body: editing.text }),
    });
    const d = (await res.json().catch(() => ({}))) as { message?: Msg };
    if (res.ok && d.message) updateMsg(editing.id, { body: d.message.body, edited: true });
    setEditing(null);
  };

  const deleteMsg = async (id: string) => {
    const before = messages;
    removeMsgLocal(id);
    const res = await fetch(`/api/user/chatrooms/${room.slug}/messages/${id}`, { method: "DELETE" });
    if (!res.ok) setMessages(before);
  };

  const modAction = async (id: string, action: "pin" | "unpin" | "remove" | "approve") => {
    const res = await fetch(`/api/user/chatrooms/${room.slug}/messages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) return;
    if (action === "remove") removeMsgLocal(id);
    else if (action === "approve") updateMsg(id, { pending: false });
    else updateMsg(id, { isPinned: action === "pin" });
    if (action === "pin" || action === "unpin" || action === "remove") void refetchRoom();
  };

  const onPickFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    const room4 = 4 - attachments.length;
    if (room4 <= 0) { setError(t("chat.maxImages", "Up to 4 images per message.")); return; }
    setUploading(true);
    for (const file of Array.from(files).slice(0, room4)) {
      const form = new FormData();
      form.append("file", file);
      try {
        const res = await fetch("/api/user/upload", { method: "POST", body: form });
        const d = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
        if (res.ok && d.url) setAttachments((prev) => (prev.length < 4 ? [...prev, { url: d.url! }] : prev));
        else setError(serverText(t, d?.error) || t("chat.uploadFailed", "Upload failed."));
      } catch {
        setError(t("chat.uploadFailed", "Upload failed."));
      }
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const blockAuthor = async (m: Msg) => {
    if (!m.authorId) return;
    await fetch("/api/user/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: m.authorId }),
    });
    setMessages((prev) => prev.filter((x) => x.authorId !== m.authorId));
    setFlash(t("chat.blocked", "Blocked. You won't see their messages."));
    setTimeout(() => setFlash(null), 3000);
  };

  const tierMeta = TIER_META[room.tier];
  const tierWords = tierText(t)[room.tier];

  const rows = useMemo(() => groupMessages(messages), [messages]);

  return (
    // The room used to be a bordered white card floating on the grey
    // page, inside a column that already had padding — a box in a box,
    // with the message list scrolling inside it while the page scrolled
    // too. It is a screen now: header at the top, composer at the
    // bottom, one scroll region between them, no card.
    <SiteShell viewer={viewer} hideRightRail fullBleed>
      <div className="flex h-full min-h-0 flex-col bg-[color:var(--color-surface)]">
        {/* Header — the back link lives in it rather than on a line of
            its own above the room, which was the other floating box. */}
        <div className="flex shrink-0 items-center gap-2.5 border-b border-[color:var(--color-border-soft)] px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
          <Link
            href="/chatrooms"
            aria-label={t("chat.allRooms", "All chatrooms")}
            className="-ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[color:var(--color-text-muted)] transition-colors hover:bg-[color:var(--color-surface-hover)] hover:text-[color:var(--color-text)]"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden><path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] text-[19px]" style={{ background: room.color ? `${room.color}1a` : "var(--color-brand-soft)" }}>
            {room.emoji ?? "💬"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate text-[15.5px] font-semibold tracking-[-0.01em]">
                <TranslatedContent kind="room" id={room.id} field="name" text={room.name} toggle={false} />
              </h1>
              <span className="shrink-0"><TierBadge tier={room.tier} /></span>
              {room.isModerator && <span className="shrink-0 rounded-full bg-[color:var(--color-brand-tint)] px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--color-brand-ink)]">{t("chat.mod", "Mod")}</span>}
              {room.status === "ARCHIVED" && <span className="shrink-0 rounded-full bg-[color:var(--color-surface-hover)] px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--color-text-muted)]">{t("chat.archived", "Archived")}</span>}
            </div>
            <button type="button" onClick={() => setMembersOpen(true)} className="text-[11.5px] tabular-nums text-[color:var(--color-text-subtle)] hover:text-[color:var(--color-text)]">
              {room.memberCount.toLocaleString()} {room.memberCount === 1 ? t("chat.member", "member") : t("chat.members", "members")} · view
            </button>
          </div>
          {room.isMember ? (
            <Button variant="ghost" size="sm" onClick={leave} disabled={busy}>{t("chat.leave", "Leave")}</Button>
          ) : room.tier !== "PUBLIC" && !room.banned ? (
            <Button size="sm" onClick={join} loading={busy}>{t("chat.join", "Join")}</Button>
          ) : null}
        </div>

        {room.tier === "CRISIS" && room.canRead && (
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[color:var(--color-danger-soft)] bg-[color:var(--color-danger-soft)] px-3 py-2 sm:px-4">
            <p className="text-[12.5px] text-[color:var(--color-danger-ink)]">
              {t("chat.crisisPrompt", "In crisis or need urgent help?")}
            </p>
            <button type="button" onClick={() => setPanicOpen(true)} className="shrink-0 inline-flex items-center gap-1 rounded-full bg-[color:var(--color-danger)] text-[color:var(--color-on-danger)] text-[12px] font-semibold px-3 h-8 hover:bg-[color:var(--color-danger-ink)] active:scale-[0.98]">
              🆘 {t("chat.getHelpNow", "Get help now")}
            </button>
          </div>
        )}

        {/* Pinned banner */}
        {room.canRead && room.pinned.length > 0 && (
          <div className="shrink-0 border-b border-[color:var(--color-warning-soft)] bg-[color:var(--color-warning-soft)]/70 px-3 py-2 sm:px-4">
            {room.pinned.slice(0, 1).map((p) => (
              <div key={p.id} className="flex items-start gap-2">
                <svg width="14" height="14" viewBox="0 0 20 20" fill="none" className="mt-0.5 shrink-0 text-[color:var(--color-warning)]" aria-hidden><path d="M10 3v8m0 0l-3-2m3 2l3-2M6 15h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <p className="text-[12.5px] text-[color:var(--color-warning-ink)] leading-snug min-w-0">
                  <span className="font-semibold">{p.authorName}: </span>
                  <span className="line-clamp-2">
                    <TranslatedContent kind="chatMessage" id={p.id} field="body" text={p.body} toggle={false} />
                  </span>
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Body */}
        {room.banned ? (
          <Notice tone="danger" text={t("chat.removed", "You've been removed from this room and can't post here.")} />
        ) : !room.canRead ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="max-w-sm text-center">
              <div className="mx-auto h-12 w-12 rounded-full flex items-center justify-center text-[22px]" style={{ background: `${tierMeta.dot}1a` }}>{room.emoji ?? "🔒"}</div>
              <p className="mt-3 text-[15px] font-semibold tracking-[-0.01em]">
                {t("chat.tierRoom", "This is a {tier} room", {
                  tier: tierWords.label.toLowerCase(),
                })}
              </p>
              <p className="mt-1 text-[13px] text-[color:var(--color-text-muted)]">
                {tierWords.hint} {t("chat.joinToRead", "Join to read and take part.")}
              </p>
              {room.description && (
                <p className="mt-3 text-[12.5px] text-[color:var(--color-text-subtle)]">
                  <TranslatedContent kind="room" id={room.id} field="description" text={room.description} toggle={false} />
                </p>
              )}
              <div className="mt-4"><Button onClick={join} loading={busy}>{t("chat.joinRoom", "Join room")}</Button></div>
              {error && <p className="mt-2 text-[12px] text-[color:var(--color-danger)]">{error}</p>}
            </div>
          </div>
        ) : (
          <>
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4">
              {room.rulesText && (
                <div className="mb-3 rounded-[12px] bg-[color:var(--color-surface-muted)] px-3 py-2 text-[12px] text-[color:var(--color-text-muted)] leading-relaxed whitespace-pre-wrap">
                  {room.rulesText}
                </div>
              )}
              {hasMoreBefore && (
                <div className="flex justify-center pb-2">
                  <button type="button" onClick={loadOlder} disabled={loadingOlder} className="text-[12.5px] font-medium text-[color:var(--color-brand)] hover:underline disabled:opacity-50">
                    {loadingOlder ? t("common.loading", "Loading…") : t("chat.loadEarlier", "Load earlier messages")}
                  </button>
                </div>
              )}
              {loading ? (
                <p className="text-center text-[12.5px] text-[color:var(--color-text-subtle)] py-6">{t("chat.loadingMessages", "Loading messages…")}</p>
              ) : messages.length === 0 ? (
                <p className="text-center text-[13px] text-[color:var(--color-text-muted)] py-6">
                  {t("chat.noMessages", "No messages yet. Be the first to say hello.")}
                </p>
              ) : (
                rows.map(({ m, newDay, continues, endsTurn }) => (
                  <div key={m.id}>
                    {newDay && <DayDivider iso={m.createdAt} />}
                  <MessageRow
                    contentKind="chatMessage"
                    m={m}
                    continues={continues}
                    endsTurn={endsTurn}
                    isMod={room.isModerator}
                    editing={editing?.id === m.id ? editing.text : null}
                    onEditChange={(t) => setEditing((e) => (e ? { ...e, text: t } : e))}
                    onEditSave={saveEdit}
                    onEditCancel={() => setEditing(null)}
                    onStartEdit={() => setEditing({ id: m.id, text: m.body })}
                    onDelete={() => deleteMsg(m.id)}
                    onReply={() => setReplyingTo(m)}
                    onReport={() => setReportTarget(m)}
                    onReact={(emoji) => react(m.id, emoji)}
                    onMod={(a) => modAction(m.id, a)}
                    onBlock={!m.isOwn && !m.isAnonymous && m.authorId ? () => blockAuthor(m) : undefined}
                  />
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>

            {/* Composer */}
            {room.canPost ? (
              <div className="shrink-0 border-t border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-3">
                {replyingTo && (
                  <div className="mb-2 flex items-center gap-2 rounded-[10px] bg-[color:var(--color-surface-muted)] px-3 py-1.5">
                    <div className="min-w-0 flex-1 text-[12px]">
                      <span className="font-semibold">
                        {t("chat.replyingTo", "Replying to {name}", {
                          name: replyingTo.isAnonymous
                            ? t("post.anonymous", "Anonymous member")
                            : replyingTo.authorName,
                        })}
                      </span>
                      <span className="text-[color:var(--color-text-subtle)] truncate block">
                        <TranslatedContent kind="chatMessage" id={replyingTo.id} field="body" text={replyingTo.body} toggle={false} />
                      </span>
                    </div>
                    <button type="button" onClick={() => setReplyingTo(null)} aria-label={t("chat.cancelReply", "Cancel reply")} className="shrink-0 text-[color:var(--color-text-subtle)] hover:text-[color:var(--color-text)]">✕</button>
                  </div>
                )}
                {room.slowModeSeconds > 0 && (
                  <p className="mb-2 text-[11px] text-[color:var(--color-text-subtle)]">
                    {t("chat.slowMode", "Slow mode: one message every {n}s.", {
                      n: room.slowModeSeconds,
                    })}
                  </p>
                )}
                {error && <p className="mb-2 text-[12px] text-[color:var(--color-danger)]">{error}</p>}
                {attachments.length > 0 && (
                  <div className="mb-2 flex gap-2 flex-wrap">
                    {attachments.map((a) => (
                      <div key={a.url} className="relative">
                        <Img src={a.url} alt="" className="h-16 w-16 object-cover rounded-[10px] border border-[color:var(--color-border-soft)]"
                          variant="thumb"
                        />
                        <button type="button" onClick={() => setAttachments((prev) => prev.filter((x) => x.url !== a.url))} aria-label={t("composer.removeImage", "Remove image")} className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-black/70 text-white text-[11px] flex items-center justify-center">✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onPickFiles(e.target.files)} />
                <div className="flex items-end gap-2">
                  <textarea
                    ref={textareaRef}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                    placeholder={t("chat.writeMessage", "Write a message…")}
                    rows={1}
                    maxLength={BODY_MAX + 200}
                    className="flex-1 resize-none rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2.5 text-[14px] leading-relaxed max-h-[140px] overflow-y-auto focus:outline-none focus:border-[color:var(--color-brand)] focus:ring-4 focus:ring-[color:var(--color-brand-soft)]"
                  />
                  <Button size="sm" loading={sending} disabled={!canSend} onClick={send}>{t("chat.send", "Send")}</Button>
                </div>
                <div className="mt-1.5 flex items-center gap-0.5">
                  <EmojiPicker onPick={(e) => setBody((b) => b + e)} />
                  <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading || attachments.length >= 4} aria-label={t("chat.attachImage", "Attach image")} className="inline-flex items-center justify-center h-9 w-9 rounded-[10px] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-brand)] hover:bg-[color:var(--color-surface-hover)] disabled:opacity-50">
                    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden><path d="M13 7l-5.5 5.5a2 2 0 002.8 2.8L16 9.8a3.5 3.5 0 00-4.9-4.9L5.5 10.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                  <MentionButton
                    slug={room.slug}
                    onPick={(mm) => {
                      setBody((b) => b + (b && !b.endsWith(" ") ? " " : "") + "@" + mm.name + " ");
                      setMentions((prev) => (prev.some((x) => x.userId === mm.userId) ? prev : [...prev, mm]));
                    }}
                  />
                  {room.allowAnonymous && (
                    <label className="ml-auto inline-flex items-center gap-2 cursor-pointer select-none pr-1">
                      <span className="text-[12px] text-[color:var(--color-text-muted)]">
                        {t("chat.anonymous", "Anonymous")}
                      </span>
                      <span className="relative inline-flex items-center">
                        <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} className="sr-only peer" />
                        <span className="h-4.5 w-8 rounded-full bg-[color:var(--color-border-strong)] peer-checked:bg-[color:var(--color-brand)] transition-colors" />
                        <span className="absolute left-0.5 top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-3.5" />
                      </span>
                    </label>
                  )}
                </div>
              </div>
            ) : room.status === "ARCHIVED" ? (
              <Notice tone="muted" text="This room is archived — you can read it, but new messages are closed." />
            ) : (
              <Notice tone="muted" text="Join this room to post a message." />
            )}
          </>
        )}
      </div>

      {reportTarget && (
        <ReportModal
          message={reportTarget}
          slug={room.slug}
          onClose={() => setReportTarget(null)}
        />
      )}
      {membersOpen && <MembersPanel slug={room.slug} onClose={() => setMembersOpen(false)} />}
      {panicOpen && <PanicModal slug={room.slug} onClose={() => setPanicOpen(false)} />}
      {flash && (
        <div className="fixed bottom-[calc(1.5rem+var(--bottom-nav-h))] left-1/2 -translate-x-1/2 z-40 rounded-[12px] px-4 py-3 shadow-[var(--shadow-elevated)] text-[13.5px] bg-[color:var(--color-text)] text-[color:var(--color-surface)]">
          {flash}
        </div>
      )}
    </SiteShell>
  );
}

/* ── report modal ────────────────────────────────────────────── */

function ReportModal({ message, slug, onClose }: { message: Msg; slug: string; onClose: () => void }) {
  const t = useT();
  const REASONS = reportReasons(t);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const submit = async () => {
    if (!reason) return;
    setSubmitting(true);
    const res = await fetch(`/api/user/chatrooms/${slug}/messages/${message.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "report", reason, notes: notes.trim() || undefined }),
    });
    const d = (await res.json().catch(() => ({}))) as { duplicate?: boolean };
    setSubmitting(false);
    setDone(
      d.duplicate
        ? t("report.duplicate", "You've already reported this — our team is on it.")
        : t("report.thanks", "Thanks. A moderator will review it."),
    );
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={submitting ? undefined : onClose} />
      <div className="relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto bg-[color:var(--color-surface)] rounded-t-2xl sm:rounded-2xl border border-[color:var(--color-border)] shadow-[var(--shadow-elevated)] p-5">
        {done ? (
          <div className="text-center py-4">
            <p className="text-[14px]">{done}</p>
            <div className="mt-4"><Button onClick={onClose}>{t("common.done", "Done")}</Button></div>
          </div>
        ) : (
          <>
            <h2 className="text-[16px] font-semibold tracking-[-0.01em]">{t("report.messageTitle", "Report message")}</h2>
            <div className="mt-3 rounded-[10px] bg-[color:var(--color-surface-muted)] px-3 py-2 text-[12.5px] text-[color:var(--color-text-muted)] line-clamp-3">{message.body}</div>
            <div className="mt-3 space-y-1.5">
              {REASONS.map((r) => (
                <label key={r.value} className={cn("flex items-center gap-2.5 rounded-[10px] border px-3 py-2 cursor-pointer", reason === r.value ? "bg-[color:var(--color-brand-tint)] border-[color:var(--color-brand)]" : "border-[color:var(--color-border)]")}>
                  <input type="radio" name="r" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} className="accent-[color:var(--color-brand)]" />
                  <span className="text-[13px]">{r.label}</span>
                </label>
              ))}
            </div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={2000} placeholder={t("report.addContext", "Add context (optional)")} className="mt-3 w-full rounded-[10px] border border-[color:var(--color-border)] px-3 py-2 text-[13px] focus:outline-none focus:border-[color:var(--color-brand)] focus:ring-4 focus:ring-[color:var(--color-brand-soft)]" />
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" className="flex-1" onClick={onClose} disabled={submitting}>{t("common.cancel", "Cancel")}</Button>
              <Button variant="danger" className="flex-1" loading={submitting} disabled={!reason} onClick={submit}>{t("report.send", "Report")}</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── members panel ───────────────────────────────────────────── */

function MembersPanel({ slug, onClose }: { slug: string; onClose: () => void }) {
  const t = useT();
  const [members, setMembers] = useState<Array<{ userId: string; userName: string; userAvatar: string | null; role: string }> | null>(null);
  useEffect(() => {
    fetch(`/api/user/chatrooms/${slug}/members`).then((r) => r.json()).then((d) => setMembers(d.members ?? [])).catch(() => setMembers([]));
  }, [slug]);
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm max-h-[80vh] overflow-y-auto bg-[color:var(--color-surface)] rounded-t-2xl sm:rounded-2xl border border-[color:var(--color-border)] shadow-[var(--shadow-elevated)]">
        <div className="px-5 py-3 border-b border-[color:var(--color-border-soft)] flex items-center justify-between">
          <h2 className="text-[15px] font-semibold">{t("members.title", "Members")}</h2>
          <button type="button" onClick={onClose} aria-label={t("common.close", "Close")} className="text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]">✕</button>
        </div>
        <div className="p-3 space-y-1">
          {members === null ? (
            <p className="text-[12.5px] text-[color:var(--color-text-subtle)] p-2">{t("common.loading", "Loading\u2026")}</p>
          ) : members.length === 0 ? (
            <p className="text-[12.5px] text-[color:var(--color-text-subtle)] p-2">{t("chat.noMembers", "No members yet.")}</p>
          ) : (
            members.map((m) => (
              <div key={m.userId} className="flex items-center gap-2.5 px-2 py-1.5">
                <Avatar name={m.userName} url={m.userAvatar} />
                <span className="text-[13px] truncate flex-1">{m.userName}</span>
                {m.role === "MODERATOR" && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand-ink)] font-medium">{t("chat.mod", "Mod")}</span>}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}


function MentionButton({ slug, onPick }: { slug: string; onPick: (m: { userId: string; name: string }) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Array<{ userId: string; userName: string }> | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  useEffect(() => {
    if (open && members === null) {
      fetch(`/api/user/chatrooms/${slug}/members`).then((r) => r.json()).then((d) => setMembers(d.members ?? [])).catch(() => setMembers([]));
    }
  }, [open, members, slug]);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-label={t("chat.mention", "Mention someone")} className="inline-flex items-center justify-center h-9 w-9 rounded-[10px] text-[16px] font-semibold text-[color:var(--color-text-muted)] hover:text-[color:var(--color-brand)] hover:bg-[color:var(--color-surface-hover)]">@</button>
      {open && (
        <div className="absolute bottom-full mb-2 left-0 z-20 w-56 max-h-56 overflow-y-auto rounded-[14px] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] shadow-[var(--shadow-elevated)] p-1">
          {members === null ? (
            <p className="p-2 text-[12px] text-[color:var(--color-text-subtle)]">{t("common.loading", "Loading\u2026")}</p>
          ) : members.length === 0 ? (
            <p className="p-2 text-[12px] text-[color:var(--color-text-subtle)]">{t("chat.noMentions", "No members to mention.")}</p>
          ) : (
            members.map((m) => (
              <button key={m.userId} type="button" onClick={() => { onPick({ userId: m.userId, name: m.userName }); setOpen(false); }} className="w-full text-left px-2.5 py-1.5 rounded-[8px] text-[13px] hover:bg-[color:var(--color-surface-hover)] truncate">
                @{m.userName}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function PanicModal({ slug, onClose }: { slug: string; onClose: () => void }) {
  const t = useT();
  const [state, setState] = useState<{ moderatorsAlerted: number } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    fetch(`/api/user/chatrooms/${slug}/panic`, { method: "POST" })
      .then((r) => r.json())
      .then((d) => { if (d.ok) setState({ moderatorsAlerted: d.moderatorsAlerted ?? 0 }); else setFailed(true); })
      .catch(() => setFailed(true));
  }, [slug]);
  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-[color:var(--color-surface)] rounded-t-2xl sm:rounded-2xl border border-[color:var(--color-border)] shadow-[var(--shadow-elevated)] p-5">
        <div className="flex items-center gap-2">
          <span className="text-[20px]">🆘</span>
          <h2 className="text-[16px] font-semibold tracking-[-0.01em]">{t("crisis.title", "You're not alone")}</h2>
        </div>
        <p className="mt-2 text-[13px] text-[color:var(--color-text-muted)]">
          {state
            ? state.moderatorsAlerted > 0
              ? t(
                  "crisis.alerted",
                  "A moderator has been alerted ({n} on call). Someone will check in with you.",
                  { n: state.moderatorsAlerted },
                )
              : t(
                  "crisis.flagged",
                  "We've flagged this room. In the meantime, please reach out below.",
                )
            : failed
              ? t("crisis.failed", "We couldn't send the alert just now — but help is still here:")
              : t("crisis.alerting", "Alerting a moderator…")}
        </p>
        <div className="mt-3 rounded-[12px] bg-[color:var(--color-danger-soft)] border border-[color:var(--color-danger-soft)] p-3">
          {/*
            THE NUMBER IS A PLACEHOLDER, not part of the sentence.
            Machine translation rewrites digits often enough that a
            crisis line is the one string where it must not be able
            to: passing it as a variable means it is substituted after
            translation and comes back exactly as written, whatever
            the language does to the words around it.
          */}
          <p className="text-[13px] font-semibold text-[color:var(--color-danger-ink)]">
            {t("crisis.lifelineName", "US · {number} Suicide & Crisis Lifeline", { number: "988" })}
          </p>
          <p className="text-[12px] text-[color:var(--color-danger-ink)] mt-0.5">
            {t("crisis.lifelineHow", "Call or text {number} — free, confidential, 24/7.", {
              number: "988",
            })}
          </p>
          <p className="text-[11.5px] text-[color:var(--color-danger-ink)]/80 mt-1.5">
            {t("crisis.emergency", "If you're in immediate danger, call your local emergency number.")}
          </p>
        </div>
        <div className="mt-4">
          <Button className="w-full" onClick={onClose}>{t("common.close", "Close")}</Button>
        </div>
      </div>
    </div>
  );
}

/* ── shared bits ─────────────────────────────────────────────── */

function Notice({ tone, text }: { tone: "danger" | "muted"; text: string }) {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <p className={cn("text-[13px] text-center max-w-sm", tone === "danger" ? "text-[color:var(--color-danger)]" : "text-[color:var(--color-text-muted)]")}>{text}</p>
    </div>
  );
}


