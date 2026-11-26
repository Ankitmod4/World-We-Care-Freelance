"use client";

/**
 * Streaming settings.
 *
 * Four sections, in the order someone actually sets this up:
 * connect to the media server, decide what a broadcaster may do,
 * decide what a new stream defaults to, decide how long recordings
 * live.
 *
 * ── THE TEST IS PROGRESSIVE ON PURPOSE ──
 *
 * One green tick that means "streaming works" is a lie waiting to
 * happen: a server can answer on 443 while its Control API is off,
 * and everything looks fine until the first recording silently
 * doesn't start. Three separate checks, each naming its own fix.
 */

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

interface HealthStep {
  step: "host" | "api" | "prefix";
  label: string;
  ok: boolean;
  detail: string | null;
}

interface Health {
  ok: boolean;
  configured: boolean;
  enabled: boolean;
  steps: HealthStep[];
  pathCount: number | null;
  sessionCount: number | null;
  checkedAt: string;
}

type Values = Record<string, string | number | boolean>;

export function StreamingPanel({ canEdit }: { canEdit: boolean }) {
  const [values, setValues] = useState<Values | null>(null);
  const [hasPass, setHasPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/settings/stream", { cache: "no-store" }).catch(() => null);
    if (!res?.ok) {
      setError("Couldn't load the streaming settings.");
      setValues({});
      return;
    }
    const d = (await res.json()) as { values: Values; hasPass: boolean };
    setValues(withDefaults(d.values ?? {}));
    setHasPass(d.hasPass);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const set = (key: string, value: string | number | boolean) =>
    setValues((v) => (v ? { ...v, [key]: value } : v));

  const save = async () => {
    if (!values) return;
    setSaving(true);
    setError(null);
    const body: Values = { ...values };
    // A password the admin didn't retype comes back masked; sending it
    // would overwrite the real one with bullets.
    if (typeof body["stream.apiPass"] === "string" && /^•/.test(body["stream.apiPass"])) {
      delete body["stream.apiPass"];
    }
    const res = await fetch("/api/admin/settings/stream", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      const d = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
      setError(d?.error ?? "Couldn't save.");
      return;
    }
    setFlash("Saved.");
    setTimeout(() => setFlash(null), 2500);
    await load();
  };

  const check = async () => {
    setChecking(true);
    setError(null);
    const res = await fetch("/api/admin/settings/stream", { method: "POST" }).catch(() => null);
    setChecking(false);
    if (!res?.ok) { setHealth(null); setError("The check itself failed."); return; }
    setHealth((await res.json()) as Health);
  };

  if (!values) {
    return <p className="text-[13px] text-[color:var(--color-text-subtle)]">Loading…</p>;
  }

  const enabled = values["stream.enabled"] === true;
  const retention = Number(values["stream.recordingRetentionDays"]) || 0;

  return (
    <div className="space-y-5">
      <Diagnostic health={health} enabled={enabled} checking={checking} onCheck={() => void check()} />

      {/* 1 ── Connection */}
      <Section
        title="Media server"
        intent="Where MediaMTX is, and how this app reaches it. Everything else on this page depends on these being right."
      >
        <ToggleRow
          label="Live streaming"
          hint={
            enabled
              ? "Members can go live, and the auth hook authorises streams normally."
              : "Nobody can go live, and the auth hook refuses every request — whatever the server below says."
          }
          checked={enabled}
          disabled={!canEdit}
          onChange={(v) => set("stream.enabled", v)}
        />

        <Field
          label="Public URL"
          hint="What a viewer's browser connects to for WHIP and HLS. Must be HTTPS — a browser will not hand over a camera to an insecure origin."
          placeholder="https://stream.worldwecare.com"
          value={values["stream.publicUrl"]}
          disabled={!canEdit}
          onChange={(v) => set("stream.publicUrl", v)}
        />
        <Field
          label="Path prefix"
          hint='Scopes every stream under one directory. Has to match the regex in mediamtx.yml — a prefix set here and not there means every broadcast is refused by the media server. Leave as "live/" unless you changed the config.'
          placeholder="live/"
          value={values["stream.pathPrefix"]}
          disabled={!canEdit}
          onChange={(v) => set("stream.pathPrefix", v)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Control API URL"
            hint="Reached by this server only, never by a browser. Starts and stops recording, and disconnects a broadcaster."
            placeholder="https://stream.worldwecare.com:9997"
            value={values["stream.apiUrl"]}
            disabled={!canEdit}
            onChange={(v) => set("stream.apiUrl", v)}
          />
          <Field
            label="Playback URL"
            hint="MediaMTX's playback server, for watching a recording back."
            placeholder="https://stream.worldwecare.com:9996"
            value={values["stream.playbackUrl"]}
            disabled={!canEdit}
            onChange={(v) => set("stream.playbackUrl", v)}
          />
          <Field
            label="Control API user"
            placeholder="wwc-api"
            value={values["stream.apiUser"]}
            disabled={!canEdit}
            onChange={(v) => set("stream.apiUser", v)}
          />
          <Field
            label="Control API password"
            hint={hasPass ? "Set — type to replace it." : "Stored on this server and never sent back to a browser."}
            secret
            value={values["stream.apiPass"]}
            disabled={!canEdit}
            onChange={(v) => set("stream.apiPass", v)}
          />
        </div>
        <Field
          label="Media server IPs"
          hint="Only these addresses may call the auth hook that authorises a stream. Comma-separated. Empty accepts any source — the token still has to be real, but leaving it open in production is a needless second chance for someone."
          placeholder="203.0.113.10"
          value={values["stream.allowedIps"]}
          disabled={!canEdit}
          onChange={(v) => set("stream.allowedIps", v)}
        />
      </Section>

      {/* 2 ── Limits */}
      <Section
        title="What a broadcaster may do"
        intent="Anyone can go live. These are the caps that apply when they do — copied onto each stream when it's created, so tightening them never cuts off a broadcast already running."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <NumberField
            label="Maximum length"
            suffix="min"
            hint="A broadcast is ended automatically at this point."
            value={values["stream.maxDurationMin"]}
            min={5}
            max={1440}
            disabled={!canEdit}
            onChange={(v) => set("stream.maxDurationMin", v)}
          />
          <NumberField
            label="Streams at once"
            hint="Per member."
            value={values["stream.maxConcurrentPerUser"]}
            min={1}
            max={10}
            disabled={!canEdit}
            onChange={(v) => set("stream.maxConcurrentPerUser", v)}
          />
          <NumberField
            label="Maximum height"
            suffix="px"
            hint="Handed to the browser's camera. 720 is plenty and costs a third of 1080's bandwidth."
            value={values["stream.maxHeight"]}
            min={240}
            max={2160}
            disabled={!canEdit}
            onChange={(v) => set("stream.maxHeight", v)}
          />
        </div>
      </Section>

      {/* 3 ── Defaults */}
      <Section
        title="What a new stream starts as"
        intent="The broadcaster can change visibility themselves; these are only the starting values."
      >
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-[color:var(--color-text-muted)]">
            Default visibility
          </span>
          <select
            value={String(values["stream.defaultVisibility"] ?? "PUBLIC")}
            disabled={!canEdit}
            onChange={(e) => set("stream.defaultVisibility", e.target.value)}
            className="h-10 w-full max-w-xs rounded-[10px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 text-[13.5px] disabled:opacity-50"
          >
            <option value="PUBLIC">Public — listed on /live</option>
            <option value="UNLISTED">Unlisted — only people with the link</option>
          </select>
          <span className="mt-1 block max-w-[70ch] text-[11.5px] leading-relaxed text-[color:var(--color-text-subtle)]">
            An unlisted stream is protected by an unguessable address, not by a check.
            Treat it as &ldquo;anyone with the link&rdquo;, not as private.
          </span>
        </label>

        <ToggleRow
          label="Require a verified email"
          hint={
            values["stream.requireEmailVerified"] === true
              ? "A member who hasn't confirmed their address can't go live. This is most of what stops a throwaway account broadcasting."
              : "Anyone with an account can go live, confirmed address or not."
          }
          checked={values["stream.requireEmailVerified"] === true}
          disabled={!canEdit}
          onChange={(v) => set("stream.requireEmailVerified", v)}
        />
        <ToggleRow
          label="Record every broadcast"
          hint={
            values["stream.autoRecord"] === true
              ? "Recording starts by itself. The broadcaster can still turn it off for their own stream."
              : "Nothing is recorded unless the broadcaster switches it on themselves."
          }
          checked={values["stream.autoRecord"] === true}
          disabled={!canEdit}
          onChange={(v) => set("stream.autoRecord", v)}
        />
      </Section>

      {/* 4 ── Retention */}
      <Section
        title="Recording retention"
        intent="How long a recording stays on the media server before it is deleted."
      >
        <div className="flex flex-wrap items-end gap-3">
          <NumberField
            label="Keep recordings for"
            suffix="days"
            hint={retention === 0 ? "Zero means keep them forever." : "Older recordings are deleted from the media server."}
            value={values["stream.recordingRetentionDays"]}
            min={0}
            max={3650}
            disabled={!canEdit}
            onChange={(v) => set("stream.recordingRetentionDays", v)}
          />
          <div className="flex gap-1.5 pb-1">
            {[0, 7, 30, 90, 365].map((d) => (
              <button
                key={d}
                type="button"
                disabled={!canEdit}
                onClick={() => set("stream.recordingRetentionDays", d)}
                className={`rounded-full border px-2.5 py-1 text-[12px] transition-colors disabled:opacity-50 ${
                  retention === d
                    ? "border-[color:var(--color-brand)] bg-[color:var(--color-brand-soft)] text-[color:var(--color-brand-ink)]"
                    : "border-[color:var(--color-border)] text-[color:var(--color-text-muted)] hover:border-[color:var(--color-brand)]"
                }`}
              >
                {d === 0 ? "Forever" : `${d}d`}
              </button>
            ))}
          </div>
        </div>
        {retention === 0 && (
          <Note>
            Recordings of people&apos;s live sessions kept indefinitely is a decision to
            take with whoever is responsible for member data, not a default to leave alone.
          </Note>
        )}
      </Section>

      {error && <p className="text-[12.5px] text-[color:var(--color-danger)]">{error}</p>}
      {flash && <p className="text-[12.5px] text-[color:var(--color-brand)]">{flash}</p>}

      {canEdit ? (
        <div className="sticky bottom-4 flex justify-end">
          <Button loading={saving} onClick={() => void save()}>Save changes</Button>
        </div>
      ) : (
        <p className="text-[12.5px] text-[color:var(--color-text-subtle)]">
          Moderators can see these settings but can&apos;t change them.
        </p>
      )}
    </div>
  );
}

/* ── the diagnostic ──────────────────────────────────────────── */

function Diagnostic({
  health,
  enabled,
  checking,
  onCheck,
}: {
  health: Health | null;
  enabled: boolean;
  checking: boolean;
  onCheck: () => void;
}) {
  return (
    <section className="rounded-[14px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[14px] font-semibold tracking-[-0.01em]">Connection</p>
          <p className="text-[12px] text-[color:var(--color-text-muted)]">
            {health
              ? health.ok
                ? "Everything answered."
                : "Something isn't answering — see below."
              : "Not checked yet."}
          </p>
        </div>
        <Button size="sm" variant="secondary" loading={checking} onClick={onCheck}>
          Test connection
        </Button>
      </div>

      {health && (
        <ol className="mt-3 space-y-1.5">
          {health.steps.map((s) => (
            <li key={s.step} className="flex items-start gap-2.5">
              <span
                aria-hidden
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${s.ok ? "bg-[color:var(--color-success)]" : "bg-[color:var(--color-danger)]"}`}
              />
              <div className="min-w-0">
                <p className="text-[13px] font-medium">{s.label}</p>
                {s.detail && (
                  <p className={`text-[12px] ${s.ok ? "text-[color:var(--color-text-subtle)]" : "text-[color:var(--color-danger)]"}`}>
                    {s.detail}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {!enabled && (
        <Note className="mt-3">
          Streaming is switched off, so members can&apos;t go live even when every check
          above is green.
        </Note>
      )}
    </section>
  );
}

/* ── small pieces ────────────────────────────────────────────── */

function Section({
  title,
  intent,
  children,
}: {
  title: string;
  intent: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[14px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
      <div className="border-b border-[color:var(--color-border-soft)] px-4 py-3">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
        <p className="mt-0.5 max-w-[72ch] text-[12.5px] leading-relaxed text-[color:var(--color-text-muted)]">
          {intent}
        </p>
      </div>
      <div className="space-y-4 p-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  placeholder,
  value,
  secret,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  placeholder?: string;
  value: unknown;
  secret?: boolean;
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-[color:var(--color-text-muted)]">
        {label}
      </span>
      <Input
        value={String(value ?? "")}
        placeholder={placeholder}
        disabled={disabled}
        type={secret ? "password" : "text"}
        autoComplete={secret ? "new-password" : "off"}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && (
        <span className="mt-1 block max-w-[72ch] text-[11.5px] leading-relaxed text-[color:var(--color-text-subtle)]">
          {hint}
        </span>
      )}
    </label>
  );
}

function NumberField({
  label,
  hint,
  suffix,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  suffix?: string;
  value: unknown;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-[color:var(--color-text-muted)]">
        {label}
      </span>
      <span className="flex items-center gap-2">
        <Input
          type="number"
          min={min}
          max={max}
          value={String(value ?? "")}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        {suffix && (
          <span className="shrink-0 text-[12.5px] text-[color:var(--color-text-subtle)]">
            {suffix}
          </span>
        )}
      </span>
      {hint && (
        <span className="mt-1 block max-w-[60ch] text-[11.5px] leading-relaxed text-[color:var(--color-text-subtle)]">
          {hint}
        </span>
      )}
    </label>
  );
}

/**
 * A setting you turn on or off.
 *
 * The same muted panel the Cache and Email settings use, and the
 * shared `Switch` rather than a hand-rolled track — that one is a real
 * button with `role="switch"`, a knob that moves, a focus ring and
 * keyboard support, none of which a bare styled checkbox had.
 *
 * The hint is written per state, not once: "Deliveries are live" and
 * "Deliveries are paused" tell you what IS, where a single sentence
 * describing the feature leaves you working out which way round the
 * switch is.
 */
function ToggleRow({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[12px] bg-[color:var(--color-surface-muted)] px-4 py-3">
      <div className="min-w-0">
        <p className="text-[14px] font-medium">{label}</p>
        <p className="mt-0.5 max-w-[70ch] text-[12px] leading-relaxed text-[color:var(--color-text-subtle)]">
          {hint}
        </p>
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} label={label} />
    </div>
  );
}

function Note({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p className={`rounded-[10px] bg-[color:var(--color-warning-soft)] px-3 py-2 text-[12.5px] leading-relaxed text-[color:var(--color-warning-ink)] ${className}`}>
      {children}
    </p>
  );
}

/**
 * Defaults for keys that have never been saved.
 *
 * Without these the number inputs render empty and a save would write
 * zeros over settings the admin never touched.
 */
function withDefaults(v: Values): Values {
  return {
    "stream.pathPrefix": "live/",
    "stream.maxDurationMin": 120,
    "stream.maxConcurrentPerUser": 1,
    "stream.maxHeight": 720,
    "stream.defaultVisibility": "PUBLIC",
    "stream.requireEmailVerified": true,
    "stream.autoRecord": false,
    "stream.recordingRetentionDays": 7,
    ...v,
  };
}
