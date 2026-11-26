"use client";

/**
 * Nominate a Town Hero — a page, not a dialog.
 *
 * IT WAS A MODAL AND THAT WAS WRONG. This form asks for a name, a
 * town, a category, a photo and several sentences about a person; a
 * dialog is for a decision, not for writing. On a phone the composed
 * keyboard left about two visible lines of the textarea, and there is
 * no way to link someone straight to a modal — "nominate her, here's
 * the link" is the most natural way this feature spreads and it could
 * not be done at all.
 *
 * The nominee is NOT looked up against the members table. The person
 * most worth nominating is often the one least likely to have an
 * account, and asking somebody to sign up before they can be thanked
 * would defeat the point.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SiteShell, type ShellViewer } from "./site-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PhotoAttach } from "./photo-attach";
import type { PublicHeroCategory } from "@/lib/town-hero-categories";
import { useT } from "./locale-context";
import { serverText } from "@/lib/i18n-core";

const LABEL = "mb-1 block text-[12.5px] font-medium text-[color:var(--color-text-muted)]";
const HINT = "mt-1 block text-[11.5px] text-[color:var(--color-text-subtle)]";

interface CountryOption {
  id: string;
  name: string;
  emojiFlag: string | null;
}

export function NominateHeroForm({
  viewer,
  categories,
}: {
  viewer: ShellViewer;
  categories: PublicHeroCategory[];
}) {
  const t = useT();
  const router = useRouter();
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [heroName, setHeroName] = useState("");
  const [town, setTown] = useState("");
  const [countryId, setCountryId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/public/geo/countries").catch(() => null);
      const d = (await res?.json().catch(() => ({ items: [] }))) as { items?: CountryOption[] };
      setCountries(d?.items ?? []);
    })();
  }, []);

  const submit = async () => {
    setError(null);
    setSaving(true);
    const res = await fetch("/api/user/town-heroes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        heroName,
        town: town || null,
        countryId: countryId || null,
        categoryId: categoryId || null,
        summary: summary || null,
        body,
        photoUrl,
        isAnonymous,
      }),
    }).catch(() => null);
    const d = (await res?.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    if (!res?.ok) {
      setError(serverText(t, d?.error) || t("nominate.failed", "Couldn't send that nomination."));
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <SiteShell viewer={viewer}>
        <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] px-5 py-12 text-center shadow-card">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--color-brand)]/10 text-[color:var(--color-brand)]">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <h1 className="text-[18px] font-semibold">
            {t("nominate.thanks", "Thank you — that's with our team")}
          </h1>
          <p className="mx-auto mt-1.5 max-w-[44ch] text-[13.5px] leading-relaxed text-[color:var(--color-text-muted)]">
            {t(
              "nominate.thanksBlurb",
              "A moderator reads every nomination before it goes up, so nobody is written about without a check first. You'll get a notification either way, and you can see it waiting on the Town Heroes page.",
            )}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <Button size="sm" onClick={() => router.push("/town-heroes")}>
              {t("nominate.back", "Back to Town Heroes")}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                // Somebody who thinks of one person often thinks of two.
                setDone(false);
                setHeroName("");
                setTown("");
                setSummary("");
                setBody("");
                setPhotoUrl(null);
              }}
            >
              {t("nominate.another", "Nominate someone else")}
            </Button>
          </div>
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell viewer={viewer}>
      <Link
        href="/town-heroes"
        className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path d="M12 4l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {t("nav.townHeroes", "Town Heroes")}
      </Link>

      <header className="mb-4">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{t("nominate.title", "Nominate a hero")}</h1>
        <p className="mt-0.5 max-w-[62ch] text-[13.5px] text-[color:var(--color-text-muted)]">
          {t(
            "nominate.subtitle",
            "Someone near you who quietly makes things better. They don't need an account here — most of them won't have one.",
          )}
        </p>
      </header>

      <div className="rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-5 shadow-card sm:p-6">
        <div className="space-y-4">
          <label className="block">
            <span className={LABEL}>{t("nominate.name", "Their name")}</span>
            <Input
              value={heroName}
              onChange={(e) => setHeroName(e.target.value)}
              placeholder={t("nominate.namePlaceholder", "Marie O'Donnell")}
              maxLength={120}
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={LABEL}>{t("nominate.town", "Town")}</span>
              <Input
                value={town}
                onChange={(e) => setTown(e.target.value)}
                placeholder={t("nominate.townPlaceholder", "Cork")}
                maxLength={120}
              />
              <span className={HINT}>{t("nominate.townHint", "Whatever people call it locally is fine.")}</span>
            </label>
            <label className="block">
              <span className={LABEL}>{t("common.country", "Country")}</span>
              <select
                value={countryId}
                onChange={(e) => setCountryId(e.target.value)}
                className="h-11 w-full rounded-[10px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 text-[14px] outline-none focus:border-[color:var(--color-brand)]"
              >
                <option value="">{t("common.anywhere", "Anywhere")}</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emojiFlag ? `${c.emojiFlag} ` : ""}
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/*
            Required. There is no "not sure" option any more, so the
            seed carries an "Anything else" category — a required
            picker with no right answer is a form somebody abandons,
            and the person they wanted to thank never gets thanked.
          */}
          <label className="block">
            <span className={LABEL}>{t("nominate.category", "What kind of thing do they do?")}</span>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="h-11 w-full rounded-[10px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 text-[14px] outline-none focus:border-[color:var(--color-brand)]"
            >
              <option value="">{t("common.chooseOne", "Choose one…")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji ? `${c.emoji} ` : ""}
                  {c.name}
                </option>
              ))}
            </select>
            {categories.length === 0 && (
              // Never silently unsubmittable: if an admin has retired
              // every category, say so rather than leaving somebody
              // clicking a dead button.
              <span className={HINT}>
                {t(
                  "nominate.noCategories",
                  "No categories are set up yet — an admin needs to add one before nominations can be sent.",
                )}
              </span>
            )}
          </label>

          <label className="block">
            <span className={LABEL}>{t("nominate.summary", "In one line")}</span>
            <Input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder={t("nominate.summaryPlaceholder", "Runs the Tuesday soup run, rain or shine.")}
              maxLength={400}
            />
            <span className={HINT}>{t("nominate.summaryHint", "This is what shows on their card.")}</span>
          </label>

          <label className="block">
            <span className={LABEL}>{t("nominate.body", "Why them?")}</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, 8000))}
              rows={8}
              placeholder={t("nominate.bodyPlaceholder", "What do they do, and what has it meant to people?")}
              className="w-full resize-y rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3.5 py-3 text-[14.5px] leading-relaxed outline-none focus:border-[color:var(--color-brand)]"
            />
            {/*
              The minimum only appears while it is unmet. "0/20
              characters minimum" under an empty box reads as a demand
              before you have typed anything, and leaving the counter
              up afterwards keeps nagging somebody who has already
              done what was asked.
            */}
            <span className={HINT}>
              {t("nominate.bodyHint", "A sentence or two is plenty.")}
              {body.trim().length > 0 && body.trim().length < 20
                ? " " +
                  t("nominate.bodyMore", "{n} more characters to go.", {
                    n: 20 - body.trim().length,
                  })
                : ""}
            </span>
          </label>

          <div>
            <span className={LABEL}>{t("nominate.photo", "A photo, if you have one")}</span>
            <PhotoAttach value={photoUrl} onChange={setPhotoUrl} />
            <span className={HINT}>
              {t(
                "nominate.photoHint",
                "Only if they'd be happy with it — a moderator will check before it goes up.",
              )}
            </span>
          </div>

          <label className="flex min-h-11 cursor-pointer items-start gap-2.5 text-[13.5px]">
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0 accent-[color:var(--color-brand)]"
            />
            <span>
              {t("nominate.anon", "Don't show my name on this")}
              <span className="block text-[11.5px] text-[color:var(--color-text-subtle)]">
                {t("nominate.anonHint", "Readers won't see who sent it. Moderators still can.")}
              </span>
            </span>
          </label>

          {error && <p className="text-[13px] text-[color:var(--color-danger)]">{error}</p>}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[color:var(--color-border-soft)] pt-4">
          <Button
            onClick={submit}
            loading={saving}
            disabled={!heroName.trim() || body.trim().length < 20 || !categoryId}
          >
            {t("nominate.send", "Send nomination")}
          </Button>
          <Link
            href="/town-heroes"
            className="inline-flex h-10 items-center rounded-[12px] px-4 text-sm text-[color:var(--color-text-muted)] hover:bg-[color:var(--color-surface-hover)]"
          >
            {t("common.cancel", "Cancel")}
          </Link>
          <p className="ml-auto text-[12px] text-[color:var(--color-text-subtle)]">
            {t("hero.reviewedFirst", "Reviewed before it appears.")}
          </p>
        </div>
      </div>
    </SiteShell>
  );
}
