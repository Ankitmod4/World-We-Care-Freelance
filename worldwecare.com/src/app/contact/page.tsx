import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Section } from "@/components/site/legal-page";
import { getT } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("page.contact.title", "Contact"),
    description: t("page.contact.description", "How to reach the people who run WorldWeCare."),
  };
}

const EMAIL = "contact@worldwecare.com";

/**
 * /contact
 *
 * Not a form. A form with nowhere to land is worse than no form —
 * outbound mail here is template-driven and can be switched off in
 * the admin, which would swallow messages silently. Until there is an
 * inbox in the admin to read them, this page does the honest thing:
 * it points each reason for writing at the route that actually works,
 * and gives a real address for the rest.
 */
export default async function ContactPage() {
  const t = await getT();
  return (
    <LegalPage title={t("contact.title", "Contact")} updated="September 2026">
      <p>
        {t(
          "contact.intro",
          "There is no call centre here \u2014 this is a small team, and messages are read by people, not a queue. Below is the fastest route for each of the reasons people usually write in.",
        )}
      </p>

      <Section heading={t("contact.dangerHeading", "If you are in danger right now")}>
        <p>
          <strong className="text-[color:var(--color-text)]">
            {t("contact.emergency", "Contact your local emergency services.")}
          </strong>{" "}
          {t(
            "contact.dangerBody",
            "This site is not a crisis service and is not monitored around the clock. Nobody is guaranteed to see a message here within minutes, and on the worst night of someone's life that gap matters more than anything else on this page.",
          )}
        </p>
      </Section>

      <Section heading={t("contact.reportHeading", "Reporting a post, a room, or a person")}>
        <p>
          {t(
            "contact.reportBody",
            "Use the report control on the thing itself rather than emailing us. It sends moderators the post, the room and the surrounding conversation attached to the report, which an email cannot carry \u2014 so it is both faster and easier to act on.",
          )}
        </p>
        <p>
          {t(
            "contact.reportException",
            "Email us only if the person you need to report is a moderator, or if reporting them would put you at risk.",
          )}
        </p>
      </Section>

      <Section heading={t("contact.accountHeading", "Your account")}>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            {t("contact.lockedOut", "Locked out \u2014")}{" "}
            <Link
              href="/forgot-password"
              className="font-medium text-[color:var(--color-brand)] hover:underline"
            >
              {t("contact.resetPassword", "reset your password")}
            </Link>
            . {t("contact.resetNote", "The link goes to the address on the account.")}
          </li>
          <li>
            {t(
              "contact.accountChanges",
              "Changing your email, deactivating, or deleting the account permanently \u2014 all in",
            )}{" "}
            <Link
              href="/settings"
              className="font-medium text-[color:var(--color-brand)] hover:underline"
            >
              {t("menu.settings", "Settings")}
            </Link>
            . {t("contact.noNeedToAsk", "You do not need to ask us.")}
          </li>
          <li>
            {t(
              "contact.reactivate",
              "Turning a deactivated account back on \u2014 that one does need us. Write from the email address the account uses.",
            )}
          </li>
        </ul>
      </Section>

      <Section heading={t("contact.elseHeading", "Everything else")}>
        <p>
          {t(
            "contact.elseBody",
            "Bugs, something that reads wrong, press, running a chapter, listing a service in the directory, or a question this page does not answer:",
          )}
        </p>
        <p>
          <a
            href={`mailto:${EMAIL}`}
            className="font-medium text-[color:var(--color-brand)] hover:underline"
          >
            {EMAIL}
          </a>
        </p>
        <p>
          {t(
            "contact.pasteLink",
            "If it is about something on the site, paste the link. It saves a round trip and usually turns a week into a day.",
          )}
        </p>
      </Section>

      <Section heading={t("contact.expectHeading", "What to expect")}>
        <p>
          {t(
            "contact.expectBody",
            "Most messages get a reply within a few working days. Reports of harm or abuse jump that queue. If you have written and heard nothing after a week, write again \u2014 it is far more likely we missed it than that we ignored it.",
          )}
        </p>
      </Section>
    </LegalPage>
  );
}
