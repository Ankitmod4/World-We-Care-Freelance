import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/user-auth";
import { SiteShell } from "@/components/site/site-shell";
import { SiteHeader } from "@/components/site/site-header";
import { getT } from "@/lib/i18n";
import { donationReturnTo } from "@/lib/donation-return";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.donate.thanks.title", "Thank you"),
  };
}
export const dynamic = "force-dynamic";

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

/**
 * Where Stripe sends someone after a successful payment.
 *
 * ── THIS PAGE DOES NOT CREDIT ANYTHING ──
 *
 * The donation is recorded by the webhook, not by the browser landing
 * here. A page that credited on arrival could be triggered by anyone
 * opening the URL, and would silently miss every donor who closes the
 * tab before the redirect. All this does is read what's there.
 *
 * Which means the row may still say PENDING for a second or two —
 * Stripe's webhook and the browser redirect race, and the redirect
 * often wins. The copy says "confirming" rather than pretending, and
 * refreshes once shortly after.
 */
export default async function DonateThanksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getT();
  const sp = await searchParams;
  const raw = sp.session_id;
  const sessionId = (Array.isArray(raw) ? raw[0] : raw) ?? "";

  const [viewer, donation] = await Promise.all([
    getCurrentUser(),
    sessionId
      ? prisma.donation.findFirst({
          where: { stripeSessionId: sessionId },
          select: {
            grossCents: true,
            currency: true,
            status: true,
            causeTitleSnapshot: true,
            recipientNameSnapshot: true,
            // Not shown — read so "back" goes where they came from.
            campaignId: true,
            eventId: true,
          },
        })
      : Promise.resolve(null),
  ]);

  const settled = donation?.status === "SUCCEEDED";
  // Both pages used to offer "Back to events" whatever had been
  // donated to. See the note in `donation-return.ts`.
  const back = await donationReturnTo(donation);
  const cause = donation?.causeTitleSnapshot ?? donation?.recipientNameSnapshot ?? null;

  const body = (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-lg rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] p-8 text-center shadow-card">
        <div
          className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--color-success-soft)]"
          aria-hidden
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--color-success-ink)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>

        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{t("donate.thankYou", "Thank you")}</h1>

        {donation ? (
          <p className="mx-auto mt-2 max-w-[46ch] text-[14px] leading-relaxed text-[color:var(--color-text-muted)]">
            {t("donate.yourAmount", "Your {amount} donation", {
              amount: money(donation.grossCents),
            })}
            {cause ? <> to <strong className="text-[color:var(--color-text)]">{cause}</strong></> : null}{" "}
            {settled
              ? t("donate.settled", "has gone through. A receipt is on its way to your email.")
              : t(
                  "donate.pending",
                  "is being confirmed. It usually takes a few seconds \u2014 a receipt will follow by email.",
                )}
          </p>
        ) : (
          <p className="mx-auto mt-2 max-w-[46ch] text-[14px] leading-relaxed text-[color:var(--color-text-muted)]">
            {t("donate.pendingPlain", "Your donation is being confirmed. A receipt will follow by email.")}
          </p>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {viewer && (
            <Link
              href="/settings/donations"
              className="inline-flex h-10 items-center rounded-full bg-[color:var(--color-brand)] px-4 text-[13.5px] font-semibold text-[color:var(--color-on-brand)] transition-colors hover:bg-[color:var(--color-brand-hover)]"
            >
              {t("donate.seeYours", "See your donations")}
            </Link>
          )}
          <Link
            href={back.href}
            className="inline-flex h-10 items-center rounded-full border border-[color:var(--color-border)] px-4 text-[13.5px] font-medium text-[color:var(--color-text-muted)] transition-colors hover:border-[color:var(--color-brand)] hover:text-[color:var(--color-brand)]"
          >
            {/* Written out in full, one branch each: a computed key
                is invisible to `i18n:extract` and could never be
                translated. See the note in `donation-return.ts`. */}
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
