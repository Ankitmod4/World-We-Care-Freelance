/**
 * Where "back" goes after a donation.
 *
 * ── WHY IT IS NOT JUST A LINK ON THE PAGE ──
 *
 * Both the thank-you and the cancelled page said "Back to events" and
 * pointed at `/events`, because when they were written an event was
 * the only thing anybody could donate to. Donations now come from
 * campaigns and live broadcasts too, so somebody who gave to a
 * campaign finished on a page offering to take them to a list of
 * events they had not asked about.
 *
 * The donation row already records what it was for. Reading it is
 * both correct and better than the old link ever was: it goes back to
 * the actual campaign, not a list.
 *
 * ── THE ROW MAY OUTLIVE WHAT IT POINTS AT ──
 *
 * `eventId` and `campaignId` are loose foreign keys on purpose — see
 * the note on the model — so the thing donated to can be deleted
 * while the donation, which is money that really moved, stays. Every
 * lookup here can legitimately find nothing, and the answer then is
 * the front page rather than a link to a 404.
 *
 * A LIVE BROADCAST HAS NO ROW OF ITS OWN. It resolves its recipient
 * and title at checkout and stores neither an id, so it lands on the
 * front page with everything else that cannot be traced back. That is
 * the honest answer rather than a wrong one: by the time somebody has
 * finished paying, the broadcast they were watching has often ended,
 * and a link back to a dead stream is worse than a link home.
 */
import { prisma } from "./db";

/**
 * A DISCRIMINANT, NOT A CATALOGUE KEY.
 *
 * The first version of this returned `{ key, english }` for the page
 * to pass straight to `t()`. That is a computed key: it typechecks,
 * it runs, and `i18n:extract` cannot see it — so those three strings
 * would never have entered the catalogue and "Back to the campaign"
 * would have stayed English in every language, for ever, with
 * nothing anywhere reporting it. The same mistake cost an afternoon
 * in `time-ago.ts`.
 *
 * So the caller switches on this and writes each `t("…", "…")` out in
 * full, where the scanner can read it.
 */
export type ReturnKind = "campaign" | "event" | "home";

export interface ReturnTo {
  href: string;
  kind: ReturnKind;
}

const HOME: ReturnTo = { href: "/", kind: "home" };

export async function donationReturnTo(
  donation: { campaignId?: string | null; eventId?: string | null } | null,
): Promise<ReturnTo> {
  if (!donation) return HOME;

  if (donation.campaignId) {
    const c = await prisma.campaign
      .findUnique({ where: { id: donation.campaignId }, select: { slug: true, status: true } })
      .catch(() => null);
    // Unpublished since the donation: the page would 404 or show a
    // moderation notice to a stranger. Home is kinder than either.
    if (c?.slug && c.status === "PUBLISHED") {
      return { href: `/campaigns/${c.slug}`, kind: "campaign" };
    }
  }

  if (donation.eventId) {
    const e = await prisma.event
      .findUnique({ where: { id: donation.eventId }, select: { slug: true, status: true } })
      .catch(() => null);
    if (e?.slug && e.status === "APPROVED") {
      return { href: `/events/${e.slug}`, kind: "event" };
    }
  }

  return HOME;
}
