"use client";

/**
 * One petition, as a row on a list.
 *
 * Shared by /petitions and /petitions/category/[slug]. It lived inside
 * petitions-client until the category page needed the same row; a
 * second copy would have been a second place to fix every bug in it.
 */

import Link from "next/link";
import { Img } from "@/components/ui/img";
import type { PetitionCardDTO } from "./petitions-client";
import { useT } from "./locale-context";
import { TranslatedContent } from "./translated-content";

export function PetitionCard({ petition }: { petition: PetitionCardDTO }) {
  const t = useT();
  return (
    <Link
      href={`/petitions/${petition.slug}`}
      className={`group flex gap-4 overflow-hidden rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-4 shadow-card transition-shadow duration-200 hover:shadow-elevated ${
        petition.open ? "" : "opacity-75"
      }`}
    >
      {petition.coverUrl && (
        <div className="hidden h-24 w-32 shrink-0 overflow-hidden rounded-xl bg-[color:var(--color-surface-muted)] sm:block">
          <Img src={petition.coverUrl} alt="" className="h-full w-full object-cover" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-2 text-[11.5px] font-semibold uppercase tracking-wide text-[color:var(--color-text-subtle)]">
          <span>{t("petitionCard.to", "To {target}", { target: petition.target })}</span>
          {/*
            CLOSED HAS TO BE A WORD, not 75% opacity.
            A campaign card already carries a "Finished" pill for the
            same state; a petition said the same thing in a way a
            screen reader cannot read and a glance can miss, which is
            how somebody ends up opening a petition they cannot sign.
          */}
          {!petition.open && (
            <span className="inline-flex items-center rounded-full bg-[color:var(--color-surface-muted)] px-2 py-0.5 text-[10.5px] tracking-normal text-[color:var(--color-text-muted)]">
              {t("petitionCard.closed", "Closed")}
            </span>
          )}
          {/*
            Not a link. The whole card is one, and an anchor inside an
            anchor is invalid HTML — the category is a label here and a
            link on the petition's own page, where it can be one.
          */}
          {petition.category && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--color-surface-muted)] px-2 py-0.5 text-[10.5px] normal-case tracking-normal text-[color:var(--color-text-muted)]">
              {petition.category.emoji && <span aria-hidden>{petition.category.emoji}</span>}
              <TranslatedContent
                kind="petitionCategory"
                id={petition.category.id}
                field="name"
                text={petition.category.name}
                toggle={false}
              />
            </span>
          )}
        </p>
        <h2 className="mt-0.5 text-[16px] font-semibold leading-snug tracking-[-0.01em]">
          <TranslatedContent kind="petition" id={petition.id} field="title" text={petition.title} toggle={false} />
        </h2>
        {petition.summary && (
          <p className="mt-1 line-clamp-2 text-[13.5px] leading-relaxed text-[color:var(--color-text-muted)]">
            <TranslatedContent kind="petition" id={petition.id} field="summary" text={petition.summary} toggle={false} />
          </p>
        )}

        <div className="mt-2.5">
          <SignatureBar count={petition.signatureCount} goal={petition.goal} />
        </div>
      </div>
    </Link>
  );
}

/**
 * The count, and a bar only when there is a goal.
 *
 * A progress bar with no target is a decoration, and one stuck near
 * zero actively discourages the next signature — so a petition whose
 * creator set no goal simply states its number.
 */
export function SignatureBar({ count, goal }: { count: number; goal: number | null }) {
  const t = useT();
  const pct = goal && goal > 0 ? Math.min(100, (count / goal) * 100) : null;

  return (
    <div>
      <p className="text-[12.5px] text-[color:var(--color-text-muted)]">
        <span className="font-semibold tabular-nums text-[color:var(--color-text)]">
          {count.toLocaleString()}
        </span>{" "}
        {count === 1 ? t("petitions.signature", "signature") : t("petitions.signatures", "signatures")}
        {goal ? " " + t("petitions.ofGoal", "of {goal}", { goal: goal.toLocaleString() }) : ""}
      </p>
      {pct !== null && (
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[color:var(--color-surface-muted)]">
          <div
            className="h-full rounded-full bg-[color:var(--color-brand)] transition-[width] duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
