/**
 * The donation receipt template.
 *
 *   npm run db:seed-payment-emails
 *
 * Create-only, like the template block in `seed.ts`: running it again
 * will not overwrite wording an admin has edited at
 * /admin/settings/email-templates. Safe to run on production, and safe
 * to run twice.
 *
 * Until this has run, `sendDonationReceipt` finds no template and
 * quietly sends nothing — the donation is unaffected.
 */

import { PrismaClient, type Prisma } from "@prisma/client";

const prisma = new PrismaClient();

const html = () => `<!doctype html>
<html><body style="margin:0;padding:0;background:#f7f5f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f5f2;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;padding:32px;">
        <tr><td>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#1a1510;">Hi {{name}},</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#1a1510;">
            Thank you. Your donation of <strong>{{amount}}</strong> to {{cause}} came through on {{date}}.
          </p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f5f2;border-radius:12px;padding:16px;margin:0 0 20px;">
            <tr><td style="font-size:14px;line-height:1.7;color:#605a52;">
              <strong style="color:#1a1510;">{{amount}}</strong><br>
              {{cause}}<br>
              {{date}}
            </td></tr>
          </table>
          <p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#605a52;">
            Keep this email for your records. Payment was handled by Stripe; your card details were never stored by {{siteName}}.
          </p>
          <p style="margin:0;font-size:14px;line-height:1.6;color:#605a52;">— The {{siteName}} team</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

const text = () => `Hi {{name}},

Thank you. Your donation of {{amount}} to {{cause}} came through on {{date}}.

  {{amount}}
  {{cause}}
  {{date}}

Keep this email for your records. Payment was handled by Stripe; your
card details were never stored by {{siteName}}.

— The {{siteName}} team
{{appUrl}}`;

const TEMPLATES = [
  {
    slug: "donation_receipt",
    name: "Donation receipt",
    description:
      "Sent to the donor once Stripe confirms the payment. Sent on the webhook, not the redirect, so it only goes out for money actually taken.",
    subject: "Your {{amount}} donation to {{cause}}",
    previewText: "Thank you — here's your receipt.",
    htmlBody: html(),
    textBody: text(),
    variables: ["name", "amount", "cause", "date", "siteName", "appUrl"],
  },
];

async function main() {
  let added = 0;
  let kept = 0;
  for (const t of TEMPLATES) {
    const existing = await prisma.emailTemplate.findUnique({ where: { slug: t.slug } });
    if (existing) {
      kept++;
      console.log(`  kept   ${t.slug} (already present — not overwritten)`);
      continue;
    }
    await prisma.emailTemplate.create({
      data: { ...t, variables: t.variables as Prisma.InputJsonValue },
    });
    added++;
    console.log(`  added  ${t.slug}`);
  }
  console.log(`\n${added} added, ${kept} left alone.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
