/**
 * Seed the starting live-stream categories.
 *
 * Choosing a category is REQUIRED to go live, so this is not optional
 * decoration — with an empty table nobody can start a broadcast at
 * all. Run it once after `prisma db push` and then manage the list
 * from /admin/live/categories.
 *
 * Idempotent: upserted by slug with an EMPTY `update`, so re-running
 * fills in anything missing and never overwrites a name, colour or
 * sort order an admin has since changed.
 *
 * Run:
 *   npm run db:seed-live-categories
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
    name: "Check-ins",
    emoji: "☕",
    color: "#0ea5e9",
    description: "Quiet company while you get on with your day.",
  },
  {
    name: "Recovery",
    emoji: "🌱",
    color: "#10b981",
    description: "Sobriety, milestones, and the ordinary days in between.",
  },
  {
    name: "Mental health",
    emoji: "💬",
    color: "#8b5cf6",
    description: "Talking honestly about how things actually are.",
  },
  {
    name: "Calm",
    emoji: "🕯️",
    color: "#64748b",
    description: "Meditation, breathing, sleep, winding down.",
  },
  {
    name: "Movement",
    emoji: "🏃",
    color: "#f59e0b",
    description: "Walks, workouts, stretching — anything that gets you up.",
  },
  {
    name: "Creative",
    emoji: "🎨",
    color: "#ec4899",
    description: "Drawing, writing, music, making something.",
  },
  {
    name: "Faith & spirituality",
    emoji: "🙏",
    color: "#6366f1",
    description: "Prayer, reflection, and shared practice.",
  },
  {
    name: "Ask me anything",
    emoji: "❓",
    color: "#14b8a6",
    description: "Open questions, lived experience, no script.",
  },
  {
    name: "Just chatting",
    emoji: "💭",
    color: "#94a3b8",
    description: "No particular subject. Somebody to talk to.",
  },
];

async function main() {
  console.log("Seeding live categories…");
  let created = 0;
  let kept = 0;

  for (const [i, c] of CATEGORIES.entries()) {
    const slug = slugify(c.name);
    const before = await prisma.liveCategory.findUnique({
      where: { slug },
      select: { id: true },
    });
    await prisma.liveCategory.upsert({
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

  const active = await prisma.liveCategory.count({ where: { isActive: true } });
  console.log(`\n  ${created} created, ${kept} already present.`);
  console.log(`  ${active} active — members can now choose one and go live.`);

  // Broadcasts that predate categories keep a null categoryId. They're
  // history, not something anyone browses, so there is deliberately no
  // backfill here — but say how many, so the number isn't a surprise
  // later in the admin list.
  const uncategorised = await prisma.liveStream.count({ where: { categoryId: null } });
  if (uncategorised > 0) {
    console.log(
      `  ${uncategorised} existing broadcast(s) have no category — they predate this feature and are left as they are.`,
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
