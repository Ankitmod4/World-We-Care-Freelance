"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Img } from "@/components/ui/img";

interface UserDto {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  anonymousByDefault: boolean;
  isActive: boolean;
  bannedAt: string | null;
  banReason: string | null;
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  activityCount: number;
}

type Tab = "profile" | "activity" | "adminlog";

/**
 * Community user detail — full moderation surface.
 *
 * Left column: three tabs (Profile / Activity / Admin log). Right
 * column (or below on mobile): sticky actions panel with the
 * dangerous stuff — status toggle, ban, reset password, send email,
 * delete.
 */
export function UserDetailClient({
  initialUser,
  templates,
}: {
  initialUser: UserDto;
  templates: Array<{ slug: string; name: string }>;
}) {
  const router = useRouter();
  const [user, setUser] = useState(initialUser);
  const [tab, setTab] = useState<Tab>("profile");
  const [toast, setToast] = useState<{ ok: boolean; message: string } | null>(null);

  const pushToast = (ok: boolean, message: string) => {
    setToast({ ok, message });
    setTimeout(() => setToast(null), 3500);
  };

  const reload = async () => {
    const res = await fetch(`/api/admin/users/${user.id}`);
    if (res.ok) {
      const d = (await res.json()) as { item: UserDto };
      setUser(d.item);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Breadcrumb + header */}
      <div className="text-[12.5px]">
        <Link
          href="/admin/users"
          className="text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
        >
          ← All users
        </Link>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-5">
        <Avatar user={user} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] truncate">
              {user.displayName}
            </h1>
            <StatusPill user={user} />
          </div>
          <p className="text-[13.5px] text-[color:var(--color-text-muted)] mt-1 truncate">
            {user.email}
          </p>
          <p className="text-[11.5px] text-[color:var(--color-text-subtle)] mt-1">
            Member since {new Date(user.createdAt).toLocaleDateString()} · ID{" "}
            <code className="font-mono">{user.id}</code>
          </p>
        </div>
      </div>

      {/* Two-column layout — actions rail moves below on mobile. */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
        {/* Left column — tabs + content */}
        <div className="xl:col-span-2 space-y-4 sm:space-y-6">
          {/* Tabs */}
          <div className="flex gap-1.5 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 overflow-x-auto no-scrollbar">
            {[
              { v: "profile" as Tab, label: "Profile" },
              { v: "activity" as Tab, label: "Activity" },
              { v: "adminlog" as Tab, label: "Admin log" },
            ].map((t) => (
              <button
                key={t.v}
                type="button"
                onClick={() => setTab(t.v)}
                className={cn(
                  "shrink-0 whitespace-nowrap px-3.5 h-9 rounded-full text-[13px] font-medium transition-colors",
                  tab === t.v
                    ? "bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)] shadow-[var(--shadow-brand)]"
                    : "bg-[color:var(--color-surface)] text-[color:var(--color-text-muted)] border border-[color:var(--color-border)] hover:text-[color:var(--color-text)]",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {tab === "profile" && <ProfilePanel user={user} onSaved={(u) => {
            setUser(u);
            pushToast(true, "Profile saved.");
          }} onError={(msg) => pushToast(false, msg)} />}
          {tab === "activity" && <ActivityPanel userId={user.id} kind="user" />}
          {tab === "adminlog" && <ActivityPanel userId={user.id} kind="admin" />}
        </div>

        {/* Right rail — actions */}
        <div className="xl:col-span-1 space-y-4 sm:space-y-6">
          <ActionsPanel
            user={user}
            templates={templates}
            onDone={(msg) => {
              pushToast(true, msg);
              reload();
            }}
            onError={(msg) => pushToast(false, msg)}
            onDeleted={() => router.replace("/admin/users")}
          />
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-40 max-w-sm">
          <div
            className={cn(
              "rounded-[12px] px-4 py-3 shadow-[var(--shadow-elevated)] text-[13.5px]",
              toast.ok
                ? "bg-[color:var(--color-success)] text-[color:var(--color-on-success)]"
                : "bg-[color:var(--color-danger)] text-[color:var(--color-on-danger)]",
            )}
          >
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
 * Profile panel — edit displayName, email, avatar, anon default.
 * ──────────────────────────────────────────────────────────────── */

function ProfilePanel({
  user,
  onSaved,
  onError,
}: {
  user: UserDto;
  onSaved: (u: UserDto) => void;
  onError: (msg: string) => void;
}) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [email, setEmail] = useState(user.email);
  const [anon, setAnon] = useState(user.anonymousByDefault);
  const [saving, setSaving] = useState(false);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          email,
          anonymousByDefault: anon,
        }),
      });
      const d = (await res.json().catch(() => ({}))) as {
        item?: UserDto;
        error?: string;
      };
      if (!res.ok || !d.item) {
        onError(d.error ?? "Save failed");
      } else {
        onSaved(d.item);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSave}>
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Basic account details. Changing the email clears the verified state.
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Display name">
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
          </div>
          <div className="flex items-center justify-between rounded-[12px] bg-[color:var(--color-surface-muted)] px-4 py-3">
            <div>
              <p className="text-[14px] font-medium">Anonymous by default</p>
              <p className="text-[12px] text-[color:var(--color-text-subtle)]">
                New posts in sensitive rooms hide the display name unless the user opts in.
              </p>
            </div>
            <Switch checked={anon} onChange={setAnon} label="Anonymous default" />
          </div>
          <MetaGrid user={user} />
          <div className="pt-2">
            <Button type="submit" loading={saving}>
              {saving ? "Saving…" : "Save profile"}
            </Button>
          </div>
        </CardBody>
      </Card>
    </form>
  );
}

function MetaGrid({ user }: { user: UserDto }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-[12px] border border-[color:var(--color-border)] p-4 bg-[color:var(--color-surface)]">
      <MetaLine label="Status" value={
        user.bannedAt
          ? "Banned"
          : !user.isActive
            ? "Deactivated"
            : user.emailVerifiedAt
              ? "Active + verified"
              : "Active — email unverified"
      } />
      <MetaLine
        label="Last seen"
        value={user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : "Never"}
      />
      <MetaLine label="Verified at" value={user.emailVerifiedAt ? new Date(user.emailVerifiedAt).toLocaleString() : "Not verified"} />
      <MetaLine label="Events" value={user.activityCount.toLocaleString()} />
      {user.banReason && (
        <div className="sm:col-span-2">
          <p className="text-[10.5px] uppercase tracking-[0.08em] text-[color:var(--color-text-subtle)] font-semibold">
            Ban reason
          </p>
          <p className="text-[13px] text-[color:var(--color-danger)] mt-0.5">
            {user.banReason}
          </p>
        </div>
      )}
    </dl>
  );
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10.5px] uppercase tracking-[0.08em] text-[color:var(--color-text-subtle)] font-semibold">
        {label}
      </dt>
      <dd className="text-[13px] text-[color:var(--color-text)] mt-0.5">{value}</dd>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
 * Activity panel — user activity OR admin action log.
 * ──────────────────────────────────────────────────────────────── */

interface ActivityItem {
  id: string;
  type?: string;
  action?: string;
  message?: string;
  reason?: string | null;
  meta?: unknown;
  admin?: { displayName: string; email: string } | null;
  createdAt: string;
}

function ActivityPanel({
  userId,
  kind,
}: {
  userId: string;
  kind: "user" | "admin";
}) {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setLoading(true);
    setPage(1);
  }, [kind, userId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/users/${userId}/activity?kind=${kind}&page=${page}&perPage=25`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setItems(d.items ?? []);
        setTotalPages(d.totalPages ?? 1);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [userId, kind, page]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{kind === "admin" ? "Admin action log" : "Activity"}</CardTitle>
        <CardDescription>
          {kind === "admin"
            ? "Every mutation an admin performed on this user."
            : "Events triggered by the user themselves (login, signup, password change, admin-attributed actions)."}
        </CardDescription>
      </CardHeader>
      <CardBody className="p-0">
        {loading && items.length === 0 ? (
          <div className="p-6 text-center text-[13px] text-[color:var(--color-text-subtle)]">
            Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-[color:var(--color-text-subtle)]">
            Nothing here yet.
          </div>
        ) : (
          <ul className="divide-y divide-[color:var(--color-border-soft)]">
            {items.map((it) => (
              <li key={it.id} className="px-5 py-3">
                <div className="flex items-start gap-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-[color:var(--color-brand)] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-[13.5px]">
                        <span className="font-medium">
                          {kind === "admin"
                            ? humanAction(it.action ?? "")
                            : humanType(it.type ?? "")}
                        </span>{" "}
                        {it.message && (
                          <span className="text-[color:var(--color-text-muted)]">
                            — {it.message}
                          </span>
                        )}
                      </p>
                      <span className="text-[11px] text-[color:var(--color-text-subtle)] tabular-nums whitespace-nowrap">
                        {relativeTime(it.createdAt)}
                      </span>
                    </div>
                    {kind === "admin" && it.admin && (
                      <p className="text-[11.5px] text-[color:var(--color-text-subtle)] mt-0.5">
                        by {it.admin.displayName} · {it.admin.email}
                      </p>
                    )}
                    {kind === "admin" && it.reason && (
                      <p className="text-[12px] text-[color:var(--color-text-muted)] mt-1">
                        Reason: {it.reason}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
      {totalPages > 1 && (
        <div className="px-5 py-3 border-t border-[color:var(--color-border-soft)] flex items-center justify-between text-[12.5px]">
          <span className="text-[color:var(--color-text-muted)]">
            Page {page} / {totalPages}
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
              Previous
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
              Next
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

/* ────────────────────────────────────────────────────────────────
 * Actions panel — moderation controls.
 * ──────────────────────────────────────────────────────────────── */

function ActionsPanel({
  user,
  templates,
  onDone,
  onError,
  onDeleted,
}: {
  user: UserDto;
  templates: Array<{ slug: string; name: string }>;
  onDone: (msg: string) => void;
  onError: (msg: string) => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [banReason, setBanReason] = useState("");
  const [templateSlug, setTemplateSlug] = useState(templates[0]?.slug ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const call = async (url: string, body?: unknown, label = "Action") => {
    setBusy(label);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const d = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || d.ok === false) {
        onError(d.error ?? `${label} failed`);
      } else {
        onDone(`${label} succeeded.`);
      }
    } finally {
      setBusy(null);
    }
  };

  const onDelete = async () => {
    setBusy("Delete");
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      onDeleted();
    } else {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      onError(d.error ?? "Delete failed");
    }
    setBusy(null);
  };

  return (
    <div className="space-y-4 sm:space-y-6 xl:sticky xl:top-24 xl:self-start">
      {/* Status */}
      <Card>
        <CardHeader>
          <CardTitle>Account status</CardTitle>
          <CardDescription>
            Deactivating freezes sign-in but keeps the account. Banning permanently blocks it.
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-2">
          {user.isActive ? (
            <Button
              variant="secondary"
              className="w-full"
              onClick={() =>
                call(`/api/admin/users/${user.id}/status`, { action: "deactivate" }, "Deactivate")
              }
              loading={busy === "Deactivate"}
            >
              Deactivate account
            </Button>
          ) : !user.bannedAt ? (
            <Button
              className="w-full"
              onClick={() =>
                call(`/api/admin/users/${user.id}/status`, { action: "activate" }, "Activate")
              }
              loading={busy === "Activate"}
            >
              Reactivate account
            </Button>
          ) : null}

          {user.bannedAt ? (
            <Button
              variant="secondary"
              className="w-full"
              onClick={() =>
                call(`/api/admin/users/${user.id}/status`, { action: "unban" }, "Unban")
              }
              loading={busy === "Unban"}
            >
              Lift ban
            </Button>
          ) : (
            <div className="space-y-2 pt-2 border-t border-[color:var(--color-border-soft)]">
              <label className="block text-[12px] font-medium">Ban reason (required)</label>
              <Input
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="e.g. Repeat spam / harassment"
              />
              <Button
                variant="danger"
                className="w-full"
                disabled={!banReason.trim()}
                loading={busy === "Ban"}
                onClick={() =>
                  call(
                    `/api/admin/users/${user.id}/status`,
                    { action: "ban", reason: banReason.trim() },
                    "Ban",
                  )
                }
              >
                Ban permanently
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Send email */}
      <Card>
        <CardHeader>
          <CardTitle>Send email</CardTitle>
          <CardDescription>
            Fires a template through the delivery provider with sample variables.
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-3">
          <label className="block text-[12px] font-medium">Template</label>
          <div className="relative">
            <select
              value={templateSlug}
              onChange={(e) => setTemplateSlug(e.target.value)}
              className="w-full h-11 pl-3 pr-9 rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] text-sm text-[color:var(--color-text)] appearance-none focus:outline-none focus:border-[color:var(--color-brand)] focus:ring-4 focus:ring-[color:var(--color-brand-soft)]"
            >
              {templates.length === 0 && (
                <option value="">No enabled templates</option>
              )}
              {templates.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.name} ({t.slug})
                </option>
              ))}
            </select>
          </div>
          <Button
            variant="secondary"
            className="w-full"
            disabled={!templateSlug}
            loading={busy === "Send email"}
            onClick={() =>
              call(
                `/api/admin/users/${user.id}/send-email`,
                { templateSlug },
                "Send email",
              )
            }
          >
            Send now
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            loading={busy === "Password reset"}
            onClick={() =>
              call(
                `/api/admin/users/${user.id}/reset-password`,
                undefined,
                "Password reset",
              )
            }
          >
            Send password reset
          </Button>
        </CardBody>
      </Card>

      {/* Danger */}
      <Card>
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
          <CardDescription>
            Deleting the account is permanent — activity + admin log entries survive for auditing.
          </CardDescription>
        </CardHeader>
        <CardBody>
          {!confirmingDelete ? (
            <Button
              variant="danger"
              className="w-full"
              onClick={() => setConfirmingDelete(true)}
            >
              Delete account
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-[13px] text-[color:var(--color-text-muted)]">
                Are you sure? Type the email to confirm.
              </p>
              <Confirm confirmMatch={user.email} onConfirm={onDelete} onCancel={() => setConfirmingDelete(false)} busy={busy === "Delete"} />
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function Confirm({
  confirmMatch,
  onConfirm,
  onCancel,
  busy,
}: {
  confirmMatch: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const [text, setText] = useState("");
  const matches = text.trim().toLowerCase() === confirmMatch.toLowerCase();
  return (
    <>
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={confirmMatch}
      />
      <div className="flex gap-2">
        <Button
          variant="secondary"
          className="flex-1"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </Button>
        <Button
          variant="danger"
          className="flex-1"
          disabled={!matches}
          loading={busy}
          onClick={onConfirm}
        >
          {busy ? "Deleting…" : "Delete forever"}
        </Button>
      </div>
    </>
  );
}

/* ────────────────────────────────────────────────────────────────
 * Small primitives.
 * ──────────────────────────────────────────────────────────────── */

function Avatar({
  user,
  size = "sm",
}: {
  user: { avatarUrl: string | null; displayName: string };
  size?: "sm" | "lg";
}) {
  const initials = useMemo(
    () =>
      user.displayName
        .split(/\s+/)
        .map((s) => s[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase(),
    [user.displayName],
  );
  const dims = size === "lg" ? "h-16 w-16 text-[18px]" : "h-9 w-9 text-[12.5px]";
  return (
    <div
      className={cn(
        "shrink-0 rounded-full bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-ink)] flex items-center justify-center overflow-hidden",
        dims,
      )}
    >
      {user.avatarUrl ? (
        <Img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
      ) : (
        <span className="font-semibold">{initials || "?"}</span>
      )}
    </div>
  );
}

function StatusPill({ user }: { user: UserDto }) {
  if (user.bannedAt) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger-ink)] border border-[color:var(--color-danger-soft)] text-[11.5px] font-medium">
        <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-danger)]" />
        Banned
      </span>
    );
  }
  if (!user.isActive) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[color:var(--color-surface-hover)] text-[color:var(--color-text-muted)] text-[11.5px] font-medium">
        <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-text-subtle)]" />
        Deactivated
      </span>
    );
  }
  if (!user.emailVerifiedAt) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[color:var(--color-warning-soft)] text-[color:var(--color-warning-ink)] border border-[color:var(--color-warning-soft)] text-[11.5px] font-medium">
        <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-warning)]" />
        Unverified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[color:var(--color-success-soft)] text-[color:var(--color-success-ink)] border border-[color:var(--color-success-soft)] text-[11.5px] font-medium">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inset-0 rounded-full bg-[color:var(--color-success)] animate-ping opacity-75" />
        <span className="relative rounded-full h-1.5 w-1.5 bg-[color:var(--color-success)]" />
      </span>
      Active
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[13px] font-medium mb-1.5">{label}</label>
      {children}
    </div>
  );
}

/* ── Formatting helpers ──────────────────────────────────────── */

function humanType(t: string): string {
  switch (t) {
    case "SIGNED_UP":
      return "Signed up";
    case "SIGNED_IN":
      return "Signed in";
    case "SIGN_IN_FAILED":
      return "Sign-in failed";
    case "EMAIL_VERIFIED":
      return "Email verified";
    case "PASSWORD_CHANGED":
      return "Password changed";
    case "PROFILE_UPDATED":
      return "Profile updated";
    case "ADMIN_ACTION":
      return "Admin action";
    default:
      return t;
  }
}

function humanAction(a: string): string {
  switch (a) {
    case "USER_UPDATED":
      return "Profile updated";
    case "USER_ACTIVATED":
      return "Reactivated";
    case "USER_DEACTIVATED":
      return "Deactivated";
    case "USER_BANNED":
      return "Banned";
    case "USER_UNBANNED":
      return "Ban lifted";
    case "USER_DELETED":
      return "Deleted";
    case "USER_PASSWORD_RESET_SENT":
      return "Password reset email sent";
    case "USER_EMAIL_SENT":
      return "Email sent";
    case "USER_CREATED":
      return "Created";
    default:
      return a;
  }
}

function relativeTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const seconds = Math.max(0, Math.floor((now - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}
