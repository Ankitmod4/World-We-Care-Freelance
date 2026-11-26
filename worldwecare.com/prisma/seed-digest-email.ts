/**
 * The daily digest email template.
 *
 *   npm run db:seed-digest-email
 *
 * Create-only, like the other email seeds: an existing template is left
 * alone, because the whole point of templates living in the database is
 * that the client edits them.
 *
 * The variables it expects: name, siteName, appUrl, quote, attribution,
 * question, streakLine, suggestion, settingsUrl.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SLUG = "daily_digest";

const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f6f5f3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f5f3;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:24px 24px 8px 24px;">
          <p style="margin:0;font-size:13px;color:#8a8580;">Good morning, {{name}}</p>
        </td></tr>

        <tr><td style="padding:8px 24px;">
          <p style="margin:0;font-size:18px;line-height:1.5;color:#1c1b1a;">&ldquo;{{quote}}&rdquo;</p>
          <p style="margin:6px 0 0 0;font-size:13px;color:#8a8580;">{{attribution}}</p>
        </td></tr>

        <tr><td style="padding:16px 24px 0 24px;">
          <div style="border-top:1px solid #eceae7;padding-top:16px;">
            <p style="margin:0;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#8a8580;">Where you're at</p>
            <p style="margin:6px 0 0 0;font-size:15px;color:#1c1b1a;">{{streakLine}}</p>
          </div>
        </td></tr>

        <tr><td style="padding:16px 24px 0 24px;">
          <div style="border-top:1px solid #eceae7;padding-top:16px;">
            <p style="margin:0;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#8a8580;">One small thing</p>
            <p style="margin:6px 0 0 0;font-size:15px;color:#1c1b1a;">{{suggestion}}</p>
          </div>
        </td></tr>

        <tr><td style="padding:16px 24px 0 24px;">
          <div style="border-top:1px solid #eceae7;padding-top:16px;">
            <p style="margin:0;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#8a8580;">Today's question</p>
            <p style="margin:6px 0 0 0;font-size:15px;color:#1c1b1a;">{{question}}</p>
            <p style="margin:4px 0 0 0;font-size:12.5px;color:#8a8580;">Your answer stays private.</p>
          </div>
        </td></tr>

        <tr><td style="padding:20px 24px 24px 24px;">
          <a href="{{appUrl}}/journal" style="display:inline-block;background:#1f6feb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 18px;border-radius:10px;">Open your journal</a>
        </td></tr>

        <tr><td style="padding:0 24px 24px 24px;">
          <p style="margin:0;font-size:12px;color:#a5a09a;">
            You asked for this once a day. <a href="{{settingsUrl}}" style="color:#8a8580;">Change the time or turn it off</a>.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

const text = `Good morning, {{name}}

"{{quote}}"
{{attribution}}

WHERE YOU'RE AT
{{streakLine}}

ONE SMALL THING
{{suggestion}}

TODAY'S QUESTION
{{question}}
(Your answer stays private.)

Open your journal: {{appUrl}}/journal

You asked for this once a day. Change the time or turn it off: {{settingsUrl}}
`;

async function main() {
  const existing = await prisma.emailTemplate.findUnique({ where: { slug: SLUG } });
  if (existing) {
    console.log(`  kept    ${SLUG} — already there, not touched`);
    return;
  }

  await prisma.emailTemplate.create({
    data: {
      slug: SLUG,
      name: "Daily digest",
      description:
        "The opt-in morning email: today's quote, the member's streaks, one suggestion, and today's question. Sent by prisma/send-digests.ts, which needs a cron.",
      subject: "{{siteName}} — your morning",
      previewText: "{{suggestion}}",
      htmlBody: html,
      textBody: text,
      variables: [
        "name",
        "siteName",
        "appUrl",
        "quote",
        "attribution",
        "question",
        "streakLine",
        "suggestion",
        "settingsUrl",
      ],
      enabled: true,
    },
  });
  console.log(`  added   ${SLUG}`);
  console.log(
    "\nNothing sends it yet — wire the cron line at the top of prisma/send-digests.ts.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
