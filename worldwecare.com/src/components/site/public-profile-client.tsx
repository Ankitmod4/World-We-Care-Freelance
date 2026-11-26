"use client";

import Link from "next/link";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SiteShell, type ShellViewer } from "./site-shell";
import { PostFeedList } from "./post-feed-list";
import { ProgressSummary, type ProfileBadge } from "./progress-summary";
import type { StreakView } from "@/lib/streaks";
import { Button } from "@/components/ui/button";
import { FollowListModal } from "./follow-list-modal";
import { Img } from "@/components/ui/img";
import { useT, useLocale } from "./locale-context";
import { monthYear } from "@/lib/month-year";
import { TranslatedContent } from "./translated-content";

interface PublicProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  location: string | null;
  createdAt: string;
  postCount: number;
  roomCount: number;
  followerCount: number;
  followingCount: number;
}

export function PublicProfileClient({
  viewer,
  profile,
  initialFollowing,
  initialBlocked,
  streaks,
  badges,
}: {
  viewer: ShellViewer;
  profile: PublicProfile;
  initialFollowing: boolean;
  initialBlocked: boolean;
  /** Already filtered to what this member chose to show. */
  streaks: StreakView[];
  badges: ProfileBadge[];
}) {
  const t = useT();
  const { locale } = useLocale();
  const cardViewer = { id: viewer.id, displayName: viewer.displayName, avatarUrl: viewer.avatarUrl };
  const router = useRouter();

  const [following, setFollowing] = useState(initialFollowing);
  const [blocked, setBlocked] = useState(initialBlocked);
  const [followers, setFollowers] = useState(profile.followerCount);
  const [busy, setBusy] = useState<"follow" | "block" | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hoverFollowing, setHoverFollowing] = useState(false);
  const [followModal, setFollowModal] = useState<"followers" | "following" | null>(null);

  async function toggleFollow() {
    if (busy) return;
    const next = !following;
    setBusy("follow");
    // Optimistic
    setFollowing(next);
    setFollowers((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      const res = await fetch("/api/user/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: profile.id, follow: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      // Revert on failure
      setFollowing(!next);
      setFollowers((c) => Math.max(0, c + (next ? -1 : 1)));
    } finally {
      setBusy(null);
    }
  }

  async function toggleBlock() {
    if (busy) return;
    const next = !blocked;
    setMenuOpen(false);
    setBusy("block");
    try {
      const res = await fetch("/api/user/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: profile.id, block: next }),
      });
      if (!res.ok) throw new Error();
      setBlocked(next);
      if (next && following) {
        // Blocking severs the follow on the server; mirror it here.
        setFollowing(false);
        setFollowers((c) => Math.max(0, c - 1));
      }
      router.refresh();
    } catch {
      /* no-op; state unchanged */
    } finally {
      setBusy(null);
    }
  }

  return (
    <SiteShell viewer={viewer}>
      <div className="rounded-[20px] overflow-hidden bg-[color:var(--color-surface)] border border-[color:var(--color-border)] shadow-[var(--shadow-card)]">
        <div className="h-36 sm:h-52 w-full relative hero-sky">
          {profile.coverUrl && (
            <Img src={profile.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )}
        </div>
        <div className="relative z-10 px-5 sm:px-7 pb-6">
          {/* Actions — sit just below the cover, clear of it */}
          <div className="absolute right-5 sm:right-7 top-4 z-20 flex items-center gap-2">
              {!blocked && (
                <Link
                  href={`/messages/${profile.id}`}
                  className="h-8 px-3.5 inline-flex items-center gap-1.5 rounded-[10px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[13px] font-medium text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-hover)] transition-colors"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M4 6.5A1.5 1.5 0 015.5 5h13A1.5 1.5 0 0120 6.5v9a1.5 1.5 0 01-1.5 1.5H9l-4 3.2V17H5.5A1.5 1.5 0 014 15.5v-9z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></svg>
                  {t("profile.message", "Message")}
                </Link>
              )}
              {!blocked && (
                <Button
                  size="sm"
                  variant={following ? "secondary" : "primary"}
                  loading={busy === "follow"}
                  onClick={toggleFollow}
                  onMouseEnter={() => setHoverFollowing(true)}
                  onMouseLeave={() => setHoverFollowing(false)}
                  className={following ? "min-w-[104px]" : "min-w-[92px]"}
                >
                  {following
                    ? hoverFollowing
                      ? t("profile.unfollow", "Unfollow")
                      : t("common.following", "Following")
                    : t("common.follow", "Follow")}
                </Button>
              )}
              {blocked && (
                <Button size="sm" variant="secondary" loading={busy === "block"} onClick={toggleBlock} className="min-w-[92px]">
                  {t("settings.unblock", "Unblock")}
                </Button>
              )}

              {/* Overflow menu */}
              <div className="relative">
                <button
                  type="button"
                  aria-label={t("profile.moreOptions", "More options")}
                  onClick={() => setMenuOpen((o) => !o)}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-muted)] transition-colors"
                >
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" aria-hidden><circle cx="4" cy="10" r="1.6" /><circle cx="10" cy="10" r="1.6" /><circle cx="16" cy="10" r="1.6" /></svg>
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-1.5 z-40 w-44 rounded-[14px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-[var(--shadow-elevated)] p-1.5">
                      <button
                        type="button"
                        onClick={toggleBlock}
                        className="w-full text-left px-3 py-2 rounded-[10px] text-[13.5px] font-medium text-[color:var(--color-danger)] hover:bg-[color:var(--color-danger-soft)] transition-colors"
                      >
                        {blocked ? t("profile.unblockMember", "Unblock member") : t("profile.blockMember", "Block member")}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

          <div className="-mt-12 sm:-mt-14">
            <Avatar name={profile.displayName} url={profile.avatarUrl} />
          </div>

          <div className="mt-4">
            <h1 className="text-[22px] font-semibold tracking-[-0.02em]">
              <TranslatedContent
                kind="member"
                id={profile.id}
                field="displayName"
                text={profile.displayName}
                toggle={false}
              />
            </h1>
            <div className="mt-1 flex items-center gap-x-3 gap-y-1 flex-wrap text-[12.5px] text-[color:var(--color-text-subtle)]">
              {profile.location && (
                <span className="inline-flex items-center gap-1">
                  <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden><path d="M10 18s6-5.3 6-10a6 6 0 10-12 0c0 4.7 6 10 6 10z" stroke="currentColor" strokeWidth="1.5"/><circle cx="10" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/></svg>
                  <TranslatedContent
                    kind="member"
                    id={profile.id}
                    field="location"
                    text={profile.location}
                    toggle={false}
                  />
                </span>
              )}
              <span>
                {t("profile.memberSince", "Member since {when}", {
                  when: monthYear(profile.createdAt, locale),
                })}
              </span>
            </div>

            {/* Follow counts */}
            <div className="mt-2.5 flex items-center gap-4 text-[13px]">
              <button type="button" onClick={() => setFollowModal("followers")} className="inline-flex items-baseline gap-1 rounded hover:underline underline-offset-2">
                <b className="text-[color:var(--color-text)] tabular-nums">{followers.toLocaleString()}</b>
                <span className="text-[color:var(--color-text-muted)]">
                  {followers === 1 ? t("profile.follower", "Follower") : t("rail.followers", "Followers")}
                </span>
              </button>
              <button type="button" onClick={() => setFollowModal("following")} className="inline-flex items-baseline gap-1 rounded hover:underline underline-offset-2">
                <b className="text-[color:var(--color-text)] tabular-nums">{profile.followingCount.toLocaleString()}</b>
                <span className="text-[color:var(--color-text-muted)]">{t("common.following", "Following")}</span>
              </button>
              <span className="inline-flex items-baseline gap-1 text-[color:var(--color-text-muted)]">
                <b className="text-[color:var(--color-text)] tabular-nums">{profile.postCount.toLocaleString()}</b>
                {profile.postCount === 1 ? t("profile.post", "Post") : t("rail.posts", "Posts")}
              </span>
            </div>

            {profile.bio && (
              <p className="mt-3 text-[14px] leading-relaxed whitespace-pre-wrap max-w-[65ch]">
                <TranslatedContent
                  kind="member"
                  id={profile.id}
                  field="bio"
                  text={profile.bio}
                  toggle={false}
                />
              </p>
            )}
          </div>
        </div>
      </div>

      {blocked && (
        <div className="mt-4 rounded-[16px] border border-[color:var(--color-border)] bg-[color:var(--color-surface-muted)] px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-[13px] text-[color:var(--color-text-muted)]">
            {t(
              "profile.blockedNote",
              "You’ve blocked this member. Their posts and messages are hidden from you across WorldWeCare.",
            )}
          </p>
          <Button size="sm" variant="secondary" loading={busy === "block"} onClick={toggleBlock}>
            {t("settings.unblock", "Unblock")}
          </Button>
        </div>
      )}

      {!blocked && (
        <>
          <ProgressSummary
            streaks={streaks}
            badges={badges}
            readOnly
            who={`${profile.displayName}'s`}
          />

          <h2 className="mt-5 mb-3 px-1 text-[13px] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-text-subtle)]">
            {t("rail.posts", "Posts")}
          </h2>
          <PostFeedList
            viewer={cardViewer}
            endpoint={`/api/user/u/${profile.id}/posts`}
            emptyTitle={t("profile.noPublicPosts", "No public posts")}
            emptySubtitle={t("profile.noPublicPostsBlurb", "This member hasn't shared any public posts yet.")}
          />
        </>
      )}
      {followModal && (
        <FollowListModal userId={profile.id} kind={followModal} onClose={() => setFollowModal(null)} />
      )}
    </SiteShell>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  const initials = useMemo(() => name.split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase(), [name]);
  if (url) {
    return <Img src={url} alt="" className="h-24 w-24 rounded-full object-cover ring-4 ring-[color:var(--color-surface)] shadow-[0_6px_20px_var(--shadow-tint)] bg-[color:var(--color-surface-muted)]"
   variant="thumb"
 />;
  }
  return <div className="h-24 w-24 rounded-full ring-4 ring-[color:var(--color-surface)] shadow-[0_6px_20px_var(--shadow-tint)] bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-ink)] flex items-center justify-center text-[26px] font-semibold">{initials || "?"}</div>;
}

