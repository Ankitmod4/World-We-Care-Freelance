"use client";

/**
 * One theme page: a header that says what the theme is for, and its
 * clips. Follow state is optimistic and reconciled, same as the index.
 */

import { useState } from "react";
import Link from "next/link";
import { SiteShell, type ShellViewer } from "./site-shell";
import { ClipGrid } from "./clip-grid";
import { FollowButton } from "./library-client";
import { Markdown } from "@/lib/rich-text";
import { Img } from "@/components/ui/img";
import { useT } from "./locale-context";
import { TranslatedContent } from "./translated-content";
import { TranslatedMarkdown } from "./translated-markdown";

export interface ThemeDetail {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  about: string | null;
  coverUrl: string | null;
  emoji: string | null;
  followerCount: number;
  clipCount: number;
  following: boolean;
}

export function LibraryDetailClient({
  viewer,
  theme: initial,
}: {
  viewer: ShellViewer;
  theme: ThemeDetail;
}) {
  const t = useT();
  const [theme, setTheme] = useState(initial);

  const toggleFollow = async () => {
    const before = { following: theme.following, followerCount: theme.followerCount };
    setTheme((t) => ({
      ...t,
      following: !t.following,
      followerCount: t.followerCount + (t.following ? -1 : 1),
    }));
    const res = await fetch(`/api/user/library/${theme.id}/follow`, { method: "POST" }).catch(
      () => null,
    );
    if (!res?.ok) {
      setTheme((t) => ({ ...t, ...before }));
      return;
    }
    const d = (await res.json().catch(() => ({}))) as {
      following?: boolean;
      followerCount?: number;
    };
    setTheme((t) => ({
      ...t,
      ...(typeof d.following === "boolean" ? { following: d.following } : {}),
      ...(typeof d.followerCount === "number" ? { followerCount: d.followerCount } : {}),
    }));
  };

  return (
    <SiteShell viewer={viewer}>
      <nav className="mb-3">
        <Link
          href="/library"
          className="inline-flex items-center gap-1 text-[13px] font-medium text-[color:var(--color-text-muted)] hover:text-[color:var(--color-brand)]"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {t("library.allThemes", "All themes")}
        </Link>
      </nav>

      <header className="mb-5 overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] shadow-card">
        {theme.coverUrl && (
          <div className="aspect-[21/6] w-full overflow-hidden bg-[color:var(--color-surface-muted)]">
            <Img src={theme.coverUrl} alt="" className="h-full w-full object-cover" />
          </div>
        )}
        <div className="flex flex-wrap items-start justify-between gap-3 p-4 sm:p-5">
          <div className="min-w-0">
            <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.02em]">
              {theme.emoji ? `${theme.emoji} ` : ""}
              <TranslatedContent kind="libraryTheme" id={theme.slug} field="name" text={theme.name} toggle={false} />
            </h1>
            {theme.tagline && (
              <p className="mt-1 max-w-[60ch] text-[14.5px] text-[color:var(--color-text-muted)]">
                <TranslatedContent kind="libraryTheme" id={theme.slug} field="tagline" text={theme.tagline} toggle={false} />
              </p>
            )}
            <p className="mt-2 text-[12px] tabular-nums text-[color:var(--color-text-subtle)]">
              {theme.clipCount === 1
                ? t("library.oneClip", "1 clip")
                : t("library.nClips", "{n} clips", { n: theme.clipCount })}
              {" \u00b7 "}
              {theme.followerCount === 1
                ? t("library.oneFollower", "1 follower")
                : t("library.nFollowers", "{n} followers", { n: theme.followerCount })}
            </p>
          </div>
          <FollowButton following={theme.following} onClick={() => void toggleFollow()} size="md" />
        </div>

        {theme.about && (
          <div className="border-t border-[color:var(--color-border-soft)] px-4 py-3.5 text-[14px] sm:px-5">
            <div className="max-w-[70ch]">
              <TranslatedMarkdown kind="libraryTheme" id={theme.slug} field="about" text={theme.about} />
            </div>
          </div>
        )}
      </header>

      <ClipGrid
        query={`scope=clips&themeId=${encodeURIComponent(theme.id)}&perPage=36`}
        empty={
          <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-10 text-center shadow-card">
            <p className="text-[15px] font-medium">{t("library.noClips", "No clips here yet")}</p>
            <p className="mt-1 text-[13.5px] text-[color:var(--color-text-muted)]">
              {t(
                "library.followTheme",
                "Follow the theme and you\u2019ll see them as soon as they land.",
              )}
            </p>
          </div>
        }
      />
    </SiteShell>
  );
}
