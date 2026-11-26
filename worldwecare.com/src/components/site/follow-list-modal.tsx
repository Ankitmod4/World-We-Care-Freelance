"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Img } from "@/components/ui/img";
import { useT } from "./locale-context";
import { TranslatedContent } from "./translated-content";

interface Row {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  isFollowing: boolean;
  isSelf: boolean;
}

export function FollowListModal({
  userId,
  kind,
  onClose,
}: {
  userId: string;
  kind: "followers" | "following";
  onClose: () => void;
}) {
  const t = useT();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/user/u/${userId}/${kind}`)
      .then((r) => r.json())
      .then((d) => { if (alive) setRows((d.users as Row[]) ?? []); })
      .catch(() => { if (alive) setRows([]); });
    return () => { alive = false; };
  }, [userId, kind]);

  const title = kind === "followers" ? "Followers" : "Following";

  async function toggle(row: Row) {
    if (busy) return;
    const next = !row.isFollowing;
    setBusy(row.id);
    setRows((prev) => prev?.map((r) => (r.id === row.id ? { ...r, isFollowing: next } : r)) ?? prev);
    try {
      const res = await fetch("/api/user/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: row.id, follow: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setRows((prev) => prev?.map((r) => (r.id === row.id ? { ...r, isFollowing: !next } : r)) ?? prev);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md max-h-[80vh] flex flex-col bg-[color:var(--color-surface)] rounded-t-2xl sm:rounded-2xl border border-[color:var(--color-border)] shadow-[var(--shadow-elevated)]">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[color:var(--color-border-soft)]">
          <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
          <button
            onClick={onClose}
            aria-label={t("common.close", "Close")}
            className="h-8 w-8 -mr-1.5 inline-flex items-center justify-center rounded-full text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-muted)] transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden><path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div className="overflow-y-auto px-2 py-2">
          {rows === null ? (
            <div className="py-10 text-center text-[13px] text-[color:var(--color-text-muted)]">{t("common.loading", "Loading\u2026")}</div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-[14px] font-medium text-[color:var(--color-text)]">
                {kind === "followers"
              ? t("follow.noFollowersYet", "No followers yet")
              : t("follow.notFollowingAnyone", "Not following anyone yet")}
              </p>
              <p className="mt-1 text-[12.5px] text-[color:var(--color-text-muted)]">
                {kind === "followers"
                  ? t("follow.noFollowers", "When people follow, they'll show up here.")
                  : t("follow.noFollowing", "Accounts they follow will show up here.")}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[color:var(--color-border-soft)]">
              {rows.map((row) => (
                <li key={row.id} className="flex items-center gap-3 px-3 py-2.5">
                  <Link href={`/u/${row.id}`} onClick={onClose} className="shrink-0">
                    <RowAvatar name={row.displayName} url={row.avatarUrl} />
                  </Link>
                  <Link href={`/u/${row.id}`} onClick={onClose} className="min-w-0 flex-1 group">
                    <p className="text-[14px] font-semibold text-[color:var(--color-text)] truncate group-hover:underline">
                      <TranslatedContent
                        kind="member"
                        id={row.id}
                        field="displayName"
                        text={row.displayName}
                        toggle={false}
                      />
                    </p>
                    {row.bio && (
                      <p className="truncate text-[12.5px] text-[color:var(--color-text-muted)]">
                        <TranslatedContent
                          kind="member"
                          id={row.id}
                          field="bio"
                          text={row.bio}
                          toggle={false}
                        />
                      </p>
                    )}
                  </Link>
                  {!row.isSelf && (
                    <button
                      onClick={() => toggle(row)}
                      disabled={busy === row.id}
                      className={
                        row.isFollowing
                          ? "shrink-0 h-8 px-3.5 rounded-full text-[12.5px] font-semibold border border-[color:var(--color-border)] text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-muted)] transition-colors disabled:opacity-60"
                          : "shrink-0 h-8 px-3.5 rounded-full text-[12.5px] font-semibold bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)] shadow-[var(--shadow-brand)] hover:bg-[color:var(--color-brand-hover)] transition-colors disabled:opacity-60"
                      }
                    >
                      {row.isFollowing ? "Following" : "Follow"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function RowAvatar({ name, url }: { name: string; url: string | null }) {
  const initials = useMemo(
    () => name.split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase(),
    [name],
  );
  if (url) {
    return <Img src={url} alt="" className="h-10 w-10 rounded-full object-cover bg-[color:var(--color-surface-muted)]"
   variant="thumb"
 />;
  }
  return (
    <div className="h-10 w-10 rounded-full bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-ink)] flex items-center justify-center text-[13px] font-semibold">
      {initials || "?"}
    </div>
  );
}
