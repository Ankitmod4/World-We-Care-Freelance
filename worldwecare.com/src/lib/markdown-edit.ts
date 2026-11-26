/**
 * Textarea edit primitives for the Markdown toolbars.
 *
 * Pure functions over (value, selectionStart, selectionEnd) so the two
 * toolbars — the full one in the admin editor, the compact one members
 * get on the event form — behave identically, and so the fiddly caret
 * arithmetic can be tested without a DOM.
 */

/** Result of a toolbar edit: the new text plus where the caret goes. */
export interface EditResult {
  next: string;
  selStart: number;
  selEnd: number;
}

/**
 * Wrap the selection in `before`/`after`. With nothing selected, the
 * placeholder is inserted AND selected, so the next keystroke replaces
 * it.
 */
export function wrapSelection(
  value: string,
  start: number,
  end: number,
  before: string,
  after: string,
  placeholder: string,
): EditResult {
  const selected = value.slice(start, end) || placeholder;
  return {
    next: value.slice(0, start) + before + selected + after + value.slice(end),
    selStart: start + before.length,
    selEnd: start + before.length + selected.length,
  };
}

/**
 * Prefix every line the selection touches. The range is first expanded
 * to whole lines so clicking mid-word still formats the line.
 */
export function prefixSelectedLines(
  value: string,
  start: number,
  end: number,
  prefix: string | ((i: number) => string),
  placeholder: string,
): EditResult {
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const lineEndRaw = value.indexOf("\n", end);
  const lineEnd = lineEndRaw === -1 ? value.length : lineEndRaw;

  const block = value.slice(lineStart, lineEnd) || placeholder;
  const prefixed = block
    .split("\n")
    .map((line, i) => (typeof prefix === "string" ? prefix : prefix(i)) + line)
    .join("\n");

  return {
    next: value.slice(0, lineStart) + prefixed + value.slice(lineEnd),
    selStart: lineStart,
    selEnd: lineStart + prefixed.length,
  };
}

/**
 * Insert a standalone block, guaranteeing a blank line before it so the
 * Markdown parser treats it as its own block rather than joining the
 * paragraph above.
 */
export function insertBlockAt(value: string, start: number, end: number, text: string): EditResult {
  const before = value.slice(0, start);
  const lead = before.length === 0 ? "" : before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
  const chunk = lead + text + "\n\n";
  const pos = before.length + chunk.length;
  return { next: before + chunk + value.slice(end), selStart: pos, selEnd: pos };
}
