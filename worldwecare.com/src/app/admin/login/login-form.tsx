"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";

/**
 * Admin login form — client component so it can capture the submit
 * and read/display errors from the JSON API without a full page
 * reload. On success we replace() to the next path (instead of
 * push()) so the login form doesn't sit in the history stack.
 */
export function AdminLoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Sign in failed. Try again.");
        setSubmitting(false);
        return;
      }
      // Hard nav so the middleware re-runs and picks up the new
      // cookie before rendering /admin.
      router.replace(nextPath);
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <label
          htmlFor="email"
          className="block text-[13px] font-medium text-[color:var(--color-text)] mb-1.5"
        >
          Email
        </label>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@worldwecare.local"
          invalid={!!error}
        />
      </div>
      <div>
        <label
          htmlFor="password"
          className="block text-[13px] font-medium text-[color:var(--color-text)] mb-1.5"
        >
          Password
        </label>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          invalid={!!error}
        />
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-[10px] bg-[color:var(--color-danger-soft)] border border-[color:var(--color-danger-soft)] text-[color:var(--color-danger)] text-[13px] px-3 py-2"
        >
          {error}
        </div>
      )}

      <Button type="submit" size="lg" loading={submitting} className="w-full">
        {submitting ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
