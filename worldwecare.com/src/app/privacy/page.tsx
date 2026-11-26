import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Section } from "@/components/site/legal-page";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.privacy.title", "Privacy notice"),
    description: t("page.privacy.description", "What WorldWeCare collects, why, and what you can do about it."),
  };
}

export default async function PrivacyPage() {
  const t = await getT();
  return (
    <LegalPage title={t("privacy.title", "Privacy notice")} updated="August 2026">
      <p>
        {t(
          "privacy.PeopleTellThisSite",
          "People tell this site things they have not told anyone else. That is the standard this notice is written to.",
        )}
      </p>

      <Section heading={t("privacy.WhatWeHold", "What we hold")}>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong className="text-[color:var(--color-text)]">{t("privacy.holdAccount", "Your account")}</strong> —{" "}
            {t(
              "privacy.holdAccountBody",
              "display name, email address, a hashed password (never the password itself), the country you chose, and when you accepted these terms.",
            )}
          </li>
          <li>
            <strong className="text-[color:var(--color-text)]">{t("privacy.holdPosts", "What you post")}</strong> —{" "}
            {t(
              "privacy.holdPostsBody",
              "posts, comments, chatroom messages, direct messages, and anything you upload.",
            )}
          </li>
          <li>
            <strong className="text-[color:var(--color-text)]">{t("privacy.holdSaved", "What you save")}</strong> —{" "}
            {t(
              "privacy.holdSavedBody",
              "bookmarked places and articles, the rooms you have joined, your saved filters.",
            )}
          </li>
          <li>
            <strong className="text-[color:var(--color-text)]">{t("privacy.holdTech", "Technical records")}</strong> —{" "}
            {t(
              "privacy.holdTechBody",
              "sign-in times and basic server logs, kept so we can keep the site working and secure.",
            )}
          </li>
        </ul>
      </Section>

      <Section heading={t("privacy.WhatAnonymousActuallyMeans", "What anonymous actually means")}>
        <p>
          {t(
            "privacy.PostingAnonymouslyHidesYour",
            "Posting anonymously hides your name from other members. It does not hide it from the database — the post is still linked to your account, because otherwise we could not let you delete it, and could not act when someone abuses anonymity to hurt people. Administrators can see who wrote what.",
          )}
        </p>
        <p>
          {t(
            "privacy.BeAwareOfWhat",
            "Be aware of what you write, not just the name attached to it. A detailed story can identify you whatever the byline says.",
          )}
        </p>
      </Section>

      <Section heading={t("privacy.WhoElseSeesIt", "Who else sees it")}>
        <p>
          {t(
            "privacy.WeDoNotSell",
            "We do not sell your data and we do not run advertising. Your information is shared only with the services needed to run the site — hosting, and an email provider that sends confirmations and notifications — and only what those services need to do their job.",
          )}
        </p>
        <p>
          {t(
            "privacy.WeWillDiscloseInformation",
            "We will disclose information if the law requires it, or where we believe someone is at immediate risk of serious harm.",
          )}
        </p>
      </Section>

      <Section heading={t("privacy.Location", "Location")}>
        <p>
          {t(
            "privacy.TheCountryYouPick",
            "The country you pick is stored on your account so lists can be scoped to where you are. Using “Near me” on the map asks your browser for your position and uses it in that moment to sort what is on screen — that position is not sent to us or stored.",
          )}
        </p>
      </Section>

      <Section heading={t("privacy.HowLongWeKeep", "How long we keep it")}>
        <p>
          {t(
            "privacy.YourAccountAndIts",
            "Your account and its content stay until you delete them. Deleting your account removes your profile and your posts. Some records — the fact that a moderation decision was made, for instance — are kept without your personal details attached, because removing them entirely would undermine the safety of everyone else.",
          )}
        </p>
      </Section>

      <Section heading={t("privacy.WhatYouCanDo", "What you can do")}>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t("privacy.SeeAndEditYour", "See and edit your details from your profile at any time.")}</li>
          <li>{t("privacy.DeleteIndividualPostsOr", "Delete individual posts, or your whole account.")}</li>
          <li>{t("privacy.AskUsForA", "Ask us for a copy of what we hold about you.")}</li>
          <li>{t("privacy.AskUsToCorrect", "Ask us to correct something that is wrong.")}</li>
        </ul>
        <p>
          {t(
            "privacy.DependingOnWhereYou",
            "Depending on where you live you may have further rights over your data. Ask and we will honour them.",
          )}
        </p>
      </Section>

      <Section heading={t("privacy.Cookies", "Cookies")}>
        <p>
          {t(
            "privacy.WeSetACookie",
            "We set a cookie to keep you signed in. That is what it is for and that is all it does. There is no advertising or cross-site tracking on this site.",
          )}
        </p>
      </Section>

      <Section heading={t("privacy.GettingInTouch", "Getting in touch")}>
        <p>
          {t("privacy.questionsGoTo", "Questions about any of this, or a request about your data, go to")}{" "}
          <Link
            href="/contact"
            className="font-medium text-[color:var(--color-brand)] hover:underline"
          >
            {t("privacy.Contact", "Contact")}
          </Link>
          {t("privacy.TellUsWhatYou", ". Tell us what you need and we will answer.")}
        </p>
      </Section>
    </LegalPage>
  );
}
