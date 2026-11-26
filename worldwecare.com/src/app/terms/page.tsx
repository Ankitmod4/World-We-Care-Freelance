import type { Metadata } from "next";
import { LegalPage, Section } from "@/components/site/legal-page";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.terms.title", "Terms of use"),
    description: t("page.terms.description", "The rules for using WorldWeCare."),
  };
}

export default async function TermsPage() {
  const t = await getT();
  return (
    <LegalPage title={t("terms.title", "Terms of use")} updated="August 2026">
      <p>
        {t(
          "terms.WorldwecareIsACommunity",
          "WorldWeCare is a community for people supporting each other through recovery, mental health and the causes around them. Using it means agreeing to the following.",
        )}
      </p>

      <Section heading={t("terms.WhoCanJoin", "Who can join")}>
        <p>
          {t(
            "terms.YouNeedToBe",
            "You need to be 18 or over to hold an account. One account per person. Give us an email address you can actually reach, because that is how we confirm it is you and how we reach you if something goes wrong.",
          )}
        </p>
      </Section>

      <Section heading={t("terms.ThisIsNotMedical", "This is not medical care")}>
        <p>
          {t(
            "terms.NothingHereIsMedical",
            "Nothing here is medical, clinical, legal or financial advice, and nobody here is your doctor. The directory lists places other people have found useful; it is not a referral, an endorsement, or a promise that any of them can help you.",
          )}
        </p>
        <p>
          <strong className="text-[color:var(--color-text)]">
            {t("terms.IfYouAreIn", "If you are in immediate danger, contact your local emergency services.")}
          </strong>{" "}
          {t(
            "terms.notMonitored",
            "This site is not monitored around the clock and is not a crisis service.",
          )}
        </p>
      </Section>

      <Section heading={t("terms.HowToBehaveHere", "How to behave here")}>
        <p>{t("terms.PeopleComeHereAt", "People come here at difficult points in their lives. So:")}</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>{t("terms.NoHarassmentThreatsOr", "No harassment, threats, or targeting anyone.")}</li>
          <li>
            {t(
              "terms.NoSharingAnyoneElse",
              "No sharing anyone else's private information, including things said elsewhere on this site.",
            )}
          </li>
          <li>
            {t("terms.NoSellingRecruitingOr", "No selling, recruiting, or promoting treatment programmes for profit.")}
          </li>
          <li>
            {t(
              "terms.NoEncouragingSelfHarm",
              "No encouraging self-harm, disordered eating, or relapse — including as a joke.",
            )}
          </li>
          <li>{t("terms.NothingIllegalAndNothing", "Nothing illegal, and nothing sexual involving minors, ever.")}</li>
        </ul>
        <p>
          {t(
            "terms.AnonymousPostingExistsSo",
            "Anonymous posting exists so people can be honest, not so they can be cruel without it being traced back.",
          )}
        </p>
      </Section>

      <Section heading={t("terms.WhatYouPost", "What you post")}>
        <p>
          {t(
            "terms.YourWordsStayYours",
            "Your words stay yours. By posting you give us permission to display and store your content so the site can function — nothing more. You can delete your posts, and deleting your account removes them.",
          )}
        </p>
        <p>
          {t(
            "terms.DoNotPostAnything",
            "Do not post anything you do not have the right to share, including photographs of other people who have not agreed to it.",
          )}
        </p>
      </Section>

      <Section heading={t("terms.Moderation", "Moderation")}>
        <p>
          {t(
            "terms.WeCanRemoveContent",
            "We can remove content, close chatrooms, and suspend or delete accounts that break these rules. Where we can, we will tell you why. Serious cases — anything that puts someone at risk — we act on first and explain afterwards.",
          )}
        </p>
      </Section>

      <Section heading={t("terms.PlacesEventsAndCampaigns", "Places, events and campaigns")}>
        <p>
          {t(
            "terms.MembersCanSubmitPlaces",
            "Members can submit places and events. We review them before they appear, but review is not verification: opening hours change, services close, and details go stale. Ring ahead. If you find something wrong, use the report link on the listing — that is what it is for.",
          )}
        </p>
      </Section>

      <Section heading={t("terms.EndingIt", "Ending it")}>
        <p>
          {t(
            "terms.YouCanDeleteYour",
            "You can delete your account whenever you like, from your profile. We can close an account that breaks these rules. Either way, these terms stop applying to you once your account is gone, apart from anything that by its nature outlasts it.",
          )}
        </p>
      </Section>

      <Section heading={t("terms.Changes", "Changes")}>
        <p>
          {t(
            "terms.TheseTermsWillChange",
            "These terms will change as the site does. Substantial changes will be announced in the app before they take effect. The date at the top of this page tells you which version you are reading.",
          )}
        </p>
      </Section>
    </LegalPage>
  );
}
