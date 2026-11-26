"use client";

/**
 * Translations.
 *
 * TWO PANES, BECAUSE THERE ARE TWO JOBS. Which languages exist and are
 * switched on is a rare decision made once; correcting what Google
 * said is a long grind done a string at a time. Putting both in one
 * flat list would make the rare thing hard to find and the frequent
 * thing hard to stay in.
 *
 * GOOGLE FILLS THE BLANKS, A PERSON FIXES WHAT IT GOT WRONG. That is
 * the whole workflow, and the list is built around seeing the
 * difference: every row says where its text came from, the "Machine,
 * unchecked" filter is the queue somebody works through, and editing
 * a row marks it human and reviewed in one action because in practice
 * those are the same moment.
 *
 * MACHINE OUTPUT IS LIVE TO MEMBERS BEFORE ANYONE CHECKS IT. A rough
 * translation beats a sentence somebody cannot read at all. The page
 * does not hide that — it counts it, on every language row.
 *
 * SET-UP LIVES NEXT DOOR, at /admin/translations/settings: the Google
 * key, the switch that decides whether members see a language control
 * at all, the scan that reads new wording out of the code, and the
 * health check for member-written content. All four are things you
 * touch about twice a year, and all four used to sit above this list —
 * so the daily job started with a screen of configuration before it
 * reached the work.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

interface StringRow {
  id: string;
  key: string;
  english: string;
  context: string | null;
  value: string | null;
  source: "GOOGLE" | "HUMAN" | null;
  reviewed: boolean;
  stale: boolean;
}

type Filter = "all" | "missing" | "machine" | "reviewed" | "stale";

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "machine", label: "Machine, unchecked" },
  { value: "missing", label: "Missing" },
  { value: "stale", label: "English changed" },
  { value: "reviewed", label: "Checked" },
  { value: "all", label: "All" },
];

export function TranslationsClient() {
  const [locales, setLocales] = useState<LocaleRow[] | null>(null);
  const [totalStrings, setTotalStrings] = useState(0);
  const [configured, setConfigured] = useState(true);
  const [active, setActive] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);


  const [rows, setRows] = useState<StringRow[] | null>(null);
  const [filter, setFilter] = useState<Filter>("machine");
  const [q, setQ] = useState("");
  const [total, setTotal] = useState(0);

  const loadLocales = useCallback(async () => {
    const res = await fetch("/api/admin/translations/locales", { cache: "no-store" }).catch(
      () => null,
    );
    const d = (await res?.json().catch(() => ({}))) as {
      locales?: LocaleRow[];
      totalStrings?: number;
      configured?: boolean;
    };
    setLocales(d.locales ?? []);
    setTotalStrings(d.totalStrings ?? 0);
    setConfigured(d.configured !== false);
  }, []);

  useEffect(() => {
    void loadLocales();
  }, [loadLocales]);

  const loadStrings = useCallback(async () => {
    if (!active) return;
    setRows(null);
    const params = new URLSearchParams({ locale: active, filter, take: "100" });
    if (q.trim()) params.set("q", q.trim());
    const res = await fetch(`/api/admin/translations/strings?${params}`, {
      cache: "no-store",
    }).catch(() => null);
    const d = (await res?.json().catch(() => ({}))) as { rows?: StringRow[]; total?: number };
    setRows(d.rows ?? []);
    setTotal(d.total ?? 0);
  }, [active, filter, q]);

  useEffect(() => {
    void loadStrings();
  }, [loadStrings]);

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

  const activeLocale = locales?.find((l) => l.code === active) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] sm:text-[26px]">
            Translations
          </h1>
          <p className="mt-0.5 text-[13px] text-[color:var(--color-text-muted)]">
            Google fills the blanks. A person fixes what it got wrong. {totalStrings} strings in
            the catalogue.
          </p>
        </div>
        {/* The key, the member-facing switch and the code scan moved
            next door — this is the only signpost to them. */}
        <Link
          href="/admin/translations/settings"
          className="text-[13px] font-medium text-[color:var(--color-brand)] hover:underline"
        >
          Settings &rarr;
        </Link>
      </div>


      {error && (
        <p className="rounded-[10px] border border-[color:var(--color-danger)]/40 px-3 py-2 text-[13px] text-[color:var(--color-danger)]" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="rounded-[10px] border border-[color:var(--color-border-soft)] px-3 py-2 text-[13px] text-[color:var(--color-text-muted)]">
          {notice}
        </p>
      )}

      {/* ── languages ────────────────────────────────────────── */}
      <Card>
        <CardBody className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--color-border-soft)] px-4 py-3 sm:px-5">
            <div>
              <h2 className="text-[15px] font-semibold">Languages</h2>
              <p className="mt-0.5 text-[12.5px] text-[color:var(--color-text-muted)]">
                Only the switched-on ones appear in the member picker.
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              disabled={busy !== null || !configured}
              onClick={async () => {
                const d = await post(
                  "/api/admin/translations/locales",
                  { action: "sync" },
                  "sync",
                );
                if (d) {
                  setNotice(`${d.added} new language(s) added. ${d.total} available from Google.`);
                  void loadLocales();
                }
              }}
            >
              {busy === "sync" ? "Fetching…" : "Refresh from Google"}
            </Button>
          </div>

          {locales === null ? (
            <div className="p-5 text-[13px] text-[color:var(--color-text-muted)]">Loading…</div>
          ) : locales.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-[15px] font-medium">No languages yet</p>
              <p className="mx-auto mt-1 max-w-[46ch] text-[13.5px] text-[color:var(--color-text-muted)]">
                Press “Refresh from Google” to pull the list of everything it can translate into.
                Nothing is switched on until you say so.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[color:var(--color-border-soft)]">
              {locales.map((l) => {
                const pct = totalStrings ? Math.round((l.translated / totalStrings) * 100) : 0;
                return (
                  <li
                    key={l.code}
                    className={`flex flex-wrap items-center gap-3 p-3 sm:px-5 ${
                      active === l.code ? "bg-[color:var(--color-surface-muted)]" : ""
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => setActive(l.code)}
                        className="text-left text-[14.5px] font-semibold hover:text-[color:var(--color-brand)]"
                      >
                        {l.nativeName}
                      </button>
                      <span className="ml-2 text-[12.5px] text-[color:var(--color-text-subtle)]">
                        {l.name} · {l.code}
                      </span>
                      {l.direction === "RTL" && (
                        <span className="ml-2 rounded-full bg-[color:var(--color-surface-muted)] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
                          RTL
                        </span>
                      )}
                      <p className="mt-0.5 text-[11.5px] tabular-nums text-[color:var(--color-text-subtle)]">
                        {l.translated}/{totalStrings} translated ({pct}%) · {l.reviewed} checked
                        {l.stale > 0 && (
                          <span className="text-[color:var(--color-warning)]">
                            {" "}· {l.stale} need re-checking
                          </span>
                        )}
                      </p>
                      {/*
                        THE TRAP THIS CLOSES. A language switched on
                        with nothing translated puts a name in the
                        member's picker that does nothing when picked:
                        every string falls back to English, correctly,
                        and from the outside the site looks broken.
                        The row has to say so where the switch is, not
                        leave somebody to work it out from a
                        percentage.
                      */}
                      {l.isEnabled && l.translated === 0 && (
                        <p className="mt-1 text-[11.5px] font-medium text-[color:var(--color-warning-ink)]">
                          Live, but nothing is translated — members who pick it still see
                          English. Press “Fill gaps”.
                        </p>
                      )}
                    </div>

                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy !== null || !configured}
                      onClick={async () => {
                        const d = await post(
                          "/api/admin/translations/translate",
                          { locale: l.code },
                          `t-${l.code}`,
                        );
                        if (d) {
                          setNotice(`${l.name}: ${d.translated} translated by Google.`);
                          void loadLocales();
                          if (active === l.code) void loadStrings();
                        }
                      }}
                    >
                      {busy === `t-${l.code}` ? "Translating…" : "Fill gaps"}
                    </Button>

                    <label className="inline-flex cursor-pointer select-none items-center gap-2">
                      <input
                        type="checkbox"
                        checked={l.isEnabled}
                        disabled={busy !== null}
                        onChange={async (e) => {
                          const on = e.target.checked;
                          // Switching on an empty language is allowed
                          // — a half-translated language is meant to
                          // be switchable on — but it must be a
                          // decision somebody made rather than one
                          // they discover later from a bug report.
                          if (on && l.translated === 0 && totalStrings > 0) {
                            const go = window.confirm(
                              `Nothing is translated into ${l.name} yet.\n\n` +
                                "If you switch it on now, it appears in the member's language " +
                                "picker and anyone who chooses it still sees English until you " +
                                'press "Fill gaps".\n\nSwitch it on anyway?',
                            );
                            if (!go) {
                              e.target.checked = false;
                              return;
                            }
                          }
                          await post(
                            "/api/admin/translations/locales",
                            { code: l.code, isEnabled: on },
                            `e-${l.code}`,
                          );
                          void loadLocales();
                        }}
                      />
                      <span className="text-[13px]">Live</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* ── the strings ──────────────────────────────────────── */}
      {activeLocale && (
        <Card>
          <CardBody className="p-0">
            <div className="border-b border-[color:var(--color-border-soft)] px-4 py-3 sm:px-5">
              <h2 className="text-[15px] font-semibold">
                {activeLocale.nativeName}{" "}
                <span className="font-normal text-[color:var(--color-text-subtle)]">
                  · {total} shown
                </span>
              </h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {FILTERS.map((f) => (
                  <button
                    key={f.value}
                    type="button"
                    onClick={() => setFilter(f.value)}
                    className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                      filter === f.value
                        ? "bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)]"
                        : "bg-[color:var(--color-surface-muted)] text-[color:var(--color-text-muted)]"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <div className="mt-2">
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search the English or the key…"
                />
              </div>
            </div>

            {rows === null ? (
              <div className="p-5 text-[13px] text-[color:var(--color-text-muted)]">Loading…</div>
            ) : rows.length === 0 ? (
              <div className="p-8 text-center text-[13.5px] text-[color:var(--color-text-muted)]">
                Nothing here. {filter === "machine" && "Everything Google wrote has been checked."}
                {filter === "missing" && "This language is complete."}
              </div>
            ) : (
              <ul className="divide-y divide-[color:var(--color-border-soft)]">
                {rows.map((r) => (
                  <StringEditor
                    key={r.id}
                    row={r}
                    locale={activeLocale.code}
                    dir={activeLocale.direction === "RTL" ? "rtl" : "ltr"}
                    onSaved={() => {
                      void loadStrings();
                      void loadLocales();
                    }}
                  />
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

/**
 * One row, editable in place.
 *
 * The textarea carries the LANGUAGE'S OWN direction, so somebody
 * typing Arabic sees it laid out the way a reader will. Without that
 * the admin is the one place in the product where RTL text is shown
 * backwards.
 */
function StringEditor({
  row,
  locale,
  dir,
  onSaved,
}: {
  row: StringRow;
  locale: string;
  dir: "ltr" | "rtl";
  onSaved: () => void;
}) {
  const [value, setValue] = useState(row.value ?? "");
  const [busy, setBusy] = useState(false);
  const dirty = value.trim() !== (row.value ?? "").trim();

  const send = async (action?: "review") => {
    setBusy(true);
    await fetch("/api/admin/translations/strings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stringId: row.id, locale, value, action }),
    }).catch(() => null);
    setBusy(false);
    onSaved();
  };

  return (
    <li className="p-3 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px]">{row.english}</p>
          <p className="mt-0.5 font-mono text-[11px] text-[color:var(--color-text-subtle)]">
            {row.key}
            {row.context && ` · ${row.context}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {row.stale && (
            <span className="rounded-full bg-[color:var(--color-warning)]/12 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[color:var(--color-warning)]">
              English changed
            </span>
          )}
          {row.reviewed ? (
            <span className="rounded-full bg-[color:var(--color-success)]/12 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[color:var(--color-success)]">
              Checked
            </span>
          ) : row.source === "GOOGLE" ? (
            <span className="rounded-full bg-[color:var(--color-surface-muted)] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[color:var(--color-text-muted)]">
              Google
            </span>
          ) : row.source === "HUMAN" ? (
            <span className="rounded-full bg-[color:var(--color-brand)]/12 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[color:var(--color-brand)]">
              Person
            </span>
          ) : (
            <span className="rounded-full bg-[color:var(--color-danger)]/10 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[color:var(--color-danger)]">
              Missing
            </span>
          )}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-end gap-2">
        <textarea
          dir={dir}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={Math.min(4, Math.max(1, Math.ceil(value.length / 70)))}
          className="min-w-0 flex-1 rounded-[10px] border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)] px-3 py-2 text-[14px] outline-none focus-visible:border-[color:var(--color-brand)]"
          placeholder="Not translated yet"
        />
        <Button size="sm" disabled={busy || !dirty} onClick={() => void send()}>
          {busy ? "Saving…" : "Save"}
        </Button>
        {!row.reviewed && row.value && !dirty && (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void send("review")}>
            Looks right
          </Button>
        )}
      </div>
    </li>
  );
}
