/**
 * Seed six petitions.
 *
 * WHY SIX AND NOT THREE. Every state the UI can be in needs one row
 * behind it, or the screens that render those states go untested until
 * a real member happens to produce one:
 *
 *   • APPROVED with a goal        → the progress bar
 *   • APPROVED with no goal       → the bare count, no bar
 *   • APPROVED near its goal      → a bar that is nearly full
 *   • APPROVED, all signatures anonymous → "everyone chose not to
 *                                          show their name", which is
 *                                          a different empty state
 *                                          from "nobody yet"
 *   • PENDING                     → the admin queue, and the author's
 *                                   own "waiting for review" banner
 *   • CLOSED                      → the Closed section on the index
 *
 * Lisa's food-bank petition is the one from plan.docx §3 — the college
 * student who bundles a blog post, a petition and a fundraiser. It is
 * seeded with the signature count the plan describes so the campaign
 * page has something real to point at.
 *
 * Idempotent: petitions upsert by slug and signatures upsert by their
 * composite key, so re-running never duplicates and never resets a
 * count someone has since added to.
 *
 * Run:
 *   npm run db:seed-petitions
 *
 * Users come from the same demo cast as the community-wall seed, and
 * are created here if that seed has not been run.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SEED_USERS = [
  { email: "sarah@wwc.demo", displayName: "Sarah" },
  { email: "mike@wwc.demo", displayName: "Mike" },
  { email: "lisa@wwc.demo", displayName: "Lisa" },
  { email: "jamal@wwc.demo", displayName: "Jamal" },
  { email: "priya@wwc.demo", displayName: "Priya" },
  { email: "diego@wwc.demo", displayName: "Diego" },
];

function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);
}

const days = (n: number) => new Date(Date.now() + n * 86_400_000);

interface SignatureSpec {
  email: string;
  comment?: string;
  anonymous?: boolean;
}

interface PetitionSpec {
  title: string;
  target: string;
  summary: string;
  body: string;
  goal?: number;
  closesAt?: Date;
  status?: "PENDING" | "APPROVED" | "CLOSED";
  /**
   * A PetitionCategory slug. Required, exactly as it is for a real
   * submission — a seed that could produce a petition the app cannot
   * would be seeding a state to debug later.
   *
   * Resolved at run time. If the category seed has not been run the
   * petition is still written, WITHOUT a category, and the run says
   * so loudly: a seed that silently half-worked is worse than one
   * that refuses.
   */
  categorySlug: string;
  creatorEmail: string;
  countryCode?: string;
  signatures: SignatureSpec[];
  /**
   * Extra signatures with no named person behind them, to make a count
   * look like a real one. Created as anonymous rows against generated
   * placeholder users so `count(signatures)` and `signatureCount`
   * still agree — a seeded number that does not match its own rows
   * would be a lie about the one thing this feature guarantees.
   */
  padding?: number;
}

const PETITIONS: PetitionSpec[] = [
  {
    // plan.docx §3 — Lisa's journey, seeded so the story in the plan
    // is a page you can actually open.
    title: "Fund the three food banks on the north side",
    categorySlug: "food-and-poverty",
    target: "Springfield City Council",
    summary:
      "Three food banks serving the north side have run out of stock twice this year. We are asking the council to fund them properly.",
    creatorEmail: "lisa@wwc.demo",
    goal: 1000,
    countryCode: "US",
    padding: 796,
    body: [
      "## What's happening",
      "",
      "Three food banks serve the north side of the city. Between them they fed **just over 4,000 people** last year. Twice since January, all three have run out of stock in the same week.",
      "",
      "When that happens, the people who are turned away are not turned away for a day. They are turned away until the next delivery, which is a fortnight.",
      "",
      "### What we are asking for",
      "",
      "1. A recurring line in the city budget for the three north-side food banks, rather than the one-off grants they currently apply for each year.",
      "2. A named contact at the council so the volunteers running them are not calling a switchboard when they run out.",
      "3. Publication of the stock figures, so nobody has to take our word for any of this.",
      "",
      "### Why now",
      "",
      "The budget is set in the spring. A decision made then holds for the year. Every week this waits is a week closer to the point where saying it changes nothing.",
      "",
      "If you have used one of these food banks, or given to one, or driven past the queue outside one — please add your name.",
    ].join("\n"),
    signatures: [
      { email: "priya@wwc.demo", comment: "I volunteered at the Elm Street one last winter. We turned away 30 people in a day." },
      { email: "mike@wwc.demo", comment: "Signed. This is the least a council should be doing." },
      { email: "jamal@wwc.demo" },
      { email: "sarah@wwc.demo", anonymous: true },
      { email: "diego@wwc.demo", comment: "My family used one of these two years ago. Nobody should have to." },
    ],
  },
  {
    title: "Keep the Riverside animal shelter open through winter",
    categorySlug: "local-services",
    target: "Riverside County Board",
    summary:
      "The shelter is scheduled to close for three months. Sixty animals and a volunteer network go with it.",
    creatorEmail: "mike@wwc.demo",
    goal: 500,
    countryCode: "US",
    padding: 212,
    body: [
      "The Riverside shelter takes in around sixty animals at a time and is run almost entirely by volunteers. The county has scheduled it to close from December to February on cost grounds.",
      "",
      "Nobody has said what happens to the animals in it.",
      "",
      "### What closing actually costs",
      "",
      "- The sixty animals currently housed there have to go somewhere. The nearest shelter is at capacity.",
      "- The volunteer network — about forty people — does not reassemble in March. It disperses.",
      "- Winter is when strays are found, not when they stop being found.",
      "",
      "We are asking the board to keep it open, and to say publicly what the three-month saving is, so it can be compared against what it costs.",
    ].join("\n"),
    signatures: [
      { email: "priya@wwc.demo", comment: "I adopted my dog from here in 2023." },
      { email: "lisa@wwc.demo" },
      { email: "diego@wwc.demo", comment: "Volunteered here every Tuesday for two years. It's not a building, it's forty people." },
    ],
  },
  {
    // No goal — exercises the "count, no bar" branch.
    title: "Put a mental health first aider in every secondary school",
    categorySlug: "mental-health",
    target: "the State Department of Education",
    summary:
      "One trained adult, in every school, whose job is to notice. Not a counsellor — a first aider.",
    creatorEmail: "priya@wwc.demo",
    countryCode: "US",
    padding: 1443,
    body: [
      "Physical first aid is mandatory in every school. Mental health first aid is not, anywhere in the state.",
      "",
      "We are not asking for a counsellor in every school — that is a bigger and more expensive ask, and it is not the one that gets said yes to. We are asking for **one trained adult per school** whose job includes noticing when a student is in trouble and knowing what to do next.",
      "",
      "The training is two days.",
      "",
      "> The teacher who noticed I'd stopped eating lunch is the reason I'm here. She had no training. She just noticed.",
      "",
      "Making that a role rather than a coincidence is the whole of this petition.",
    ].join("\n"),
    signatures: [
      { email: "sarah@wwc.demo", comment: "Two days of training. That's the entire ask. Sign it." },
      { email: "lisa@wwc.demo" },
      { email: "mike@wwc.demo" },
      { email: "jamal@wwc.demo", anonymous: true },
    ],
  },
  {
    // Every signature anonymous — the signer list renders empty while
    // the count does not, which is a distinct empty state.
    title: "Extend the needle exchange to Sundays",
    categorySlug: "addiction-and-recovery",
    target: "the County Health Authority",
    summary:
      "The exchange is closed on the day the emergency department sees the most overdoses.",
    creatorEmail: "sarah@wwc.demo",
    goal: 300,
    countryCode: "US",
    padding: 87,
    body: [
      "The county needle exchange runs Monday to Saturday. The emergency department sees more overdose presentations on Sunday than on any other day of the week. Those two facts have been true at the same time for three years.",
      "",
      "Opening on Sunday costs one shift.",
      "",
      "Many of the people signing this will not want their names on it, and that is exactly why the signature count matters more than the list. You can add your name privately.",
    ].join("\n"),
    signatures: [
      { email: "diego@wwc.demo", anonymous: true },
      { email: "jamal@wwc.demo", anonymous: true },
      { email: "priya@wwc.demo", anonymous: true },
    ],
  },
  {
    // PENDING — populates the admin queue and the author's own banner.
    title: "Add step-free access to the Fourth Street library",
    categorySlug: "access-and-disability",
    target: "the City Library Board",
    summary:
      "Eleven steps and no ramp. The nearest step-free library is a forty-minute bus ride.",
    creatorEmail: "jamal@wwc.demo",
    status: "PENDING",
    goal: 250,
    countryCode: "US",
    body: [
      "The Fourth Street library has eleven steps at its only entrance and no ramp. It has a lift inside, which you reach by going up the steps.",
      "",
      "The nearest step-free library is forty minutes away by bus, with one change.",
      "",
      "The board's own accessibility audit flagged this in 2021. We are asking for a date.",
    ].join("\n"),
    signatures: [],
  },
  {
    // CLOSED — populates the Closed section on the index, and shows
    // that a finished petition keeps its record.
    title: "Save the Tuesday evening bus to the recovery meeting",
    categorySlug: "transport",
    target: "Metro Transit",
    summary:
      "The 34B was the only way to reach the Tuesday meeting without a car. It has been reinstated.",
    creatorEmail: "diego@wwc.demo",
    status: "CLOSED",
    goal: 200,
    countryCode: "US",
    padding: 268,
    body: [
      "**This petition succeeded. The 34B evening service was reinstated in March, and the Tuesday meeting is running again.**",
      "",
      "---",
      "",
      "The 34B was the only evening service reaching the community centre where the Tuesday recovery meeting is held. When it was cut, attendance at that meeting halved in a month — not because people stopped wanting to go, but because people in early recovery are disproportionately people without a car.",
      "",
      "Thank you to everyone who signed. Leaving this up as a record of what it took.",
    ].join("\n"),
    signatures: [
      { email: "sarah@wwc.demo", comment: "This meeting is the reason I have eighteen months." },
      { email: "mike@wwc.demo" },
      { email: "priya@wwc.demo", comment: "Cutting an evening bus is never just cutting a bus." },
    ],
  },
];

async function main(): Promise<void> {
  console.log("Seeding petitions\n");

  // ── Users ──
  const passwordHash = await bcrypt.hash("demo-password-123", 10);
  const users = new Map<string, { id: string; displayName: string; avatarUrl: string | null }>();

  for (const u of SEED_USERS) {
    let user = await prisma.user.findUnique({
      where: { email: u.email },
      select: { id: true, displayName: true, avatarUrl: true },
    });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: u.email,
          passwordHash,
          displayName: u.displayName,
          emailVerifiedAt: new Date(),
        },
        select: { id: true, displayName: true, avatarUrl: true },
      });
    }
    users.set(u.email, user);
  }
  console.log(`→ Users: ${users.size} ready (password: demo-password-123)`);

  // Best-effort: the geography seed may not have been run.
  const us = await prisma.country.findUnique({ where: { code: "US" } }).catch(() => null);
  if (!us) console.log("  (no US country row — petitions will save without a country link)");

  // Categories are REQUIRED for a real submission, so a run without
  // them produces petitions the app itself would have refused. Said
  // once, loudly, up front — not swallowed per petition.
  const categories = new Map(
    (await prisma.petitionCategory.findMany({ select: { id: true, slug: true } })).map(
      (c) => [c.slug, c.id] as const,
    ),
  );
  const wanted = new Set(PETITIONS.map((p) => p.categorySlug));
  const missing = [...wanted].filter((slug) => !categories.has(slug));
  if (missing.length) {
    console.log("");
    console.log(`  ⚠ ${missing.length} categor${missing.length === 1 ? "y is" : "ies are"} missing: ${missing.join(", ")}`);
    console.log("    Run `npm run db:seed-petition-categories` first, then re-run this —");
    console.log("    it is idempotent and will file them on the second pass.");
  }
  console.log("");

  for (const spec of PETITIONS) {
    const slug = slugify(spec.title);
    const creator = users.get(spec.creatorEmail)!;
    const status = spec.status ?? "APPROVED";

    const data = {
      title: spec.title,
      target: spec.target,
      summary: spec.summary,
      body: spec.body,
      goal: spec.goal ?? null,
      closesAt: spec.closesAt ?? (status === "APPROVED" ? days(45) : null),
      status,
      countryId: spec.countryCode && us ? us.id : null,
      categoryId: categories.get(spec.categorySlug) ?? null,
      creatorUserId: creator.id,
      creatorNameSnapshot: creator.displayName,
      creatorAvatarSnapshot: creator.avatarUrl,
      reviewedAt: status === "PENDING" ? null : new Date(),
    };

    const petition = await prisma.petition.upsert({
      where: { slug },
      create: { ...data, slug },
      update: data,
      select: { id: true, title: true },
    });

    // ── named signatures ──
    for (const sig of spec.signatures) {
      const signer = users.get(sig.email)!;
      await prisma.petitionSignature.upsert({
        where: {
          petitionId_userId: { petitionId: petition.id, userId: signer.id },
        },
        create: {
          petitionId: petition.id,
          userId: signer.id,
          nameSnapshot: signer.displayName,
          avatarSnapshot: signer.avatarUrl,
          comment: sig.comment ?? null,
          isAnonymous: !!sig.anonymous,
        },
        update: {},
      });
    }

    // ── padding ──
    //
    // Real rows, not a number typed into signatureCount. The count is
    // recomputed from the table below, exactly as the app does it, so
    // a seeded petition cannot be in a state the app could never
    // produce.
    if (spec.padding) {
      const existing = await prisma.petitionSignature.count({ where: { petitionId: petition.id } });
      const wanted = spec.signatures.length + spec.padding;
      for (let i = existing; i < wanted; i++) {
        const email = `supporter-${slug}-${i}@wwc.demo`;
        let filler = await prisma.user.findUnique({ where: { email }, select: { id: true } });
        if (!filler) {
          filler = await prisma.user.create({
            data: {
              email,
              passwordHash,
              displayName: `Supporter ${i}`,
              emailVerifiedAt: new Date(),
            },
            select: { id: true },
          });
        }
        await prisma.petitionSignature.upsert({
          where: { petitionId_userId: { petitionId: petition.id, userId: filler.id } },
          create: {
            petitionId: petition.id,
            userId: filler.id,
            nameSnapshot: `Supporter ${i}`,
            avatarSnapshot: null,
            // Anonymous, so the seeded crowd never pretends to be a
            // list of real people with real profiles to click into.
            isAnonymous: true,
          },
          update: {},
        });
      }
    }

    const signatureCount = await prisma.petitionSignature.count({
      where: { petitionId: petition.id },
    });
    await prisma.petition.update({ where: { id: petition.id }, data: { signatureCount } });

    const named = spec.signatures.filter((s) => !s.anonymous).length;
    console.log(`  ${petition.title}`);
    console.log(`     /petitions/${slug}  [${status}]`);
    console.log(
      `     ${signatureCount} signature(s) — ${named} named, ${signatureCount - named} private` +
        (spec.goal ? `, goal ${spec.goal}` : ", no goal"),
    );
    console.log("");
  }

  console.log(`Done: ${PETITIONS.length} petitions.`);
  console.log("Pending one is at /admin/petitions — approve it to see the queue empty.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
