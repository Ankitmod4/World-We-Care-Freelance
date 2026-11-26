"use client";

/**
 * Translation settings — the things you set up once.
 *
 * ── WHY THIS IS A SEPARATE PAGE ──
 *
 * It all used to live above the language list on /admin/translations,
 * so the daily job — reading what Google wrote and fixing what it got
 * wrong — began with four cards of configuration that change perhaps
 * twice a year. The split is by HOW OFTEN, not by subject.
 *
 * ── WHY IT LOOKS LIKE THIS ──
 *
 * The first version was four full-width cards in a column, each one a
 * paragraph of text on the left and a lone button floated to the
 * right. On a wide monitor the middle half of every card was empty —
 * exactly the dead space DESIGN_RULES.md rule 1 exists to prevent —
 * and four cards of identical weight said nothing about which of them
 * mattered.
 *
 * Two things fixed it:
 *
 *   A STATUS ROW, because the page could not previously answer the
 *   only question anybody brings to it — "is this working?" — without
 *   pressing three buttons. Four numbers now answer it on load.
 *
 *   TWO COLUMNS ON WIDE SCREENS, grouped by what they are for: things
 *   you SET (the key, whether members get a language at all) beside
 *   things you CHECK (the code scan, the content cache). One column
 *   below `xl`, per rule 2.
 *
 * ── WHAT LOADS AND WHAT COSTS ──
 *
 * The status row is free: counting cached rows and asking whether a
 * key exists are two queries and no network. The PROBE — asking
 * Google to translate a word, which is the only way to find out that
 * a stored key is rejected — spends characters, so it stays behind a
 * button and is never run on page load.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface LocaleRow {
  code: string;
  name: string;
  nativeName: string;
  direction: "LTR" | "RTL";
  isEnabled: boolean;
  sortOrder: number;
  translated: number;
  reviewed: number;
  stale: number;
}

/** What POST /api/admin/translations/extract sends back. */
interface ExtractReport {
  sourceAvailable: boolean;
  scannedFiles: number;
  serverFiles: number;
  calls: number;
  strings: number;
  added: string[];
  changed: string[];
  removed: string[];
  collisions: Array<{ key: string; variants: Array<{ file: string; line: number; english: string }> }>;
  problems: Array<{ file: string; line: number; reason: string; excerpt: string }>;
  wrote: number;
  pruned: number;
  refused: string | null;
}

/** What GET /api/admin/translations/content sends back. */
interface ContentHealth {
  tableReady: boolean;
  rows: number;
  byLocale: Array<{ locale: string; rows: number }>;
  byKind: Array<{ kind: string; rows: number }>;
  configured: boolean;
  probe: { ok: boolean; message: string } | null;
  error: string | null;
}

/* ── small pieces ────────────────────────────────────────────── */

/**
 * The state of one thing, sitting on the thing itself.
 *
 * There was a row of four big status tiles above these cards, and it
 * had two problems. It repeated what the cards underneath already
 * said — "Set · Ending ••••keKY, saved here" appeared twice on one
 * screen — and four low-density boxes took 130px to carry four words.
 * A pill in the card header says the same thing beside the control
 * that changes it, and costs nothing.
 */
function Pill({
  tone = "plain",
  children,
}: {
  tone?: "plain" | "good" | "bad";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold tabular-nums",
        tone === "good" && "bg-[color:var(--color-success)]/12 text-[color:var(--color-success)]",
        tone === "bad" && "bg-[color:var(--color-danger)]/12 text-[color:var(--color-danger)]",
        tone === "plain" &&
          "bg-[color:var(--color-surface-muted)] text-[color:var(--color-text-muted)]",
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}

/** A small figure in a tinted tile — a locale and how much is cached. */
function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] bg-[color:var(--color-surface-muted)] px-3 py-2">
      <dt className="text-[11px] uppercase tracking-[0.06em] text-[color:var(--color-text-subtle)]">
        {label}
      </dt>
      <dd className="mt-0.5 text-[17px] font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * One settings card.
 *
 * `footer` is separated by a rule and holds the controls, so every
 * card ends the same way and the four of them read as one set rather
 * than four independent boxes — which is what a title with a button
 * floated to the far right looked like, with the middle of the card
 * empty between them.
 */
function Panel({
  title,
  pill,
  pillTone,
  blurb,
  tone = "plain",
  children,
  footer,
}: {
  title: string;
  pill?: string;
  pillTone?: "plain" | "good" | "bad";
  blurb: React.ReactNode;
  tone?: "plain" | "bad";
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col">
      <CardBody className="flex flex-1 flex-col p-5">
        <div className="flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3
              className={cn(
                "text-[15px] font-semibold tracking-[-0.01em]",
                tone === "bad" && "text-[color:var(--color-danger)]",
              )}
            >
              {title}
            </h3>
            {pill && <Pill tone={pillTone}>{pill}</Pill>}
          </div>
          {/*
            A measure, not a page cap. DESIGN_RULES rule 1 forbids
            `max-w-*` on CONTENT AREAS because it leaves a wide
            monitor half empty — the card itself still fills its
            column. This is the same rule's line-length exception
            applied one level down.
          */}
          <p className="mt-1.5 max-w-[68ch] text-[13px] leading-relaxed text-[color:var(--color-text-muted)]">
            {blurb}
          </p>
          {children}
        </div>
        {footer && (
          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[color:var(--color-border-soft)] pt-4">
            {footer}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
/**
 * Which kinds of member writing have ever been translated.
 *
 * ── WHY A LIST OF ZEROES IS THE USEFUL PART ──
 *
 * Everything in `content-translate.ts` fails softly: a loader that
 * throws costs its own kind and the page shows the original. So "chat
 * messages are not translating" and "every chat message is already in
 * your language" look identical from outside — and telling them apart
 * meant reading six files and still guessing.
 *
 * A kind with rows is working, provably. A kind with none either has
 * nothing to translate yet or is broken, and the server log says
 * which. Either way it is one glance rather than an afternoon.
 *
 * The ones with nothing are listed LAST and quietly, because on a
 * healthy site most of them are simply empty — nobody has read a
 * confession in Spanish yet — and a wall of red would train whoever
 * reads this to ignore it.
 */
function KindBreakdown({ rows }: { rows: Array<{ kind: string; rows: number }> }) {
  const [open, setOpen] = useState(false);
  if (!rows.length) return null;
  const working = rows.filter((r) => r.rows > 0);
  const empty = rows.filter((r) => r.rows === 0);

  return (
    <div className="mt-4 border-t border-[color:var(--color-border-soft)] pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-2 text-left text-[12.5px] text-[color:var(--color-text-muted)]"
      >
        <span>
          {working.length} of {rows.length} kinds have been translated at least once
        </span>
        <span className="text-[color:var(--color-text-subtle)]">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <ul className="flex flex-wrap gap-1.5">
            {working.map((r) => (
              <li
                key={r.kind}
                className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-surface-muted)] px-2.5 py-1 text-[12px]"
              >
                {r.kind}
                <span className="font-semibold tabular-nums">{r.rows.toLocaleString()}</span>
              </li>
            ))}
          </ul>
          {empty.length > 0 && (
            <p className="text-[12px] leading-relaxed text-[color:var(--color-text-subtle)]">
              Nothing cached yet for: {empty.map((r) => r.kind).join(", ")}. That is normal for
              anything nobody has read in another language. If something here is on a page you
              are watching stay English, the server log will have a line beginning
              &ldquo;[content-translate] the &hellip; loader failed&rdquo;.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ── the page ────────────────────────────────────────────────── */

export function TranslationSettingsClient() {
  const [locales, setLocales] = useState<LocaleRow[] | null>(null);
  const [totalStrings, setTotalStrings] = useState(0);
  const [configured, setConfigured] = useState(true);
  const [keySource, setKeySource] = useState<"database" | "environment" | "none">("none");
  const [keyHint, setKeyHint] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(true);
  // Write-only: the stored key never comes back to this page.
  const [keyDraft, setKeyDraft] = useState("");
  const [keyOpen, setKeyOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [scan, setScan] = useState<ExtractReport | null>(null);
  const [health, setHealth] = useState<ContentHealth | null>(null);

  const loadLocales = useCallback(async () => {
    const res = await fetch("/api/admin/translations/locales", { cache: "no-store" }).catch(
      () => null,
    );
    const d = (await res?.json().catch(() => ({}))) as {
      locales?: LocaleRow[];
      totalStrings?: number;
      configured?: boolean;
      source?: "database" | "environment" | "none";
      hint?: string | null;
      showPicker?: boolean;
    };
    setLocales(d.locales ?? []);
    setTotalStrings(d.totalStrings ?? 0);
    setConfigured(d.configured !== false);
    setKeySource(d.source ?? "none");
    setKeyHint(d.hint ?? null);
    setShowPicker(d.showPicker !== false);
  }, []);

  /**
   * The cheap half of the health check, on load.
   *
   * No `?probe=` — see the note at the top. Counting rows and asking
   * whether the table exists costs two queries; translating a word to
   * prove the key works costs money, and nobody asked for that by
   * opening a page.
   */
  const loadHealth = useCallback(async (probe?: string) => {
    const res = await fetch(
      `/api/admin/translations/content${probe ? `?probe=${probe}` : ""}`,
      { cache: "no-store" },
    ).catch(() => null);
    if (!res?.ok) return null;
    const d = (await res.json().catch(() => null)) as ContentHealth | null;
    if (d) setHealth(d);
    return d;
  }, []);

  useEffect(() => {
    void loadLocales();
    void loadHealth();
  }, [loadLocales, loadHealth]);

  /* Two of the moved buttons refreshed the string list after writing
     to it; that list lives on the other page now, so refreshing the
     counts is the honest equivalent. */
  const loadStrings = loadLocales;

  const post = async (url: string, body: unknown, label: string) => {
    setBusy(label);
    setError(null);
    setNotice(null);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const d = (await res?.json().catch(() => ({}))) as Record<string, unknown>;
    setBusy(null);
    if (!res?.ok) {
      setError(String(d.error ?? "That didn't work."));
      return null;
    }
    return d;
  };

  const live = locales?.filter((l) => l.isEnabled) ?? [];
  /** English is the source; a picker needs something to switch TO. */
  const others = live.filter((l) => l.code !== "en");
  const probeLocale = others[0]?.code ?? "";
  const tableBroken = health !== null && !health.tableReady;

  /**
   * The headline, in one line.
   *
   * It replaces a row of four status tiles. Nobody opens this page to
   * read four numbers — they open it to find out whether translation
   * is working, and if not, which part is broken. Every failure here
   * is silent by design (the site quietly shows English rather than
   * break a page), so this line is the only place it surfaces.
   */
  const headline: { text: string; bad: boolean } = !configured
    ? { text: "Machine translation is off — there is no Google Translate key.", bad: true }
    : tableBroken
      ? { text: "Member content is not being translated — the database is missing a table.", bad: true }
      : !showPicker
        ? { text: "The site is in English for everyone. Members are not offered a choice.", bad: false }
        : others.length === 0
          ? { text: "Set up and ready. English is the only language switched on so far.", bad: false }
          : {
              text: `Working. Members can read the site in ${others.length + 1} languages.`,
              bad: false,
            };

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] sm:text-[26px]">
            Translation settings
          </h1>
          <p
            className={cn(
              // `items-start` so the dot stays on the first line when
              // the sentence wraps on a phone, rather than floating
              // to the middle of two lines.
              "mt-1.5 flex items-start gap-2 text-[13.5px] leading-relaxed",
              headline.bad
                ? "text-[color:var(--color-danger)]"
                : "text-[color:var(--color-text-muted)]",
            )}
          >
            <span
              className={cn(
                "mt-[6px] h-2 w-2 shrink-0 rounded-full",
                headline.bad
                  ? "bg-[color:var(--color-danger)]"
                  : "bg-[color:var(--color-success)]",
              )}
              aria-hidden
            />
            {locales === null ? "Checking…" : headline.text}
          </p>
        </div>
        <Link
          href="/admin/translations"
          className="inline-flex min-h-11 items-center rounded-[10px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3.5 text-[13px] font-medium transition-colors duration-200 hover:border-[color:var(--color-border-strong)]"
        >
          Languages and strings &rarr;
        </Link>
      </header>

      {error && (
        <p
          className="rounded-[10px] border border-[color:var(--color-danger)]/40 px-3 py-2 text-[13px] text-[color:var(--color-danger)]"
          role="alert"
        >
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-[10px] border border-[color:var(--color-border-soft)] px-3 py-2 text-[13px] text-[color:var(--color-text-muted)]">
          {notice}
        </p>
      )}

      {/*
        Two columns on a wide screen, one below `xl` per rule 2. The
        pairing is by height, not by subject: the key and the string
        scan are the two that grow when you press something, so they
        sit in the same column and the short ones sit beside them
        rather than being stretched to match.
      */}
      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <Panel
            tone={configured ? "plain" : "bad"}
            title={configured ? "Google Translate key" : "No Google Translate key"}
            pill={configured ? "Set" : "Missing"}
            pillTone={configured ? "good" : "bad"}
            blurb={
              configured ? (
                keySource === "database" ? (
                  <>
                    Google bills per character translated. Keep the key restricted to the Cloud
                    Translation API in the Google console, so a copy of it cannot be spent on
                    anything else.
                  </>
                ) : (
                  <>
                    This one comes from the server environment. A key saved here overrides it,
                    and can be changed without a redeploy.
                  </>
                )
              ) : (
                <>
                  Everything else on this page works without it — you just cannot
                  machine-translate until one is set. Get a key from the Google Cloud console
                  with the Cloud Translation API switched on.
                </>
              )
            }
            footer={
              <>
                {configured && probeLocale && (
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={busy === "probe"}
                    onClick={async () => {
                      // The only way to learn that a stored key is
                      // rejected. It spends a few characters, which is
                      // why it is a button and not part of the load.
                      setBusy("probe");
                      setError(null);
                      setNotice(null);
                      await loadHealth(probeLocale);
                      setBusy(null);
                    }}
                  >
                    Test it
                  </Button>
                )}
                <Button size="sm" variant="secondary" onClick={() => setKeyOpen((v) => !v)}>
                  {keyOpen ? "Close" : configured ? "Replace" : "Add a key"}
                </Button>
                {configured && keyHint && !keyOpen && (
                  <span className="text-[12px] text-[color:var(--color-text-subtle)]">
                    Ending <code className="tabular-nums">{keyHint}</code>
                    {keySource === "database" ? ", saved here" : ", from the environment"}
                  </span>
                )}
              </>
            }
          >
            {health?.probe && (
              <p
                className={cn(
                  "mt-3 rounded-[10px] border px-3 py-2 text-[12.5px] leading-relaxed",
                  health.probe.ok
                    ? "border-[color:var(--color-border-soft)] text-[color:var(--color-text-muted)]"
                    : "border-[color:var(--color-danger)]/40 text-[color:var(--color-danger)]",
                )}
              >
                {health.probe.ok ? "The translator answered: " : "The translator refused: "}
                {health.probe.message}
              </p>
            )}

            {keyOpen && (
              <div className="mt-4 border-t border-[color:var(--color-border-soft)] pt-4">
                <label className="block">
                  <span className="mb-1 block text-[12.5px] font-medium">Google API key</span>
                  <Input
                    value={keyDraft}
                    onChange={(e) => setKeyDraft(e.target.value)}
                    placeholder="AIza…"
                    autoComplete="off"
                    spellCheck={false}
                    // A password field, not because anyone is
                    // shoulder-surfing, but because it keeps the value
                    // out of form autofill and browser history.
                    type="password"
                  />
                </label>
                <p className="mt-1.5 text-[12px] leading-relaxed text-[color:var(--color-text-subtle)]">
                  Stored in the platform settings table. It is never sent back to this page —
                  only the last four characters are, so you can tell one key from another.
                  Anyone with database or backup access can read it, so restrict the key to the
                  Cloud Translation API in the Google console.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    loading={busy === "key"}
                    disabled={!keyDraft.trim()}
                    onClick={async () => {
                      const d = await post(
                        "/api/admin/translations/locales",
                        { action: "key", apiKey: keyDraft },
                        "key",
                      );
                      if (!d) return;
                      setKeyDraft("");
                      setKeyOpen(false);
                      setNotice("Key saved.");
                      void loadLocales();
                      void loadHealth();
                    }}
                  >
                    Save key
                  </Button>
                  {keySource === "database" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={busy === "clearkey"}
                      onClick={async () => {
                        const d = await post(
                          "/api/admin/translations/locales",
                          { action: "key", apiKey: "" },
                          "clearkey",
                        );
                        if (!d) return;
                        setKeyDraft("");
                        setKeyOpen(false);
                        setNotice("Key removed.");
                        void loadLocales();
                        void loadHealth();
                      }}
                    >
                      Remove the stored key
                    </Button>
                  )}
                </div>
              </div>
            )}
          </Panel>

          <Panel
            title="The list of strings"
            pill={totalStrings ? `${totalStrings.toLocaleString()} strings` : undefined}
            blurb={
              <>
                Every sentence on the site is written in the code. This reads it and brings the
                list up to date, so new wording appears ready to be translated. Do it after any
                release that changed the site&apos;s words.
              </>
            }
            footer={
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={busy === "scan"}
                  onClick={async () => {
                    setScan(null);
                    const d = await post("/api/admin/translations/extract", {}, "scan");
                    if (d) setScan(d as unknown as ExtractReport);
                  }}
                >
                  Check the code
                </Button>
                <span className="text-[12px] text-[color:var(--color-text-subtle)]">
                  Reading the code changes nothing.
                </span>
              </>
            }
          >
            {scan && (
              <div className="mt-4 border-t border-[color:var(--color-border-soft)] pt-4">
                {!scan.sourceAvailable ? (
                  // The honest failure: a standalone build has no src/
                  // to read. Say that, rather than "0 strings found".
                  <p className="text-[13px] leading-relaxed text-[color:var(--color-danger)]">
                    {scan.refused}
                  </p>
                ) : (
                  <>
                    <p className="text-[13px] text-[color:var(--color-text-muted)]">
                      Read {scan.scannedFiles} files and found {scan.strings} strings.
                    </p>

                    {/*
                      THE TWO REFUSALS ARE SHOWN IN FULL, with file and
                      line, because they are a developer's job and the
                      admin's only useful action is to pass them on. A
                      count alone would make this page a dead end.
                    */}
                    {scan.collisions.length > 0 && (
                      <div className="mt-3 rounded-[10px] border border-[color:var(--color-danger)]/40 p-3">
                        <p className="text-[13px] font-semibold text-[color:var(--color-danger)]">
                          Two places use the same key for different wording
                        </p>
                        <ul className="mt-1.5 space-y-1.5 text-[12px] text-[color:var(--color-text-muted)]">
                          {scan.collisions.slice(0, 8).map((c) => (
                            <li key={c.key}>
                              <code>{c.key}</code>
                              {c.variants.map((v, i) => (
                                <span key={i} className="ml-2 block">
                                  {v.file}:{v.line} — {JSON.stringify(v.english)}
                                </span>
                              ))}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {scan.problems.length > 0 && (
                      <div className="mt-3 rounded-[10px] border border-[color:var(--color-danger)]/40 p-3">
                        <p className="text-[13px] font-semibold text-[color:var(--color-danger)]">
                          {scan.problems.length} string
                          {scan.problems.length === 1 ? "" : "s"} can never be translated
                        </p>
                        <p className="mt-1 text-[12px] leading-relaxed text-[color:var(--color-text-muted)]">
                          These build their key instead of writing it out, so they never reach
                          the list. Send this to whoever works on the code:
                        </p>
                        <ul className="mt-1.5 space-y-0.5 text-[12px] text-[color:var(--color-text-muted)]">
                          {scan.problems.slice(0, 8).map((pr, i) => (
                            <li key={i}>
                              <code>
                                {pr.file}:{pr.line}
                              </code>{" "}
                              — {pr.reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {!scan.refused && (
                      <>
                        <dl className="mt-3 grid grid-cols-3 gap-2">
                          <Figure label="new" value={String(scan.added.length)} />
                          <Figure label="reworded" value={String(scan.changed.length)} />
                          <Figure label="unused" value={String(scan.removed.length)} />
                        </dl>
                        <p className="mt-2 text-[12px] leading-relaxed text-[color:var(--color-text-subtle)]">
                          Reworded strings have their translations marked as needing another
                          look. Unused ones are kept, in case it is a temporary change.
                        </p>

                        {scan.wrote > 0 ? (
                          <p className="mt-3 text-[13px] leading-relaxed text-[color:var(--color-text-muted)]">
                            Updated. {scan.wrote} strings are in the list
                            {scan.pruned > 0 && `, and ${scan.pruned} were removed`}.{" "}
                            <Link
                              href="/admin/translations"
                              className="font-medium text-[color:var(--color-brand)] hover:underline"
                            >
                              Fill the gaps for each language
                            </Link>
                            .
                          </p>
                        ) : scan.added.length + scan.changed.length === 0 ? (
                          <p className="mt-3 text-[13px] text-[color:var(--color-text-muted)]">
                            Nothing to do — the list already matches the code.
                          </p>
                        ) : (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Button
                              size="sm"
                              loading={busy === "apply"}
                              onClick={async () => {
                                const d = await post(
                                  "/api/admin/translations/extract",
                                  { apply: true },
                                  "apply",
                                );
                                if (!d) return;
                                setScan(d as unknown as ExtractReport);
                                setNotice("The list is up to date.");
                                void loadLocales();
                                void loadStrings();
                              }}
                            >
                              Update the list
                            </Button>
                            <span className="text-[12px] text-[color:var(--color-text-subtle)]">
                              Nothing is translated by this.
                            </span>
                          </div>
                        )}

                        {/*
                          DELETING IS ITS OWN BUTTON and stays behind
                          the write. A key that has left the code takes
                          its translations with it, including ones a
                          person typed by hand — which is why "unused"
                          is kept by default and removing them is a
                          decision, not a side effect.
                        */}
                        {scan.removed.length > 0 && (
                          <div className="mt-4 border-t border-[color:var(--color-border-soft)] pt-3">
                            <p className="text-[12.5px] leading-relaxed text-[color:var(--color-text-muted)]">
                              {scan.removed.length} string
                              {scan.removed.length === 1 ? " is" : "s are"} in the list but no
                              longer anywhere in the site. Removing them also deletes their
                              translations, including any typed by hand — so only do it if you
                              are sure the wording is gone for good and not mid-change.
                            </p>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="mt-2 text-[color:var(--color-danger)]"
                              loading={busy === "prune"}
                              onClick={async () => {
                                if (
                                  !window.confirm(
                                    `Delete ${scan.removed.length} unused strings and their translations? This cannot be undone.`,
                                  )
                                )
                                  return;
                                const d = await post(
                                  "/api/admin/translations/extract",
                                  { apply: true, prune: true },
                                  "prune",
                                );
                                if (!d) return;
                                setScan(d as unknown as ExtractReport);
                                setNotice("Unused strings removed.");
                                void loadLocales();
                                void loadStrings();
                              }}
                            >
                              Remove the unused ones
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel
            title="Let members choose a language"
            pill={showPicker ? "Shown" : "Hidden"}
            pillTone={showPicker ? "good" : "bad"}
            blurb={
              showPicker ? (
                <>
                  Members see a globe in the header, pick a language, and the site reads in it.
                  Switching this off puts the whole site in English for everyone without
                  deleting anybody&apos;s choice.
                </>
              ) : (
                <>
                  The globe is hidden and the site is in English for everyone, including members
                  who had already picked another language. Nothing was deleted — switch this back
                  on and each member returns to the language they had picked.
                </>
              )
            }
            footer={
              /*
                A real checkbox with a label, not a styled div: this is
                the switch that decides what language the whole site is
                in, and it has to be reachable by keyboard and announce
                its state like any other control. `min-h-11` for the
                mobile tap target, per rule 2.
              */
              <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[13px] font-medium">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[color:var(--color-brand)]"
                  checked={showPicker}
                  disabled={busy === "picker"}
                  onChange={async (e) => {
                    const on = e.target.checked;
                    // Optimistic, then corrected from the response —
                    // the switch should move under the finger, not a
                    // moment after it.
                    setShowPicker(on);
                    const d = await post(
                      "/api/admin/translations/locales",
                      { action: "picker", on },
                      "picker",
                    );
                    if (!d) {
                      setShowPicker(!on);
                      return;
                    }
                    setShowPicker(d.showPicker !== false);
                    setNotice(
                      on
                        ? "Members can choose a language again."
                        : "The site is in English for everyone. No choices were deleted.",
                    );
                  }}
                />
                Show the language picker
              </label>
            }
          >
            {locales !== null &&
              (others.length === 0 ? (
                /*
                  The switch is on but there is nothing to switch TO.
                  The picker hides itself below two options, so an
                  admin could turn this on, see no globe, and
                  reasonably conclude the switch is broken.
                */
                <p className="mt-3 text-[13px] leading-relaxed text-[color:var(--color-text-muted)]">
                  Nothing is showing yet — English is the only language switched on, and a picker
                  with one option would do nothing.{" "}
                  <Link
                    href="/admin/translations"
                    className="font-medium text-[color:var(--color-brand)] hover:underline"
                  >
                    Turn a second language on
                  </Link>{" "}
                  and the globe appears.
                </p>
              ) : (
                <div className="mt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-text-subtle)]">
                    What members can choose
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {live.map((l) => (
                      <span
                        key={l.code}
                        className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-surface-muted)] px-2.5 py-1 text-[12.5px]"
                      >
                        {l.nativeName}
                        <span className="text-[color:var(--color-text-subtle)]">{l.code}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
          </Panel>

          <Panel
            tone={tableBroken ? "bad" : "plain"}
            title="What members write"
            pill={
              health === null
                ? undefined
                : health.tableReady
                  ? `${health.rows.toLocaleString()} cached`
                  : "Broken"
            }
            pillTone={tableBroken ? "bad" : "plain"}
            blurb={
              <>
                Posts, comments, events, categories, room names and the rest are translated as
                people read them, once each, and kept. Nothing to fill in — but if it stops
                working the site simply shows the English, quietly, so this says which.
              </>
            }
            footer={
              <Button
                size="sm"
                variant="secondary"
                loading={busy === "health"}
                onClick={async () => {
                  setBusy("health");
                  setError(null);
                  const d = await loadHealth(probeLocale || undefined);
                  setBusy(null);
                  if (!d) setError("Could not check.");
                }}
              >
                Check it
              </Button>
            }
          >
            {health && (
              <div className="mt-4">
                {/*
                  THE LIKELIEST FAULT, AND THE QUIETEST ONE: the schema
                  change was never applied on this server, so every
                  lookup throws and every page shows English. It is one
                  query to detect and one command to fix.
                */}
                {!health.tableReady ? (
                  <p className="text-[13px] leading-relaxed text-[color:var(--color-danger)]">
                    {health.error}
                  </p>
                ) : health.byLocale.length > 0 ? (
                  <>
                    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {health.byLocale.slice(0, 6).map((l) => (
                        <Figure key={l.locale} label={l.locale} value={l.rows.toLocaleString()} />
                      ))}
                    </dl>
                    <KindBreakdown rows={health.byKind ?? []} />
                  </>
                ) : (
                  <p className="text-[13px] leading-relaxed text-[color:var(--color-text-muted)]">
                    Nothing cached yet. That is normal until somebody reads a page in a language
                    other than English — it fills in as people browse.
                  </p>
                )}
                {!health.configured && health.tableReady && (
                  <p className="mt-2 text-[13px] text-[color:var(--color-danger)]">
                    No Google key, so nothing members write can be translated.
                  </p>
                )}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
