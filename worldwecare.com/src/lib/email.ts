/**
 * Email sending.
 *
 * Send flow:
 *   1. Load the enabled template by slug.
 *   2. Render subject + body with Mustache-style {{var}} substitution.
 *   3. POST to the provider's REST API (no SDK — one HTTP call, no deps).
 *   4. Log the attempt into email_logs regardless of success / failure
 *      so the Email Logs page can show what went out.
 *
 * The provider config (API key, from address, from name) lives in
 * platform_settings under the `email.*` keys — the admin edits it
 * from /admin/settings/email.
 */

import { EmailStatus } from "@prisma/client";
import { prisma } from "./db";
import { getSetting } from "./settings";

/*
 * THE PROVIDER'S ENDPOINT, AND THE ONE PLACE ITS NAME HAS TO SURVIVE.
 *
 * The vendor's name was taken out of every label and every message an
 * admin reads. It cannot come out of THIS: it is the URL email is
 * actually POSTed to. Change it and nothing sends.
 *
 * The same goes for the two setting keys below. They are the names the
 * values are STORED under, and a live installation has a key sitting
 * under that exact string — which is why the local field was renamed to
 * `apiKey` and the key itself was left spelled as it has always been.
 * Renaming either orphans it: the settings row stays in the database,
 * `getSetting` looks for the new name, finds nothing, and email stops
 * with "API key is not configured" while the key is plainly visible in
 * the admin. Invisible to every reader, load-bearing to the feature.
 */
const PROVIDER_URL = "https://api.resend.com/emails";

interface EmailConfig {
  provider: string;
  apiKey: string;
  fromEmail: string;
  fromName: string;
  replyToEmail: string;
  enabled: boolean;
}

async function loadConfig(): Promise<EmailConfig> {
  const [provider, apiKey, fromEmail, fromName, replyToEmail, enabled] =
    await Promise.all([
      getSetting<string>("email.provider", "resend"),
      getSetting<string>("email.resendApiKey", ""),
      getSetting<string>("email.fromEmail", ""),
      getSetting<string>("email.fromName", ""),
      getSetting<string>("email.replyToEmail", ""),
      getSetting<boolean>("email.enabled", false),
    ]);
  return { provider, apiKey, fromEmail, fromName, replyToEmail, enabled };
}

/**
 * Mustache-style variable substitution. `{{name}}` gets replaced with
 * the string value of `vars.name`. Missing vars leave the token in
 * place (visible in the email) so the admin notices the mistake
 * rather than the recipient getting a silent empty string.
 */
export function renderTemplate(
  input: string,
  vars: Record<string, string | number>,
): string {
  return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => {
    const v = vars[key];
    if (v === undefined || v === null) return `{{${key}}}`;
    return String(v);
  });
}

export interface SendEmailInput {
  templateSlug: string;
  to: string;
  variables: Record<string, string | number>;
}

export interface SendEmailResult {
  ok: boolean;
  status: "sent" | "skipped" | "failed";
  message?: string;
  providerId?: string;
}

/**
 * Send an email using the named template. Records the attempt in
 * email_logs. Returns a discriminated result so callers know whether
 * to retry / warn the user.
 */
export async function sendEmail(
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const cfg = await loadConfig();
  const template = await prisma.emailTemplate
    .findUnique({ where: { slug: input.templateSlug } })
    .catch(() => null);

  if (!template) {
    return { ok: false, status: "failed", message: "Template not found" };
  }

  const subject = renderTemplate(template.subject, input.variables);
  const html = renderTemplate(template.htmlBody, input.variables);
  const text = template.textBody
    ? renderTemplate(template.textBody, input.variables)
    : undefined;

  const fromLabel = cfg.fromName
    ? `${cfg.fromName} <${cfg.fromEmail}>`
    : cfg.fromEmail;

  // Log the attempt up front — flip status once we know the outcome.
  const log = await prisma.emailLog.create({
    data: {
      templateSlug: input.templateSlug,
      toEmail: input.to,
      fromEmail: cfg.fromEmail || "unset",
      subject,
      status: EmailStatus.QUEUED,
    },
  });

  // Guardrails BEFORE hitting the wire.
  if (!template.enabled) {
    await prisma.emailLog.update({
      where: { id: log.id },
      data: {
        status: EmailStatus.FAILED,
        errorMessage: "Template is disabled",
      },
    });
    return {
      ok: false,
      status: "skipped",
      message: "Template is disabled",
    };
  }
  if (!cfg.enabled) {
    await prisma.emailLog.update({
      where: { id: log.id },
      data: {
        status: EmailStatus.FAILED,
        errorMessage: "Email delivery is turned off in settings",
      },
    });
    return {
      ok: false,
      status: "skipped",
      message: "Email delivery is turned off in settings",
    };
  }
  if (!cfg.apiKey) {
    await prisma.emailLog.update({
      where: { id: log.id },
      data: {
        status: EmailStatus.FAILED,
        errorMessage: "Email API key is not configured",
      },
    });
    return {
      ok: false,
      status: "failed",
      message: "Email API key is not configured",
    };
  }
  if (!cfg.fromEmail) {
    await prisma.emailLog.update({
      where: { id: log.id },
      data: {
        status: EmailStatus.FAILED,
        errorMessage: "From address is not configured",
      },
    });
    return {
      ok: false,
      status: "failed",
      message: "From address is not configured",
    };
  }

  try {
    const body: Record<string, unknown> = {
      from: fromLabel,
      to: [input.to],
      subject,
      html,
    };
    if (text) body.text = text;
    if (cfg.replyToEmail) body.reply_to = cfg.replyToEmail;

    const res = await fetch(PROVIDER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      error?: { message?: string } | string;
    };
    if (!res.ok) {
      const errMsg =
        typeof data.error === "string"
          ? data.error
          : data.error?.message ?? data.message ?? `HTTP ${res.status}`;
      await prisma.emailLog.update({
        where: { id: log.id },
        data: {
          status: EmailStatus.FAILED,
          errorMessage: errMsg,
        },
      });
      return { ok: false, status: "failed", message: errMsg };
    }
    await prisma.emailLog.update({
      where: { id: log.id },
      data: {
        status: EmailStatus.SENT,
        providerId: data.id ?? null,
        sentAt: new Date(),
      },
    });
    return { ok: true, status: "sent", providerId: data.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await prisma.emailLog.update({
      where: { id: log.id },
      data: { status: EmailStatus.FAILED, errorMessage: msg },
    });
    return { ok: false, status: "failed", message: msg };
  }
}
