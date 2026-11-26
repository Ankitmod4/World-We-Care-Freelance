/**
 * Seed the initial admin user + default platform settings + default
 * email templates.
 *
 * Idempotent: keyed on emails / slugs. Re-running does not overwrite
 * existing rows — we only insert when the row is missing. To reset a
 * setting or template, edit it from the admin UI (or delete the row
 * manually and re-run).
 *
 * Run:
 *   npm run db:seed
 */

import { PrismaClient, AdminRole, Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const BCRYPT_COST = 10;

const SEED_ADMIN = {
  email: "admin@worldwecare.local",
  password: "changeme123",
  displayName: "Owner",
  role: AdminRole.OWNER,
};

// ── Default platform settings ─────────────────────────────────────
// Grouped by page in the admin. Values are JSON — booleans, strings,
// objects all round-trip cleanly.
const DEFAULT_SETTINGS: Array<{
  key: string;
  group: string;
  value: Prisma.InputJsonValue;
}> = [
  // General
  { key: "general.siteName", group: "general", value: "WorldWeCare" },
  {
    key: "general.tagline",
    group: "general",
    value: "People helping people.",
  },
  {
    key: "general.description",
    group: "general",
    value:
      "A calm place where anyone can quietly find support and take the next small step.",
  },
  { key: "general.textLogo", group: "general", value: "WorldWeCare" },
  { key: "general.svgLogo", group: "general", value: "" },
  { key: "general.logoUrl", group: "general", value: "" },
  { key: "general.faviconUrl", group: "general", value: "" },
  { key: "general.supportEmail", group: "general", value: "" },

  // Email delivery
  { key: "email.provider", group: "email", value: "resend" },
  { key: "email.resendApiKey", group: "email", value: "" },
  { key: "email.fromEmail", group: "email", value: "no-reply@worldwecare.local" },
  { key: "email.fromName", group: "email", value: "WorldWeCare" },
  { key: "email.replyToEmail", group: "email", value: "" },
  { key: "email.enabled", group: "email", value: false },

  // Storage
  { key: "storage.provider", group: "storage", value: "local" },
  { key: "storage.localPath", group: "storage", value: "/uploads" },
  { key: "storage.maxFileMB", group: "storage", value: 8 },
  { key: "storage.publicBaseUrl", group: "storage", value: "" },

  // Cache
  { key: "cache.enabled", group: "cache", value: true },
  { key: "cache.defaultTtlSeconds", group: "cache", value: 300 },
];

// ── Default email templates ───────────────────────────────────────
// Simple Mustache-style variables — `{{name}}`, `{{appUrl}}`, etc.
// The htmlBody uses inline styles because email clients strip <style>
// blocks unreliably. Keep the palette matching the app (sky-500).
const DEFAULT_TEMPLATES = [
  {
    slug: "welcome",
    name: "Welcome email",
    description:
      "Sent when a new community member finishes signup. Warm, calm, no ask.",
    subject: "Welcome to {{siteName}}, {{name}}",
    previewText: "You don't have to say anything until you're ready.",
    htmlBody: welcomeHtml(),
    textBody: welcomeText(),
    variables: ["name", "email", "siteName", "appUrl"],
  },
  {
    slug: "email_confirm",
    name: "Email confirmation",
    description:
      "Verifies a new email address. Send when the user signs up or changes their address.",
    subject: "Confirm your email on {{siteName}}",
    previewText: "One tap to confirm.",
    htmlBody: emailConfirmHtml(),
    textBody: emailConfirmText(),
    variables: ["name", "confirmLink", "siteName", "appUrl"],
  },
  {
    slug: "password_reset",
    name: "Password reset request",
    description:
      "Sent when a user asks to reset their password. Link expires in 10 minutes.",
    subject: "Reset your {{siteName}} password",
    previewText: "Link expires in 10 minutes.",
    htmlBody: passwordResetHtml(),
    textBody: passwordResetText(),
    variables: ["name", "resetLink", "siteName", "appUrl", "minutes"],
  },
  {
    slug: "password_reset_confirmed",
    name: "Password reset confirmation",
    description:
      "Sent after a password has been successfully changed. Alerts the user in case they didn't do it.",
    subject: "Your {{siteName}} password was changed",
    previewText: "If this wasn't you, contact support immediately.",
    htmlBody: passwordResetConfirmedHtml(),
    textBody: passwordResetConfirmedText(),
    variables: ["name", "supportEmail", "siteName", "appUrl"],
  },
];

async function main(): Promise<void> {
  console.log("Seeding WorldWeCare\n");

  // ── Admin user ──
  const existingAdmin = await prisma.adminUser.findUnique({
    where: { email: SEED_ADMIN.email },
  });
  if (existingAdmin) {
    console.log(
      `→ Admin ${SEED_ADMIN.email} already exists (id: ${existingAdmin.id}).`,
    );
  } else {
    const passwordHash = await bcrypt.hash(SEED_ADMIN.password, BCRYPT_COST);
    const row = await prisma.adminUser.create({
      data: {
        email: SEED_ADMIN.email,
        passwordHash,
        displayName: SEED_ADMIN.displayName,
        role: SEED_ADMIN.role,
      },
    });
    console.log(`✓ Created admin ${row.email}`);
    console.log(`  Password: ${SEED_ADMIN.password}`);
  }

  // ── Platform settings ──
  let insertedSettings = 0;
  let skippedSettings = 0;
  for (const s of DEFAULT_SETTINGS) {
    const existing = await prisma.platformSetting.findUnique({
      where: { key: s.key },
    });
    if (existing) {
      skippedSettings++;
      continue;
    }
    await prisma.platformSetting.create({
      data: { key: s.key, group: s.group, value: s.value },
    });
    insertedSettings++;
  }
  console.log(
    `→ Platform settings: ${insertedSettings} inserted, ${skippedSettings} existing.`,
  );

  // ── Email templates ──
  let insertedTemplates = 0;
  let skippedTemplates = 0;
  for (const t of DEFAULT_TEMPLATES) {
    const existing = await prisma.emailTemplate.findUnique({
      where: { slug: t.slug },
    });
    if (existing) {
      skippedTemplates++;
      continue;
    }
    await prisma.emailTemplate.create({
      data: {
        slug: t.slug,
        name: t.name,
        description: t.description,
        subject: t.subject,
        previewText: t.previewText,
        htmlBody: t.htmlBody,
        textBody: t.textBody,
        variables: t.variables as Prisma.InputJsonValue,
      },
    });
    insertedTemplates++;
  }
  console.log(
    `→ Email templates: ${insertedTemplates} inserted, ${skippedTemplates} existing.\n`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });

// ── Email template bodies (kept at the bottom to keep main() short) ─

function baseWrapper(inner: string): string {
  return `<!DOCTYPE html>
<html lang="en"><body style="margin:0;padding:0;background:#f0f9ff;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f0f9ff"><tr><td align="center" style="padding:40px 16px">
  <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:16px;box-shadow:0 1px 3px rgba(15,23,42,0.06),0 12px 32px rgba(15,23,42,0.08);overflow:hidden">
    <tr><td style="padding:28px 32px 8px 32px">
      <div style="font-size:20px;font-weight:600;letter-spacing:-0.01em;color:#0ea5e9">{{siteName}}</div>
    </td></tr>
    <tr><td style="padding:8px 32px 32px 32px;font-size:15px;line-height:1.6;color:#0f172a">
      ${inner}
    </td></tr>
    <tr><td style="padding:20px 32px;border-top:1px solid #eef2f7;font-size:12px;color:#94a3b8">
      Sent by {{siteName}} — <a href="{{appUrl}}" style="color:#0ea5e9;text-decoration:none">{{appUrl}}</a>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

function button(label: string, hrefVar: string): string {
  return `<a href="{{${hrefVar}}}" style="display:inline-block;background:#0ea5e9;color:#ffffff;padding:12px 22px;border-radius:12px;font-weight:600;text-decoration:none;font-size:14px">${label}</a>`;
}

function welcomeHtml(): string {
  return baseWrapper(`
    <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:600;letter-spacing:-0.01em">Welcome, {{name}} 👋</h1>
    <p style="margin:0 0 14px 0">You've joined {{siteName}}. There's no pressure here — you can quietly read for a while, post anonymously when you're ready, and take the next small step in your own time.</p>
    <p style="margin:0 0 24px 0">Whenever you're ready, jump back in:</p>
    <p style="margin:0 0 24px 0">${button("Open your feed", "appUrl")}</p>
    <p style="margin:0;color:#64748b;font-size:13px">If this wasn't you, ignore this message — no account was created without a password confirmation.</p>
  `);
}
function welcomeText(): string {
  return `Welcome, {{name}}.

You've joined {{siteName}}. There's no pressure — read quietly, post when you're ready.

Open your feed: {{appUrl}}
`;
}

function emailConfirmHtml(): string {
  return baseWrapper(`
    <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:600;letter-spacing:-0.01em">Confirm your email</h1>
    <p style="margin:0 0 14px 0">Hi {{name}}, tap the button below to confirm this email address for your {{siteName}} account.</p>
    <p style="margin:0 0 24px 0">${button("Confirm email", "confirmLink")}</p>
    <p style="margin:0 0 8px 0;color:#64748b;font-size:13px">Or paste this link into your browser:</p>
    <p style="margin:0 0 20px 0;word-break:break-all"><a href="{{confirmLink}}" style="color:#0ea5e9">{{confirmLink}}</a></p>
    <p style="margin:0;color:#64748b;font-size:13px">This link is safe to ignore if you didn't sign up.</p>
  `);
}
function emailConfirmText(): string {
  return `Hi {{name}}, confirm your email for {{siteName}}: {{confirmLink}}`;
}

function passwordResetHtml(): string {
  return baseWrapper(`
    <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:600;letter-spacing:-0.01em">Reset your password</h1>
    <p style="margin:0 0 14px 0">Hi {{name}}, we got a request to reset your {{siteName}} password. Tap the button below to choose a new one.</p>
    <p style="margin:0 0 24px 0">${button("Reset password", "resetLink")}</p>
    <p style="margin:0 0 12px 0;color:#64748b;font-size:13px">This link expires in {{minutes}} minutes. If you didn't ask for it, ignore this email — nothing has changed.</p>
  `);
}
function passwordResetText(): string {
  return `Reset your {{siteName}} password (expires in {{minutes}} minutes): {{resetLink}}\n\nIf you didn't ask for this, ignore it — nothing has changed.`;
}

function passwordResetConfirmedHtml(): string {
  return baseWrapper(`
    <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:600;letter-spacing:-0.01em">Your password was changed</h1>
    <p style="margin:0 0 14px 0">Hi {{name}}, this is a heads-up that your {{siteName}} password was just changed.</p>
    <p style="margin:0 0 14px 0"><strong>Was this you?</strong> Great — no action needed.</p>
    <p style="margin:0 0 14px 0"><strong>Not you?</strong> Reply to this email or contact <a href="mailto:{{supportEmail}}" style="color:#0ea5e9">{{supportEmail}}</a> immediately. We'll help you regain access.</p>
  `);
}
function passwordResetConfirmedText(): string {
  return `Your {{siteName}} password was changed. If this wasn't you, contact {{supportEmail}} immediately.`;
}
