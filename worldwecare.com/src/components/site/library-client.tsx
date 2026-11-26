"use client";

/**
 * /library — the themes index.
 *
 * Two tabs: every theme, and a single feed of clips from the themes
 * this member follows. Following is the whole point of the feature, so
 * the follow control lives on the card rather than only on the theme
 * page.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SiteShell, type ShellViewer } from "./site-shell";
import { ClipGrid } from "./clip-grid";
import { Img } from "@/components/ui/img";
import { PageHeading } from "./page-heading";
import { useT } from "./locale-context";
import { TranslatedContent } from "./translated-content";

interface ThemeCard {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  coverUrl: string | null;
  emoji: string | null;
  followerCount: number;
  clipCount: number;
  following: boolean;
}

export function LibraryClient({
  viewer,
}: {
  viewer: ShellViewer;
}) {
  const t = useT();
  const [tab, setTab] = useState<"themes" | "following">("themes");
  const [themes, setThemes] = useState<ThemeCard[] | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/user/library", { cache: "no-store" });
    const d = (await res.json().catch(() => ({ themes: [] }))) as { themes: ThemeCard[] };
    setThemes(d.themes ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleFollow = useCallback(async (id: string) => {
    setThemes((prev) =>
      prev?.map((t) =>
        t.id === id
          ? { ...t, following: !t.following, followerCount: t.followerCount + (t.following ? -1 : 1) }
          : t,
      ) ?? prev,
    );
    const res = await fetch(`/api/user/library/${id}/follow`, { method: "POST" }).catch(() => null);
    if (!res?.ok) {
      // Put it back — a follow button that lies is worse than one that
      // fails visibly.
      setThemes((prev) =>
        prev?.map((t) =>
          t.id === id
            ? { ...t, following: !t.following, followerCount: t.followerCount + (t.following ? -1 : 1) }
            : t,
        ) ?? prev,
      );
      return;
    }
    const d = (await res.json().catch(() => ({}))) as { following?: boolean; followerCount?: number };
    setThemes((prev) =>
      prev?.map((t) =>
        t.id === id
          ? {
              ...t,
              ...(typeof d.following === "boolean" ? { following: d.following } : {}),
              ...(typeof d.followerCount === "number" ? { followerCount: d.followerCount } : {}),
            }
          : t,
      ) ?? prev,
    );
  }, []);

  const tabClass = (active: boolean) =>
    `inline-flex min-h-11 items-center rounded-full border px-4 text-[13.5px] font-medium transition-colors duration-200 active:scale-[0.98] sm:min-h-9 ${
      active
        ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)]"
        : "border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-brand)] hover:text-[color:var(--color-text)]"
    }`;

  const followingCount = themes?.filter((th) => th.following).length ?? 0;

  return (
    <SiteShell viewer={viewer}>
      <header className="mb-4">
        <PageHeading
          title={t("page.libraryTitle", "Library")}
          intro={t("page.libraryIntro", "Short, uplifting clips grouped by what they're about. Follow the ones you want more of.")}
        />
      </header>

      <div className="mb-4 flex gap-2">
        <button type="button" className={tabClass(tab === "themes")} onClick={() => setTab("themes")}>
          {t("library.themes", "Themes")}
        </button>
        <button
          type="button"
          className={tabClass(tab === "following")}
          onClick={() => setTab("following")}
        >
          {t("library.following", "Following")}
          {followingCount > 0 ? ` · ${followingCount}` : ""}
        </button>
      </div>

      {tab === "themes" ? (
        themes === null ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-48 animate-pulse rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)]"
              />
            ))}
          </div>
        ) : themes.length === 0 ? (
          <EmptyBox
            title={t("library.noThemes", "No themes yet")}
            body={t("library.noThemesBlurb", "Once an admin sets one up, it'll show here.")}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {themes.map((theme) => (
              <article
                key={theme.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] shadow-card transition-shadow duration-200 hover:shadow-elevated"
              >
                <Link href={`/library/${theme.slug}`} className="block">
                  <div className="relative aspect-[16/9] w-full overflow-hidden bg-[color:var(--color-surface-muted)]">
                    {theme.coverUrl ? (
                      <Img
                        src={theme.coverUrl}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[color:var(--color-brand-soft)] to-[color:var(--color-surface-muted)] text-[34px]">
                        {theme.emoji ?? "✨"}
                      </span>
                    )}
                  </div>
                </Link>

                <div className="flex flex-1 flex-col p-3.5">
                  <Link
                    href={`/library/${theme.slug}`}
                    className="text-[15.5px] font-semibold tracking-[-0.01em] hover:text-[color:var(--color-brand)]"
                  >
                    {theme.emoji ? `${theme.emoji} ` : ""}
                    <TranslatedContent kind="libraryTheme" id={theme.slug} field="name" text={theme.name} toggle={false} />
                  </Link>
                  {theme.tagline && (
                    <p className="mt-0.5 line-clamp-2 text-[13px] text-[color:var(--color-text-muted)]">
                      <TranslatedContent kind="libraryTheme" id={theme.slug} field="tagline" text={theme.tagline} toggle={false} />
                    </p>
                  )}

                  <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                    <span className="text-[11.5px] tabular-nums text-[color:var(--color-text-subtle)]">
                      {theme.clipCount === 1
                        ? t("library.oneClip", "1 clip")
                        : t("library.nClips", "{n} clips", { n: theme.clipCount })}
                      {" \u00b7 "}
                      {theme.followerCount === 1
                        ? t("library.oneFollower", "1 follower")
                        : t("library.nFollowers", "{n} followers", { n: theme.followerCount })}
                    </span>
                    <FollowButton
                      following={theme.following}
                      onClick={() => void toggleFollow(theme.id)}
                    />
                  </div>
                </div>
              </article>
            ))}
          </div>
        )
      ) : (
        <ClipGrid
          query="scope=following&perPage=36"
          showTheme
          empty={
            <EmptyBox
              title={t("common.nothingHere", "Nothing here yet")}
              body={t("library.noFollowing", "Follow a theme and its clips will collect here.")}
              action={
                <button
                  type="button"
                  onClick={() => setTab("themes")}
                  className="mt-3 inline-flex min-h-9 items-center rounded-full bg-[color:var(--color-brand)] px-4 text-[13.5px] font-medium text-[color:var(--color-on-brand)]"
                >
                  {t("library.browseThemes", "Browse themes")}
                </button>
              }
            />
          }
        />
      )}
    </SiteShell>
  );
}

export function FollowButton({
  following,
  onClick,
  size = "sm",
}: {
  following: boolean;
  onClick: () => void;
  size?: "sm" | "md";
}) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={following}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border font-medium transition-colors duration-200 active:scale-[0.98] ${
        size === "sm" ? "min-h-8 px-3 text-[12.5px]" : "min-h-10 px-4 text-[14px]"
      } ${
        following
          ? "border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-danger)] hover:text-[color:var(--color-danger)]"
          : "border-[color:var(--color-brand)] bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)]"
      }`}
    >
      {following ? t("common.following", "Following") : t("common.follow", "Follow")}
    </button>
  );
}

function EmptyBox({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-10 text-center shadow-card">
      <p className="text-[15px] font-medium">{title}</p>
      <p className="mt-1 text-[13.5px] text-[color:var(--color-text-muted)]">{body}</p>
      {action}
    </div>
  );
}
