/**
 * Sample community wall posts + a handful of open reports so the
 * admin has something to moderate on day one.
 *
 * Idempotent: exits early if any Post already exists. Deliberate,
 * so a real production DB with real posts doesn't get spammed with
 * fixtures.
 *
 * Run:
 *   npm run db:seed-posts
 *
 * Requires:
 *   - `npm run db:seed` first (admin user + settings)
 *   - `npm run db:seed-geo` first (US country row, referenced for
 *     a few of the country-scoped posts)
 */

import { PrismaClient, ReportReason } from "@prisma/client";
import bcrypt from "bcryptjs";
// Route seeded reports through the shared helper so the admin
// notification fan-out fires exactly the way it will in prod —
// demo admins see the bell light up on first seed.
import { reportPost } from "../src/lib/posts-user";

const prisma = new PrismaClient();

const SEED_USERS = [
  { email: "sarah@wwc.demo",  displayName: "Sarah",   anonymousByDefault: true  },
  { email: "mike@wwc.demo",   displayName: "Mike",    anonymousByDefault: false },
  { email: "lisa@wwc.demo",   displayName: "Lisa",    anonymousByDefault: false },
  { email: "jamal@wwc.demo",  displayName: "Jamal",   anonymousByDefault: false },
  { email: "priya@wwc.demo",  displayName: "Priya",   anonymousByDefault: false },
  { email: "diego@wwc.demo",  displayName: "Diego",   anonymousByDefault: true  },
];

interface PostSpec {
  authorEmail: string;
  body: string;
  isAnonymous?: boolean;
  countryCode?: string;
  comments?: Array<{ authorEmail: string; body: string; isAnonymous?: boolean }>;
  reports?: Array<{ reporterEmail: string; reason: ReportReason; notes?: string }>;
  featured?: boolean;
}

const POSTS: PostSpec[] = [
  {
    authorEmail: "sarah@wwc.demo",
    isAnonymous: true,
    body:
      "First time posting here. I've been drinking more than I want to admit and I don't know how to talk to anyone about it. How did anyone here get through the first week?",
    comments: [
      { authorEmail: "mike@wwc.demo", body: "You're brave for posting this. My first week was mostly walks + calling my sister when it got loud in my head." },
      { authorEmail: "priya@wwc.demo", body: "Day 1 was the hardest. I promise it gets lighter — one hour at a time.", isAnonymous: true },
    ],
  },
  {
    authorEmail: "mike@wwc.demo",
    body:
      "Volunteered at the animal shelter this morning. Walked seven dogs. If anyone in the Bay Area wants to come next Tuesday, DM me — they're always short of hands.",
    countryCode: "US",
    featured: true,
    comments: [
      { authorEmail: "diego@wwc.demo", body: "Sending this to my sister who's been looking for something like this." },
    ],
  },
  {
    authorEmail: "lisa@wwc.demo",
    body:
      "Started a petition to increase funding for our town's three food banks. They served 4,200 families last month and are running out of shelf-stable staples.\n\nSigning takes 30 seconds. Sharing takes 60. Link in my profile.",
    countryCode: "US",
    reports: [
      { reporterEmail: "jamal@wwc.demo", reason: ReportReason.OFF_TOPIC, notes: "Feels more like promo than a community post." },
    ],
  },
  {
    authorEmail: "jamal@wwc.demo",
    body:
      "60 days sober today. Not celebrating, exactly — just noting it. Thanks to the people who replied to my first post; you know who you are.",
    comments: [
      { authorEmail: "sarah@wwc.demo", body: "This means a lot. Rooting for you.", isAnonymous: true },
      { authorEmail: "mike@wwc.demo", body: "60 is huge, friend. One breath at a time." },
      { authorEmail: "priya@wwc.demo", body: "🕊️" },
    ],
  },
  {
    authorEmail: "priya@wwc.demo",
    body:
      "Gratitude entry: the barista who remembered my order this morning; the sun after three grey days; my mom's voicemail that I almost deleted then replayed.",
  },
  {
    authorEmail: "diego@wwc.demo",
    isAnonymous: true,
    body:
      "How do you tell your family you can't come to Thanksgiving because being around drinking uncle is a trigger? Every year I promise myself I won't go and every year I go.",
    comments: [
      { authorEmail: "sarah@wwc.demo", body: "I've been in your exact shoes. What worked for me: staying with a sober friend that day + a scripted 'I have another commitment this year' text.", isAnonymous: true },
    ],
    reports: [
      { reporterEmail: "mike@wwc.demo", reason: ReportReason.OTHER, notes: "Not sure it's a report — flagging so a mod can eyeball. Feels heavy." },
    ],
  },
  {
    authorEmail: "mike@wwc.demo",
    body:
      "Reminder: today's opening-up question is 'What is one thing you've been carrying that you've never told anyone?'\n\nYou can post publicly, share only in a chatroom you trust, or keep it in your private journal. Whichever is safest.",
  },
  {
    authorEmail: "lisa@wwc.demo",
    body: "Buy nothing group meetup on Saturday at the community garden — 10am. Free coffee, free books, no ask.",
    countryCode: "US",
  },
  {
    authorEmail: "sarah@wwc.demo",
    isAnonymous: true,
    body: "Update from a week ago: I made it to my first meeting. I didn't say anything but I stayed the whole hour. That felt like enough.",
    comments: [
      { authorEmail: "mike@wwc.demo", body: "STAYING is huge. Staying is the whole thing." },
      { authorEmail: "jamal@wwc.demo", body: "Proud of you." },
      { authorEmail: "priya@wwc.demo", body: "That's more than enough. That's brave." },
      { authorEmail: "diego@wwc.demo", body: "Rooting for you.", isAnonymous: true },
    ],
    featured: true,
  },
  {
    authorEmail: "jamal@wwc.demo",
    body: "Spam spam spam click here to win a million dollars",
    reports: [
      { reporterEmail: "priya@wwc.demo", reason: ReportReason.SPAM },
      { reporterEmail: "mike@wwc.demo", reason: ReportReason.SPAM, notes: "Clearly spam." },
    ],
  },
];

function summarize(body: string): string {
  const clean = body.replace(/\s+/g, " ").trim();
  return clean.length > 60 ? `${clean.slice(0, 60)}…` : clean;
}

async function main(): Promise<void> {
  console.log("Seeding community wall\n");

  const existingPosts = await prisma.post.count();
  if (existingPosts > 0) {
    console.log(`→ ${existingPosts} posts already exist. Skipping seed to avoid duplicates.`);
    return;
  }

  // ── Users ──
  const bcryptCost = 10;
  const passwordHash = await bcrypt.hash("demo-password-123", bcryptCost);
  const userIdByEmail = new Map<string, string>();
  for (const u of SEED_USERS) {
    let user = await prisma.user.findUnique({ where: { email: u.email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: u.email,
          passwordHash,
          displayName: u.displayName,
          anonymousByDefault: u.anonymousByDefault,
          emailVerifiedAt: new Date(),
        },
      });
    }
    userIdByEmail.set(u.email, user.id);
  }
  console.log(`→ Users: ${userIdByEmail.size} ready (password: demo-password-123)`);

  // ── Country lookup (best-effort; ignore if geo isn't seeded yet) ──
  const usCountry = await prisma.country.findUnique({ where: { code: "US" } }).catch(() => null);
  if (!usCountry) console.log("  (US country row missing — country-scoped posts will save without a country link)");

  // ── Posts + comments + reports ──
  let postCount = 0;
  let commentCount = 0;
  let reportCount = 0;
  for (const spec of POSTS) {
    const authorId = userIdByEmail.get(spec.authorEmail);
    if (!authorId) continue;
    const author = await prisma.user.findUnique({ where: { id: authorId }, select: { displayName: true, avatarUrl: true } });
    const commentsCount = spec.comments?.length ?? 0;
    const reportsCount = spec.reports?.length ?? 0;

    const created = await prisma.post.create({
      data: {
        authorId,
        authorNameSnapshot: author?.displayName ?? spec.authorEmail,
        authorAvatarSnapshot: author?.avatarUrl ?? null,
        body: spec.body,
        isAnonymous: spec.isAnonymous ?? false,
        countryId: spec.countryCode ? usCountry?.id ?? null : null,
        isFeatured: spec.featured ?? false,
        featuredAt: spec.featured ? new Date() : null,
        commentCount: commentsCount,
        // reportCount is bumped by reportPost() below so we don't
        // double-count when the shared helper runs.
        reportCount: 0,
      },
    });
    postCount++;

    for (const c of spec.comments ?? []) {
      const cAuthorId = userIdByEmail.get(c.authorEmail);
      if (!cAuthorId) continue;
      const cAuthor = await prisma.user.findUnique({ where: { id: cAuthorId }, select: { displayName: true, avatarUrl: true } });
      await prisma.postComment.create({
        data: {
          postId: created.id,
          authorId: cAuthorId,
          authorNameSnapshot: cAuthor?.displayName ?? c.authorEmail,
          authorAvatarSnapshot: cAuthor?.avatarUrl ?? null,
          body: c.body,
          isAnonymous: c.isAnonymous ?? false,
        },
      });
      commentCount++;
    }

    for (const r of spec.reports ?? []) {
      const reporterId = userIdByEmail.get(r.reporterEmail);
      if (!reporterId) continue;
      // Go through the real helper so counters increment + admin
      // notifications fan out just like they will in production.
      await reportPost({
        postId: created.id,
        reporterId,
        reason: r.reason,
        notes: r.notes,
      });
      reportCount++;
    }

    console.log(
      `  ✓ ${author?.displayName ?? spec.authorEmail}: ${summarize(spec.body)}` +
      (commentsCount ? ` (${commentsCount} comments)` : "") +
      (reportsCount ? ` (${reportsCount} reports)` : ""),
    );
  }

  console.log(
    `\nDone. ${postCount} posts · ${commentCount} comments · ${reportCount} reports queued.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
