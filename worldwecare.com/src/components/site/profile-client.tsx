"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FollowListModal } from "./follow-list-modal";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteShell, type ShellViewer } from "./site-shell";
import { PostFeedList } from "./post-feed-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Img } from "@/components/ui/img";
import { ProgressSummary, type ProfileBadge } from "./progress-summary";
import type { StreakView } from "@/lib/streaks";
import { useT, useLocale } from "./locale-context";
import { monthYear } from "@/lib/month-year";
import { serverText } from "@/lib/i18n-core";
import { TranslatedContent } from "./translated-content";

interface Profile {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string | null;
  location: string | null;
  emailVerifiedAt: string | null;
  createdAt: string;
}
interface Stats { posts: number; replies: number; rooms: number; saved: number; followers: number; following: number; memberSince: string }

export function ProfileClient({ viewer }: { viewer: ShellViewer }) {
  const t = useT();
  const { locale } = useLocale();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [tab, setTab] = useState<"posts" | "saved" | "rooms">("posts");
  const [editing, setEditing] = useState(false);
  const [followModal, setFollowModal] = useState<"followers" | "following" | null>(null);
  const [progress, setProgress] = useState<{
    streaks: StreakView[];
    badges: ProfileBadge[];
    journalDays: number;
  } | null>(null);

  const loadProfile = useCallback(async () => {
    const res = await fetch("/api/user/profile");
    const d = (await res.json().catch(() => null)) as { profile: Profile } | null;
    if (d?.profile) setProfile(d.profile);
  }, []);
  useEffect(() => { void loadProfile(); }, [loadProfile]);
  useEffect(() => {
    fetch("/api/user/profile/stats").then((r) => r.json()).then((d) => setStats(d.stats ?? null)).catch(() => {});
  }, []);
  // Separate from the stats call because /api/user/progress also
  // awards any newly-earned badge — a profile visit is the natural
  // moment to notice one, and a failure here must not take the
  // stats strip down with it.
  useEffect(() => {
    fetch("/api/user/progress", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) =>
        setProgress(
          d ? { streaks: d.streaks ?? [], badges: d.badges ?? [], journalDays: d.journalDays ?? 0 } : null,
        ),
      )
      .catch(() => {});
  }, []);

  const cardViewer = { id: viewer.id, displayName: viewer.displayName, avatarUrl: viewer.avatarUrl };

  return (
    <SiteShell viewer={viewer}>
      {/* Cover + identity */}
      <div className="rounded-[20px] overflow-hidden bg-[color:var(--color-surface)] border border-[color:var(--color-border)] shadow-[var(--shadow-card)]">
        <div className="h-36 sm:h-52 w-full relative hero-sky">
          {profile?.coverUrl && (
            <Img src={profile.coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )}
        </div>
        <div className="relative z-10 px-5 sm:px-7 pb-6">
          <div className="flex items-end justify-between gap-3 -mt-12 sm:-mt-14">
            <ProfileAvatar name={profile?.displayName ?? viewer.displayName} url={profile?.avatarUrl ?? viewer.avatarUrl} />
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)} className="mb-1">
              {t("profile.edit", "Edit profile")}
            </Button>
          </div>
          <div className="mt-4">
            <h1 className="text-[24px] font-semibold tracking-[-0.02em]">
              <TranslatedContent
                kind="member"
                id={viewer.id}
                field="displayName"
                text={profile?.displayName ?? viewer.displayName}
                toggle={false}
              />
            </h1>
            <div className="mt-1.5 flex items-center gap-x-4 gap-y-1 flex-wrap text-[13px] text-[color:var(--color-text-subtle)]">
              {profile?.location && (
                <span className="inline-flex items-center gap-1">
                  <svg width="13" height="13" viewBox="0 0 20 20" fill="none" aria-hidden><path d="M10 18s6-5.3 6-10a6 6 0 10-12 0c0 4.7 6 10 6 10z" stroke="currentColor" strokeWidth="1.5"/><circle cx="10" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/></svg>
                  <TranslatedContent
                    kind="member"
                    id={viewer.id}
                    field="location"
                    text={profile.location}
                    toggle={false}
                  />
                </span>
              )}
              {stats && (
                <span>
                  {/* One string with the month inside it, not "Member
                      since" glued to a date — word order is not the
                      same in every language, and a sentence cut in
                      half cannot be translated at all. */}
                  {t("profile.memberSince", "Member since {when}", {
                    when: monthYear(stats.memberSince, locale),
                  })}
                </span>
              )}
            </div>
            {profile?.bio && (
              <p className="mt-3.5 text-[14.5px] leading-relaxed text-[color:var(--color-text)] whitespace-pre-wrap max-w-[65ch]">
                <TranslatedContent
                  kind="member"
                  id={viewer.id}
                  field="bio"
                  text={profile.bio}
                  toggle={false}
                />
              </p>
            )}
            <div className="mt-3.5 flex items-center gap-5 text-[13.5px]">
              <button
                type="button"
                onClick={() => setFollowModal("following")}
                className="group inline-flex items-baseline gap-1"
              >
                <b className="font-semibold text-[color:var(--color-text)] tabular-nums">{(stats?.following ?? 0).toLocaleString()}</b>
                <span className="text-[color:var(--color-text-muted)] group-hover:text-[color:var(--color-text)] group-hover:underline underline-offset-2 transition-colors">{t("common.following", "Following")}</span>
              </button>
              <button
                type="button"
                onClick={() => setFollowModal("followers")}
                className="group inline-flex items-baseline gap-1"
              >
                <b className="font-semibold text-[color:var(--color-text)] tabular-nums">{(stats?.followers ?? 0).toLocaleString()}</b>
                <span className="text-[color:var(--color-text-muted)] group-hover:text-[color:var(--color-text)] group-hover:underline underline-offset-2 transition-colors">
                  {(stats?.followers ?? 0) === 1
                    ? t("profile.follower", "Follower")
                    : t("rail.followers", "Followers")}
                </span>
              </button>
            </div>
          </div>

          {/* Journey stats — integrated footer strip */}
          <div className="-mx-5 sm:-mx-7 mt-6 px-4 sm:px-6 pt-3.5 border-t border-[color:var(--color-border-soft)] flex flex-wrap items-center gap-y-1">
            <Stat label={t("rail.posts", "Posts")} value={stats?.posts} onClick={() => setTab("posts")} icon={ICON_POSTS} />
            <StatSep />
            <Stat label={t("profile.replies", "Replies")} value={stats?.replies} icon={ICON_REPLIES} />
            <StatSep />
            <Stat label={t("profile.rooms", "Rooms")} value={stats?.rooms} onClick={() => setTab("rooms")} icon={ICON_ROOMS} />
            <StatSep />
            <Stat label={t("saved.title", "Saved")} value={stats?.saved} onClick={() => setTab("saved")} icon={ICON_SAVED} />
          </div>
        </div>
      </div>

      {progress && (
        <ProgressSummary
          streaks={progress.streaks}
          badges={progress.badges}
          journalDays={progress.journalDays}
        />
      )}

      {/* Tabs */}
      <div className="mt-5 flex items-center gap-1 border-b border-[color:var(--color-border-soft)]">
        <Tab active={tab === "posts"} onClick={() => setTab("posts")} label={t("rail.posts", "Posts")} />
        <Tab active={tab === "saved"} onClick={() => setTab("saved")} label={t("saved.title", "Saved")} />
        <Tab active={tab === "rooms"} onClick={() => setTab("rooms")} label={t("profile.rooms", "Rooms")} />
      </div>

      <div className="mt-4">
        {tab === "posts" && (
          <PostFeedList viewer={cardViewer} endpoint="/api/user/profile/posts" emptyTitle={t("profile.noPosts", "You haven't posted yet")} emptySubtitle={t("profile.noPostsBlurb", "Anything you share on the wall shows up here.")} />
        )}
        {tab === "saved" && (
          <PostFeedList viewer={cardViewer} endpoint="/api/user/saved" emptyTitle={t("saved.noPosts", "No saved posts yet")} emptySubtitle={t("saved.noPostsBlurb", "Tap the bookmark icon on any post to keep it here.")} />
        )}
        {tab === "rooms" && <RoomsTab />}
      </div>

      <div className="mt-6">
        <Link href="/blocked" className="text-[13px] font-medium text-[color:var(--color-brand)] hover:underline">
          Manage blocked accounts →
        </Link>
      </div>

      {followModal && (
        <FollowListModal userId={viewer.id} kind={followModal} onClose={() => setFollowModal(null)} />
      )}

      {editing && profile && (
        <EditProfileModal
          profile={profile}
          onClose={() => setEditing(false)}
          onSaved={async () => {
            setEditing(false);
            await loadProfile();
            router.refresh();
          }}
        />
      )}
    </SiteShell>
  );
}

/* ── Rooms tab ───────────────────────────────────────────────── */

function RoomsTab() {
  const t = useT();
  const [rooms, setRooms] = useState<Array<{ id: string; slug: string; name: string; emoji: string | null; unread: number }> | null>(null);
  useEffect(() => {
    fetch("/api/user/chatrooms")
      .then((r) => r.json())
      .then((d) => setRooms((d.rooms ?? []).filter((r: { isMember?: boolean }) => r.isMember)))
      .catch(() => setRooms([]));
  }, []);
  if (rooms === null) return <p className="text-[13px] text-[color:var(--color-text-subtle)]">{t("common.loading", "Loading\u2026")}</p>;
  if (rooms.length === 0)
    return (
      <div className="rounded-[16px] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] p-8 text-center">
        <p className="text-[15px] font-semibold tracking-[-0.01em]">{t("profile.noRooms", "No rooms yet")}</p>
        <p className="mt-1 text-[13px] text-[color:var(--color-text-muted)]">
          <Link href="/chatrooms" className="text-[color:var(--color-brand)] font-medium">Find a chatroom →</Link>
        </p>
      </div>
    );
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {rooms.map((r) => (
        <Link key={r.id} href={`/chatrooms/${r.slug}`} className="flex items-center gap-3 rounded-[14px] bg-[color:var(--color-surface)] border border-[color:var(--color-border)] p-3.5 hover:border-[color:var(--color-border-strong)] transition-colors">
          <span className="h-10 w-10 rounded-[12px] bg-[color:var(--color-brand-soft)] flex items-center justify-center text-[18px]">{r.emoji ?? "💬"}</span>
          <span className="text-[14px] font-medium truncate flex-1">
            <TranslatedContent kind="room" id={r.id} field="name" text={r.name} toggle={false} />
          </span>
          {r.unread > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)] font-semibold tabular-nums">{r.unread}</span>}
        </Link>
      ))}
    </div>
  );
}

/* ── Edit modal ──────────────────────────────────────────────── */

function EditProfileModal({ profile, onClose, onSaved }: { profile: Profile; onClose: () => void; onSaved: () => void }) {
  const t = useT();
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [location, setLocation] = useState(profile.location ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [coverUrl, setCoverUrl] = useState(profile.coverUrl);
  const [uploading, setUploading] = useState<"avatar" | "cover" | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const upload = async (file: File, which: "avatar" | "cover") => {
    setUploading(which);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/user/upload", { method: "POST", body: form });
      const d = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (res.ok && d.url) which === "avatar" ? setAvatarUrl(d.url) : setCoverUrl(d.url);
      else setError(serverText(t, d?.error) || t("chat.uploadFailed", "Upload failed."));
    } catch {
      setError(t("chat.uploadFailed", "Upload failed."));
    }
    setUploading(null);
  };

  const save = async () => {
    if (!displayName.trim()) { setError(t("profile.nameRequired", "Name can't be empty.")); return; }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName, location, bio, avatarUrl, coverUrl }),
    });
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (!res.ok) { setError(serverText(t, d?.error) || t("profile.saveFailed", "Save failed.")); return; }
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={saving ? undefined : onClose} />
      <div className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto bg-[color:var(--color-surface)] rounded-t-2xl sm:rounded-2xl border border-[color:var(--color-border)] shadow-[var(--shadow-elevated)]">
        {/* Hidden file inputs (triggered by the buttons below) */}
        <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) void upload(e.target.files[0], "cover"); e.target.value = ""; }} />
        <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) void upload(e.target.files[0], "avatar"); e.target.value = ""; }} />

        {/* Cover editor */}
        <div className="relative h-28 hero-sky">
          {coverUrl && (
            <Img src={coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          )}
          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            className="absolute bottom-2 right-2 z-30 rounded-full bg-black/50 text-white text-[11.5px] font-medium px-3 h-8 flex items-center gap-1.5 hover:bg-black/60 active:scale-[0.98]"
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden><rect x="3" y="5" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.5"/><circle cx="8" cy="9.5" r="1.4" stroke="currentColor" strokeWidth="1.2"/><path d="M4 15l4-3 3 2 3-3 2 2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
            {uploading === "cover" ? t("profile.uploading", "Uploading…") : t("profile.changeCover", "Change cover")}
          </button>
        </div>
        <div className="relative z-10 px-5 pb-5">
          <div className="-mt-12 mb-3">
            <button type="button" onClick={() => avatarInputRef.current?.click()} className="relative inline-block rounded-full group">
              <ProfileAvatar name={displayName} url={avatarUrl} />
              <span className="absolute inset-0 rounded-full bg-black/40 text-white text-[10.5px] font-medium flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {uploading === "avatar" ? "…" : t("settings.change", "Change")}
              </span>
            </button>
          </div>

          <div className="space-y-3">
            <Field label={t("auth.displayName", "Display name")}><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} /></Field>
            <Field label={t("profile.location", "Location (optional)")}><Input value={location} onChange={(e) => setLocation(e.target.value)} maxLength={100} placeholder={t("profile.locationPlaceholder", "City, Country")} /></Field>
            <Field label={t("profile.about", "About you (optional)")}>
              <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} maxLength={150} placeholder={t("profile.aboutPlaceholder", "Share a little about yourself, or why you're here.")} />
              <p className="mt-1 text-[11px] text-[color:var(--color-text-subtle)] text-right tabular-nums">{bio.length}/150</p>
            </Field>
            {error && <p className="text-[12.5px] text-[color:var(--color-danger)]">{error}</p>}
          </div>

          <div className="mt-4 flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={onClose} disabled={saving}>{t("common.cancel", "Cancel")}</Button>
            <Button className="flex-1" loading={saving} onClick={save}>{t("common.save", "Save")}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── bits ────────────────────────────────────────────────────── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[12px] font-medium text-[color:var(--color-text-muted)] mb-1">{label}</span>
      {children}
    </label>
  );
}

const ICON_POSTS = (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden><path d="M4 5.5h12M4 10h12M4 14.5h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
);
const ICON_REPLIES = (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden><path d="M8 6L4 9.5 8 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M4.5 9.5H12a4 4 0 014 4V15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
);
const ICON_ROOMS = (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden><circle cx="7" cy="7.5" r="2.2" stroke="currentColor" strokeWidth="1.4"/><circle cx="13.5" cy="8.5" r="1.8" stroke="currentColor" strokeWidth="1.4"/><path d="M3.5 15c0-2 1.6-3.3 3.5-3.3S10.5 13 10.5 15M12 12c1.7 0 3 1 3 2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
);
const ICON_SAVED = (
  <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden><path d="M6 4.5h8a1 1 0 011 1v10l-5-3-5 3v-10a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
);

function Stat({ label, value, icon, onClick }: { label: string; value?: number; icon: ReactNode; onClick?: () => void }) {
  const body = (
    <>
      <span className="text-[color:var(--color-text-subtle)] transition-colors group-hover:text-[color:var(--color-brand)]">{icon}</span>
      {value === undefined ? (
        <span className="inline-block h-4 w-4 rounded bg-[color:var(--color-surface-muted)] animate-pulse" />
      ) : (
        <span className="text-[15px] font-semibold tabular-nums tracking-[-0.01em] text-[color:var(--color-text)]">{value.toLocaleString()}</span>
      )}
      <span className="text-[13px] text-[color:var(--color-text-muted)] transition-colors group-hover:text-[color:var(--color-text)]">{label}</span>
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="group inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 transition-colors hover:bg-[color:var(--color-surface-muted)] active:scale-[0.98]"
      >
        {body}
      </button>
    );
  }
  return <span className="group inline-flex items-center gap-1.5 px-2.5 py-1.5">{body}</span>;
}

function StatSep() {
  return <span aria-hidden className="mx-1 h-3.5 w-px bg-[color:var(--color-border-soft)] self-center" />;
}

function Tab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-2 text-[13.5px] font-medium -mb-px border-b-2 transition-colors",
        active ? "border-[color:var(--color-brand)] text-[color:var(--color-text)]" : "border-transparent text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]",
      )}
    >
      {label}
    </button>
  );
}

function ProfileAvatar({ name, url }: { name: string; url: string | null }) {
  const initials = useMemo(
    () => name.split(/\s+/).map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase(),
    [name],
  );
  if (url) {
    return <Img src={url} alt="" className="h-24 w-24 rounded-full object-cover ring-4 ring-[color:var(--color-surface)] shadow-[0_6px_20px_var(--shadow-tint)] bg-[color:var(--color-surface-muted)]"
   variant="thumb"
 />;
  }
  return (
    <div className="h-24 w-24 rounded-full ring-4 ring-[color:var(--color-surface)] shadow-[0_6px_20px_var(--shadow-tint)] bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-ink)] flex items-center justify-center text-[26px] font-semibold">
      {initials || "?"}
    </div>
  );
}

