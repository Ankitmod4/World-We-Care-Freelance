import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/user-auth";
import { SiteShell } from "@/components/site/site-shell";
import { SiteHeader } from "@/components/site/site-header";
import { getT } from "@/lib/i18n";
import { prisma } from "@/lib/db";
import { donationReturnTo } from "@/lib/donation-return";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.donate.cancelled.title", "Donation cancelled"),
  };
}
export const dynamic = "force-dynamic";

/**
 * Where Stripe sends someone who backed out of checkout.
 *
 * Deliberately unbothered in tone. Someone who changed their mind
 * about giving money does not need to be talked out of it, and the
 * PENDING row they left behind is swept to FAILED by the
 * checkout.session.expired webhook rather than by anything here.
 */
export default async function DonateCancelledPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getT();
  const sp = await searchParams;
  const rawId = sp.d;
  const donationId = (Array.isArray(rawId) ? rawId[0] : rawId) ?? "";

  const [viewer, donation] = await Promise.all([
    getCurrentUser(),
    donationId
      ? prisma.donation
          .findUnique({
            where: { id: donationId },
            // Only what picks the link. Nothing about the money, the
            // donor or the recipient: this id arrives in a URL.
            select: { campaignId: true, eventId: true },
          })
          .catch(() => null)
      : Promise.resolve(null),
  ]);

  // "Back to events" was offered to everybody, including people who
  // had just backed out of a campaign.
  const back = await donationReturnTo(donation);

  const body = (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-lg rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-8 text-center shadow-card">
        <h1 className="text-[20px] font-semibold tracking-[-0.02em]">{t("donate.cancelled", "No donation was made")}</h1>
        <p className="mx-auto mt-2 max-w-[46ch] text-[14px] leading-relaxed text-[color:var(--color-text-muted)]">
          {t(
            "donate.cancelledBlurb",
            "You cancelled before paying, so nothing has been charged. You\u2019re welcome back any time.",
          )}
        </p>
        <div className="mt-6">
          <Link
            href={back.href}
            className="inline-flex h-10 items-center rounded-full border border-[color:var(--color-border)] px-4 text-[13.5px] font-medium text-[color:var(--color-text-muted)] transition-colors hover:border-[color:var(--color-brand)] hover:text-[color:var(--color-brand)]"
          >
            {/* Literal keys, one branch each — see the note in
                `donation-return.ts`. */}
            {back.kind === "campaign"
              ? t("donate.backCampaign", "Back to the campaign")
              : back.kind === "event"
                ? t("donate.backEvent", "Back to the event")
                : t("donate.backHome", "Back to WorldWeCare")}
          </Link>
        </div>
      </div>
    </div>
  );

  if (!viewer) {
    return (
      <>
        <SiteHeader user={null} />
        <main className="mx-auto w-full">{body}</main>
      </>
    );
  }
  return <SiteShell viewer={viewer}>{body}</SiteShell>;
}
