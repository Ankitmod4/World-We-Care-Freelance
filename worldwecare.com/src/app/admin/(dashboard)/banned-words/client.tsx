"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardBody } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface Word { id: string; word: string; createdAt: string }

export function BannedWordsClient() {
  const [words, setWords] = useState<Word[] | null>(null);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/banned-words");
    const d = (await res.json().catch(() => ({ words: [] }))) as { words: Word[] };
    setWords(d.words);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const add = async () => {
    if (!input.trim()) return;
    setSaving(true);
    setMsg(null);
    const res = await fetch("/api/admin/banned-words", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ words: input }),
    });
    const d = (await res.json().catch(() => ({}))) as { added?: number; error?: string };
    setSaving(false);
    if (!res.ok) { setMsg(d.error ?? "Failed"); return; }
    setInput("");
    setMsg(`Added ${d.added ?? 0} word${d.added === 1 ? "" : "s"}.`);
    void load();
  };

  const remove = async (id: string) => {
    await fetch(`/api/admin/banned-words/${id}`, { method: "DELETE" });
    void load();
  };

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Banned words</h1>
        <p className="text-[13px] text-[color:var(--color-text-muted)] mt-0.5">
          Words here are hidden with asterisks everywhere on the site — feed, comments, and chatrooms.
          Matching is whole-word and case-insensitive. Nothing is stored censored, so changes apply instantly.
        </p>
      </div>

      <Card><CardBody className="p-4">
        <label className="block text-[12px] font-medium text-[color:var(--color-text-muted)] mb-1">
          Add words (one per line, or comma-separated)
        </label>
        <Textarea value={input} onChange={(e) => setInput(e.target.value)} rows={3} placeholder="e.g. word1, word2&#10;word3" />
        <div className="mt-2 flex items-center gap-2">
          <Button onClick={add} loading={saving}>Add words</Button>
          {msg && <span className="text-[12.5px] text-[color:var(--color-text-muted)]">{msg}</span>}
        </div>
      </CardBody></Card>

      <Card><CardBody className="p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[13px] font-semibold">Blocked list</p>
          {words && <span className="text-[12px] text-[color:var(--color-text-subtle)] tabular-nums">{words.length}</span>}
        </div>
        {words === null ? (
          <p className="text-[13px] text-[color:var(--color-text-subtle)]">Loading…</p>
        ) : words.length === 0 ? (
          <p className="text-[13px] text-[color:var(--color-text-muted)]">No banned words yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {words.map((w) => (
              <span key={w.id} className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--color-surface-muted)] border border-[color:var(--color-border)] pl-3 pr-1.5 py-1 text-[13px]">
                {w.word}
                <button type="button" onClick={() => remove(w.id)} aria-label={`Remove ${w.word}`} className="h-5 w-5 flex items-center justify-center rounded-full text-[color:var(--color-text-subtle)] hover:text-[color:var(--color-danger)] hover:bg-[color:var(--color-surface)]">✕</button>
              </span>
            ))}
          </div>
        )}
      </CardBody></Card>
    </div>
  );
}
