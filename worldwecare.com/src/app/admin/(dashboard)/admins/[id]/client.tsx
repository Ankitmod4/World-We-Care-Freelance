"use client";

import { useMemo, useState } from "react";
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
import { cn } from "@/lib/utils";
import { RolePill } from "../client";

type Role = "OWNER" | "ADMIN" | "MODERATOR";

interface AdminDto {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Admin detail — same two-column layout as the community user page.
 * Left: profile form (name, email, role). Right: sticky actions
 * (activate/deactivate, reset password, delete). Self-actions are
 * disabled + labeled so an admin doesn't try to lock themselves
 * out.
 */
export function AdminDetailClient({
  initial,
  viewerId,
}: {
  initial: AdminDto;
  viewerId: string;
}) {
  const router = useRouter();
  const [admin, setAdmin] = useState(initial);
  const [toast, setToast] = useState<{ ok: boolean; message: string } | null>(
    null,
  );
  const isSelf = viewerId === admin.id;

  const pushToast = (ok: boolean, message: string) => {
    setToast({ ok, message });
    setTimeout(() => setToast(null), 3500);
  };
  const reload = async () => {
    const res = await fetch(`/api/admin/admins/${admin.id}`);
    if (res.ok) {
      const d = (await res.json()) as { item: AdminDto };
      setAdmin(d.item);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="text-[12.5px]">
        <Link
          href="/admin/admins"
          className="text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
        >
          ← All admins
        </Link>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-5">
        <Avatar admin={admin} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] truncate">
              {admin.displayName}
            </h1>
            <RolePill role={admin.role} />
            {isSelf && (
              <span className="px-2 py-0.5 rounded-full bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-ink)] text-[10.5px] font-medium">
                You
              </span>
            )}
            {!admin.isActive && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[color:var(--color-surface-hover)] text-[color:var(--color-text-muted)] text-[10.5px] font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-text-subtle)]" />
                Deactivated
              </span>
            )}
          </div>
          <p className="text-[13.5px] text-[color:var(--color-text-muted)] mt-1 truncate">
            {admin.email}
          </p>
          <p className="text-[11.5px] text-[color:var(--color-text-subtle)] mt-1">
            {admin.lastLoginAt
              ? `Last signed in ${new Date(admin.lastLoginAt).toLocaleString()}`
              : "Never signed in yet"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
        <div className="xl:col-span-2 space-y-4 sm:space-y-6">
          <ProfileForm
            admin={admin}
            isSelf={isSelf}
            onSaved={(a) => {
              setAdmin(a);
              pushToast(true, "Profile saved.");
            }}
            onError={(m) => pushToast(false, m)}
          />
        </div>
        <div className="xl:col-span-1 space-y-4 sm:space-y-6">
          <ActionsPanel
            admin={admin}
            isSelf={isSelf}
            onDone={(msg) => {
              pushToast(true, msg);
              reload();
            }}
            onError={(m) => pushToast(false, m)}
            onDeleted={() => router.replace("/admin/admins")}
          />
        </div>
      </div>

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

/* ────────────────────────────────────────────────────────────── */

function ProfileForm({
  admin,
  isSelf,
  onSaved,
  onError,
}: {
  admin: AdminDto;
  isSelf: boolean;
  onSaved: (a: AdminDto) => void;
  onError: (msg: string) => void;
}) {
  const [displayName, setDisplayName] = useState(admin.displayName);
  const [email, setEmail] = useState(admin.email);
  const [role, setRole] = useState<Role>(admin.role);
  const [saving, setSaving] = useState(false);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    const res = await fetch(`/api/admin/admins/${admin.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName, email, role }),
    });
    const d = (await res.json().catch(() => ({}))) as {
      item?: AdminDto;
      error?: string;
    };
    if (!res.ok || !d.item) {
      onError(d.error ?? "Save failed");
    } else {
      onSaved(d.item);
    }
    setSaving(false);
  };

  return (
    <form onSubmit={onSave}>
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            {isSelf
              ? "You're editing your own account. Role can be changed by another admin."
              : "Edit name, email, and role."}
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Display name">
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </Field>
            <Field label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
          </div>
          <Field
            label="Role"
            hint={
              isSelf
                ? "You can't change your own role — ask another admin."
                : "OWNER can invite other owners. ADMIN handles everything except transferring ownership. MODERATOR reviews content and users."
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(["MODERATOR", "ADMIN", "OWNER"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  disabled={isSelf}
                  onClick={() => setRole(r)}
                  className={cn(
                    "h-11 rounded-[12px] border text-[13px] font-medium transition-colors",
                    role === r
                      ? "bg-[color:var(--color-brand-soft)] border-[color:var(--color-brand)] text-[color:var(--color-brand-ink)]"
                      : "bg-[color:var(--color-surface)] border-[color:var(--color-border)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-border-strong)]",
                    isSelf && "opacity-50 cursor-not-allowed",
                  )}
                >
                  {r === "OWNER" ? "Owner" : r === "ADMIN" ? "Admin" : "Moderator"}
                </button>
              ))}
            </div>
          </Field>
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

/* ────────────────────────────────────────────────────────────── */

function ActionsPanel({
  admin,
  isSelf,
  onDone,
  onError,
  onDeleted,
}: {
  admin: AdminDto;
  isSelf: boolean;
  onDone: (msg: string) => void;
  onError: (msg: string) => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pwReveal, setPwReveal] = useState<string | null>(null);
  const [pwInput, setPwInput] = useState("");
  const [pwCopied, setPwCopied] = useState(false);

  const call = async (
    url: string,
    body: unknown,
    label: string,
    okMsg?: string,
  ) => {
    setBusy(label);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || d.ok === false) {
        onError(d.error ?? `${label} failed`);
      } else {
        onDone(okMsg ?? `${label} succeeded.`);
      }
    } finally {
      setBusy(null);
    }
  };

  const doReset = async () => {
    setBusy("Reset password");
    try {
      const res = await fetch(`/api/admin/admins/${admin.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwInput.trim() || undefined }),
      });
      const d = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        newPassword?: string;
        error?: string;
      };
      if (!res.ok || !d.newPassword) {
        onError(d.error ?? "Reset failed");
      } else {
        setPwReveal(d.newPassword);
        setPwInput("");
      }
    } finally {
      setBusy(null);
    }
  };

  const doDelete = async () => {
    setBusy("Delete");
    const res = await fetch(`/api/admin/admins/${admin.id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      onDeleted();
    } else {
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      onError(d.error ?? "Delete failed");
      setBusy(null);
    }
  };

  const copyPw = async () => {
    if (!pwReveal) return;
    try {
      await navigator.clipboard.writeText(pwReveal);
      setPwCopied(true);
      setTimeout(() => setPwCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 xl:sticky xl:top-24 xl:self-start">
      <Card>
        <CardHeader>
          <CardTitle>Account status</CardTitle>
          <CardDescription>
            Deactivating suspends sign-in without deleting anything. The
            last active OWNER can't be deactivated.
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-2">
          {admin.isActive ? (
            <Button
              variant="secondary"
              className="w-full"
              disabled={isSelf}
              loading={busy === "Deactivate"}
              onClick={() =>
                call(
                  `/api/admin/admins/${admin.id}/status`,
                  { action: "deactivate" },
                  "Deactivate",
                )
              }
            >
              {isSelf ? "Can't deactivate yourself" : "Deactivate admin"}
            </Button>
          ) : (
            <Button
              className="w-full"
              loading={busy === "Activate"}
              onClick={() =>
                call(
                  `/api/admin/admins/${admin.id}/status`,
                  { action: "activate" },
                  "Activate",
                )
              }
            >
              Reactivate admin
            </Button>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reset password</CardTitle>
          <CardDescription>
            Sets a new password on this account. Share it with the admin
            over a secure channel — we don't email it.
          </CardDescription>
        </CardHeader>
        <CardBody className="space-y-3">
          {pwReveal ? (
            <>
              <div className="rounded-[12px] bg-[color:var(--color-surface-muted)] border border-[color:var(--color-border)] p-3">
                <p className="text-[10.5px] uppercase tracking-[0.08em] text-[color:var(--color-text-subtle)] font-semibold">
                  New password
                </p>
                <p className="mt-0.5 text-[14px] font-mono break-all select-all">
                  {pwReveal}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={copyPw}
                >
                  {pwCopied ? "Copied ✓" : "Copy"}
                </Button>
                <Button className="flex-1" onClick={() => setPwReveal(null)}>
                  Done
                </Button>
              </div>
            </>
          ) : (
            <>
              <Input
                type="text"
                value={pwInput}
                onChange={(e) => setPwInput(e.target.value)}
                placeholder="Leave blank to auto-generate"
                autoComplete="new-password"
              />
              <Button
                variant="secondary"
                className="w-full"
                loading={busy === "Reset password"}
                onClick={doReset}
              >
                Reset password
              </Button>
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danger zone</CardTitle>
          <CardDescription>
            Delete permanently — audit-log entries survive but this
            admin will no longer be able to sign in.
          </CardDescription>
        </CardHeader>
        <CardBody>
          {!confirmingDelete ? (
            <Button
              variant="danger"
              className="w-full"
              disabled={isSelf}
              onClick={() => setConfirmingDelete(true)}
            >
              {isSelf ? "Can't delete yourself" : "Delete admin"}
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-[13px] text-[color:var(--color-text-muted)]">
                Type the email to confirm.
              </p>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={admin.email}
              />
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => {
                    setConfirmingDelete(false);
                    setConfirmText("");
                  }}
                  disabled={busy === "Delete"}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  disabled={
                    confirmText.trim().toLowerCase() !== admin.email.toLowerCase()
                  }
                  loading={busy === "Delete"}
                  onClick={doDelete}
                >
                  {busy === "Delete" ? "Deleting…" : "Delete forever"}
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/* ── Small primitives ────────────────────────────────────────── */

function Avatar({ admin }: { admin: { displayName: string } }) {
  const initials = useMemo(
    () =>
      admin.displayName
        .split(/\s+/)
        .map((s) => s[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase(),
    [admin.displayName],
  );
  return (
    <div className="shrink-0 h-16 w-16 rounded-full bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-ink)] flex items-center justify-center text-[18px] font-semibold">
      {initials || "?"}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[13px] font-medium mb-1.5">{label}</label>
      {children}
      {hint && (
        <p className="mt-1.5 text-[11.5px] text-[color:var(--color-text-subtle)]">
          {hint}
        </p>
      )}
    </div>
  );
}
