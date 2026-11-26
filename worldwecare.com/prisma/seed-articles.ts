/**
 * Seed the magazine: article categories + a few published articles
 * each, covering the topic areas from plan.docx.
 *
 * Idempotent:
 *   • categories are upserted by slug
 *   • articles are upserted by slug, so re-running refreshes the
 *     content rather than piling up duplicates
 *
 * Run:
 *   npm run db:seed-articles
 *
 * Requires `npm run db:seed` first (an admin user, used for the
 * byline — optional, falls back to "WorldWeCare Team").
 *
 * Images: deterministic stock photos from picsum.photos. Swap the
 * cover for a real upload any time from Admin → Articles → Edit.
 */

import { PrismaClient } from "@prisma/client";

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

/** Rough reading-time estimate — mirrors estimateReadMinutes in src/lib/rich-text.tsx. */
function readMinutes(body: string): number {
  const plain = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~`-]/g, " ");
  return Math.max(1, Math.round(plain.split(/\s+/).filter(Boolean).length / 200));
}

const cover = (seed: string) => `https://picsum.photos/seed/${seed}/1600/900`;
const inline = (seed: string) => `https://picsum.photos/seed/${seed}-inline/1200/800`;

interface CategorySpec {
  name: string;
  description: string;
  /** Shown in the tile's circle on /articles. */
  emoji: string;
  /** Tints that circle. Hex only — it lands in an inline style. */
  color: string;
  sortOrder: number;
}

const CATEGORIES: CategorySpec[] = [
  {
    name: "Recovery & Sobriety",
    emoji: "🌱",
    color: "#10b981",
    description: "First weeks, long roads, and the people who walk them with you.",
    sortOrder: 0,
  },
  {
    name: "Mental Health",
    emoji: "💬",
    color: "#8b5cf6",
    description: "Anxiety, low days, burnout — and what actually helps.",
    sortOrder: 1,
  },
  {
    name: "Meditation & Spiritual Healing",
    emoji: "🕯️",
    color: "#6366f1",
    description: "Quiet practices for loud minds.",
    sortOrder: 2,
  },
  {
    name: "Animals & Rescue",
    emoji: "🐾",
    color: "#f59e0b",
    description: "Shelters, fosters, and the animals who rescue us back.",
    sortOrder: 3,
  },
  {
    name: "Community & Volunteering",
    emoji: "🤝",
    color: "#0ea5e9",
    description: "Showing up locally — food banks, neighbours, small acts.",
    sortOrder: 4,
  },
];

interface ArticleSpec {
  title: string;
  category: string;
  excerpt: string;
  body: string;
  featured?: boolean;
  /** Days ago it was published, so the index has a natural order. */
  daysAgo: number;
}

const ARTICLES: ArticleSpec[] = [
  /* ── Recovery & Sobriety ─────────────────────────────────── */
  {
    title: "Getting Through the First Week",
    category: "Recovery & Sobriety",
    excerpt:
      "The first seven days are their own kind of hard. Here's what people in our rooms say got them through.",
    featured: true,
    daysAgo: 2,
    body: `The first week is not the hardest week of recovery. It is, however, the loudest — everything in your body and your calendar is arguing with the decision you just made.

## Make the days smaller

A week is too big to look at. Most people who make it through don't think about seven days. They think about the next hour, then the one after that.

- Plan what happens at the time of day you'd normally drink or use
- Put something in that slot — a walk, a call, a shower, a shift
- Eat properly, even when you don't want to

> "I stopped counting days and started counting evenings. Evenings were the thing I actually had to survive." — a member of our sobriety room

![Morning light through a window](${inline("first-week")})

## Tell exactly one person

You don't owe anyone an announcement. But one person who knows makes the difference between white-knuckling alone and having somewhere to put it at 9pm on a Tuesday.

## Expect it to be uneven

Day three is often better than day five. That isn't failure — it's just how it goes. If you slip, the week doesn't reset your worth. Come back and say so.

**A note on safety:** stopping alcohol or some drugs suddenly can be medically dangerous. If you drink heavily or daily, talk to a doctor before you stop — withdrawal is one of the few things here that genuinely needs professional supervision.`,
  },
  {
    title: "What to Say When Someone Tells You They're Struggling",
    category: "Recovery & Sobriety",
    excerpt:
      "Most of us freeze. A few simple responses are better than the perfect thing you never say.",
    daysAgo: 9,
    body: `Someone just told you something hard. Your instinct is to fix it. Resist that for sixty seconds.

## Start with the least useful-sounding sentence

"Thank you for telling me." It sounds like nothing. It does an enormous amount of work — it says *this didn't cost me anything and you didn't lose me*.

## Then ask, don't assume

- "How long have you been carrying this?"
- "Do you want help thinking about it, or do you just want me to listen?"

That second question saves most conversations. People rarely want solutions first.

![Two people talking on a bench](${inline("what-to-say")})

## Things that land badly

- "At least it's not…" — comparison shrinks people
- "Have you tried…" — usually yes, and it didn't work
- Going quiet afterwards — the silence gets read as regret

## Follow up on a boring Tuesday

The message that matters most is the one three days later that says *thinking of you, no reply needed*. It proves the first conversation wasn't a one-off.`,
  },

  /* ── Mental Health ───────────────────────────────────────── */
  {
    title: "A Low Day Is Not a Relapse of Everything",
    category: "Mental Health",
    excerpt:
      "One bad day tends to feel like proof that nothing worked. It usually isn't proof of anything.",
    daysAgo: 4,
    body: `You had months of steady. Then a day arrived where getting up felt like lifting furniture, and your brain filed it as: *none of it worked.*

## The story a low day tells

Low mood is a bad narrator. It doesn't just make today heavy — it rewrites the past as always-heavy and the future as permanently-heavy. That rewriting is a symptom, not a report.

## What to do with it

1. Lower the bar to something almost insulting — one glass of water, one open window
2. Do the thing that helped before, badly, for five minutes
3. Tell someone the truth in one sentence

![Rain on a window](${inline("low-day")})

> A low day inside a good month is weather. A low month is climate. Treat them differently.

## When it isn't just weather

If the low days start outnumbering the level ones, or you notice you've stopped doing the things that normally pull you back, that's worth taking to a professional. Peer support is powerful and it is not a substitute for care.`,
  },
  {
    title: "Burnout Doesn't Look Like Exhaustion",
    category: "Mental Health",
    excerpt:
      "It often looks like cynicism, short temper, and not caring about things you used to love.",
    daysAgo: 16,
    body: `Most people expect burnout to arrive as tiredness. It usually arrives as *flatness* — you're still functioning, you just don't care much anymore.

## The three quiet signs

- **Cynicism** about work or people you used to be warm toward
- **Detachment** — going through motions well, feeling none of it
- **Reduced sense of accomplishment** — nothing you finish feels like it counted

![An empty desk at dusk](${inline("burnout")})

## Rest isn't the whole answer

A holiday fixes tiredness. Burnout is usually about *control, fairness, and meaning* — a week off returns you to the same conditions. Ask what specifically drained you: the hours, or the powerlessness?

## Small structural changes beat big resolutions

- One boundary you actually enforce beats five you announce
- One task removed beats a new productivity system
- One person who knows how bad it got beats a plan you keep private`,
  },

  /* ── Meditation & Spiritual Healing ──────────────────────── */
  {
    title: "Meditation for People Who Can't Sit Still",
    category: "Meditation & Spiritual Healing",
    excerpt:
      "If ten silent minutes sounds unbearable, you are the person meditation was designed for.",
    featured: true,
    daysAgo: 6,
    body: `The most common reason people quit meditation is believing they're bad at it. Almost always, they're doing it correctly and misreading what success looks like.

## Noticing you drifted *is* the rep

The goal was never an empty mind. The practice is: attention wanders → you notice → you come back. That noticing is the entire exercise. A session where you drifted forty times is forty repetitions, not forty failures.

![Still water at dawn](${inline("meditation")})

## Start at two minutes

Not ten. Two. Long enough to be real, short enough that you can't talk yourself out of it.

1. Sit however you're already sitting
2. Follow the out-breath, not the in-breath — it's slower and easier to track
3. When you notice you've gone, come back without commentary

## If sitting is impossible, move

Walking meditation counts. So does washing dishes with your attention actually on the water. The container matters far less than the returning.

> "I meditated for a year before I realised I wasn't supposed to be enjoying it. That took the pressure off completely."`,
  },
  {
    title: "Gratitude Without the Fake Positivity",
    category: "Meditation & Spiritual Healing",
    excerpt:
      "Listing three good things doesn't work when you don't believe them. Here's the version that does.",
    daysAgo: 21,
    body: `Gratitude practice gets a bad name because it's often taught as *insist things are fine.* That fails immediately when things are not fine.

## Specific beats grand

"I'm grateful for my health" is too abstract to move anything. "The bus was warm" is small enough to be true. Truth is the active ingredient.

## Try noticing instead of listing

Rather than producing three items on demand, spend the day noticing one moment that was slightly better than neutral. One is enough.

![A cup of tea on a table](${inline("gratitude")})

## It's allowed to sit next to grief

You can be grateful for a phone call and still be devastated. Gratitude practice isn't a verdict on your life — it's attention training. Nothing about it requires you to pretend.

If you want somewhere to put these, the [gratitude wall](/gratitude) exists exactly for this. Reading someone else's list on a bad day is often more useful than writing your own.`,
  },

  {
    title: "Ten Minutes, Badly Done, Still Counts",
    category: "Meditation & Spiritual Healing",
    excerpt:
      "Most people quit meditating because they think they're bad at it. Being bad at it is the activity.",
    daysAgo: 16,
    body: `Nobody sits down, closes their eyes, and finds silence. That is not what is on offer. What is on offer is ten minutes of noticing you have wandered off, and coming back — and the coming back is the whole exercise, not the interruption to it.

## The bar is lower than you think

If you sat for ten minutes and spent nine of them thinking about an email, you did it correctly. You noticed. That noticing is the repetition. It is a bicep curl, not a state of grace.

- Sit somewhere you already sit
- Set a timer so you stop checking
- When you notice you've gone, come back — that's the rep

![A candle on a windowsill](${inline("ten-minutes")})

## Why it helps here in particular

Cravings and spirals both work by feeling like the only thing in the room. Practising the small act of stepping back from a thought about laundry makes it fractionally easier to step back from a thought that matters. Fractionally is enough, repeated.

> "I gave up on meditation four times before someone told me I wasn't supposed to be good at it." — from our meditation room

## If sitting still is unbearable

It is, for some people, especially early on. Walk instead. Same job: notice where your attention went, bring it back to your feet. The stillness was never the point.`,
  },
  /* ── Animals & Rescue ────────────────────────────────────── */
  {
    title: "So You Want to Volunteer at a Shelter",
    category: "Animals & Rescue",
    excerpt: "What the first day actually involves, and why they need you on Tuesdays.",
    daysAgo: 11,
    body: `Most people picture volunteering as playing with puppies. There is some of that. There is considerably more laundry.

## What shelters actually need

- **Weekday mornings.** Weekends are oversubscribed; Tuesday at 9am is desperate
- **Consistency over enthusiasm.** Two hours every week beats a whole Saturday once
- **Unglamorous work** — dishes, bedding, cleaning, transport runs

![A dog waiting at a shelter gate](${inline("shelter")})

## The first day

You'll shadow someone. You probably won't handle the anxious dogs. That isn't a judgement — it's because animals under stress need predictable handlers, and you're new.

## The part nobody warns you about

You'll get attached, and some outcomes are hard. Experienced volunteers handle this by staying connected to the ones who make it and being honest about the ones who don't. Talk about it — the shelter's own room here is a reasonable place to start.`,
  },
  {
    title: "Fostering: The Version Nobody Advertises",
    category: "Animals & Rescue",
    excerpt: "Temporary is the point, and the goodbye is the job — not the failure.",
    daysAgo: 24,
    body: `Fostering is the highest-leverage thing most people can do for a shelter. It's also the thing people quit fastest, because the hard part is emotional rather than practical.

## What it involves

1. The shelter usually covers food and vet costs — ask, don't assume
2. Expect a decompression period: the first two weeks are rarely representative
3. You're providing recovery time, not a forever home

![A cat asleep on a sofa](${inline("fostering")})

## "I'd get too attached"

You will. That's the qualification, not the disqualification. The attachment is what makes the animal safe enough to become adoptable.

> Every foster who says goodbye frees a space. The next animal exists because you let go of the last one.

## Starting small

Ask about a two-week emergency placement rather than an open-ended commitment. Most people who foster long-term started with something that had an end date.`,
  },

  {
    title: "Fostering, When You're Not Sure You Can Commit",
    category: "Animals & Rescue",
    excerpt:
      "Shelters need short-term homes far more than they need perfect ones. What fostering actually asks of you.",
    daysAgo: 21,
    body: `The most common reason people give for not fostering is that they might not be able to keep it up. That is not a disqualification. It is roughly the job description.

## What a foster actually does

You take an animal out of a loud, frightening building and put it somewhere quiet for a few weeks. That's it. The shelter usually covers food and vet costs — ask, because most people don't and assume the worst.

- Most placements are two to eight weeks
- Medical care is normally the rescue's responsibility
- You can say no to a particular animal, and you can say when you're done

![A dog asleep on a sofa](${inline("fostering")})

## The part nobody warns you about

You will get attached. Some people foster once, adopt, and never foster again — that is a good outcome for one animal and an honest thing to know about yourself. Others find the goodbye gets easier because the next one is already waiting.

## Why it comes up in a recovery community

A lot of members say the same thing: something that needs feeding at seven whether or not you feel like getting up is its own kind of structure. It is not a treatment plan. It is a reason to be upright at a specific time, which on some days is the harder problem.

If you're at a point where caring for yourself is the whole job, this can wait. It isn't going anywhere — shelters are always short.`,
  },
  /* ── Community & Volunteering ────────────────────────────── */
  {
    title: "Your Local Food Bank Needs Something Different Than You Think",
    category: "Community & Volunteering",
    excerpt: "Tinned goods pile up. Here's what's actually short — and why cash goes further.",
    featured: true,
    daysAgo: 1,
    body: `Food drives are generous and slightly inefficient. If you want your contribution to go furthest, it helps to know what a food bank's shelves actually look like in week three.

## Usually overstocked

- Tinned beans and pasta
- Long-life soup
- Cereal

## Usually short

- **Toiletries** — toothpaste, shampoo, deodorant, razors
- **Period products**
- **Nappies and formula**
- **Pet food** — people skip their own meals before their animal's
- **Cooking staples** — oil, salt, spices, stock

![Shelves at a community food bank](${inline("food-bank")})

## Why cash goes further

Food banks buy wholesale at prices you can't get in a supermarket, and they buy the specific thing that ran out on Thursday. A donation often stretches two to three times further than the equivalent in shopping.

## Ask before you collect

One phone call — "what are you short of this month?" — will redirect your effort better than any list, including this one.`,
  },
  {
    title: "Small Acts That Actually Hold a Neighbourhood Together",
    category: "Community & Volunteering",
    excerpt: "Not grand gestures. The recurring, boring, load-bearing ones.",
    daysAgo: 14,
    body: `Communities aren't held together by big events. They're held together by a handful of people who reliably do small things, and by everyone else noticing.

## The load-bearing acts

- Knowing which neighbours live alone, and what normal looks like for them
- Being the person who has the spare key
- Taking a bin out that hasn't moved
- Learning the name of whoever works your local shop

![A quiet residential street](${inline("neighbourhood")})

## Why the boring ones matter most

A charity gala raises money. A neighbour who notices the curtains haven't opened in two days saves a life. Both matter; only one requires you to be there every week.

## If you want a place to start

Pick one street and one habit. That's it. People who try to fix a whole town tend to last about six weeks — people who look after one street tend to still be doing it years later.

> "I didn't set out to volunteer. I just started saying hello, and it turned into fifteen years."`,
  },

  {
    title: "Sober and Still Social",
    category: "Recovery & Sobriety",
    excerpt:
      "Rebuilding a social life without the thing that used to make it easy.",
    daysAgo: 18,
    body: `The part people underestimate isn't stopping. It's Saturday.

## The gap is real

Drinking wasn't only a habit — it was the structure of your evenings, your shorthand for relaxing, and often your entire method for talking to strangers. Removing it leaves a hole shaped exactly like your social life.

## Replace the function, not just the drink

Ask what the drinking was *doing*: loosening you up, marking the end of the workday, giving your hands something to do. Each of those has a different replacement.

![People walking together at sunset](${inline("sober-social")})

## Things that work

- Activities with a built-in purpose — hikes, classes, volunteering, gigs
- Arriving early and leaving early, on your own terms
- Having a first line ready for "why aren't you drinking?" — "I'm driving" ends it; "I'm taking a break" is honest

> The first three sober social events are the hardest. It gets ordinary faster than you expect.

## You're allowed to leave

Deciding in advance that you can go home at any point, without explaining, is often what makes going possible at all.`,
  },
  {
    title: "How to Ask for Help When You Don't Have the Words",
    category: "Mental Health",
    excerpt:
      "You don't need to explain it well. You just need to say something.",
    daysAgo: 27,
    body: `A lot of people wait to reach out until they can describe the problem properly. That's a trap — the ability to explain it clearly usually comes *after* support, not before.

## Sentences that are enough

- "I'm not doing great and I don't really want to talk about why yet."
- "Can you check on me this week?"
- "I don't need advice. I just didn't want to be the only one who knew."

![A phone on a table](${inline("asking-help")})

## Lower the stakes deliberately

Text instead of calling. Ask for company instead of a conversation. Say it while doing something else — driving, walking, washing up. Side-by-side is easier than face-to-face.

## If it's anonymous first, that's fine

That's what the [chatrooms](/chatrooms) are for. Plenty of people read for weeks before posting a word, and post anonymously long before they use their name. That's not cowardice — it's a sensible way to test whether a room is safe.

**If you're in immediate danger or thinking about harming yourself, please contact your local emergency number or a crisis line now.** Peer support matters enormously, and it is not the right tool for an emergency.`,
  },
  {
    title: "Starting Something in a Town That Has Nothing",
    category: "Community & Volunteering",
    excerpt:
      "No budget, no committee, no permission. What the first three months actually look like.",
    daysAgo: 30,
    body: `Most community groups don't begin with funding or a plan. They begin with one person doing something small on a regular schedule until other people turn up.

## Month one: just be reliable

Pick a time and a place and go, even when nobody comes. A weekly litter pick with one person is a real thing. A committee with no activity is not.

![A small group gathering outdoors](${inline("starting-something")})

## Month two: make it findable

- One page or post that says what, where, when
- A way to reply that isn't your personal phone number
- A photo — people join things they can picture

## Month three: give things away

The fastest way to lose a group is to be the only person who can run it. Hand over a task before you feel ready. The second organiser is more important than the first ten attendees.

> "We were four people and a bin bag for two months. We're ninety now. Nothing changed except we kept showing up."`,
  },
];

async function main() {
  const admin = await prisma.adminUser.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, displayName: true },
  });

  // ── categories ──
  const byName = new Map<string, string>();
  for (const c of CATEGORIES) {
    const slug = slugify(c.name);
    const row = await prisma.articleCategory.upsert({
      where: { slug },
      update: { name: c.name, description: c.description, sortOrder: c.sortOrder },
      create: {
        slug, name: c.name, description: c.description,
        emoji: c.emoji, color: c.color, sortOrder: c.sortOrder,
      },
    });

    // Icon and colour are FILLED IN, never overwritten. They're in the
    // `create` above for a new install; this second step is for the
    // categories that already existed before tiles did. An admin who
    // has since picked their own keeps it — unlike name and
    // description above, which this seed has always reset.
    if (row.emoji === null || row.color === null) {
      await prisma.articleCategory.update({
        where: { id: row.id },
        data: {
          ...(row.emoji === null ? { emoji: c.emoji } : {}),
          ...(row.color === null ? { color: c.color } : {}),
        },
      });
    }

    byName.set(c.name, row.id);
  }

  // ── articles ──
  let created = 0;
  let updated = 0;
  for (const a of ARTICLES) {
    const slug = slugify(a.title);
    const publishedAt = new Date(Date.now() - a.daysAgo * 24 * 60 * 60 * 1000);
    const data = {
      title: a.title,
      excerpt: a.excerpt,
      body: a.body,
      coverUrl: cover(slug),
      coverAlt: a.title,
      categoryId: byName.get(a.category) ?? null,
      status: "PUBLISHED" as const,
      isFeatured: a.featured ?? false,
      featuredAt: a.featured ? publishedAt : null,
      publishedAt,
      readMinutes: readMinutes(a.body),
      authorAdminId: admin?.id ?? null,
      authorNameSnapshot: admin?.displayName ?? "WorldWeCare Team",
    };

    const existing = await prisma.article.findUnique({ where: { slug }, select: { id: true } });
    if (existing) {
      await prisma.article.update({ where: { slug }, data });
      updated += 1;
    } else {
      await prisma.article.create({ data: { slug, ...data } });
      created += 1;
    }
  }

  const perCategory = CATEGORIES.map(
    (c) => `${c.name}: ${ARTICLES.filter((a) => a.category === c.name).length}`,
  ).join(" · ");

  console.log(`Done. ${CATEGORIES.length} categories · ${created} created, ${updated} updated.`);
  console.log(perCategory);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
