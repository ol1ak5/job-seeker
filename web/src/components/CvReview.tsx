"use client";

import type { Cv } from "@/app/cvs/page";
import {
  applyDecisions,
  buildHunks,
  inlineDiff,
  type Decision,
  type Piece,
} from "@/lib/diff";
import { createClient } from "@/lib/supabase/client";
import { useMemo, useState } from "react";

/**
 * One line, with the words that moved picked out.
 *
 * A whole line in red beside a whole line in green reads as "replaced with
 * something identical" whenever the edit was small - which it usually is.
 */
function Line({
  pieces,
  tone,
}: {
  pieces: Piece[];
  tone: "removed" | "added";
}) {
  const base =
    tone === "removed"
      ? "bg-red-50 text-red-900"
      : "bg-emerald-50 text-emerald-900";
  const mark =
    tone === "removed"
      ? "bg-red-200/70 rounded-sm"
      : "bg-emerald-200/70 rounded-sm";

  return (
    <p className={`flex gap-2 px-4 py-1 font-mono text-xs leading-relaxed ${base}`}>
      <span aria-hidden="true" className="select-none opacity-60">
        {tone === "removed" ? "\u2212" : "+"}
      </span>
      <span className="whitespace-pre-wrap">
        {pieces.length === 0 ? " " : null}
        {pieces.map((piece, i) => (
          <span key={i} className={piece.changed ? mark : undefined}>
            {piece.text}
          </span>
        ))}
      </span>
    </p>
  );
}

/** Pair lines up so each can be compared word by word against its partner. */
function pairs(before: string[], after: string[]) {
  const rows: { before: Piece[] | null; after: Piece[] | null }[] = [];
  const shared = Math.min(before.length, after.length);
  for (let i = 0; i < shared; i++) {
    const { before: left, after: right } = inlineDiff(before[i], after[i]);
    rows.push({ before: left, after: right });
  }
  for (let i = shared; i < before.length; i++) {
    rows.push({ before: [{ text: before[i], changed: true }], after: null });
  }
  for (let i = shared; i < after.length; i++) {
    rows.push({ before: null, after: [{ text: after[i], changed: true }] });
  }
  return rows;
}

/**
 * Every change the model made, one decision at a time.
 *
 * A tailored CV is a document with your name on it, written by something that
 * cannot be asked what it was thinking. Reading it end to end and hoping to
 * spot the invented metric does not work; seeing only what moved does.
 *
 * Three answers, because two are not enough: the model is often nearly right,
 * and "nearly" is worth editing rather than throwing away.
 */
export default function CvReview({ cv }: { cv: Cv }) {
  const hunks = useMemo(
    () => buildHunks(cv.baseline ?? "", cv.markdown),
    [cv.baseline, cv.markdown],
  );

  const [decisions, setDecisions] = useState<Record<number, Decision>>({});
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const result = useMemo(
    () => applyDecisions(cv.baseline ?? "", cv.markdown, decisions),
    [cv.baseline, cv.markdown, decisions],
  );

  const decided = Object.keys(decisions).length;

  function decide(id: number, decision: Decision) {
    setDecisions((prev) => ({ ...prev, [id]: decision }));
    setEditing(null);
  }

  async function save() {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("cvs")
      .update({ approved_markdown: result })
      .eq("id", cv.id);
    setBusy(false);
    setSaved(error ? `Could not save: ${error.message}` : "Saved.");
  }

  function download() {
    const blob = new Blob([result], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = cv.filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (!cv.baseline) {
    return (
      <p className="rounded-lg border border-line bg-line-soft px-4 py-3 text-sm text-ink-soft">
        This one was written before changes were tracked, so there is nothing to
        compare it against. Ask for it again to review the changes.
      </p>
    );
  }

  if (hunks.length === 0) {
    return (
      <p className="rounded-lg border border-line bg-line-soft px-4 py-3 text-sm text-ink-soft">
        Nothing was changed for this vacancy.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">
          <span className="font-mono text-ink">
            {decided}/{hunks.length}
          </span>{" "}
          changes decided
        </p>
        <div className="flex items-center gap-3 text-sm">
          <button
            onClick={download}
            className="cursor-pointer text-ink-soft transition-colors duration-150 hover:text-brand"
          >
            Download the result
          </button>
          <button
            onClick={save}
            disabled={busy}
            className="cursor-pointer rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Saving..." : "Save this version"}
          </button>
          {saved && <span className="text-ink-faint">{saved}</span>}
        </div>
      </div>

      {hunks.map((hunk) => {
        const decision = decisions[hunk.id];
        const chosen =
          typeof decision === "object"
            ? "edited"
            : (decision as "accept" | "keep" | undefined);

        return (
          <section
            key={hunk.id}
            className={`overflow-hidden rounded-lg border ${
              chosen ? "border-line" : "border-brand/30"
            } bg-surface`}
          >
            {hunk.context && (
              <p className="truncate border-b border-line-soft bg-line-soft px-4 py-1.5 font-mono text-xs text-ink-faint">
                {hunk.context}
              </p>
            )}

            <div className="divide-y divide-line-soft">
              {pairs(hunk.before, hunk.after).map((row, i) => (
                <div key={i}>
                  {row.before && <Line pieces={row.before} tone="removed" />}
                  {row.after && <Line pieces={row.after} tone="added" />}
                </div>
              ))}
            </div>

            {editing === hunk.id ? (
              <div className="border-t border-line-soft p-4">
                <label
                  htmlFor={`edit-${hunk.id}`}
                  className="block text-xs font-medium text-ink"
                >
                  Write it yourself
                </label>
                <textarea
                  id={`edit-${hunk.id}`}
                  rows={Math.max(2, hunk.after.length + 1)}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-xs leading-relaxed text-ink outline-none focus:border-brand"
                />
                <div className="mt-2 flex gap-3 text-xs">
                  <button
                    onClick={() => decide(hunk.id, { edited: draft })}
                    className="cursor-pointer rounded bg-brand px-2.5 py-1 font-medium text-white transition-opacity duration-150 hover:opacity-90"
                  >
                    Use mine
                  </button>
                  <button
                    onClick={() => setEditing(null)}
                    className="cursor-pointer text-ink-faint transition-colors duration-150 hover:text-ink"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2 border-t border-line-soft px-4 py-2.5 text-xs">
                <button
                  onClick={() => decide(hunk.id, "accept")}
                  className={`cursor-pointer rounded border px-2.5 py-1 transition-colors duration-150 ${
                    chosen === "accept"
                      ? "border-emerald-400 bg-emerald-50 text-emerald-900"
                      : "border-line text-ink-soft hover:border-brand hover:text-brand"
                  }`}
                >
                  Take the new one
                </button>
                <button
                  onClick={() => decide(hunk.id, "keep")}
                  className={`cursor-pointer rounded border px-2.5 py-1 transition-colors duration-150 ${
                    chosen === "keep"
                      ? "border-ink-faint bg-line-soft text-ink"
                      : "border-line text-ink-soft hover:border-brand hover:text-brand"
                  }`}
                >
                  Keep what I had
                </button>
                <button
                  onClick={() => {
                    setEditing(hunk.id);
                    setDraft(
                      typeof decision === "object"
                        ? decision.edited
                        : hunk.after.join("\n"),
                    );
                  }}
                  className={`cursor-pointer rounded border px-2.5 py-1 transition-colors duration-150 ${
                    chosen === "edited"
                      ? "border-brand bg-brand/5 text-brand"
                      : "border-line text-ink-soft hover:border-brand hover:text-brand"
                  }`}
                >
                  {chosen === "edited" ? "Edited" : "Write it myself"}
                </button>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
