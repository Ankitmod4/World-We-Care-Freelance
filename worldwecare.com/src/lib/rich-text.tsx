/**
 * Lightweight, XSS-safe rich-text renderers.
 *
 * Two exports:
 *
 *   • `RichText`  — the compact subset used by user posts, comments,
 *     gratitude and confession bodies. Bold / italic / strikethrough,
 *     line breaks and paragraphs. Behaviour is unchanged from the
 *     original implementation.
 *
 *   • `Markdown`  — the long-form subset used by admin-authored
 *     articles. Everything `RichText` supports plus headings, ordered
 *     and unordered lists, blockquotes, horizontal rules, fenced code
 *     blocks, inline code, links and images.
 *
 * Both render into React nodes — never `dangerouslySetInnerHTML` — so
 * there is no HTML or script injection surface. URLs in links and
 * images are whitelisted to http(s) or site-relative paths, which
 * blocks `javascript:` and `data:` payloads.
 */
import React from "react";
import { cn } from "./utils";
import { toEmbed } from "./embeds";
import { Img } from "@/components/ui/img";

type ParseFn = (text: string, key: string) => React.ReactNode[];

type InlineRule = {
  re: RegExp;
  build: (m: RegExpMatchArray, key: string, parse: ParseFn) => React.ReactNode;
};

/**
 * Only http(s) and site-relative URLs are allowed through. Anything
 * else (javascript:, data:, vbscript:, protocol-relative //evil.com)
 * returns null and the markup is rendered as plain text instead.
 */
function safeUrl(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  // Site-relative — but not protocol-relative "//host".
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  if (/^https?:\/\/[^\s]+$/i.test(url)) return url;
  return null;
}

// ─── Inline rules shared by both renderers ───────────────────────
const BASE_INLINE_RULES: InlineRule[] = [
  // bold (** or __) — recurse
  {
    re: /\*\*([^*]+)\*\*|__([^_]+)__/,
    build: (m, key, parse) => (
      <strong key={key} className="font-semibold">{parse(m[1] ?? m[2], key)}</strong>
    ),
  },
  // strikethrough — recurse
  {
    re: /~~([^~]+)~~/,
    build: (m, key, parse) => <s key={key} className="opacity-80">{parse(m[1], key)}</s>,
  },
  // italic (* or _) — recurse
  {
    re: /\*([^*\n]+)\*|_([^_\n]+)_/,
    build: (m, key, parse) => <em key={key}>{parse(m[1] ?? m[2], key)}</em>,
  },
];

// ─── Extra inline rules for articles ─────────────────────────────
// Ordered before the base rules so a code span or link wins a tie at
// the same index — otherwise `**` inside `code` would be parsed as
// bold.
const ARTICLE_INLINE_RULES: InlineRule[] = [
  // highlight
  {
    re: /==([^=\n]+)==/,
    build: (m, key, parse) => (
      <mark key={key} className="rounded bg-[color:var(--color-brand-soft)] px-1 text-[color:var(--color-text)]">
        {parse(m[1], key)}
      </mark>
    ),
  },
  // inline code — terminal, contents are NOT parsed further
  {
    re: /`([^`\n]+)`/,
    build: (m, key) => (
      <code
        key={key}
        className="rounded-[6px] bg-[color:var(--color-surface-muted)] px-1.5 py-0.5 text-[0.9em] font-mono"
      >
        {m[1]}
      </code>
    ),
  },
  // image  ![alt](url)  — must come before the link rule
  {
    re: /!\[([^\]]*)\]\(([^)\s]+)\)/,
    build: (m, key) => {
      const src = safeUrl(m[2]);
      if (!src) return <React.Fragment key={key}>{m[0]}</React.Fragment>;
      return (
        <Img
          key={key}
          src={src}
          alt={m[1]}
          className="my-4 w-full rounded-2xl object-cover shadow-card"
        />
      );
    },
  },
  // link  [label](url) — terminal apart from emphasis inside the label
  {
    re: /\[([^\]]+)\]\(([^)\s]+)\)/,
    build: (m, key, parse) => {
      const href = safeUrl(m[2]);
      if (!href) return <React.Fragment key={key}>{m[0]}</React.Fragment>;
      const external = /^https?:\/\//i.test(href);
      return (
        <a
          key={key}
          href={href}
          className="font-medium text-[color:var(--color-brand)] underline underline-offset-2 hover:opacity-80"
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {parse(m[1], key)}
        </a>
      );
    },
  },
  ...BASE_INLINE_RULES,
];

function parseInline(
  text: string,
  keyPrefix: string,
  rules: InlineRule[] = BASE_INLINE_RULES,
): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const recurse: ParseFn = (t, k) => parseInline(t, k, rules);
  let rest = text;
  let i = 0;
  // Bounded loop guard — worst case one node per character.
  let guard = 0;
  while (rest.length && guard++ < 5000) {
    let best: { start: number; rule: InlineRule; m: RegExpMatchArray } | null = null;
    for (const rule of rules) {
      const m = rule.re.exec(rest);
      if (m && m.index !== undefined && (best === null || m.index < best.start)) {
        best = { start: m.index, rule, m };
      }
    }
    if (!best) { out.push(rest); break; }
    if (best.start > 0) out.push(rest.slice(0, best.start));
    out.push(best.rule.build(best.m, `${keyPrefix}-${i++}`, recurse));
    rest = rest.slice(best.start + best.m[0].length);
  }
  if (guard >= 5000 && rest.length) out.push(rest);
  return out;
}

// ─── Compact renderer (posts, comments, gratitude, confessions) ──
export function RichText({ text, className }: { text: string; className?: string }) {
  const lines = (text ?? "").replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let para: string[] = [];
  let k = 0;

  const flushPara = () => {
    if (!para.length) return;
    const key = `p${k++}`;
    const buf = para;
    blocks.push(
      <p key={key} className="whitespace-pre-wrap break-words">
        {buf.map((ln, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <br />}
            {parseInline(ln, `${key}-${idx}`)}
          </React.Fragment>
        ))}
      </p>,
    );
    para = [];
  };

  for (const raw of lines) {
    if (raw.trim() === "") { flushPara(); continue; }
    para.push(raw);
  }
  flushPara();

  return <div className={cn("space-y-2", className)}>{blocks}</div>;
}

// ─── Long-form renderer (articles) ───────────────────────────────

/** Split a Markdown table row into trimmed cells. */
function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

/** A `| --- | :--: |` style separator line. */
function isTableSeparator(line: string): boolean {
  const t = line.trim();
  return t.includes("-") && /^\|?[\s:|-]+\|?$/.test(t);
}

const H_CLASSES: Record<number, string> = {
  1: "mt-8 mb-3 text-[28px] sm:text-[32px] font-semibold tracking-[-0.02em] leading-tight",
  2: "mt-8 mb-3 text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] leading-tight",
  3: "mt-6 mb-2 text-[18px] sm:text-[20px] font-semibold tracking-[-0.01em]",
  4: "mt-5 mb-2 text-[16px] sm:text-[17px] font-semibold",
};

export function Markdown({ text, className }: { text: string; className?: string }) {
  const lines = (text ?? "").replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let k = 0;
  let i = 0;

  const inline = (t: string, key: string) => parseInline(t, key, ARTICLE_INLINE_RULES);

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Blank line — nothing to emit, spacing comes from block margins.
    if (trimmed === "") { i++; continue; }

    // Fenced code block ``` … ```
    if (/^```/.test(trimmed)) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        buf.push(lines[i]);
        i++;
      }
      i++; // consume closing fence
      blocks.push(
        <pre
          key={`c${k++}`}
          className="my-4 overflow-x-auto rounded-2xl bg-[color:var(--color-surface-muted)] p-4 text-[13px] leading-relaxed"
        >
          <code className="font-mono">{buf.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(<hr key={`h${k++}`} className="my-8 border-[color:var(--color-border)]" />);
      i++;
      continue;
    }

    // Heading  # … ####
    const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    if (heading) {
      const level = heading[1].length;
      const Tag = (`h${Math.min(level + 1, 6)}`) as "h2" | "h3" | "h4" | "h5";
      const key = `hd${k++}`;
      blocks.push(
        <Tag key={key} className={H_CLASSES[level]}>
          {inline(heading[2], key)}
        </Tag>,
      );
      i++;
      continue;
    }

    // Blockquote — consecutive "> " lines
    if (/^>\s?/.test(trimmed)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) {
        buf.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      const key = `q${k++}`;
      blocks.push(
        <blockquote
          key={key}
          className="my-5 border-l-4 border-[color:var(--color-brand)] pl-4 italic text-[color:var(--color-text-muted)]"
        >
          {buf.map((ln, idx) => (
            <p key={idx} className="mb-1 last:mb-0">{inline(ln, `${key}-${idx}`)}</p>
          ))}
        </blockquote>,
      );
      continue;
    }

    // Embed — @[embed](url). Only whitelisted providers become an
    // iframe (see lib/embeds.ts); anything else degrades to a link.
    const embedMatch = /^@\[embed\]\(([^)\s]+)\)$/.exec(trimmed);
    if (embedMatch) {
      const key = `em${k++}`;
      const info = toEmbed(embedMatch[1]);
      i++;
      if (!info) {
        const safe = safeUrl(embedMatch[1]);
        blocks.push(
          <p key={key} className="my-4">
            {safe ? (
              <a
                href={safe}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[color:var(--color-brand)] underline underline-offset-2"
              >
                {embedMatch[1]}
              </a>
            ) : (
              embedMatch[1]
            )}
          </p>,
        );
        continue;
      }
      blocks.push(
        <figure key={key} className="my-6">
          {info.kind === "video" ? (
            <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-card">
              <iframe
                src={info.src}
                title={info.title}
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            </div>
          ) : (
            <iframe
              src={info.src}
              title={info.title}
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="autoplay; clipboard-write; encrypted-media"
              style={{ height: info.height ?? 166 }}
              className="w-full rounded-2xl border-0"
            />
          )}
        </figure>,
      );
      continue;
    }

    // Table — a `|` row followed by a `| --- |` separator. Wrapped in
    // its own overflow-x container so a wide table scrolls itself
    // rather than the page (DESIGN_RULES rule 2).
    if (trimmed.startsWith("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const head = splitRow(trimmed);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      const key = `tb${k++}`;
      blocks.push(
        <div key={key} className="my-5 overflow-x-auto rounded-2xl border border-[color:var(--color-border-soft)]">
          <table className="w-full border-collapse text-left text-[14px]">
            <thead className="bg-[color:var(--color-surface-muted)]">
              <tr>
                {head.map((c, idx) => (
                  <th key={idx} className="whitespace-nowrap px-3 py-2 font-semibold">
                    {inline(c, `${key}-h${idx}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, r) => (
                <tr key={r} className="border-t border-[color:var(--color-border-soft)]">
                  {row.map((c, idx) => (
                    <td key={idx} className="px-3 py-2 align-top">
                      {inline(c, `${key}-${r}-${idx}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Unordered list — items may be task items (`- [ ]` / `- [x]`).
    if (/^[-*+]\s+/.test(trimmed)) {
      const buf: string[] = [];
      while (i < lines.length && /^[-*+]\s+/.test(lines[i].trim())) {
        buf.push(lines[i].trim().replace(/^[-*+]\s+/, ""));
        i++;
      }
      const key = `ul${k++}`;
      const isTask = (t: string) => /^\[( |x|X)\]\s+/.test(t);
      const allTasks = buf.every(isTask);
      blocks.push(
        <ul
          key={key}
          className={cn("my-4 space-y-1.5", allTasks ? "list-none pl-1" : "list-disc pl-6")}
        >
          {buf.map((ln, idx) => {
            if (!isTask(ln)) return <li key={idx}>{inline(ln, `${key}-${idx}`)}</li>;
            const checked = /^\[[xX]\]/.test(ln);
            const text = ln.replace(/^\[( |x|X)\]\s+/, "");
            return (
              <li key={idx} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={checked}
                  readOnly
                  disabled
                  className="mt-1 h-4 w-4 shrink-0 accent-[color:var(--color-brand)]"
                />
                <span className={checked ? "text-[color:var(--color-text-subtle)] line-through" : undefined}>
                  {inline(text, `${key}-${idx}`)}
                </span>
              </li>
            );
          })}
        </ul>,
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const buf: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        buf.push(lines[i].trim().replace(/^\d+\.\s+/, ""));
        i++;
      }
      const key = `ol${k++}`;
      blocks.push(
        <ol key={key} className="my-4 list-decimal space-y-1.5 pl-6">
          {buf.map((ln, idx) => <li key={idx}>{inline(ln, `${key}-${idx}`)}</li>)}
        </ol>,
      );
      continue;
    }

    // Paragraph — consecutive non-blank lines that aren't another block
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^```/.test(lines[i].trim()) &&
      !/^(#{1,4})\s+/.test(lines[i].trim()) &&
      !/^>\s?/.test(lines[i].trim()) &&
      !/^[-*+]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim()) &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim()) &&
      !/^@\[embed\]\(/.test(lines[i].trim()) &&
      !(lines[i].trim().startsWith("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
    ) {
      buf.push(lines[i]);
      i++;
    }
    const key = `p${k++}`;
    blocks.push(
      <p key={key} className="my-4 break-words leading-[1.75]">
        {buf.map((ln, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <br />}
            {inline(ln, `${key}-${idx}`)}
          </React.Fragment>
        ))}
      </p>,
    );
  }

  return <div className={cn("text-[16px] sm:text-[17px]", className)}>{blocks}</div>;
}

/**
 * Rough reading-time estimate for an article body, in minutes.
 * Markdown syntax is stripped first so fences and link targets don't
 * inflate the count. 200 wpm is the usual figure for web prose.
 */
export function estimateReadMinutes(body: string): number {
  const plain = (body ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~`-]/g, " ");
  const words = plain.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
