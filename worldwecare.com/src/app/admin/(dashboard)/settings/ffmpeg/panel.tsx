"use client";

/**
 * ffmpeg readiness panel.
 *
 * The probe runs a real test encode, so it is deliberately *not* run on
 * page load in the background — it is a button press with a visible
 * spinner. A check that quietly burns a second of CPU on every page
 * view is a check people learn to distrust.
 */

import { useCallback, useEffect, useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CheckState = "pass" | "fail" | "warn";

interface Check {
  id: string;
  label: string;
  state: CheckState;
  detail: string;
}

interface Status {
  ready: boolean;
  ffmpegPath: string | null;
  ffprobePath: string | null;
  origin: "env" | "managed" | "path" | null;
  version: string | null;
  checks: Check[];
  platform: { os: string; arch: string; node: string };
  installable: boolean;
  manualCommand: string;
  managedRoot: string;
  installedAt: string | null;
  archiveSha256: string | null;
  source: string | null;
  installing?: boolean;
}

interface InstallResult {
  ok: boolean;
  message: string;
  sha256?: string;
  version?: string | null;
}

const DOT: Record<CheckState, string> = {
  pass: "bg-[color:var(--color-brand)]",
  warn: "bg-[color:var(--color-warning)]",
  fail: "bg-[color:var(--color-danger)]",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          /* clipboard blocked — the text is on screen anyway */
        }
      }}
      className="shrink-0 rounded-[8px] border border-[color:var(--color-border)] px-2 py-1 text-[11.5px] font-medium text-[color:var(--color-text-muted)] transition-colors duration-200 hover:border-[color:var(--color-brand)] hover:text-[color:var(--color-text)]"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function FfmpegPanel({ canInstall }: { canInstall: boolean }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [checking, setChecking] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [result, setResult] = useState<InstallResult | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [expectedSha, setExpectedSha] = useState("");
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/ffmpeg", { cache: "no-store" });
      if (!res.ok) {
        setError("Could not run the check.");
        setStatus(null);
        return;
      }
      setStatus((await res.json()) as Status);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  const install = async () => {
    setInstalling(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/ffmpeg/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedSha256: expectedSha.trim() || undefined }),
      });
      const d = (await res.json().catch(() => ({}))) as InstallResult;
      setResult(d);
      if (d.ok) await check();
    } catch {
      setError("The install request failed. It may still be running — re-run the check in a minute.");
    } finally {
      setInstalling(false);
    }
  };

  const forget = async () => {
    await fetch("/api/admin/ffmpeg", { method: "DELETE" });
    await check();
  };

  const failing = status?.checks.filter((c) => c.state === "fail") ?? [];

  return (
    <div className="space-y-4">
      {/* ── headline ─────────────────────────────────────────── */}
      <Card>
        <CardBody className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span
                className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                  checking
                    ? "bg-[color:var(--color-surface-muted)] text-[color:var(--color-text-muted)]"
                    : status?.ready
                      ? "bg-[color:var(--color-brand)]/10 text-[color:var(--color-brand)]"
                      : "bg-[color:var(--color-danger)]/10 text-[color:var(--color-danger)]"
                }`}
              >
                {checking ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : status?.ready ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M12 7v6M12 16.5v.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                )}
              </span>
              <div>
                <p className="text-[17px] font-semibold tracking-[-0.01em]">
                  {checking
                    ? "Checking…"
                    : status?.ready
                      ? `ffmpeg is ready${status.version ? ` — version ${status.version}` : ""}`
                      : status?.ffmpegPath
                        ? "ffmpeg is installed but not usable"
                        : "ffmpeg is not installed"}
                </p>
                <p className="mt-0.5 text-[13px] text-[color:var(--color-text-muted)]">
                  {checking
                    ? "Running a one-second test encode."
                    : status?.ready
                      ? "Uploaded video can be converted to browser-playable MP4."
                      : `Video upload and conversion will fail until this is fixed.${
                          failing.length ? ` ${failing.length} check${failing.length > 1 ? "s" : ""} failing.` : ""
                        }`}
                </p>
              </div>
            </div>
            <Button variant="secondary" size="sm" loading={checking} onClick={check}>
              Re-run check
            </Button>
          </div>

          {status && (
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-[color:var(--color-border-soft)] pt-3 text-[12.5px] sm:grid-cols-4">
              <div>
                <dt className="text-[color:var(--color-text-subtle)]">Server</dt>
                <dd className="font-medium">{status.platform.os} / {status.platform.arch}</dd>
              </div>
              <div>
                <dt className="text-[color:var(--color-text-subtle)]">Node</dt>
                <dd className="font-medium">{status.platform.node}</dd>
              </div>
              <div>
                <dt className="text-[color:var(--color-text-subtle)]">Found via</dt>
                <dd className="font-medium">
                  {status.origin === "env"
                    ? "FFMPEG_PATH"
                    : status.origin === "managed"
                      ? "Managed install"
                      : status.origin === "path"
                        ? "System PATH"
                        : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[color:var(--color-text-subtle)]">Installed</dt>
                <dd className="font-medium">
                  {status.installedAt ? new Date(status.installedAt).toLocaleDateString() : "—"}
                </dd>
              </div>
            </dl>
          )}

          {error && (
            <p className="mt-3 rounded-xl bg-[color:var(--color-danger)]/10 px-3 py-2 text-[13px] text-[color:var(--color-danger)]">
              {error}
            </p>
          )}
        </CardBody>
      </Card>

      {/* ── checks ───────────────────────────────────────────── */}
      {status && status.checks.length > 0 && (
        <Card>
          <CardBody className="p-0">
            <ul className="divide-y divide-[color:var(--color-border-soft)]">
              {status.checks.map((c) => (
                <li key={c.id} className="flex gap-3 p-3.5 sm:px-5">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[c.state]}`} aria-hidden />
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-medium">
                      {c.label}
                      {c.state === "warn" && (
                        <span className="ml-2 rounded-full bg-[color:var(--color-warning)]/10 px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[color:var(--color-warning)]">
                          Warning
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 break-words font-mono text-[12px] text-[color:var(--color-text-muted)]">
                      {c.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      {/* ── install ──────────────────────────────────────────── */}
      {status && !status.ready && (
        <Card>
          <CardBody className="space-y-3 p-4 sm:p-5">
            <div>
              <p className="text-[15px] font-semibold tracking-[-0.01em]">Install it</p>
              <p className="mt-0.5 text-[13px] text-[color:var(--color-text-muted)]">
                {status.installable
                  ? "This downloads a statically linked build and unpacks it into the app's own folder. No root, nothing installed system-wide, and it only counts as done once a test encode passes."
                  : `No one-click build is published for ${status.platform.os}/${status.platform.arch}. Run the command below instead.`}
              </p>
            </div>

            {status.installable && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onClick={install}
                    loading={installing}
                    disabled={!canInstall || installing}
                  >
                    {installing ? "Installing…" : "Download and install ffmpeg"}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setAdvanced((a) => !a)}
                    className="text-[12.5px] font-medium text-[color:var(--color-text-muted)] hover:text-[color:var(--color-brand)]"
                  >
                    {advanced ? "Hide verification" : "Verify the download first"}
                  </button>
                </div>

                {!canInstall && (
                  <p className="text-[12.5px] text-[color:var(--color-text-muted)]">
                    Only an owner can run the install. Ask one to open this page, or run the command
                    below on the server yourself.
                  </p>
                )}

                {installing && (
                  <p className="text-[12.5px] text-[color:var(--color-text-muted)]">
                    Downloading around 80&nbsp;MB and unpacking it — this can take a couple of
                    minutes. Leave the page open.
                  </p>
                )}

                {advanced && (
                  <div className="space-y-2 rounded-xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)] p-3">
                    <p className="text-[12.5px] text-[color:var(--color-text-muted)]">
                      The publisher ships a rolling &ldquo;latest&rdquo; URL, so no digest can be
                      pinned in the code that stays correct. The download is fetched over HTTPS from
                      a fixed host, and its SHA-256 is always shown afterwards. To make that
                      end-to-end, paste the digest from the publisher&apos;s checksum page here
                      first — a mismatch aborts before anything is unpacked.
                    </p>
                    <Input
                      value={expectedSha}
                      onChange={(e) => setExpectedSha(e.target.value.trim())}
                      placeholder="Expected SHA-256 (64 hex characters) — optional"
                      className="font-mono text-[12.5px]"
                    />
                  </div>
                )}
              </>
            )}

            <div className="rounded-xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)] p-3">
              <p className="mb-1.5 text-[12px] font-medium text-[color:var(--color-text-muted)]">
                Or install it yourself on the server
              </p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 overflow-x-auto whitespace-pre rounded-[8px] bg-[color:var(--color-surface)] px-2.5 py-2 font-mono text-[12.5px]">
                  {status.manualCommand}
                </code>
                <CopyButton text={status.manualCommand} />
              </div>
              <p className="mt-1.5 text-[11.5px] text-[color:var(--color-text-subtle)]">
                Restart the app afterwards, then re-run the check.
              </p>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ── install result ───────────────────────────────────── */}
      {result && (
        <Card>
          <CardBody className="space-y-2 p-4 sm:p-5">
            <p
              className={`text-[13.5px] font-medium ${
                result.ok ? "text-[color:var(--color-brand)]" : "text-[color:var(--color-danger)]"
              }`}
            >
              {result.message}
            </p>
            {result.sha256 && (
              <div>
                <p className="text-[11.5px] text-[color:var(--color-text-subtle)]">
                  SHA-256 of the archive that was downloaded — compare it with the publisher&apos;s
                  checksum page.
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="min-w-0 flex-1 overflow-x-auto rounded-[8px] bg-[color:var(--color-surface-muted)] px-2.5 py-2 font-mono text-[11.5px]">
                    {result.sha256}
                  </code>
                  <CopyButton text={result.sha256} />
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* ── managed install details ──────────────────────────── */}
      {status?.installedAt && (
        <Card>
          <CardBody className="space-y-2 p-4 sm:p-5">
            <p className="text-[15px] font-semibold tracking-[-0.01em]">Managed install</p>
            <dl className="space-y-1.5 text-[12.5px]">
              <div>
                <dt className="text-[color:var(--color-text-subtle)]">Location</dt>
                <dd className="break-all font-mono">{status.managedRoot}</dd>
              </div>
              {status.source && (
                <div>
                  <dt className="text-[color:var(--color-text-subtle)]">Downloaded from</dt>
                  <dd className="break-all font-mono">{status.source}</dd>
                </div>
              )}
              {status.archiveSha256 && (
                <div>
                  <dt className="text-[color:var(--color-text-subtle)]">Archive SHA-256</dt>
                  <dd className="break-all font-mono">{status.archiveSha256}</dd>
                </div>
              )}
            </dl>
            {canInstall && (
              <div className="flex flex-wrap gap-2 pt-1">
                <Button variant="secondary" size="sm" loading={installing} onClick={install}>
                  Re-install / update
                </Button>
                <Button variant="secondary" size="sm" onClick={forget}>
                  Forget this install
                </Button>
              </div>
            )}
            <p className="text-[11.5px] text-[color:var(--color-text-subtle)]">
              Add <code className="font-mono">.ffmpeg/</code> to <code className="font-mono">.gitignore</code> — the
              binary is around 80&nbsp;MB and does not belong in the repository. A deploy that wipes
              untracked files will need this run again.
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
