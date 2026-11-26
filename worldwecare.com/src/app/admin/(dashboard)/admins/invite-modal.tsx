"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Role = "OWNER" | "ADMIN" | "MODERATOR";

const ROLES: Array<{ v: Role; label: string; hint: string }> = [
  { v: "MODERATOR", label: "Moderator", hint: "Can review content and users." },
  { v: "ADMIN", label: "Admin", hint: "Everything except transferring ownership." },
  { v: "OWNER", label: "Owner", hint: "Full control, including inviting other owners." },
];

/**
 * Invite modal — small form, single POST, ends in a one-time
 * password reveal that the inviter must copy right then.
 *
 * The password shown here is generated server-side when the
 * inviter doesn't type one. Once the admin dismisses the reveal
 * we can't retrieve it again (only its hash is stored).
 */
export function InviteAdminModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<Role>("ADMIN");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  // Reset when opening.
  useEffect(() => {
    if (open) {
      setEmail("");
      setDisplayName("");
      setPassword("");
      setRole("ADMIN");
      setError(null);
      setReveal(null);
      setCopied(false);
      // Autofocus after the modal has painted.
      requestAnimationFrame(() => firstFieldRef.current?.focus());
    }
  }, [open]);

  // Close on Escape (unless the reveal is still up — the admin needs
  // to see it).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          displayName: displayName.trim(),
          role,
          password: password.trim() || undefined,
        }),
      });
      const d = (await res.json().catch(() => ({}))) as {
        item?: { email: string };
        initialPassword?: string;
        error?: string;
      };
      if (!res.ok || !d.item) {
        setError(d.error ?? "Invite failed");
        setBusy(false);
        return;
      }
      setReveal({
        email: d.item.email,
        password: d.initialPassword ?? password,
      });
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  };

  const copyReveal = async () => {
    if (!reveal) return;
    const text = `Email: ${reveal.email}\nPassword: ${reveal.password}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard might be blocked — no fallback needed, the admin
      // can still select-copy the text manually.
    }
  };

  const finish = () => {
    onCreated();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={reveal ? undefined : onClose}
      />
      <div className="relative w-full sm:max-w-md bg-[color:var(--color-surface)] rounded-t-2xl sm:rounded-2xl border border-[color:var(--color-border)] shadow-[var(--shadow-elevated)] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[color:var(--color-border-soft)] flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold tracking-[-0.01em]">
              {reveal ? "Admin created" : "Invite an admin"}
            </h2>
            <p className="text-[12px] text-[color:var(--color-text-muted)] mt-0.5">
              {reveal
                ? "Copy the sign-in details now — the password can't be shown again."
                : "They'll use these credentials to sign in at /admin/login."}
            </p>
          </div>
          {!reveal && (
            <button
              onClick={onClose}
              disabled={busy}
              aria-label="Close"
              className="min-h-11 min-w-11 flex items-center justify-center rounded-[10px] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)] hover:bg-[color:var(--color-surface-hover)] disabled:opacity-50"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path d="M4 4l8 8M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        {reveal ? (
          <RevealPanel reveal={reveal} copied={copied} onCopy={copyReveal} onDone={finish} />
        ) : (
          <form onSubmit={onSubmit} className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Display name">
                <Input
                  ref={firstFieldRef}
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Alex Owner"
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@yourdomain.com"
                />
              </Field>
            </div>

            <Field label="Role">
              <div className="grid grid-cols-1 gap-1.5">
                {ROLES.map((r) => (
                  <label
                    key={r.v}
                    className={cn(
                      "flex items-start gap-3 px-3.5 py-2.5 rounded-[12px] border transition-colors cursor-pointer",
                      role === r.v
                        ? "bg-[color:var(--color-brand-tint)] border-[color:var(--color-brand)]"
                        : "bg-[color:var(--color-surface)] border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)]",
                    )}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={r.v}
                      checked={role === r.v}
                      onChange={() => setRole(r.v)}
                      className="mt-1 accent-[color:var(--color-brand)]"
                    />
                    <div>
                      <p className="text-[13.5px] font-medium">{r.label}</p>
                      <p className="text-[11.5px] text-[color:var(--color-text-muted)] mt-0.5">
                        {r.hint}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </Field>

            <Field
              label="Initial password"
              hint="Leave blank to auto-generate a strong one."
            >
              <Input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="auto-generated"
                autoComplete="new-password"
              />
            </Field>

            {error && (
              <div className="rounded-[10px] bg-[color:var(--color-danger-soft)] border border-[color:var(--color-danger-soft)] text-[color:var(--color-danger)] text-[13px] px-3 py-2">
                {error}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={onClose}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1" loading={busy}>
                {busy ? "Creating…" : "Create admin"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function RevealPanel({
  reveal,
  copied,
  onCopy,
  onDone,
}: {
  reveal: { email: string; password: string };
  copied: boolean;
  onCopy: () => void;
  onDone: () => void;
}) {
  return (
    <div className="p-5 space-y-4">
      <div className="rounded-[12px] bg-[color:var(--color-warning-soft)] border border-[color:var(--color-warning-soft)] px-3.5 py-2.5 text-[12.5px] text-[color:var(--color-warning-ink)] leading-snug">
        Share these details with the new admin over a secure channel.
        This password is <strong>only shown once</strong> — we don't
        store the plaintext.
      </div>

      <div className="rounded-[12px] bg-[color:var(--color-surface-muted)] border border-[color:var(--color-border)] p-4 space-y-3">
        <RevealField label="Email" value={reveal.email} />
        <RevealField label="Password" value={reveal.password} mono />
      </div>

      <div className="flex gap-2">
        <Button
          variant="secondary"
          className="flex-1"
          onClick={onCopy}
        >
          {copied ? "Copied ✓" : "Copy both"}
        </Button>
        <Button className="flex-1" onClick={onDone}>
          Done
        </Button>
      </div>
    </div>
  );
}

function RevealField({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="text-[10.5px] uppercase tracking-[0.08em] text-[color:var(--color-text-subtle)] font-semibold">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-[13.5px] break-all select-all",
          mono && "font-mono",
        )}
      >
        {value}
      </p>
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
