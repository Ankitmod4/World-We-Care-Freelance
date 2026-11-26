/**
 * Seed the starting campaign categories.
 *
 * Choosing one is REQUIRED to start a campaign, so this is not
 * optional decoration — with an empty table nobody can submit
 * anything at all, and `submitCampaign` will refuse every submission
 * with "Choose what this campaign is about."
 *
 * It does a second job too, and it is the reason these particular
 * names were chosen. An empty campaigns page showing "Housing &
 * homelessness · Mental health · Loneliness & connection" tells a
 * visitor what kind of thing people organise around here and what
 * they could start. An empty page tells them to leave. The categories
 * are the prompt, and now that members can submit, the prompt is the
 * point.
 *
 * WHY NOT THE PETITION LIST, which reads almost the same. A petition
 * is aimed at a body that can say yes, so those categories are the
 * areas such bodies have departments for. A campaign is a thing people
 * organise around: "Loneliness & connection" is something to organise
 * around and nothing to petition a council about, and "Transport" is
 * the reverse. The overlap is real; the cut is not the same.
 *
 * Run it once after `prisma db push`:
 *   npm run db:seed-campaign-categories
 *
 * Idempotent: upserted by slug with an EMPTY `update`, so re-running
 * fills in anything missing and never overwrites a name, colour or
 * sort order somebody has since changed.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

const CATEGORIES = [
  {
    name: "Housing & homelessness",
    emoji: "🏠",
    color: "#f59e0b",
    description: "Somewhere to live, and keeping the places that take people in.",
  },
  {
    name: "Health & care",
    emoji: "❤️",
    color: "#ef4444",
    description: "Getting seen, getting treated, and the people who do the caring.",
  },
  {
    name: "Mental health",
    emoji: "🧠",
    color: "#8b5cf6",
    description: "Crisis support, counselling, and talking about it out loud.",
  },
  {
    name: "Addiction & recovery",
    emoji: "🌱",
    color: "#10b981",
    description: "Meetings, harm reduction, and the road back.",
  },
  {
    name: "Food & poverty",
    emoji: "🍲",
    color: "#ec4899",
    description: "Food banks, warm rooms, and getting through the month.",
  },
  {
    name: "Children & schools",
    emoji: "🎒",
    color: "#84cc16",
    description: "What young people are offered, in school and out of it.",
  },
  {
    name: "Safety & justice",
    emoji: "🛡️",
    color: "#64748b",
    description: "Feeling safe where you live, and being treated fairly.",
  },
  {
    name: "Environment",
    emoji: "🌍",
    color: "#22c55e",
    description: "Air, water, green space, and what gets built on it.",
  },
  {
    name: "Disability & access",
    emoji: "♿",
    color: "#6366f1",
    description: "Being able to get in, get around, and take part.",
  },
  {
    name: "Loneliness & connection",
    emoji: "🤝",
    color: "#0ea5e9",
    description: "Company, belonging, and knowing somebody would notice.",
  },
  {
    name: "Money & debt",
    emoji: "💷",
    color: "#a16207",
    description: "Bills, benefits, and getting out from under it.",
  },
  {
    name: "Something else",
    emoji: "✨",
    color: "#0891b2",
    description: "Anything that doesn't fit the rest.",
  },
];

async function main() {
  console.log("Seeding campaign categories…");
  let created = 0;
  let kept = 0;

  for (const [i, c] of CATEGORIES.entries()) {
    const slug = slugify(c.name);
    const before = await prisma.campaignCategory.findUnique({
      where: { slug },
      select: { id: true },
    });
    await prisma.campaignCategory.upsert({
      where: { slug },
      create: {
        name: c.name,
        slug,
        description: c.description,
        emoji: c.emoji,
        color: c.color,
        sortOrder: i,
        isActive: true,
      },
      update: {},
    });
    if (before) {
      kept += 1;
    } else {
      created += 1;
      console.log(`  ✓ ${c.emoji}  ${c.name}`);
    }
  }

  const active = await prisma.campaignCategory.count({ where: { isActive: true } });
  console.log(`\n  ${created} created, ${kept} already present.`);
  console.log(`  ${active} active — members can now submit a campaign.`);

  // Campaigns that predate categories keep a null categoryId. A
  // finished one is history and nobody browses those by category, but
  // a LIVE one is invisible to every tile until somebody files it — so
  // the number is split into one you can act on and one you can't.
  const now = new Date();
  const [uncategorised, liveUncategorised] = await Promise.all([
    prisma.campaign.count({ where: { categoryId: null } }),
    prisma.campaign.count({
      where: {
        categoryId: null,
        status: "PUBLISHED",
        OR: [{ endsAt: null }, { endsAt: { gt: now } }],
      },
    }),
  ]);
  if (uncategorised > 0) {
    console.log(`  ${uncategorised} existing campaign(s) have no category.`);
  }
  if (liveUncategorised > 0) {
    console.log(
      `  ${liveUncategorised} of them are STILL LIVE and won't appear under any tile — ` +
        `set a category at /admin/campaigns (filter: Uncategorised).`,
    );
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
