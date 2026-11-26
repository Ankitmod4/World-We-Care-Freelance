import Link from "next/link";
import { LandingIcon, PhotoStrip } from "./landing-art";
import { getT } from "@/lib/i18n";
import type { TFunction } from "@/lib/i18n-core";

/**
 * The signed-out landing page, below the hero.
 *
 * WHO THIS IS WRITTEN FOR: someone who is struggling, has told nobody,
 * and is deciding whether to type their email into a website about it.
 * That person has three questions in this order — is this for people
 * like me, do I have to expose myself, and what actually happens if I
 * join — and the sections answer them in that order.
 *
 * All static. A marketing page that reads live counts shows "3 members"
 * on the day it can least afford to, and a hesitant visitor reads an
 * empty room as an abandoned one.
 */

/* ── 1. the ladder ───────────────────────────────────────────── */

function steps(t: TFunction) {
  return [
    {
      n: "01",
      icon: "eye" as const,
      title: t("landing.step1", "Read for as long as you need"),
      body: t(
        "landing.step1Body",
        "Nobody is notified that you are here. Most people read for days before they say a word, and that is a normal way to start.",
      ),
    },
    {
      n: "02",
      icon: "ask" as const,
      title: t("landing.step2", "Ask one thing, anonymously"),
      body: t(
        "landing.step2Body",
        "Your name is not attached. It is usually one question \u2014 how did anyone get through the first week \u2014 and the answers come from people who have.",
      ),
    },
    {
      n: "03",
      icon: "people" as const,
      title: t("landing.step3", "Join a room"),
      body: t(
        "landing.step3Body",
        "Topic by topic: sobriety, family recovery, animal rescue, food banks, elderly care. You choose which ones you appear in.",
      ),
    },
    {
      n: "04",
      icon: "envelope" as const,
      title: t("landing.step4", "Message one person"),
      body: t(
        "landing.step4Body",
        "Usually the one who sounded like you. That conversation is private, and it is the step most people say mattered.",
      ),
    },
    {
      n: "05",
      icon: "pin" as const,
      title: t("landing.step5", "Show up somewhere real"),
      body: t(
        "landing.step5Body",
        "A meeting, a shelter, a shift on a Tuesday morning. Everything before this exists to make this step small enough to take.",
      ),
    },
  ];
}

export async function LadderSection() {
  const t = await getT();
  const STEPS = steps(t);
  return (
    <section className="border-t border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)]">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="max-w-2xl">
          <h2 className="text-[30px] font-semibold leading-tight tracking-[-0.025em] sm:text-[38px]">
            {t("landing.ladderTitle", "You don't have to talk on day one.")}
          </h2>
          <p className="mt-4 text-[16.5px] leading-relaxed text-[color:var(--color-text-muted)]">
            {t(
              "landing.ladderBlurb",
              "Almost nobody walks into a support group the first time they admit something is wrong. This is built for the five steps before that \u2014 each one small enough that the next one stops looking impossible.",
            )}
          </p>
        </div>

        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((s) => (
            <li
              key={s.n}
              className="rounded-2xl border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)] p-6 transition-colors hover:border-[color:var(--color-brand)]/40"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand)]">
                  <LandingIcon name={s.icon} size={22} />
                </span>
                <span className="text-[13px] font-bold tabular-nums text-[color:var(--color-brand)]">
                  {s.n}
                </span>
              </div>
              <h3 className="mt-4 text-[17px] font-semibold leading-snug tracking-[-0.01em]">
                {s.title}
              </h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-[color:var(--color-text-muted)]">
                {s.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ── 2. the topics ───────────────────────────────────────────── */

/**
 * Static, and every chip links to /chatrooms rather than to a room.
 *
 * A named room that has not been created yet is a 404 on the first
 * page a stranger ever sees. The list says what the place is about;
 * the browse page says what is actually open right now.
 */
function topics(t: TFunction) {
  return [
    t("landing.topicSobriety", "Sobriety"),
    t("landing.topicDrugRecovery", "Drug recovery"),
    t("landing.topicMentalHealth", "Mental health"),
    t("landing.topicFamilyAbuse", "Family abuse"),
    t("landing.topicMeditation", "Meditation"),
    t("landing.topicSpiritualHealing", "Spiritual healing"),
    t("landing.topicGrief", "Grief"),
    t("landing.topicAnimalRescue", "Animal rescue"),
    t("landing.topicAnimalShelters", "Animal shelters"),
    t("landing.topicFoodBanks", "Food banks"),
    t("landing.topicElderlyCare", "Elderly care"),
    t("landing.topicDisabilitySupport", "Disability support"),
    t("landing.topicVolunteering", "Volunteering"),
    t("landing.topicTheEnvironment", "The environment"),
    t("landing.topicEducation", "Education"),
    t("landing.topicCounsellingTherapy", "Counselling & therapy"),
    t("landing.topicCommunityEvents", "Community events"),
    t("landing.topicFundraising", "Fundraising"),
  ];
}

export async function TopicsSection() {
  const t = await getT();
  const TOPICS = topics(t);
  return (
    <section className="border-t border-[color:var(--color-border-soft)] bg-[color:var(--color-surface-muted)]">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="max-w-2xl">
          <h2 className="text-[30px] font-semibold leading-tight tracking-[-0.025em] sm:text-[38px]">
            {t("landing.topicsTitle", "Whatever it is, someone here has been through it.")}
          </h2>
          <p className="mt-4 text-[16.5px] leading-relaxed text-[color:var(--color-text-muted)]">
            {t(
              "landing.topicsBlurb",
              "Rooms are organised by topic and moderated by people, not keywords. Some are open to anyone. Some you join first. The hardest ones are answered by trained peer supporters.",
            )}
          </p>
        </div>

        <ul className="mt-10 flex flex-wrap gap-2.5">
          {TOPICS.map((t) => (
            <li key={t}>
              <Link
                href="/chatrooms"
                className="inline-flex rounded-full border border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)] px-4 py-2 text-[14px] font-medium transition-colors hover:border-[color:var(--color-brand)] hover:text-[color:var(--color-brand)]"
              >
                {t}
              </Link>
            </li>
          ))}
        </ul>

        <PhotoStrip className="mt-12" />

        <p className="mt-6 text-[14px] text-[color:var(--color-text-muted)]">
          {t("landing.mapNote", "Plus a map of real programmes, clinics, shelters and food banks near you \u2014")}{" "}
          <Link href="/places" className="font-medium text-[color:var(--color-brand)] hover:underline">
            {t("landing.mapLink", "with opening hours and who to ask for")}
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

/* ── 3. what's private ───────────────────────────────────────── */

/**
 * THIS SECTION TELLS THE TRUTH, INCLUDING THE UNFLATTERING HALF.
 *
 * Anonymous posting hides your name from READERS. It does not hide it
 * from moderators — the schema keeps the author id precisely so abuse
 * stays moderatable (see the note above `enum PostStatus`). Claiming
 * otherwise on the page that persuades someone to write down the worst
 * thing in their life would be the single worst thing this site could
 * do, and they would find out at the worst possible moment.
 *
 * Saying it plainly also happens to be reassuring: it is the sentence
 * that proves somebody is watching the room.
 */
function privacy(t: TFunction) {
  return [
    {
      title: t("landing.priv1", "Anonymous is anonymous to other people"),
      icon: "mask" as const,
      body: t(
        "landing.priv1Body",
        "Post without your name and readers see \u201cAnonymous member\u201d. Moderators can still see who wrote it \u2014 that is how abuse gets dealt with, and we would rather say so than let you find out later.",
      ),
    },
    {
      title: t("landing.priv2", "You choose it room by room"),
      icon: "toggle" as const,
      body: t(
        "landing.priv2Body",
        "Be anonymous where you are talking about addiction, and yourself where you are organising a shelter shift. It is a setting per room, not per account.",
      ),
    },
    {
      title: t("landing.priv3", "Your email is never shown"),
      icon: "shield" as const,
      body: t(
        "landing.priv3Body",
        "Not on your profile, not on a post, not to anyone you message. It is how you sign in and how we send you a password reset. Nothing else.",
      ),
    },
    {
      title: t("landing.priv4", "Reading costs nothing"),
      icon: "book" as const,
      body: t(
        "landing.priv4Body",
        "The wall, the rooms, the map and the live broadcasts can all be read without an account. You only need one to speak.",
      ),
    },
  ];
}

export async function PrivacySection() {
  const t = await getT();
  const PRIVACY = privacy(t);
  return (
    <section className="border-t border-[color:var(--color-border-soft)] bg-[color:var(--color-surface)]">
      <div className="mx-auto max-w-6xl px-6 py-20 sm:py-24">
        <div className="max-w-2xl">
          <h2 className="text-[30px] font-semibold leading-tight tracking-[-0.025em] sm:text-[38px]">
            {t("landing.privacyTitle", "What's private, and what isn't.")}
          </h2>
          <p className="mt-4 text-[16.5px] leading-relaxed text-[color:var(--color-text-muted)]">
            {t("landing.privacyBlurb", "Written plainly, including the parts that are not in our favour.")}
          </p>
        </div>

        <dl className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2">
          {PRIVACY.map((p) => (
            <div key={p.title} className="flex gap-4">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--color-brand-tint)] text-[color:var(--color-brand)]">
                <LandingIcon name={p.icon} size={21} />
              </span>
              <div>
                <dt className="text-[16.5px] font-semibold leading-snug tracking-[-0.01em]">
                  {p.title}
                </dt>
                <dd className="mt-2 text-[14.5px] leading-relaxed text-[color:var(--color-text-muted)]">
                  {p.body}
                </dd>
              </div>
            </div>
          ))}
        </dl>

        <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link
            href="/signup"
            className="inline-flex h-12 items-center rounded-full bg-[color:var(--color-brand)] px-7 text-[15px] font-semibold text-[color:var(--color-on-brand)] transition-colors hover:bg-[color:var(--color-brand-hover)]"
          >
            {t("landing.createAccount", "Create an account")}
          </Link>
          {/* The quiet option, given equal billing. For a good number of
              people arriving here it is the only one they are ready for
              today, and hiding it would push them off the page. */}
          <Link
            href="/chatrooms"
            className="text-[15px] font-medium text-[color:var(--color-text-muted)] underline-offset-4 hover:text-[color:var(--color-brand)] hover:underline"
          >
            {t("landing.lookAround", "Or just look around first")}
          </Link>
        </div>
      </div>
    </section>
  );
}
