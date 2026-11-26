"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SiteShell, type ShellViewer } from "./site-shell";
import { useCountry } from "./country-context";
import { TierBadge, type Tier } from "./chat-tier";
import { PageHeading } from "./page-heading";
import { useT } from "./locale-context";
import { TranslatedContent } from "./translated-content";

interface Room {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  tier: Tier;
  emoji: string | null;
  color: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categorySort: number;
  memberCount: number;
  messageCount: number;
  membership: string | null;
  isMember: boolean;
  unread: number;
}

export function ChatBrowse({
  viewer,
}: {
  viewer: ShellViewer;
}) {
  const t = useT();
  const { countryId } = useCountry();
  const [rooms, setRooms] = useState<Room[] | null>(null);

  useEffect(() => {
    let alive = true;
    setRooms(null);
    const qs = countryId ? `?countryId=${encodeURIComponent(countryId)}` : "";
    fetch(`/api/user/chatrooms${qs}`)
      .then((r) => r.json())
      .then((d) => {
        if (alive) setRooms(d.rooms ?? []);
      })
      .catch(() => {
        if (alive) setRooms([]);
      });
    return () => {
      alive = false;
    };
  }, [countryId]);

  const groups = useMemo(() => {
    if (!rooms) return [];
    const map = new Map<string, { name: string; sort: number; rooms: Room[] }>();
    for (const r of rooms) {
      const key = r.categoryId ?? "_none";
      const name = r.categoryName ?? t("report.other", "Other");
      if (!map.has(key)) map.set(key, { name, sort: r.categorySort, rooms: [] });
      map.get(key)!.rooms.push(r);
    }
    return [...map.values()].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
  }, [rooms]);

  return (
    <SiteShell viewer={viewer}>
      <PageHeading
          title={t("page.chatroomsTitle", "Chatrooms")}
          intro={t("page.chatroomsIntro", "Find people who understand. Read first, post when you're ready — anonymously if that's safer.")}
        />

      {rooms === null ? (
        <BrowseSkeleton />
      ) : rooms.length === 0 ? (
        <div className="rounded-[16px] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] p-8 text-center">
          <p className="text-[15px] font-semibold tracking-[-0.01em]">{t("chat.noRooms", "No rooms yet")}</p>
          <p className="mt-1 text-[13px] text-[color:var(--color-text-muted)]">
            {t("chat.noRoomsBlurb", "Chatrooms will appear here as they open. Check back soon.")}
          </p>
        </div>
      ) : (
        <div className="space-y-7">
          {groups.map((g) => (
            <section key={g.name}>
              <h2 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-text-subtle)] mb-2.5 px-1">
                {g.name}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {g.rooms.map((r) => (
                  <RoomCard key={r.id} room={r} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </SiteShell>
  );
}

function RoomCard({ room }: { room: Room }) {
  const t = useT();
  return (
    <Link
      href={`/chatrooms/${room.slug}`}
      className="group flex items-start gap-3 rounded-[16px] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] p-4 hover:border-[color:var(--color-border-strong)] hover:shadow-[var(--shadow-card)] transition-all"
    >
      <div
        className="shrink-0 h-11 w-11 rounded-[12px] flex items-center justify-center text-[20px]"
        style={{ background: room.color ? `${room.color}1a` : "var(--color-brand-soft)" }}
      >
        {room.emoji ?? "💬"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[14.5px] font-semibold tracking-[-0.01em] truncate">
            <TranslatedContent kind="room" id={room.id} field="name" text={room.name} toggle={false} />
          </p>
          <TierBadge tier={room.tier} />
          {room.isMember && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-ink)] font-medium">
              {t("chat.joined", "Joined")}
            </span>
          )}
          {room.unread > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)] font-semibold tabular-nums">
              {room.unread > 99 ? "99+" : room.unread} new
            </span>
          )}
        </div>
        {room.description && (
          <p className="mt-1 text-[12.5px] text-[color:var(--color-text-muted)] leading-snug line-clamp-2">
            <TranslatedContent kind="room" id={room.id} field="description" text={room.description} toggle={false} />
          </p>
        )}
        <p className="mt-1.5 text-[11.5px] text-[color:var(--color-text-subtle)] tabular-nums">
          {room.memberCount.toLocaleString()} {room.memberCount === 1 ? t("chat.member", "member") : t("chat.members", "members")} ·{" "}
          {room.messageCount.toLocaleString()} {room.messageCount === 1 ? t("chat.message", "message") : t("chat.messages", "messages")}
        </p>
      </div>
    </Link>
  );
}

function BrowseSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-[16px] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] p-4 animate-pulse">
          <div className="flex gap-3">
            <div className="h-11 w-11 rounded-[12px] bg-[color:var(--color-surface-muted)]" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-32 rounded bg-[color:var(--color-surface-muted)]" />
              <div className="h-2.5 w-full rounded bg-[color:var(--color-surface-muted)]" />
              <div className="h-2.5 w-24 rounded bg-[color:var(--color-surface-muted)]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
