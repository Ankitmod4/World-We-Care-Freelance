"use client";

import { useState } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SettingsFooter } from "@/components/admin/settings-footer";
import { Switch } from "@/components/ui/switch";

/**
 * Email settings — configure the delivery provider and the sender
 * identity. The
 * API key is write-only: we never fetch it back to the client after
 * it's set, and the input starts empty. "Leave blank to keep
 * current" is the pattern.
 */
export function EmailForm({
  initial,
  hasKey,
}: {
  initial: Record<string, string | boolean>;
  hasKey: boolean;
}) {
  const [provider] = useState((initial["email.provider"] as string) ?? "resend");
  const [apiKey, setApiKey] = useState("");
  const [fromEmail, setFromEmail] = useState(
    (initial["email.fromEmail"] as string) ?? "",
  );
  const [fromName, setFromName] = useState(
    (initial["email.fromName"] as string) ?? "",
  );
  const [replyTo, setReplyTo] = useState(
    (initial["email.replyToEmail"] as string) ?? "",
  );
  const [enabled, setEnabled] = useState(
    Boolean(initial["email.enabled"]),
  );

  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        "email.provider": provider,
        "email.fromEmail": fromEmail,
        "email.fromName": fromName,
        "email.replyToEmail": replyTo,
        "email.enabled": enabled,
      };
      // Only send the API key if the admin typed one — empty means
      // "leave the existing key alone".
      if (apiKey.trim()) body["email.resendApiKey"] = apiKey.trim();
      const res = await fetch("/api/admin/settings/email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "Save failed");
      } else {
        setSavedAt(Date.now());
        setApiKey("");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Provider</CardTitle>
            <CardDescription>
              Paste the API key from your email delivery provider. The sender
              domain must be verified with them before delivery works.
            </CardDescription>
          </CardHeader>
          <CardBody className="space-y-4">
            <Field
              label="API key"
              hint={
                hasKey
                  ? "Leave blank to keep the current key. Type a new one to replace it."
                  : "Starts with re_. Stored server-side only — the browser never sees it after save."
              }
            >
              <Input
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={hasKey ? "•••••••••••••••••••••" : "re_XXXXXXXX_XXXXXXXX"}
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="From email">
                <Input
                  type="email"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                  placeholder="no-reply@yourdomain.com"
                />
              </Field>
              <Field label="From name">
                <Input
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="WorldWeCare"
                />
              </Field>
            </div>
            <Field label="Reply-to (optional)">
              <Input
                type="email"
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
                placeholder="support@yourdomain.com"
              />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Delivery</CardTitle>
            <CardDescription>
              Master switch. When off, no emails go out — the app still
              logs the intent to Email Logs so you can see what would have
              been sent.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <div className="flex items-center justify-between rounded-[12px] bg-[color:var(--color-surface-muted)] px-4 py-3">
              <div>
                <p className="text-[14px] font-medium">Send emails</p>
                <p className="text-[12px] text-[color:var(--color-text-subtle)]">
                  {enabled ? "Deliveries are live." : "Deliveries are paused."}
                </p>
              </div>
              <Switch checked={enabled} onChange={setEnabled} label="Email delivery" />
            </div>
          </CardBody>
        </Card>
      </div>

      <SettingsFooter
        saving={saving}
        savedAt={savedAt}
        error={error}
        hint="You can test a template after saving."
      />
    </form>
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
