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

function operations(before: string[], after: string[]): Op[] {
  const rows = before.length;
  const cols = after.length;

  // table[i][j] = length of the longest common run of before[i:] and after[j:]
  const table: number[][] = Array.from({ length: rows + 1 }, () =>
    new Array(cols + 1).fill(0),
  );
  for (let i = rows - 1; i >= 0; i--) {
    for (let j = cols - 1; j >= 0; j--) {
      table[i][j] =
        before[i] === after[j]
          ? table[i + 1][j + 1] + 1
          : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

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
  const ops = operations(before.split("\n"), after.split("\n"));
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
  const ops = operations(before.split("\n"), after.split("\n"));
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
