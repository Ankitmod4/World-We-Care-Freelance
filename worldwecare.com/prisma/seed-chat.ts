/**
 * Seed chat categories + rooms covering the topic list from
 * plan.docx, across the Public / Support / Crisis tiers.
 *
 * Idempotent: categories are upserted by slug; rooms are only
 * created when NO chat room exists yet, so re-running never spams a
 * live DB with duplicate rooms.
 *
 * Run:
 *   npm run db:seed-chat
 *
 * Requires `npm run db:seed` first (an admin user, used as the
 * room author — optional but nice for attribution).
 */

import { PrismaClient, ChatTier } from "@prisma/client";

const prisma = new PrismaClient();

function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

interface CategorySpec {
  name: string;
  sortOrder: number;
}

const CATEGORIES: CategorySpec[] = [
  { name: "Recovery & Sobriety", sortOrder: 0 },
  { name: "Mental Health & Support", sortOrder: 1 },
  { name: "Animals & Rescue", sortOrder: 2 },
  { name: "Community & Volunteering", sortOrder: 3 },
  { name: "Learning & Care", sortOrder: 4 },
  { name: "Causes & Action", sortOrder: 5 },
  { name: "Crisis", sortOrder: 6 },
];

interface RoomSpec {
  name: string;
  category: string; // category name
  tier: ChatTier;
  emoji: string;
  color: string;
  description: string;
  allowAnonymous?: boolean;
  isFeatured?: boolean;
}

const ROOMS: RoomSpec[] = [
  // Recovery & Sobriety
  {
    name: "Alcohol & Drug Recovery",
    category: "Recovery & Sobriety",
    tier: "SUPPORT",
    emoji: "🌱",
    color: "#059669",
    description: "A safe, judgment-free room for anyone in recovery or thinking about it. First posts are reviewed to keep it kind.",
    allowAnonymous: true,
    isFeatured: true,
  },
  {
    name: "Sober & Sober-Curious",
    category: "Recovery & Sobriety",
    tier: "PUBLIC",
    emoji: "🌿",
    color: "#10b981",
    description: "Building a social life without alcohol — meetups, milestones, and encouragement.",
  },
  // Mental Health & Support
  {
    name: "Anxiety & Depression",
    category: "Mental Health & Support",
    tier: "SUPPORT",
    emoji: "💙",
    color: "#0ea5e9",
    description: "Talk openly about the hard days. Peers who get it, no pressure to have answers.",
    allowAnonymous: true,
  },
  {
    name: "Meditation & Mindfulness",
    category: "Mental Health & Support",
    tier: "PUBLIC",
    emoji: "🧘",
    color: "#7c3aed",
    description: "Daily practice, guided sessions, and small moments of calm.",
  },
  {
    name: "Counseling & Therapy",
    category: "Mental Health & Support",
    tier: "SUPPORT",
    emoji: "🗣️",
    color: "#2563eb",
    description: "Share what's helped, ask about programs and clinics, find your next step.",
  },
  {
    name: "Family Abuse Recovery",
    category: "Mental Health & Support",
    tier: "SUPPORT",
    emoji: "🕊️",
    color: "#0284c7",
    description: "For survivors and those still in it. Anonymous by default. Moderated with care.",
    allowAnonymous: true,
  },
  // Animals & Rescue
  {
    name: "Animal Shelters & Rescue",
    category: "Animals & Rescue",
    tier: "PUBLIC",
    emoji: "🐾",
    color: "#f59e0b",
    description: "Foster, adopt, volunteer, or coordinate a rescue near you.",
  },
  // Community & Volunteering
  {
    name: "Volunteer Opportunities",
    category: "Community & Volunteering",
    tier: "PUBLIC",
    emoji: "🙌",
    color: "#0ea5e9",
    description: "Where can I help? Post your free hours and find local needs.",
  },
  {
    name: "Social Events & Meetups",
    category: "Community & Volunteering",
    tier: "PUBLIC",
    emoji: "🎉",
    color: "#ec4899",
    description: "Game nights, hikes, coffee meetups — real gatherings, real people.",
  },
  {
    name: "Food Banks",
    category: "Community & Volunteering",
    tier: "PUBLIC",
    emoji: "🥫",
    color: "#ef4444",
    description: "Donations, drives, and where to get help this week.",
  },
  // Learning & Care
  {
    name: "Elderly Care",
    category: "Learning & Care",
    tier: "PUBLIC",
    emoji: "🧓",
    color: "#8b5cf6",
    description: "Caregiving tips, companionship, and support for families.",
  },
  {
    name: "Disability & Impairment Support",
    category: "Learning & Care",
    tier: "SUPPORT",
    emoji: "♿",
    color: "#0891b2",
    description: "Accessibility, advocacy, and a community that has your back.",
  },
  {
    name: "Education & Academics",
    category: "Learning & Care",
    tier: "PUBLIC",
    emoji: "📚",
    color: "#3b82f6",
    description: "Tutoring, scholarships, mentoring, and staying in school.",
  },
  // Causes & Action
  {
    name: "Environment Cleanup",
    category: "Causes & Action",
    tier: "PUBLIC",
    emoji: "🌍",
    color: "#22c55e",
    description: "Local cleanups, sustainability, and taking care of our shared home.",
  },
  {
    name: "Fundraising & Charity",
    category: "Causes & Action",
    tier: "PUBLIC",
    emoji: "💛",
    color: "#eab308",
    description: "Rally support for a cause, share a fundraiser, coordinate giving.",
  },
  // Crisis
  {
    name: "Crisis Line",
    category: "Crisis",
    tier: "CRISIS",
    emoji: "🚨",
    color: "#dc2626",
    description: "For someone in immediate distress. Trained peer supporters respond. Panic button + on-call rotation coming soon.",
    allowAnonymous: true,
    isFeatured: true,
  },
];

async function main() {
  // Upsert categories (safe to re-run).
  for (const c of CATEGORIES) {
    const slug = slugify(c.name);
    await prisma.chatCategory.upsert({
      where: { slug },
      update: { name: c.name, sortOrder: c.sortOrder },
      create: { name: c.name, slug, sortOrder: c.sortOrder },
    });
  }
  const cats = await prisma.chatCategory.findMany();
  const catId = (name: string) => cats.find((c) => c.slug === slugify(name))?.id ?? null;

  const existingRooms = await prisma.chatRoom.count();
  if (existingRooms > 0) {
    console.log(
      `Categories upserted (${cats.length}). ${existingRooms} chat room(s) already exist — skipping room seed.`,
    );
    return;
  }

  const admin = await prisma.adminUser.findFirst({ select: { id: true } });

  let created = 0;
  for (let i = 0; i < ROOMS.length; i++) {
    const r = ROOMS[i];
    await prisma.chatRoom.create({
      data: {
        name: r.name,
        slug: slugify(r.name),
        description: r.description,
        tier: r.tier,
        status: "ACTIVE",
        categoryId: catId(r.category),
        emoji: r.emoji,
        color: r.color,
        allowAnonymous: r.allowAnonymous ?? true,
        isFeatured: r.isFeatured ?? false,
        sortOrder: i,
        createdByAdminId: admin?.id ?? null,
      },
    });
    created += 1;
  }

  console.log(`Done. ${cats.length} categories · ${created} chat rooms seeded.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
