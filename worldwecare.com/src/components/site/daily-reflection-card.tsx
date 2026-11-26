"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "./locale-context";
import { TranslatedContent } from "./translated-content";

type Payload = { quote: { id: string; body: string; attribution: string | null } | null; question: { id: string; body: string; reflection: { body: string } | null } | null };

export function DailyReflectionCard() {
  const t = useT();
  const [data, setData] = useState<Payload | null>(null);
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { fetch("/api/user/daily-reflection").then((r) => r.json()).then((d: Payload) => { setData(d); setBody(d.question?.reflection?.body ?? ""); }).catch(() => setData({ quote: null, question: null })); }, []);
  if (!data || (!data.quote && !data.question)) return null;
  const save = async () => {
    if (!data.question || !body.trim()) return; setSaving(true);
    const res = await fetch("/api/user/daily-reflection", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionId: data.question.id, body }) });
    if (res.ok) { setData({ ...data, question: { ...data.question, reflection: { body } } }); setOpen(false); }
    setSaving(false);
  };
  return <section className="overflow-hidden rounded-[16px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] shadow-[var(--shadow-card)]">
    {data.quote && <div className="border-l-[3px] border-[color:var(--color-brand)] bg-[color:var(--color-brand-tint)] px-4 py-4 sm:px-5"><div className="max-w-[92ch]"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-brand-ink)]">{t("reflection.quoteLabel", "Today's gentle reminder")}</p><blockquote className="mt-2.5 text-[13.5px] leading-6 text-[color:var(--color-text)]">“<TranslatedContent kind="dailyQuote" id={data.quote.id} field="body" text={data.quote.body} toggle={false} />”</blockquote>{data.quote.attribution && <p className="mt-2 text-[12px] font-medium text-[color:var(--color-text-muted)]">— <TranslatedContent kind="dailyQuote" id={data.quote.id} field="attribution" text={data.quote.attribution} toggle={false} /></p>}</div></div>}
    {data.question && <div className={`px-4 py-4 sm:px-5 ${data.quote ? "border-t border-[color:var(--color-border-soft)]" : ""}`}><div className="max-w-[92ch]"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[color:var(--color-brand-ink)]">{t("reflection.questionLabel", "A question for today")}</p><p className="mt-2 text-[13.5px] leading-6 text-[color:var(--color-text)]"><TranslatedContent kind="dailyQuestion" id={data.question.id} field="body" text={data.question.body} toggle={false} /></p>{open ? <div className="mt-3"><textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} rows={4} placeholder={t("reflection.placeholder", "This is private — only you can see it.")} className="w-full rounded-[12px] border bg-[color:var(--color-surface)] p-3 text-[13px] leading-relaxed focus:outline-none focus:ring-4 focus:ring-[color:var(--color-brand-soft)]" /><div className="mt-2 flex justify-end gap-2"><Button variant="ghost" size="sm" onClick={() => setOpen(false)}>{t("common.cancel", "Cancel")}</Button><Button size="sm" loading={saving} disabled={!body.trim()} onClick={save}>{t("journal.savePrivately", "Save privately")}</Button></div></div> : <button type="button" onClick={() => setOpen(true)} className="mt-3 min-h-9 rounded-[9px] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-2.5 text-[12px] font-medium text-[color:var(--color-brand-ink)] hover:bg-[color:var(--color-brand-tint)]">{data.question.reflection
      ? t("reflection.edit", "Edit private reflection")
      : t("reflection.start", "Reflect privately")}</button>}</div></div>}
  </section>;
}
