"use client";

/**
 * One message in a chatroom, and the divider between days.
 *
 * Split out of `chat-room.tsx` — which was a thousand lines and
 * climbing — when the row was reworked. The rules it encodes are the
 * visible half of `groupMessages`: a run from one person collapses to
 * a single avatar, a single name and a single timestamp, and the
 * controls that used to sit under every message now appear on hover,
 * or behind one ⋯ on a touchscreen where there is no hover to use.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Img } from "@/components/ui/img";
import { LinkPreview, firstUrl } from "./link-preview";
import { useT } from "./locale-context";
import { TranslationToggle, useTranslatedContent } from "./translated-content";
import type { ContentKind } from "@/lib/content-kinds";

export const REACTIONS = ["❤️", "🙏", "🫂", "👍", "🎉", "😢"];

export interface Reaction { emoji: string; count: number; mine: boolean }
export interface ReplyPreview { id: string; authorName: string; body: string }
export interface Msg {
  id: string;
  authorId: string | null;
  authorName: string;
  authorAvatar: string | null;
  body: string;
  isAnonymous: boolean;
  isPinned: boolean;
  isOwn: boolean;
  pending: boolean;
  edited: boolean;
  createdAt: string;
  replyTo: ReplyPreview | null;
  reactions: Reaction[];
  attachments: Array<{ url: string; alt?: string | null }>;
}

/* ── message row ─────────────────────────────────────────────── */

export function MessageRow({
  m, continues, endsTurn, isMod, editing, onEditChange, onEditSave, onEditCancel, onStartEdit, onDelete, onReply, onReport, onReact, onMod, onBlock, contentKind,
}: {
  m: Msg;
  /**
   * Set to "chatMessage" by rooms. LEFT UNSET BY DIRECT MESSAGES, and
   * that is the entire mechanism keeping private correspondence away
   * from Google — this component draws both, so a translation added
   * "to chat" without this prop would have quietly included every DM
   * on the site. Absent means the message renders exactly as written.
   */
  contentKind?: ContentKind;
  /** Same person, moments ago — no avatar, no name repeated. */
  continues: boolean;
  /** Last of the turn — the one that carries the time. */
  endsTurn: boolean;
  isMod: boolean;
  editing: string | null;
  onEditChange: (t: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
  onStartEdit: () => void;
  onDelete: () => void;
  onReply: () => void;
  onReport: () => void;
  onReact: (emoji: string) => void;
  onMod: (a: "pin" | "unpin" | "remove" | "approve") => void;
  onBlock?: () => void;
}) {
  const t = useT();
  /*
    YOUR OWN MESSAGES ARE TRANSLATED TOO, by the owner's decision.

    They used to be excluded — `!m.isOwn` — on the reasoning that
    nobody needs their own sentence handed back in the language they
    picked. That is a fair argument and it is kept here rather than
    thrown away. What beat it is what a room actually looks like: in a
    quiet room, or any room where you are the one writing, every
    message on the screen is yours, so the page reads as if
    translation is broken. "Show original" is one press away for the
    case where you want to check your own words.

    The extra spend is small and bounded: a message is translated once
    per language and kept, and anything another member reads in that
    language would have been paid for anyway.

    WHAT IS STILL EXCLUDED is a message with no `contentKind` — see
    the note at the top. That is how direct messages stay out of
    Google's hands, and nothing here changes it.
  */
  const bodyT = useTranslatedContent(
    contentKind ?? "chatMessage",
    contentKind ? m.id : "",
    "body",
    m.body,
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen && !pickerOpen) return;
    const onDoc = (e: MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) { setMenuOpen(false); setPickerOpen(false); } };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen, pickerOpen]);

  const name = m.isAnonymous ? t("post.anonymous", "Anonymous member") : m.authorName;
  // Your own messages are already on your own side of the room. A name
  // and a face on every one of them is the app telling you who you are.
  const showAvatar = !m.isOwn && !continues;
  const showName = !m.isOwn && !continues;
  const tags = (m.isPinned ? 1 : 0) + (m.pending ? 1 : 0) + (m.isOwn && m.isAnonymous ? 1 : 0);

  return (
    <div className={cn("group flex items-start gap-2.5", continues ? "mt-0.5" : "mt-3", m.isOwn && "flex-row-reverse")}>
      {m.isOwn ? null : showAvatar ? (
        <Avatar name={m.isAnonymous ? "?" : m.authorName} url={m.isAnonymous ? null : m.authorAvatar} />
      ) : (
        // Holds the column so a continued message lines up under the
        // first one rather than sliding left.
        <div className="h-0 w-8 shrink-0" aria-hidden />
      )}
      <div className={cn("min-w-0 max-w-[80%] flex flex-col", m.isOwn && "items-end")}>
        {(showName || tags > 0) && (
          <div className={cn("flex items-center gap-2", m.isOwn && "flex-row-reverse")}>
            {showName && <span className="text-[12px] font-semibold tracking-[-0.01em] truncate">{name}</span>}
            {m.isOwn && m.isAnonymous && <span className="text-[9.5px] uppercase tracking-[0.06em] font-semibold text-[color:var(--color-text-subtle)]">{t("comments.anonymous", "Anonymous")}</span>}
            {m.isPinned && <span className="text-[9.5px] uppercase tracking-[0.06em] font-semibold text-[color:var(--color-warning-ink)]">{t("chat.pinned", "Pinned")}</span>}
            {m.pending && <span className="text-[9.5px] uppercase tracking-[0.06em] font-semibold text-[color:var(--color-text-subtle)]">{t("chat.pending", "Pending")}</span>}
          </div>
        )}

        {m.replyTo && (
          <div className={cn("mt-0.5 max-w-full rounded-[8px] border-l-2 border-[color:var(--color-brand)] bg-[color:var(--color-surface-muted)] px-2 py-1", m.isOwn && "text-right")}>
            <p className="text-[10.5px] font-semibold text-[color:var(--color-text-muted)] truncate">{m.replyTo.authorName}</p>
            <p className="text-[11px] text-[color:var(--color-text-subtle)] truncate">{m.replyTo.body}</p>
          </div>
        )}

        {editing !== null ? (
          <div className="mt-1 w-full">
            <textarea
              value={editing}
              onChange={(e) => onEditChange(e.target.value)}
              rows={2}
              className="w-full rounded-[10px] border border-[color:var(--color-border)] px-2.5 py-1.5 text-[13.5px] focus:outline-none focus:border-[color:var(--color-brand)] focus:ring-4 focus:ring-[color:var(--color-brand-soft)]"
            />
            <div className="mt-1 flex gap-2 justify-end">
              <button type="button" onClick={onEditCancel} className="text-[12px] text-[color:var(--color-text-muted)] hover:underline">{t("common.cancel", "Cancel")}</button>
              <button type="button" onClick={onEditSave} className="text-[12px] font-medium text-[color:var(--color-brand)] hover:underline">{t("common.save", "Save")}</button>
            </div>
          </div>
        ) : (
          <div className={cn("mt-0.5 rounded-[14px] px-3 py-2 text-[13.5px] leading-relaxed whitespace-pre-wrap break-words", m.isOwn ? "bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)]" : "bg-[color:var(--color-surface-muted)] text-[color:var(--color-text)]", m.pending && "opacity-70")}>
            {renderBody(bodyT.text)}
            {bodyT.translated && (
              <span className="mt-1 block">
                <TranslationToggle
                  state={bodyT}
                  className={cn(
                    "text-[11px] font-medium underline underline-offset-2",
                    m.isOwn
                      ? "text-[color:var(--color-on-brand)]/75 hover:text-[color:var(--color-on-brand)]"
                      : "text-[color:var(--color-text-subtle)] hover:text-[color:var(--color-text-muted)]",
                  )}
                />
              </span>
            )}
            {m.attachments.length > 0 && (
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {m.attachments.map((a, i) => (
                  <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="block">
                    <Img src={a.url} alt={a.alt ?? ""} className="rounded-[8px] max-h-40 object-cover w-full" />
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {!m.pending && firstUrl(m.body) && <LinkPreview url={firstUrl(m.body)!} />}

        {/* Reactions */}
        {m.reactions.length > 0 && (
          <div className={cn("mt-1 flex flex-wrap gap-1", m.isOwn && "justify-end")}>
            {m.reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                onClick={() => onReact(r.emoji)}
                className={cn("inline-flex items-center gap-1 rounded-full px-2 h-6 text-[12px] border transition-colors", r.mine ? "bg-[color:var(--color-brand-soft)] border-[color:var(--color-brand)] text-[color:var(--color-brand-ink)]" : "bg-[color:var(--color-surface)] border-[color:var(--color-border)] text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-hover)]")}
              >
                <span>{r.emoji}</span>
                <span className="tabular-nums">{r.count}</span>
              </button>
            ))}
          </div>
        )}

        {/*
          Actions.

          They used to sit under every message as a permanent
          "⋯ Reply 😊 26d ago" strip — three controls and a timestamp
          per message, on every message, which on a phone is more
          chrome than conversation.

          Now: on a pointer device they fade in on hover, where there
          is room for them. On touch, where there is no hover and no
          room, only the ⋯ remains, and its menu carries Reply and the
          reactions that the other two buttons used to expose.
        */}
        <div ref={wrapRef} className={cn("relative flex items-center gap-2", m.isOwn && "flex-row-reverse")}>
          <div className="relative hidden lg:block">
            <button type="button" onClick={() => { setPickerOpen((v) => !v); setMenuOpen(false); }} aria-label={t("chat.react", "React")} className="text-[color:var(--color-text-subtle)] opacity-0 transition-opacity hover:text-[color:var(--color-brand)] focus:opacity-100 group-hover:opacity-100">
              <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden><circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.4"/><path d="M7.5 12c.6.9 1.5 1.4 2.5 1.4s1.9-.5 2.5-1.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="7.5" cy="8" r="0.8" fill="currentColor"/><circle cx="12.5" cy="8" r="0.8" fill="currentColor"/></svg>
            </button>
            {pickerOpen && (
              <div className={cn("absolute bottom-full mb-1 z-20 flex items-center gap-1 rounded-full bg-[color:var(--color-surface)] border border-[color:var(--color-border)] shadow-[var(--shadow-elevated)] px-2 py-1", m.isOwn ? "right-0" : "left-0")}>
                {REACTIONS.map((e) => (
                  <button key={e} type="button" onClick={() => { onReact(e); setPickerOpen(false); }} className="text-[16px] transition-transform hover:scale-125">{e}</button>
                ))}
              </div>
            )}
          </div>
          <button type="button" onClick={onReply} className="hidden text-[10.5px] font-medium text-[color:var(--color-text-subtle)] opacity-0 transition-opacity hover:text-[color:var(--color-text)] focus:opacity-100 group-hover:opacity-100 lg:inline">{t("comments.reply", "Reply")}</button>
          <div className="relative">
            <button type="button" onClick={() => { setMenuOpen((v) => !v); setPickerOpen(false); }} aria-label={`Actions for this message from ${name}`} className="px-1 text-[color:var(--color-text-subtle)] transition-opacity hover:text-[color:var(--color-text)] focus:opacity-100 lg:opacity-0 lg:group-hover:opacity-100">⋯</button>
            {menuOpen && (
              <div className={cn("absolute bottom-full mb-1 z-10 w-44 rounded-[12px] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] shadow-[var(--shadow-elevated)] py-1", m.isOwn ? "right-0" : "left-0")}>
                {/* Touch has no hover, so the two controls that only
                    exist on hover live here instead. */}
                <div className="flex items-center justify-between gap-1 px-2 pb-1 lg:hidden">
                  {REACTIONS.map((e) => (
                    <button key={e} type="button" onClick={() => { setMenuOpen(false); onReact(e); }} aria-label={`React ${e}`} className="text-[17px] leading-none">{e}</button>
                  ))}
                </div>
                <div className="my-1 border-t border-[color:var(--color-border-soft)] lg:hidden" />
                <div className="lg:hidden">
                  <MenuItem onClick={() => { setMenuOpen(false); onReply(); }}>{t("comments.reply", "Reply")}</MenuItem>
                </div>
                {m.isOwn ? (
                  <>
                    <MenuItem onClick={() => { setMenuOpen(false); onStartEdit(); }}>{t("common.edit", "Edit")}</MenuItem>
                    <MenuItem danger onClick={() => { setMenuOpen(false); onDelete(); }}>{t("common.delete", "Delete")}</MenuItem>
                  </>
                ) : (
                  <>
                    <MenuItem danger onClick={() => { setMenuOpen(false); onReport(); }}>{t("report.send", "Report")}</MenuItem>
                    {onBlock && <MenuItem danger onClick={() => { setMenuOpen(false); onBlock(); }}>{t("chat.blockUser", "Block user")}</MenuItem>}
                  </>
                )}
                {isMod && (
                  <>
                    <div className="my-1 border-t border-[color:var(--color-border-soft)]" />
                    {m.pending && <MenuItem onClick={() => { setMenuOpen(false); onMod("approve"); }}>{t("chat.approve", "Approve")}</MenuItem>}
                    <MenuItem onClick={() => { setMenuOpen(false); onMod(m.isPinned ? "unpin" : "pin"); }}>{m.isPinned ? t("chat.unpin", "Unpin") : t("chat.pin", "Pin")}</MenuItem>
                    {!m.isOwn && <MenuItem danger onClick={() => { setMenuOpen(false); onMod("remove"); }}>{t("chat.removeMod", "Remove (mod)")}</MenuItem>}
                  </>
                )}
              </div>
            )}
          </div>

          {/* One time per turn, not one per message. */}
          {(endsTurn || m.edited) && (
            <span className="text-[10.5px] tabular-nums text-[color:var(--color-text-subtle)]">
              {clockTime(m.createdAt)}
              {m.edited && " · " + t("chat.edited", "edited")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * "Today", "Yesterday", or a date — once, between days.
 *
 * Local time on purpose, and safe: the message list is fetched after
 * mount, so none of this is in the server's HTML and there is nothing
 * for a hydration pass to disagree with.
 */
export function DayDivider({ iso }: { iso: string }) {
  const t = useT();
  const label = useMemo(() => {
    const d = new Date(iso);
    const midnight = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const days = Math.round((midnight(new Date()) - midnight(d)) / 86_400_000);
    if (days === 0) return t("events.today", "Today");
    if (days === 1) return t("chat.yesterday", "Yesterday");
    return d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      ...(d.getFullYear() === new Date().getFullYear() ? {} : { year: "numeric" }),
    });
  }, [iso, t]);

  return (
    <div className="my-4 flex items-center gap-3">
      <span className="h-px flex-1 bg-[color:var(--color-border-soft)]" />
      <span className="text-[11px] font-medium text-[color:var(--color-text-subtle)]">{label}</span>
      <span className="h-px flex-1 bg-[color:var(--color-border-soft)]" />
    </div>
  );
}

function MenuItem({ children, onClick, danger }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={cn("w-full text-left min-h-8 px-3 text-[12.5px] hover:bg-[color:var(--color-surface-hover)]", danger ? "text-[color:var(--color-danger)]" : "text-[color:var(--color-text)]")}>
      {children}
    </button>
  );
}

function renderBody(text: string) {
  const parts = text.split(/(@[\p{L}\p{N}_]+)/u);
  return parts.map((part, i) =>
    part.startsWith("@") && part.length > 1 ? (
      <span key={i} className="font-semibold">{part}</span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export function Avatar({ name, url }: { name: string; url: string | null }) {
  const initials = useMemo(() => name.split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase(), [name]);
  if (url) {
    return <Img src={url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover bg-[color:var(--color-surface-muted)]"
   variant="thumb"
 />;
  }
  return <div className="shrink-0 h-8 w-8 rounded-full bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-ink)] flex items-center justify-center text-[11px] font-semibold">{initials || "?"}</div>;
}

/**
 * The clock time a message was sent.
 *
 * This replaced a private "26d ago" helper — the fourth copy of that
 * function in the codebase. Relative time is right for a feed, where
 * one post stands alone; in a room where the day is already named by
 * a divider, "26d ago" on every message says less than "14:32" and
 * takes more room to say it.
 */
function clockTime(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
