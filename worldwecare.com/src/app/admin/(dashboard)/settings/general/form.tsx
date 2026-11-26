"use client";

import { useState } from "react";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SettingsFooter } from "@/components/admin/settings-footer";
import { ImageUpload } from "@/components/admin/image-upload";

/**
 * General settings — the identity of the site the community sees:
 * site name, tagline, description, logos (uploaded PNG/JPG,
 * SVG-as-string, plus a favicon), and the support address.
 *
 * Grouped into three cards so wide screens can show two-per-row and
 * mobile just stacks them. Save posts the whole form so the admin
 * doesn't need per-card Save buttons.
 */
export function GeneralForm({ initial }: { initial: Record<string, string> }) {
  const [siteName, setSiteName] = useState(initial["general.siteName"] ?? "");
  const [tagline, setTagline] = useState(initial["general.tagline"] ?? "");
  const [description, setDescription] = useState(initial["general.description"] ?? "");
  const [textLogo, setTextLogo] = useState(initial["general.textLogo"] ?? "");
  const [svgLogo, setSvgLogo] = useState(initial["general.svgLogo"] ?? "");
  const [logoUrl, setLogoUrl] = useState(initial["general.logoUrl"] ?? "");
  const [faviconUrl, setFaviconUrl] = useState(initial["general.faviconUrl"] ?? "");
  const [supportEmail, setSupportEmail] = useState(initial["general.supportEmail"] ?? "");

  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings/general", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          "general.siteName": siteName,
          "general.tagline": tagline,
          "general.description": description,
          "general.textLogo": textLogo,
          "general.svgLogo": svgLogo,
          "general.logoUrl": logoUrl,
          "general.faviconUrl": faviconUrl,
          "general.supportEmail": supportEmail,
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

  return (
    <form onSubmit={onSubmit} className="space-y-4 sm:space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Site identity</CardTitle>
            <CardDescription>
              How your community sees the site. Site name shows in the browser
              tab and every email.
            </CardDescription>
          </CardHeader>
          <CardBody className="space-y-4">
            <Field label="Site name">
              <Input
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                placeholder="WorldWeCare"
              />
            </Field>
            <Field label="Tagline">
              <Input
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="People helping people."
              />
            </Field>
            <Field label="Description" hint="Used in the <meta> description tag.">
              <Textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A calm place where anyone can quietly find support…"
              />
            </Field>
            <Field label="Support email" hint="Shown in transactional emails.">
              <Input
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                placeholder="support@yourdomain.com"
              />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Logo &amp; favicon</CardTitle>
            <CardDescription>
              Text logo is used when no image is set. SVG logo (inline markup)
              wins over the image if both are present.
            </CardDescription>
          </CardHeader>
          <CardBody className="space-y-4">
            <Field label="Text logo" hint="Used in the header when no image is set.">
              <Input
                value={textLogo}
                onChange={(e) => setTextLogo(e.target.value)}
                placeholder="WorldWeCare"
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ImageUpload
                label="Logo image"
                hint="PNG/JPG/WebP, transparent bg."
                category="logos"
                value={logoUrl}
                onChange={setLogoUrl}
                aspect="wide"
              />
              <ImageUpload
                label="Favicon"
                hint="16×16 or 32×32 .ico / .png"
                category="favicons"
                value={faviconUrl}
                onChange={setFaviconUrl}
                accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml"
              />
            </div>
            <Field label="SVG logo (inline markup)" hint="Paste the <svg>…</svg> code. Overrides the image logo.">
              <Textarea
                rows={4}
                value={svgLogo}
                onChange={(e) => setSvgLogo(e.target.value)}
                placeholder='<svg xmlns="http://www.w3.org/2000/svg" …>…</svg>'
                className="font-mono text-[12px]"
              />
            </Field>
          </CardBody>
        </Card>
      </div>

      <SettingsFooter
        saving={saving}
        savedAt={savedAt}
        error={error}
        hint="All changes save together."
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
