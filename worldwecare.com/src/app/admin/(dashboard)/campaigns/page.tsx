import type { Metadata } from "next";
import Link from "next/link";
import { listAdminCampaigns, type CampaignStatusValue } from "@/lib/campaigns-admin";
import { listSelectableCategories } from "@/lib/campaign-categories";
import { CampaignReviewActions } from "./review-actions";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Img } from "@/components/ui/img";

export const metadata: Metadata = { title: "Campaigns" };
export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  PENDING: "bg-[color:var(--color-brand)]/12 text-[color:var(--color-brand)]",
  PUBLISHED: "bg-[color:var(--color-success)]/12 text-[color:var(--color-success)]",
  DRAFT: "bg-[color:var(--color-surface-muted)] text-[color:var(--color-text-muted)]",
  REJECTED: "bg-[color:var(--color-danger)]/10 text-[color:var(--color-danger)]",
  ARCHIVED: "bg-[color:var(--color-warning)]/10 text-[color:var(--color-warning)]",
};

/**
 * PENDING is first and is the default view.
 *
 * The queue is the only filter with somebody waiting on the other end
 * of it — a draft nobody has touched since March is not urgent, a
 * submission from this morning is. Landing on "everything" would mean
 * the one list that needs acting on is the one you have to go looking
 * for.
 *
 * UNCATEGORISED is a filter and not a status, because that is what it
 * is: the campaigns that predate categories, which no tile can reach.
 * It is here so the backlog has somewhere to be found rather than
 * being a number in a seed script's output nobody scrolls back to.
 */
const FILTERS: Array<{ value: string; label: string }> = [
  { value: "PENDING", label: "Waiting" },
  { value: "PUBLISHED", label: "Published" },
  { value: "DRAFT", label: "Drafts" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ARCHIVED", label: "Archived" },
  { value: "UNCATEGORISED", label: "Uncategorised" },
  { value: "ALL", label: "All" },
];

export default async function AdminCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const raw = sp.status && FILTERS.some((f) => f.value === sp.status) ? sp.status : "PENDING";
  const uncategorised = raw === "UNCATEGORISED";

  const [campaigns, categories] = await Promise.all([
    listAdminCampaigns({
      status: uncategorised ? "ALL" : (raw as CampaignStatusValue | "ALL"),
      uncategorised,
    }),
    listSelectableCategories(),
  ]);

  return (
    <div className="space-y-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] sm:text-[26px]">Campaigns</h1>
          <p className="mt-0.5 text-[13px] text-[color:var(--color-text-muted)]">
            One cause, one page. A campaign gathers articles, events and a chatroom that already
            exist — it never holds content of its own.
          </p>
        </div>
        <Link href="/admin/campaigns/new">
          <Button size="sm">New campaign</Button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/admin/campaigns?status=${f.value}`}
            className={`rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
              raw === f.value
                ? "bg-[color:var(--color-brand)] text-[color:var(--color-on-brand)]"
                : "bg-[color:var(--color-surface-muted)] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {campaigns.length === 0 ? (
        <Card>
          <CardBody className="p-10 text-center">
            {/* The list is filtered now, so "no campaigns yet" would be
                a lie on every view but ALL. */}
            <p className="text-[15px] font-medium">
              {raw === "PENDING"
                ? "Nothing waiting for review"
                : raw === "UNCATEGORISED"
                  ? "Every campaign has a category"
                  : "Nothing here"}
            </p>
            <p className="mt-1 text-[13.5px] text-[color:var(--color-text-muted)]">
              {raw === "PENDING"
                ? "Submissions from members land here."
                : raw === "UNCATEGORISED"
                  ? "Nothing is hidden from the tiles."
                  : "Try another filter, or start one for a cause you already have articles or events about."}
            </p>
            <Link href="/admin/campaigns/new">
              <Button size="sm" className="mt-4">New campaign</Button>
            </Link>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="p-0">
            <ul className="divide-y divide-[color:var(--color-border-soft)]">
              {campaigns.map((c) => (
                <li key={c.id} className="flex items-center gap-3 p-3 sm:px-5">
                  <div className="h-12 w-16 shrink-0 overflow-hidden rounded-[10px] bg-[color:var(--color-surface-muted)]">
                    {c.coverUrl ? (
                      <Img src={c.coverUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-[20px]">
                        {c.emoji ?? "📣"}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/campaigns/${c.id}`}
                      className="text-[14.5px] font-semibold hover:text-[color:var(--color-brand)]"
                    >
                      {c.title}
                    </Link>
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${
                        STATUS_TONE[c.status] ?? STATUS_TONE.DRAFT
                      }`}
                    >
                      {c.status}
                    </span>
                    {c.summary && (
                      <p className="mt-0.5 line-clamp-1 text-[12.5px] text-[color:var(--color-text-muted)]">
                        {c.summary}
                      </p>
                    )}
                    <p className="mt-0.5 text-[11.5px] tabular-nums text-[color:var(--color-text-subtle)]">
                      /{c.slug} · {c.supporterCount} supporter{c.supporterCount === 1 ? "" : "s"} ·{" "}
                      {c._count.articles} article{c._count.articles === 1 ? "" : "s"} ·{" "}
                      {c._count.events} event{c._count.events === 1 ? "" : "s"}
                      {c.submitterNameSnapshot ? ` · sent in by ${c.submitterNameSnapshot}` : ""}
                    </p>
                    <p className="mt-0.5 text-[11.5px]">
                      {c.category ? (
                        <span className="text-[color:var(--color-text-subtle)]">
                          {c.category.emoji ? `${c.category.emoji} ` : ""}
                          {c.category.name}
                        </span>
                      ) : (
                        /* Named on the row rather than left blank: a
                           missing category is the reason a published
                           campaign is unreachable, and "no category"
                           read as "not set yet" is how it stays that
                           way. */
                        <span className="font-medium text-[color:var(--color-danger)]">
                          No category{c.status === "PUBLISHED" ? " — under no tile" : ""}
                        </span>
                      )}
                    </p>
                  </div>
                  {c.status === "PENDING" ? (
                    <CampaignReviewActions
                      id={c.id}
                      categoryId={c.category?.id ?? null}
                      categories={categories}
                    />
                  ) : (
                    <Link href={`/admin/campaigns/${c.id}`}>
                      <Button variant="secondary" size="sm">Manage</Button>
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
