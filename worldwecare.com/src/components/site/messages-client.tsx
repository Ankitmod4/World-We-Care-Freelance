"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { SiteShell, type ShellViewer } from "./site-shell";
import { PhotoAttach, EntryImage } from "./photo-attach";
import { EmojiPicker } from "./emoji-picker";
import { Img } from "@/components/ui/img";
import { timeAgo } from "@/lib/time-ago";
import { useT } from "./locale-context";
import { serverText } from "@/lib/i18n-core";

interface ConversationSummary {
  id: string; otherId: string; otherName: string; otherAvatar: string | null;
  lastMessageText: string | null; lastMessageAt: string; lastSenderId: string | null;
  unread: number; isAccepted: boolean;
}
interface DmMessage {
  id: string; senderId: string; body: string; imageUrl: string | null;
  deleted: boolean; isOwn: boolean; createdAt: string;
}
interface ThreadView {
  conversationId: string | null;
  other: { id: string; name: string; avatar: string | null } | null;
  isAccepted: boolean; isRequest: boolean; blocked: boolean;
  otherLastReadAt: string | null; messages: DmMessage[]; nextCursor: string | null;
}

export function MessagesClient({ viewer, initialUserId }: { viewer: ShellViewer; initialUserId: string | null }) {
  const t = useT();
  const [box, setBox] = useState<"primary" | "requests">("primary");
  const [convos, setConvos] = useState<ConversationSummary[]>([]);
  const [reqCount, setReqCount] = useState(0);
  const [selected, setSelected] = useState<string | null>(initialUserId);

  const [thread, setThread] = useState<ThreadView | null>(null);
  const [messages, setMessages] = useState<DmMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [otherLastReadAt, setOtherLastReadAt] = useState<string | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);

  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const esRef = useRef<EventSource | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastTypingSent = useRef(0);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const stickRef = useRef(true);
  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);
  const onScrollArea = () => {
    const el = scrollRef.current;
    if (el) stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  const loadList = useCallback(async (b: "primary" | "requests") => {
    try {
      const res = await fetch(`/api/user/messages?box=${b}`);
      const d = await res.json();
      setConvos(d.conversations ?? []);
    } catch { /* noop */ }
  }, []);
  const loadReqCount = useCallback(async () => {
    try {
      const res = await fetch("/api/user/messages?box=requests");
      const d = await res.json();
      setReqCount((d.conversations ?? []).length);
    } catch { /* noop */ }
  }, []);

  useEffect(() => { void loadList(box); }, [box, loadList]);
  useEffect(() => { void loadReqCount(); }, [loadReqCount]);
  useEffect(() => {
    const t = setInterval(() => { void loadList(box); void loadReqCount(); }, 8000);
    return () => clearInterval(t);
  }, [box, loadList, loadReqCount]);

  /*
   * Which thread request is the current one.
   *
   * Open A, then click B before A's response lands: both fetches are
   * in flight, and if A is the slower of the two its response arrives
   * last and wins. The screen then shows A's name, A's avatar and A's
   * private messages while the conversation list still highlights B.
   * On a page whose entire job is private conversations, showing the
   * wrong person's is the worst bug in this file, so every write below
   * is gated on still being the newest request.
   */
  const openSeq = useRef(0);

  const openThread = useCallback(async (userId: string) => {
    const seq = ++openSeq.current;
    setLoadingThread(true);
    setMessages([]);
    setError(null);
    try {
      const res = await fetch(`/api/user/messages/thread/${userId}`);
      if (seq !== openSeq.current) return;
      if (!res.ok) { setThread(null); return; }
      const d: ThreadView = await res.json();
      if (seq !== openSeq.current) return;
      setThread(d);
      setMessages(d.messages);
      setNextCursor(d.nextCursor);
      setOtherLastReadAt(d.otherLastReadAt);
      setOtherTyping(false);
      stickRef.current = true;
      requestAnimationFrame(() => requestAnimationFrame(() => scrollToBottom()));
      if (d.conversationId) {
        fetch(`/api/user/messages/conversations/${d.conversationId}/read`, { method: "POST" }).catch(() => {});
        setConvos((prev) => prev.map((c) => (c.id === d.conversationId ? { ...c, unread: 0 } : c)));
      }
    } finally {
      // Only the newest request owns the spinner — an older one
      // finishing must not declare the newer one done.
      if (seq === openSeq.current) setLoadingThread(false);
    }
  }, []);

  useEffect(() => {
    if (selected) {
      void openThread(selected);
      try { window.history.replaceState(null, "", `/messages/${selected}`); } catch { /* ignore */ }
    } else {
      setThread(null);
      setMessages([]);
      try { window.history.replaceState(null, "", "/messages"); } catch { /* ignore */ }
    }
  }, [selected, openThread]);

  // SSE for the open conversation
  const convoId = thread?.conversationId ?? null;
  useEffect(() => {
    esRef.current?.close();
    esRef.current = null;
    if (!convoId) return;
    const after = messages.length ? messages[messages.length - 1].createdAt : new Date(0).toISOString();
    const es = new EventSource(`/api/user/messages/conversations/${convoId}/stream?after=${encodeURIComponent(after)}`);
    es.addEventListener("messages", (e) => {
      const incoming = JSON.parse((e as MessageEvent).data) as DmMessage[];
      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m.id));
        const add = incoming.filter((m) => !ids.has(m.id));
        return add.length ? [...prev, ...add] : prev;
      });
      if (incoming.some((m) => !m.isOwn)) {
        fetch(`/api/user/messages/conversations/${convoId}/read`, { method: "POST" }).catch(() => {});
      }
    });
    es.addEventListener("seen", (e) => {
      const d = JSON.parse((e as MessageEvent).data) as { otherLastReadAt: string | null };
      setOtherLastReadAt(d.otherLastReadAt);
    });
    es.addEventListener("typing", (e) => {
      const d = JSON.parse((e as MessageEvent).data) as { typing: boolean };
      setOtherTyping(!!d.typing);
    });
    esRef.current = es;
    return () => { es.close(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convoId]);

  // Stick to the newest message unless the user has scrolled up to read history.
  useEffect(() => {
    if (stickRef.current) scrollToBottom();
  }, [messages, otherTyping, scrollToBottom]);

  const send = async () => {
    if ((!body.trim() && !imageUrl) || sending || !selected) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/user/messages/thread/${selected}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim(), imageUrl }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(serverText(t, d?.error) || t("chat.sendFailed", "Couldn't send.")); return; }
      setMessages((prev) => (prev.some((m) => m.id === d.message.id) ? prev : [...prev, d.message]));
      setBody("");
      setImageUrl(null);
      if (!thread?.conversationId && d.conversationId) {
        setThread((t) => (t ? { ...t, conversationId: d.conversationId, isAccepted: true, isRequest: false } : t));
      }
      void loadList(box);
    } catch {
      setError(t("common.wentWrong", "Something went wrong."));
    } finally { setSending(false); }
  };

  const onBodyChange = (v: string) => {
    setBody(v);
    const cid = thread?.conversationId;
    if (cid && Date.now() - lastTypingSent.current > 3000) {
      lastTypingSent.current = Date.now();
      fetch(`/api/user/messages/conversations/${cid}/typing`, { method: "POST" }).catch(() => {});
    }
  };

  const insertEmoji = (emo: string) => {
    const ta = composerRef.current;
    if (!ta) { onBodyChange(body + emo); return; }
    const start = ta.selectionStart ?? body.length;
    const end = ta.selectionEnd ?? body.length;
    onBodyChange(body.slice(0, start) + emo + body.slice(end));
    requestAnimationFrame(() => {
      ta.focus();
      const c = start + emo.length;
      ta.setSelectionRange(c, c);
    });
  };

  const loadMore = async () => {
    if (!selected || !nextCursor) return;
    stickRef.current = false;
    const res = await fetch(`/api/user/messages/thread/${selected}?cursor=${encodeURIComponent(nextCursor)}`);
    const d: ThreadView = await res.json();
    const el = scrollRef.current;
    const prevH = el?.scrollHeight ?? 0;
    setMessages((prev) => [...d.messages, ...prev]);
    setNextCursor(d.nextCursor);
    requestAnimationFrame(() => { if (el) el.scrollTop = el.scrollHeight - prevH; });
  };

  const accept = async () => {
    const cid = thread?.conversationId;
    if (!cid) return;
    await fetch(`/api/user/messages/conversations/${cid}/accept`, { method: "POST" });
    setThread((t) => (t ? { ...t, isRequest: false, isAccepted: true } : t));
    void loadReqCount();
  };
  const decline = async () => {
    const cid = thread?.conversationId;
    if (!cid) return;
    await fetch(`/api/user/messages/conversations/${cid}/decline`, { method: "POST" });
    setSelected(null);
    void loadReqCount();
    void loadList("requests");
  };
  const delMsg = async (m: DmMessage) => {
    await fetch(`/api/user/messages/messages/${m.id}`, { method: "DELETE" });
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, deleted: true, body: "", imageUrl: null } : x)));
  };

  const lastOwn = useMemo(() => [...messages].reverse().find((m) => m.isOwn) ?? null, [messages]);
  const seen = lastOwn && otherLastReadAt ? new Date(otherLastReadAt) >= new Date(lastOwn.createdAt) : false;

  return (
    // Same treatment as a chatroom, and for the same reason: this was a
    // bordered card floating on the grey page, inside a column that
    // already had padding, with the inbox and the thread each scrolling
    // inside it while the page scrolled too. A conversation is a
    // screen. The shell hands over the height and the page fills it.
    <SiteShell viewer={viewer} hideRightRail fullBleed>
      <div className="flex h-full min-h-0 bg-[color:var(--color-surface)]">
        {/* Inbox list */}
        <div className={"w-full md:w-80 shrink-0 min-h-0 md:border-r border-[color:var(--color-border-soft)] flex-col " + (selected ? "hidden md:flex" : "flex")}>
          <div className="shrink-0 px-4 pt-4 pb-2">
            <h1 className="text-[18px] font-semibold tracking-[-0.02em]">{t("tabs.messages", "Messages")}</h1>
            <div className="mt-3 flex items-center gap-1.5">
              <TabBtn active={box === "primary"} onClick={() => setBox("primary")} label={t("messages.primary", "Primary")} />
              <TabBtn active={box === "requests"} onClick={() => setBox("requests")} label={t("messages.requests", "Requests")} badge={reqCount} />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {convos.length === 0 ? (
              <p className="px-4 py-10 text-center text-[13px] text-[color:var(--color-text-muted)]">
                {box === "primary"
                  ? t("messages.noConversations", "No conversations yet.")
                  : t("messages.noRequests", "No message requests.")}
              </p>
            ) : (
              convos.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelected(c.otherId)}
                  className={"w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-[color:var(--color-surface-muted)] transition-colors " + (selected === c.otherId ? "bg-[color:var(--color-surface-muted)]" : "")}
                >
                  <Avatar name={c.otherName} url={c.otherAvatar} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[14px] font-semibold truncate">{c.otherName}</span>
                      <span className="text-[11px] text-[color:var(--color-text-subtle)] shrink-0">{timeAgo(t, c.lastMessageAt, { suffix: false })}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className={"text-[12.5px] truncate " + (c.unread > 0 ? "text-[color:var(--color-text)] font-medium" : "text-[color:var(--color-text-muted)]")}>
                        {c.lastSenderId === viewer.id ? t("messages.youPrefix", "You: ") : ""}
                        {c.lastMessageText ?? t("messages.photo", "Photo")}
                      </span>
                      {c.unread > 0 && <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)] text-[11px] font-semibold inline-flex items-center justify-center">{c.unread}</span>}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Thread */}
        <div className={"flex-1 min-w-0 min-h-0 flex-col " + (selected ? "flex" : "hidden md:flex")}>
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-center px-6">
              <div>
                <div className="text-[28px] mb-2" aria-hidden>💬</div>
                <p className="text-[15px] font-semibold">{t("messages.title", "Your messages")}</p>
                <p className="mt-1 text-[13px] text-[color:var(--color-text-muted)]">
                  {t("messages.pickOne", "Pick a conversation, or start one from someone's profile.")}
                </p>
              </div>
            </div>
          ) : loadingThread && messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-[13px] text-[color:var(--color-text-muted)]">{t("common.loading", "Loading\u2026")}</div>
          ) : (
            <>
              {/* Thread header */}
              <div className="flex shrink-0 items-center gap-3 px-4 py-3 border-b border-[color:var(--color-border-soft)]">
                <button className="md:hidden -ml-1 mr-1 h-8 w-8 inline-flex items-center justify-center rounded-full hover:bg-[color:var(--color-surface-muted)]" onClick={() => setSelected(null)} aria-label={t("common.back", "Back")}>
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M12 5l-5 5 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
                {thread?.other && (
                  <Link href={`/u/${thread.other.id}`} className="flex items-center gap-2.5 min-w-0 group">
                    <Avatar name={thread.other.name} url={thread.other.avatar} />
                    <span className="text-[14.5px] font-semibold truncate group-hover:underline">{thread.other.name}</span>
                  </Link>
                )}
              </div>

              {/* Request banner */}
              {thread?.isRequest && (
                <div className="shrink-0 px-4 py-2.5 bg-[color:var(--color-warning-soft)] border-b border-[color:var(--color-warning-soft)] flex items-center justify-between gap-3">
                  <p className="text-[12.5px] text-[color:var(--color-warning-ink)]">
                    {t("messages.requestNote", "This is a message request. Accept to reply.")}
                  </p>
                  <div className="flex items-center gap-2">
                    <button onClick={decline} className="h-8 px-3 rounded-full text-[12.5px] font-medium text-[color:var(--color-text-muted)] hover:bg-black/5">{t("common.delete", "Delete")}</button>
                    <button onClick={accept} className="h-8 px-3.5 rounded-full text-[12.5px] font-semibold bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)] hover:bg-[color:var(--color-brand-hover)]">{t("messages.accept", "Accept")}</button>
                  </div>
                </div>
              )}

              {/* Messages */}
              <div ref={scrollRef} onScroll={onScrollArea} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-2">
                {nextCursor && (
                  <div className="flex justify-center pb-2">
                    <button onClick={loadMore} className="text-[12.5px] text-[color:var(--color-brand)] hover:underline">{t("chat.loadEarlier", "Load earlier messages")}</button>
                  </div>
                )}
                {messages.map((m) => (
                  <div key={m.id} className={"flex " + (m.isOwn ? "justify-end" : "justify-start")}>
                    <div className={"group max-w-[78%] " + (m.isOwn ? "items-end" : "items-start")}>
                      <div className={"rounded-[16px] px-3.5 py-2 text-[14px] leading-relaxed " + (m.isOwn ? "bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)] rounded-br-[6px]" : "bg-[color:var(--color-surface-muted)] text-[color:var(--color-text)] rounded-bl-[6px]")}>
                        {m.deleted ? (
                          <span className={"italic " + (m.isOwn ? "text-white/70" : "text-[color:var(--color-text-subtle)]")}>
                            {t("messages.deleted", "Message deleted")}
                          </span>
                        ) : (
                          <>
                            {m.imageUrl && <div className="mb-1 -mx-1"><EntryImage src={m.imageUrl} onLoaded={() => { if (stickRef.current) scrollToBottom(); }} /></div>}
                            {m.body && <span className="whitespace-pre-wrap break-words">{m.body}</span>}
                          </>
                        )}
                      </div>
                      <div className={"mt-0.5 flex items-center gap-2 text-[10.5px] text-[color:var(--color-text-subtle)] " + (m.isOwn ? "justify-end" : "justify-start")}>
                        <span>{clockTime(m.createdAt)}</span>
                        {m.isOwn && !m.deleted && (
                          <button onClick={() => delMsg(m)} className="opacity-0 group-hover:opacity-100 hover:text-[color:var(--color-danger)] transition-opacity">{t("common.delete", "Delete")}</button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {otherTyping && (
                  <div className="flex justify-start">
                    <div className="rounded-[16px] rounded-bl-[6px] bg-[color:var(--color-surface-muted)] px-3.5 py-2.5">
                      <TypingDots />
                    </div>
                  </div>
                )}
                {seen && !otherTyping && (
                  <p className="text-right text-[11px] text-[color:var(--color-text-subtle)] pr-1">{t("messages.seen", "Seen")}</p>
                )}
              </div>

              {/* Composer */}
              {thread?.blocked ? (
                <div className="shrink-0 px-4 py-4 text-center text-[13px] text-[color:var(--color-text-muted)] border-t border-[color:var(--color-border-soft)]">
                  {t("messages.blocked", "You can't message this member.")}
                </div>
              ) : (
                <div className="shrink-0 border-t border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] px-3 py-2.5">
                  {imageUrl && <div className="mb-2"><PhotoAttach value={imageUrl} onChange={setImageUrl} /></div>}
                  {error && <p className="mb-1 text-[12px] text-[color:var(--color-danger)]">{error}</p>}
                  <div className="flex items-end gap-1">
                    {!imageUrl && <PhotoAttach value={imageUrl} onChange={setImageUrl} compact />}
                    <EmojiPicker onPick={insertEmoji} keepOpen />
                    <textarea
                      ref={composerRef}
                      value={body}
                      onChange={(e) => onBodyChange(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                      rows={1}
                      placeholder={t("messages.placeholder", "Message…")}
                      className="flex-1 min-w-0 resize-none max-h-32 rounded-[20px] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] px-4 py-2 text-[14px] text-[color:var(--color-text)] placeholder:text-[color:var(--color-text-subtle)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)]/25 focus:border-[color:var(--color-brand)] focus:bg-[color:var(--color-surface)] transition-colors"
                    />
                    {(body.trim() || imageUrl) && (
                      <button
                        onClick={send}
                        disabled={sending}
                        className="h-9 px-3.5 rounded-full text-[color:var(--color-brand)] text-[14px] font-semibold hover:bg-[color:var(--color-surface-muted)] disabled:opacity-50 shrink-0"
                      >
                        {t("messages.send", "Send")}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </SiteShell>
  );
}

function TabBtn({ active, onClick, label, badge }: { active: boolean; onClick: () => void; label: string; badge?: number }) {
  return (
    <button
      onClick={onClick}
      className={"inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] font-medium transition-colors " + (active ? "bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)]" : "text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-muted)]")}
    >
      {label}
      {badge ? <span className={"min-w-4 h-4 px-1 rounded-full text-[10px] font-semibold inline-flex items-center justify-center " + (active ? "bg-[color:var(--color-on-brand)]/25" : "bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)]")}>{badge}</span> : null}
    </button>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  const initials = name.split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  if (url) {
    return <Img src={url} alt="" className="h-10 w-10 rounded-full object-cover bg-[color:var(--color-surface-muted)] shrink-0"
   variant="thumb"
 />;
  }
  return <div className="h-10 w-10 rounded-full bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-ink)] flex items-center justify-center text-[13px] font-semibold shrink-0">{initials || "?"}</div>;
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-text-subtle)] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </span>
  );
}

function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
