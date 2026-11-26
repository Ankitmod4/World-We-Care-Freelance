/**
 * One milestone, as a chip — and the stat tile that sits beside it.
 *
 * Both are the small shared pieces of the progress design, in one file
 * because they only ever appear together: the profile's summary and
 * the /progress page draw the same two shapes and had grown two
 * versions of each.
 *
 * THE SHAPE IS BORROWED FROM DAZZLINGDISH deliberately. Its trophy
 * case and tier ladder solve the same problem this had — a wrapped
 * row of full-width pills reads as scattered, while a strip of even
 * chips reads as a set. What is NOT borrowed is the icon system: DD
 * resolves a FontAwesome definition and a colour class per badge;
 * WWC's milestones already carry an emoji, which needs no lookup
 * table and no bundle.
 *
 * A LOCKED CHIP IS GREY, NOT ABSENT. Somebody who has earned three of
 * fifteen should be able to see the other twelve — that is the part
 * that tells them what this place counts as worth doing.
 */

export function MilestoneChip({
  emoji,
  name,
  description,
  earned,
  size = "md",
}: {
  emoji: string;
  name: string;
  description?: string;
  earned: boolean;
  /** "sm" for the profile strip, "md" for a list row. */
  size?: "sm" | "md";
}) {
  const box = size === "sm" ? "h-8 w-8 text-[15px]" : "h-10 w-10 text-[18px]";
  return (
    <span
      // The whole thing is the tooltip: the name alone repeats what is
      // already written beside it in the list, and says nothing at all
      // in the profile strip where there is no label.
      title={description ? `${name} — ${description}` : name}
      aria-label={name}
      className={
        "inline-flex shrink-0 items-center justify-center rounded-[10px] leading-none ring-1 " +
        box +
        (earned
          ? " bg-[color:var(--color-brand-tint)] ring-[color:var(--color-border-soft)]"
          : " bg-[color:var(--color-surface-muted)] ring-[color:var(--color-border-soft)] opacity-45 grayscale")
      }
    >
      <span aria-hidden>{emoji}</span>
    </span>
  );
}

/**
 * A number with a word under it.
 *
 * Small, bordered, and always `tabular-nums` — these sit in rows of
 * two or three and a proportional digit makes them jitter against
 * each other as the numbers change.
 */
export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-[12px] border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] px-3 py-2">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-text-subtle)]">
        {label}
      </p>
      <p className="mt-0.5 text-[18px] font-semibold leading-tight tabular-nums">
        {value}
        {hint && (
          <span className="ml-1 text-[11px] font-normal text-[color:var(--color-text-subtle)]">
            {hint}
          </span>
        )}
      </p>
    </div>
  );
}
