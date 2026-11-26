import type { Metadata } from "next";
import Link from "next/link";
import { ReportStatus } from "@prisma/client";
import { getCurrentAdmin } from "@/lib/admin-auth";
import { prisma } from "@/lib/db";
import { Card, CardBody } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * /admin — dashboard home.
 *
 * Server-rendered, so every number is live per request (no client
 * fetches, no loading flash). Kept as a single async page rather
 * than being sliced into island components because the whole point
 * of a dashboard is that you land on it and see the truth right
 * now.
 *
 * Layout per DESIGN_RULES.md:
 *   • Full page width — no max-w cap.
 *   • Grid columns scale up on wider screens so there's no dead
 *     space, and everything stacks single-column at 375px.
 */
export default async function AdminHomePage() {
  const admin = await getCurrentAdmin();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  // Every read fires in parallel — the dashboard should feel snappy
  // even as more counters get added.
  const [
    userCount,
    usersLast7,
    usersPrev7,
    usersUnverifiedOver3d,
    adminCount,
    postCount,
    postsToday,
    commentCount,
    openReports,
    resolved7,
    countryCount,
    statesCount,
    recentSignups,
    recentPosts,
    recentReports,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.user.count({
      where: { createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
    }),
    prisma.user.count({
      where: { emailVerifiedAt: null, createdAt: { lt: threeDaysAgo } },
    }),
    prisma.adminUser.count({ where: { isActive: true } }),
    prisma.post.count({ where: { status: "PUBLISHED" } }),
    prisma.post.count({
      where: { status: "PUBLISHED", createdAt: { gte: startOfToday } },
    }),
    prisma.postComment.count({ where: { status: "PUBLISHED" } }),
    prisma.postReport.count({ where: { status: ReportStatus.OPEN } }),
    prisma.postReport.count({
      where: {
        status: { in: [ReportStatus.RESOLVED, ReportStatus.DISMISSED] },
        resolvedAt: { gte: sevenDaysAgo },
      },
    }),
    prisma.country.count({ where: { isActive: true } }),
    prisma.state.count({ where: { isActive: true } }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, displayName: true, email: true, createdAt: true, emailVerifiedAt: true },
    }),
    prisma.post.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        body: true,
        authorNameSnapshot: true,
        isAnonymous: true,
        createdAt: true,
      },
    }),
    prisma.postReport.findMany({
      where: { status: ReportStatus.OPEN },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        reporter: { select: { displayName: true } },
        post: { select: { id: true, body: true, authorNameSnapshot: true } },
      },
    }),
  ]);

  const verifiedRate =
    userCount === 0
      ? 0
      : Math.round(((userCount - usersUnverifiedOver3d) / userCount) * 100);

  // Merge the three fetches into a single chronological timeline
  // so the "recent activity" panel reads as a story of the last
  // hour/day, not three siloed lists.
  type Activity =
    | { kind: "signup"; at: Date; user: { id: string; name: string; email: string; verified: boolean } }
    | { kind: "post";   at: Date; post: { id: string; body: string; author: string; anon: boolean } }
    | { kind: "report"; at: Date; report: { id: string; postId: string; reason: string; reporter: string | null; snippet: string } };

  const activity: Activity[] = [
    ...recentSignups.map<Activity>((u) => ({
      kind: "signup",
      at: u.createdAt,
      user: {
        id: u.id,
        name: u.displayName,
        email: u.email,
        verified: u.emailVerifiedAt !== null,
      },
    })),
    ...recentPosts.map<Activity>((p) => ({
      kind: "post",
      at: p.createdAt,
      post: {
        id: p.id,
        body: p.body,
        author: p.authorNameSnapshot,
        anon: p.isAnonymous,
      },
    })),
    ...recentReports.map<Activity>((r) => ({
      kind: "report",
      at: r.createdAt,
      report: {
        id: r.id,
        postId: r.postId,
        reason: r.reason,
        reporter: r.reporter?.displayName ?? null,
        snippet: r.post.body,
      },
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 12);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8">
      <header>
        <h1 className="text-[24px] sm:text-[28px] font-semibold tracking-[-0.02em]">
          Welcome back{admin?.displayName ? `, ${admin.displayName}` : ""} 👋
        </h1>
        <p className="mt-1.5 text-[14px] sm:text-[15px] text-[color:var(--color-text-muted)]">
          {openReports > 0
            ? `${openReports} report${openReports === 1 ? "" : "s"} waiting for you.`
            : `Everything's tidy. Here's a pulse of the community.`}
        </p>
      </header>

      {/* Stat tiles ------------------------------------------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Members"
          value={userCount}
          delta={{ this7: usersLast7, prev7: usersPrev7, singular: "member" }}
          href="/admin/users"
        />
        <StatCard
          label="Verified"
          value={verifiedRate}
          suffix="%"
          hint={`${usersUnverifiedOver3d.toLocaleString()} pending > 3d`}
          href="/admin/users"
        />
        <StatCard
          label="Posts"
          value={postCount}
          hint={postsToday === 0 ? "None today" : `${postsToday.toLocaleString()} today`}
          href="/admin/posts"
        />
        <StatCard
          label="Open reports"
          value={openReports}
          hint={
            resolved7 > 0
              ? `${resolved7} resolved this week`
              : "Nothing outstanding"
          }
          href="/admin/posts/reports"
          tone={openReports > 0 ? "warn" : "ok"}
        />
      </div>

      {/* Body -------------------------------------------------------- */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
        {/* Left: activity timeline */}
        <div className="xl:col-span-2 space-y-4 sm:space-y-6">
          <Card>
            <CardBody className="p-0">
              <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-[16px] font-semibold tracking-[-0.01em]">Recent activity</h2>
                  <p className="text-[12.5px] text-[color:var(--color-text-muted)] mt-0.5">
                    Signups, posts, and reports — chronological.
                  </p>
                </div>
              </div>
              {activity.length === 0 ? (
                <div className="text-center py-14 text-[color:var(--color-text-subtle)] text-[13.5px]">
                  Nothing has happened yet. Once members sign up and post, you'll see it here.
                </div>
              ) : (
                <ol className="divide-y divide-[color:var(--color-border-soft)]">
                  {activity.map((item, i) => (
                    <ActivityRow key={i} item={item} />
                  ))}
                </ol>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Right: attention + quick actions */}
        <div className="xl:col-span-1 space-y-4 sm:space-y-6">
          <AttentionPanel
            openReports={openReports}
            unverified={usersUnverifiedOver3d}
            adminCount={adminCount}
          />
          <QuickActions />
          <FootprintCard
            countryCount={countryCount}
            statesCount={statesCount}
            commentCount={commentCount}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Stat card with optional week-over-week delta ────────────── */

function StatCard({
  label,
  value,
  suffix,
  hint,
  href,
  tone,
  delta,
}: {
  label: string;
  value: number;
  suffix?: string;
  hint?: string;
  href?: string;
  tone?: "warn" | "ok";
  delta?: { this7: number; prev7: number; singular: string };
}) {
  const deltaLabel = (() => {
    if (!delta) return null;
    const diff = delta.this7 - delta.prev7;
    if (delta.this7 === 0 && delta.prev7 === 0) return "No new this week";
    if (diff === 0) return `${delta.this7} new this week`;
    const arrow = diff > 0 ? "↑" : "↓";
    const magnitude = Math.abs(diff);
    return `${delta.this7} new · ${arrow} ${magnitude} vs last week`;
  })();

  const body = (
    <Card
      className={cn(
        "h-full transition-shadow duration-150",
        href && "hover:shadow-[var(--shadow-elevated)] cursor-pointer",
      )}
    >
      <CardBody className="pt-5">
        <p className="text-[10.5px] sm:text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-text-subtle)]">
          {label}
        </p>
        <p
          className={cn(
            "mt-2 text-[28px] sm:text-[36px] font-semibold tracking-[-0.02em] tabular-nums",
            tone === "warn" && value > 0 && "text-[color:var(--color-warning)]",
            tone === "ok" && "text-[color:var(--color-text)]",
            !tone && "text-[color:var(--color-text)]",
          )}
        >
          {value.toLocaleString()}
          {suffix && (
            <span className="text-[16px] sm:text-[18px] text-[color:var(--color-text-muted)] font-medium ml-0.5">
              {suffix}
            </span>
          )}
        </p>
        <p className="mt-1 text-[12px] sm:text-[13px] text-[color:var(--color-text-muted)]">
          {deltaLabel ?? hint ?? " "}
        </p>
      </CardBody>
    </Card>
  );

  if (!href) return body;
  return (
    <Link href={href} className="block h-full">
      {body}
    </Link>
  );
}

/* ── Right rail: attention needed ────────────────────────────── */

function AttentionPanel({
  openReports,
  unverified,
  adminCount,
}: {
  openReports: number;
  unverified: number;
  adminCount: number;
}) {
  const items: Array<{ label: string; hint: string; href: string; tone: "warn" | "neutral" }> = [];
  if (openReports > 0) {
    items.push({
      label: `${openReports.toLocaleString()} open report${openReports === 1 ? "" : "s"}`,
      hint: "Triage from the reports queue.",
      href: "/admin/posts/reports",
      tone: "warn",
    });
  }
  if (unverified > 0) {
    items.push({
      label: `${unverified.toLocaleString()} unverified > 3d`,
      hint: "Members who haven't clicked the confirmation link.",
      href: "/admin/users?status=unverified",
      tone: "neutral",
    });
  }
  if (adminCount < 2) {
    items.push({
      label: "Only 1 active admin",
      hint: "Invite a second so you're never a single point of failure.",
      href: "/admin/admins",
      tone: "neutral",
    });
  }

  return (
    <Card>
      <CardBody className="p-5">
        <h2 className="text-[16px] font-semibold tracking-[-0.01em]">Needs your attention</h2>
        <p className="text-[12.5px] text-[color:var(--color-text-muted)] mt-0.5">
          {items.length === 0
            ? "You're caught up. Nice."
            : `${items.length} thing${items.length === 1 ? "" : "s"} to look at.`}
        </p>
        {items.length > 0 && (
          <ul className="mt-3 space-y-2">
            {items.map((it, i) => (
              <li key={i}>
                <Link
                  href={it.href}
                  className={cn(
                    "block rounded-[12px] border px-3.5 py-3 transition-colors",
                    it.tone === "warn"
                      ? "bg-[color:var(--color-warning-soft)] border-[color:var(--color-warning-soft)] hover:bg-[color:var(--color-warning-soft)]"
                      : "bg-[color:var(--color-surface)] border-[color:var(--color-border)] hover:bg-[color:var(--color-surface-hover)]",
                  )}
                >
                  <p
                    className={cn(
                      "text-[13.5px] font-medium",
                      it.tone === "warn" ? "text-[color:var(--color-warning-ink)]" : "text-[color:var(--color-text)]",
                    )}
                  >
                    {it.label}
                  </p>
                  <p
                    className={cn(
                      "text-[12px] mt-0.5",
                      it.tone === "warn" ? "text-[color:var(--color-warning-ink)]/80" : "text-[color:var(--color-text-muted)]",
                    )}
                  >
                    {it.hint}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

/* ── Right rail: quick actions ───────────────────────────────── */

function QuickActions() {
  const actions: Array<{ label: string; href: string; icon: React.ReactNode }> = [
    { label: "Users",       href: "/admin/users",          icon: <IconUsers /> },
    { label: "Reports",     href: "/admin/posts/reports",  icon: <IconFlag /> },
    { label: "Admins",      href: "/admin/admins",         icon: <IconShield /> },
    { label: "Geography",   href: "/admin/geography",      icon: <IconGlobe /> },
    { label: "Email",       href: "/admin/settings/email", icon: <IconMail /> },
    { label: "General",     href: "/admin/settings/general", icon: <IconGear /> },
  ];
  return (
    <Card>
      <CardBody className="p-5">
        <h2 className="text-[16px] font-semibold tracking-[-0.01em]">Jump to</h2>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {actions.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[13px] font-medium text-[color:var(--color-text-muted)] border border-[color:var(--color-border)] hover:text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-hover)] transition-colors"
            >
              <span className="text-[color:var(--color-text-subtle)]">{a.icon}</span>
              <span>{a.label}</span>
            </Link>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

/* ── Right rail: platform footprint ──────────────────────────── */

function FootprintCard({
  countryCount,
  statesCount,
  commentCount,
}: {
  countryCount: number;
  statesCount: number;
  commentCount: number;
}) {
  return (
    <Card>
      <CardBody className="p-5 space-y-3">
        <h2 className="text-[16px] font-semibold tracking-[-0.01em]">Platform footprint</h2>
        <FootprintRow label="Active countries" value={countryCount} />
        <FootprintRow label="States (US)" value={statesCount} />
        <FootprintRow label="Comments posted" value={commentCount} />
      </CardBody>
    </Card>
  );
}

function FootprintRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <p className="text-[12.5px] text-[color:var(--color-text-muted)]">{label}</p>
      <p className="text-[15px] font-semibold tabular-nums tracking-[-0.01em]">
        {value.toLocaleString()}
      </p>
    </div>
  );
}

/* ── Activity row ────────────────────────────────────────────── */

type Activity =
  | { kind: "signup"; at: Date; user: { id: string; name: string; email: string; verified: boolean } }
  | { kind: "post";   at: Date; post: { id: string; body: string; author: string; anon: boolean } }
  | { kind: "report"; at: Date; report: { id: string; postId: string; reason: string; reporter: string | null; snippet: string } };

function ActivityRow({ item }: { item: Activity }) {
  if (item.kind === "signup") {
    return (
      <li className="px-5 py-3 flex items-start gap-3 hover:bg-[color:var(--color-surface-hover)] transition-colors">
        <Dot kind="signup" />
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px]">
            <Link
              href={`/admin/users/${item.user.id}`}
              className="font-medium hover:text-[color:var(--color-brand)]"
            >
              {item.user.name}
            </Link>{" "}
            <span className="text-[color:var(--color-text-muted)]">signed up</span>
            {!item.user.verified && (
              <span className="ml-2 inline-flex px-1.5 py-0 rounded-full bg-[color:var(--color-surface-hover)] text-[color:var(--color-text-muted)] text-[10px] font-medium align-middle">
                unverified
              </span>
            )}
          </p>
          <p className="text-[11.5px] text-[color:var(--color-text-subtle)] mt-0.5 truncate">
            {item.user.email} · {relativeTime(item.at)}
          </p>
        </div>
      </li>
    );
  }
  if (item.kind === "post") {
    return (
      <li className="px-5 py-3 flex items-start gap-3 hover:bg-[color:var(--color-surface-hover)] transition-colors">
        <Dot kind="post" />
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px]">
            <span className="font-medium">
              {item.post.anon ? "Anonymous member" : item.post.author}
            </span>{" "}
            <Link
              href={`/admin/posts/${item.post.id}`}
              className="text-[color:var(--color-text-muted)] hover:text-[color:var(--color-brand)]"
            >
              posted
            </Link>
          </p>
          <p className="text-[12px] text-[color:var(--color-text-muted)] mt-0.5 line-clamp-1">
            "{item.post.body.replace(/\s+/g, " ").trim()}"
          </p>
          <p className="text-[11.5px] text-[color:var(--color-text-subtle)] mt-0.5">
            {relativeTime(item.at)}
          </p>
        </div>
      </li>
    );
  }
  return (
    <li className="px-5 py-3 flex items-start gap-3 hover:bg-[color:var(--color-surface-hover)] transition-colors bg-[color:var(--color-warning-soft)]/40">
      <Dot kind="report" />
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px]">
          <span className="text-[color:var(--color-text-muted)]">
            {item.report.reporter ?? "Someone"} reported a post ·{" "}
          </span>
          <Link
            href={`/admin/posts/reports`}
            className="font-medium text-[color:var(--color-warning-ink)] hover:underline"
          >
            {humanReason(item.report.reason)}
          </Link>
        </p>
        <p className="text-[12px] text-[color:var(--color-text-muted)] mt-0.5 line-clamp-1">
          "{item.report.snippet.replace(/\s+/g, " ").trim()}"
        </p>
        <p className="text-[11.5px] text-[color:var(--color-text-subtle)] mt-0.5">
          {relativeTime(item.at)}
        </p>
      </div>
    </li>
  );
}

function Dot({ kind }: { kind: Activity["kind"] }) {
  const map = {
    signup: { bg: "bg-[color:var(--color-success-soft)]", fg: "text-[color:var(--color-success-ink)]", icon: "✦" },
    post:   { bg: "bg-[color:var(--color-brand-soft)]", fg: "text-[color:var(--color-brand-ink)]", icon: "✎" },
    report: { bg: "bg-[color:var(--color-warning-soft)]", fg: "text-[color:var(--color-warning-ink)]", icon: "!" },
  } as const;
  const c = map[kind];
  return (
    <span
      className={cn(
        "shrink-0 mt-0.5 h-7 w-7 rounded-full flex items-center justify-center text-[13px] font-semibold",
        c.bg,
        c.fg,
      )}
      aria-hidden
    >
      {c.icon}
    </span>
  );
}

function humanReason(reason: string): string {
  return reason
    .toLowerCase()
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

function relativeTime(d: Date): string {
  const seconds = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

/* ── Icons ───────────────────────────────────────────────────── */

function IconUsers() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 17c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="14" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M12 17c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
function IconFlag() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <path d="M5 3v14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M5 4h8l-1.5 3L13 10H5V4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <path d="M10 3l6 2v5c0 4-3 6.5-6 7-3-.5-6-3-6-7V5l6-2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}
function IconGlobe() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.4" />
      <path d="M3 10h14M10 3c2.2 2 3.5 4.5 3.5 7s-1.3 5-3.5 7c-2.2-2-3.5-4.5-3.5-7s1.3-5 3.5-7z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconMail() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <rect x="3" y="5" width="14" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M4 6l6 5 6-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconGear() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M10 3v2M10 15v2M3 10h2M15 10h2M5 5l1.4 1.4M13.6 13.6L15 15M5 15l1.4-1.4M13.6 6.4L15 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
