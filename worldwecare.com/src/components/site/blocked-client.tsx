"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SiteShell, type ShellViewer } from "./site-shell";
import { Button } from "@/components/ui/button";
import { Img } from "@/components/ui/img";
import { useT } from "./locale-context";

interface Blocked { userId: string; displayName: string; avatarUrl: string | null; createdAt: string }

export function BlockedClient({ viewer }: { viewer: ShellViewer }) {
  const t = useT();
  const [list, setList] = useState<Blocked[] | null>(null);

  const load = useCallback(() => {
    fetch("/api/user/blocks")
      .then((r) => r.json())
      .then((d) => setList(d.blocked ?? []))
      .catch(() => setList([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const unblock = async (userId: string) => {
    await fetch("/api/user/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, block: false }),
    });
    load();
  };

  return (
    <SiteShell viewer={viewer}>
      <header className="mb-4">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{t("settings.blocked", "Blocked accounts")}</h1>
        <p className="text-[13px] text-[color:var(--color-text-muted)] mt-0.5">
          {t("blocked.blurb", "People you've blocked won't appear in your feed or chatrooms.")}
        </p>
      </header>

      {list === null ? (
        <p className="text-[13px] text-[color:var(--color-text-subtle)]">{t("common.loading", "Loading\u2026")}</p>
      ) : list.length === 0 ? (
        <div className="rounded-[16px] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] p-8 text-center">
          <p className="text-[15px] font-semibold tracking-[-0.01em]">{t("blocked.none", "No blocked accounts")}</p>
          <p className="mt-1 text-[13px] text-[color:var(--color-text-muted)]">
            You can block someone from the ⋯ menu on their post or message.
          </p>
        </div>
      ) : (
        <div className="rounded-[16px] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] divide-y divide-[color:var(--color-border-soft)]">
          {list.map((b) => (
            <div key={b.userId} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={b.displayName} url={b.avatarUrl} />
              <span className="text-[14px] font-medium truncate flex-1">{b.displayName}</span>
              <Button variant="secondary" size="sm" onClick={() => unblock(b.userId)}>
                {t("settings.unblock", "Unblock")}
              </Button>
            </div>
          ))}
        </div>
      )}
    </SiteShell>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  const initials = useMemo(
    () => name.split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase(),
    [name],
  );
  if (url) {
    return <Img src={url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover bg-[color:var(--color-surface-muted)]"
   variant="thumb"
 />;
  }
  return <div className="shrink-0 h-9 w-9 rounded-full bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-ink)] flex items-center justify-center text-[12px] font-semibold">{initials || "?"}</div>;
}
