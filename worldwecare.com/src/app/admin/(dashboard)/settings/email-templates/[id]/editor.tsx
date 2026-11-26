"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

interface TemplateData {
  id: string;
  slug: string;
  name: string;
  description: string;
  subject: string;
  previewText: string;
  htmlBody: string;
  textBody: string;
  variables: string[];
  enabled: boolean;
}

/**
 * Full template editor. Two-column on desktop (form + live preview),
 * stacked on mobile. "Send test" pushes a real email through the
 * with sample variable values so the admin can see what actually
 * lands in an inbox.
 */
export function TemplateEditor({ initial }: { initial: TemplateData }) {
  const [name, setName] = useState(initial.name);
  const [description, setDescription] = useState(initial.description);
  const [subject, setSubject] = useState(initial.subject);
  const [previewText, setPreviewText] = useState(initial.previewText);
  const [htmlBody, setHtmlBody] = useState(initial.htmlBody);
  const [textBody, setTextBody] = useState(initial.textBody);
  const [enabled, setEnabled] = useState(initial.enabled);

  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  // Sample values so the preview iframe isn't full of raw {{name}}
  // tokens.
  const sampleVars: Record<string, string> = useMemo(
    () => ({
      name: "Alex",
      email: "alex@example.com",
      siteName: "WorldWeCare",
      appUrl: "https://worldwecare.local",
      supportEmail: "support@worldwecare.local",
      confirmLink: "https://worldwecare.local/confirm/preview",
      resetLink: "https://worldwecare.local/reset/preview",
    }),
    [],
  );

  const rendered = useMemo(() => {
    return htmlBody.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, k) => {
      const v = sampleVars[k];
      return v ?? `{{${k}}}`;
    });
  }, [htmlBody, sampleVars]);

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/email-templates/${initial.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          subject,
          previewText,
          htmlBody,
          textBody,
          enabled,
        }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "Save failed");
      } else {
        setSavedAt(Date.now());
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const onTest = async () => {
    if (testing) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) {
      setTestResult("Enter a valid email address to send the test to.");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(
        `/api/admin/email-templates/${initial.id}/test`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: testEmail }),
        },
      );
      const d = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        status?: string;
      };
      if (!d.ok) {
        setTestResult(d.error ?? "Test send failed.");
      } else {
        setTestResult(`Sent to ${testEmail}. Check the inbox.`);
      }
    } catch {
      setTestResult("Network error.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <form onSubmit={onSave} className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-2 text-[12px]">
        <Link
          href="/admin/settings/email-templates"
          className="text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
        >
          ← All templates
        </Link>
        <span className="text-[color:var(--color-text-subtle)]">/</span>
        <code className="font-mono text-[11.5px] text-[color:var(--color-text-subtle)]">
          {initial.slug}
        </code>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 sm:gap-6">
        {/* Editor column */}
        <div className="xl:col-span-3 space-y-4 sm:space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basics</CardTitle>
              <CardDescription>
                What this template is for and whether it's active.
              </CardDescription>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Name">
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </Field>
                <div className="flex items-end">
                  <div className="flex items-center justify-between w-full rounded-[12px] bg-[color:var(--color-surface-muted)] px-4 h-11">
                    <span className="text-[13px] font-medium">
                      {enabled ? "Enabled" : "Disabled"}
                    </span>
                    <Switch
                      checked={enabled}
                      onChange={setEnabled}
                      label="Template enabled"
                    />
                  </div>
                </div>
              </div>
              <Field label="Description (admin only)">
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What triggers this email?"
                />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Subject &amp; preview</CardTitle>
              <CardDescription>
                Use {`{{variableName}}`} to insert values at send time.
              </CardDescription>
            </CardHeader>
            <CardBody className="space-y-4">
              <Field label="Subject line">
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </Field>
              <Field
                label="Preview text"
                hint="Little grey line under the subject in most inboxes."
              >
                <Input
                  value={previewText}
                  onChange={(e) => setPreviewText(e.target.value)}
                />
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>HTML body</CardTitle>
              <CardDescription>
                Available variables:{" "}
                {initial.variables.length > 0 ? (
                  initial.variables.map((v) => (
                    <code
                      key={v}
                      className="inline-block mr-1 mt-1 px-1.5 py-0.5 rounded bg-[color:var(--color-surface-muted)] text-[11.5px]"
                    >
                      {`{{${v}}}`}
                    </code>
                  ))
                ) : (
                  <span>No variables declared.</span>
                )}
              </CardDescription>
            </CardHeader>
            <CardBody className="space-y-4">
              <Textarea
                rows={16}
                value={htmlBody}
                onChange={(e) => setHtmlBody(e.target.value)}
                className="font-mono text-[12.5px] leading-[1.55]"
              />
              <Field label="Plain-text version (optional)">
                <Textarea
                  rows={5}
                  value={textBody}
                  onChange={(e) => setTextBody(e.target.value)}
                  placeholder="Fallback for email clients that block HTML."
                />
              </Field>
            </CardBody>
          </Card>
        </div>

        {/* Preview column */}
        <div className="xl:col-span-2 space-y-4 sm:space-y-6 xl:sticky xl:top-24 xl:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Live preview</CardTitle>
              <CardDescription>
                Rendered with sample values ({Object.keys(sampleVars).join(", ")}).
              </CardDescription>
            </CardHeader>
            <CardBody>
              <div className="mb-3">
                <p className="text-[11.5px] uppercase tracking-[0.08em] text-[color:var(--color-text-subtle)]">
                  Subject
                </p>
                <p className="text-[14px] font-medium mt-0.5">
                  {renderTemplate(subject, sampleVars)}
                </p>
              </div>
              <div className="rounded-[12px] border border-[color:var(--color-border)] overflow-hidden bg-[color:var(--color-surface)]">
                <iframe
                  srcDoc={rendered}
                  title="Preview"
                  sandbox=""
                  className="w-full h-[520px] block"
                />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Send a test</CardTitle>
              <CardDescription>
                Fires a real send through the delivery provider using the current values.
              </CardDescription>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onTest}
                  loading={testing}
                >
                  {testing ? "Sending…" : "Send test"}
                </Button>
              </div>
              {testResult && (
                <p
                  className={
                    testResult.startsWith("Sent")
                      ? "text-[12.5px] text-[color:var(--color-success)]"
                      : "text-[12.5px] text-[color:var(--color-danger)]"
                  }
                >
                  {testResult}
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <StickyFooter saving={saving} savedAt={savedAt} error={error} />
    </form>
  );
}

function renderTemplate(
  input: string,
  vars: Record<string, string>,
): string {
  return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, k) => {
    return vars[k] ?? `{{${k}}}`;
  });
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

function StickyFooter({
  saving,
  savedAt,
  error,
}: {
  saving: boolean;
  savedAt: number | null;
  error: string | null;
}) {
  return (
    <div className="sticky bottom-0 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 frost border-t border-[color:var(--color-border-soft)] flex items-center justify-between gap-3">
      <div className="text-[13px]">
        {error ? (
          <span className="text-[color:var(--color-danger)]">{error}</span>
        ) : savedAt ? (
          <span className="text-[color:var(--color-success)]">Saved.</span>
        ) : (
          <span className="text-[color:var(--color-text-subtle)]">
            Test sends stay live even if the template is disabled.
          </span>
        )}
      </div>
      <Button type="submit" loading={saving}>
        {saving ? "Saving…" : "Save template"}
      </Button>
    </div>
  );
}
