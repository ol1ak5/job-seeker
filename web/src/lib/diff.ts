/**
 * Line-by-line comparison of two versions of a CV.
 *
 * Small enough to write rather than depend on: these are two documents of a few
 * dozen lines, so the textbook longest-common-subsequence table costs nothing
 * and behaves exactly as anyone who has read a diff expects.
 *
 * The result is grouped into hunks, because a reader does not decide about
 * lines - they decide about changes. "This paragraph was rewritten" is one
 * decision even when it touches six lines.
 */

export type Hunk = {
  id: number;
  /** Lines as they were. Empty when the change is purely an addition. */
  before: string[];
  /** Lines as the model wrote them. Empty when something was removed. */
  after: string[];
  /** The unchanged line above, for orientation. */
  context: string;
};

type Op = { kind: "same" | "remove" | "add"; line: string };

/**
 * Trailing spaces are not an edit anybody wants to rule on, and a model that
 * reflows a line adds them constantly. Both sides are levelled before anything
 * is compared, so a hunk always means a real difference in words.
 */
function normalise(text: string): string[] {
  return text.replace(/[ \t]+$/gm, "").split("\n");
}

function lcs<T>(before: T[], after: T[], same: (a: T, b: T) => boolean): number[][] {
  const table: number[][] = Array.from({ length: before.length + 1 }, () =>
    new Array(after.length + 1).fill(0),
  );
  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      table[i][j] = same(before[i], after[j])
        ? table[i + 1][j + 1] + 1
        : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }
  return table;
}

export type Piece = { text: string; changed: boolean };

/**
 * Which words inside a line actually moved.
 *
 * Painting a whole line red and a whole green when two words changed reads as
 * "it replaced the line with an identical one" - the reader cannot see the
 * edit, only that something happened. Splitting on whitespace but keeping the
 * separators means the pieces still join back into the original text.
 */
export function inlineDiff(
  before: string,
  after: string,
): { before: Piece[]; after: Piece[] } {
  const a = before.split(/(\s+)/);
  const b = after.split(/(\s+)/);
  const table = lcs(a, b, (x, y) => x === y);

  const left: Piece[] = [];
  const right: Piece[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      left.push({ text: a[i], changed: false });
      right.push({ text: b[j], changed: false });
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      left.push({ text: a[i++], changed: true });
    } else {
      right.push({ text: b[j++], changed: true });
    }
  }
  while (i < a.length) left.push({ text: a[i++], changed: true });
  while (j < b.length) right.push({ text: b[j++], changed: true });
  return { before: left, after: right };
}

function operations(before: string[], after: string[]): Op[] {
  const rows = before.length;
  const cols = after.length;
  const table = lcs(before, after, (x, y) => x === y);

  const ops: Op[] = [];
  let i = 0;
  let j = 0;
  while (i < rows && j < cols) {
    if (before[i] === after[j]) {
      ops.push({ kind: "same", line: before[i] });
      i++;
      j++;
    } else if (table[i + 1][j] >= table[i][j + 1]) {
      ops.push({ kind: "remove", line: before[i] });
      i++;
    } else {
      ops.push({ kind: "add", line: after[j] });
      j++;
    }
  }
  while (i < rows) ops.push({ kind: "remove", line: before[i++] });
  while (j < cols) ops.push({ kind: "add", line: after[j++] });
  return ops;
}

export function buildHunks(before: string, after: string): Hunk[] {
  const ops = operations(normalise(before), normalise(after));
  const hunks: Hunk[] = [];
  let context = "";
  let current: Hunk | null = null;

  for (const op of ops) {
    if (op.kind === "same") {
      if (current) {
        hunks.push(current);
        current = null;
      }
      if (op.line.trim()) context = op.line;
      continue;
    }
    if (!current) {
      current = { id: hunks.length, before: [], after: [], context };
    }
    if (op.kind === "remove") current.before.push(op.line);
    else current.after.push(op.line);
  }
  if (current) hunks.push(current);

  // A run of blank-line churn is not a change anybody wants to rule on.
  return hunks
    .filter((h) => h.before.some((l) => l.trim()) || h.after.some((l) => l.trim()))
    .map((h, id) => ({ ...h, id }));
}

export type Decision = "accept" | "keep" | { edited: string };

/**
 * Rebuild the document from the reader's answers.
 *
 * Walking the operations a second time, rather than patching text, means the
 * result can only ever be made of lines that were actually in one version or
 * typed by hand - a rewrite cannot silently reappear because a search-and-
 * replace matched twice.
 */
export function applyDecisions(
  before: string,
  after: string,
  decisions: Record<number, Decision>,
): string {
  const ops = operations(normalise(before), normalise(after));
  const out: string[] = [];
  let hunkIndex = -1;
  let inHunk = false;
  let pending: { before: string[]; after: string[] } | null = null;

  const flush = () => {
    if (!pending) return;
    const meaningful =
      pending.before.some((l) => l.trim()) || pending.after.some((l) => l.trim());
    if (meaningful) hunkIndex++;
    const decision = meaningful ? decisions[hunkIndex] : undefined;

    if (typeof decision === "object" && decision !== null) {
      out.push(...decision.edited.split("\n"));
    } else if (decision === "keep") {
      out.push(...pending.before);
    } else {
      out.push(...pending.after);
    }
    pending = null;
  };

  for (const op of ops) {
    if (op.kind === "same") {
      if (inHunk) {
        flush();
        inHunk = false;
      }
      out.push(op.line);
      continue;
    }
    if (!inHunk) {
      inHunk = true;
      pending = { before: [], after: [] };
    }
    if (op.kind === "remove") pending!.before.push(op.line);
    else pending!.after.push(op.line);
  }
  if (inHunk) flush();

  return out.join("\n");
}

export type Segment =
  | { kind: "same"; lines: string[] }
  | { kind: "change"; id: number; before: string[]; after: string[] };

/**
 * The whole document in reading order, with the changes marked in place.
 *
 * buildHunks answers "what changed". This answers "what does it say, and which
 * parts of that are new" - a different question, and the one that catches a
 * sentence which no longer follows from the one above it. Ruling on a paragraph
 * while seeing the paragraphs around it is not the same act as ruling on it in
 * a list of isolated cards.
 *
 * Change ids match buildHunks, so a decision made here means the same thing to
 * applyDecisions.
 */
export function buildSegments(before: string, after: string): Segment[] {
  const ops = operations(normalise(before), normalise(after));
  const segments: Segment[] = [];
  let same: string[] = [];
  let pending: { before: string[]; after: string[] } | null = null;
  let id = 0;

  const flushSame = () => {
    if (same.length) {
      segments.push({ kind: "same", lines: same });
      same = [];
    }
  };

  const flushChange = () => {
    if (!pending) return;
    const meaningful =
      pending.before.some((l) => l.trim()) || pending.after.some((l) => l.trim());
    if (meaningful) {
      segments.push({ kind: "change", id: id++, ...pending });
    } else {
      // blank-line churn is not a decision; it belongs to the text around it
      same.push(...pending.after);
    }
    pending = null;
  };

  for (const op of ops) {
    if (op.kind === "same") {
      flushChange();
      same.push(op.line);
      continue;
    }
    if (!pending) {
      flushSame();
      pending = { before: [], after: [] };
    }
    if (op.kind === "remove") pending.before.push(op.line);
    else pending.after.push(op.line);
  }
  flushChange();
  flushSame();
  return segments;
}
