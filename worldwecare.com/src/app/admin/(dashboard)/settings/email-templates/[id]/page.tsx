import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { SettingsShell } from "@/components/admin/settings-shell";
import { TemplateEditor } from "./editor";

// Dynamic — includes the template's human name for tab clarity.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const t = await prisma.emailTemplate
    .findUnique({ where: { id }, select: { name: true } })
    .catch(() => null);
  return { title: t ? `${t.name} · Email template` : "Email template" };
}

export default async function EmailTemplateEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const template = await prisma.emailTemplate.findUnique({ where: { id } });
  if (!template) notFound();

  return (
    <SettingsShell
      title={template.name}
      subtitle={template.description ?? `Template slug: ${template.slug}`}
    >
      <TemplateEditor
        initial={{
          id: template.id,
          slug: template.slug,
          name: template.name,
          description: template.description ?? "",
          subject: template.subject,
          previewText: template.previewText ?? "",
          htmlBody: template.htmlBody,
          textBody: template.textBody ?? "",
          variables: Array.isArray(template.variables)
            ? (template.variables as string[])
            : [],
          enabled: template.enabled,
        }}
      />
    </SettingsShell>
  );
}
