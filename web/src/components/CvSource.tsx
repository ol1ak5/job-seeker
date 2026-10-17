"use client";

import { applyDecisions, buildSegments, type Decision } from "@/lib/diff";
import { useMemo, useState } from "react";

/**
 * The CV's text, with the model's changes marked where they happened.
 *
 * Ruling on a change and rewriting the whole thing used to be two separate
 * screens, so a reader had to decide which job they were doing before they
 * could see anything. They are the same job: you read the document, and where
 * something is new you either take it, leave it, or type over it.
 *
 * Green is what the model added, struck-through red what it removed. Hovering a
 * change brings up the two answers; anything a decision cannot express - moving
 * a section, rewriting a whole job - is what the free-text editor underneath is
 * for.
 */
export default function CvSource({
  baseline,
  generated,
  value,
  onChange,
}: {
  baseline: string;
  generated: string;
  /** The text as it stands, decisions already applied. */
  value: string;
  onChange: (next: string) => void;
}) {
  const [decisions, setDecisions] = useState<Record<number, Decision>>({});
  const [editing, setEditing] = useState(false);

  const segments = useMemo(
    () => buildSegments(baseline, generated),
    [baseline, generated],
  );

  const changes = segments.filter((s) => s.kind === "change").length;
  const decided = Object.keys(decisions).length;

  function decide(id: number, decision: Decision) {
    const next = { ...decisions, [id]: decision };
    setDecisions(next);
    onChange(applyDecisions(baseline, generated, next));
  }

  // Editing by hand and deciding change by change cannot both own the text, so
  // opening the editor ends the review rather than fighting it.
  if (editing || !baseline || changes === 0) {
    return (
      <div>
        {!editing && changes === 0 && baseline && (
          <p className="mb-3 text-sm text-ink-faint">
            The model changed nothing for this vacancy.
          </p>
        )}
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          rows={Math.min(40, value.split("\n").length + 2)}
          aria-label="The CV in Markdown"
          className="w-full rounded-lg border border-line bg-surface p-4 font-mono text-xs leading-relaxed text-ink outline-none focus:border-brand"
        />
        {changes > 0 && (
          <button
            onClick={() => setEditing(false)}
            className="mt-3 cursor-pointer text-sm text-ink-faint transition-colors duration-150 hover:text-ink"
          >
            Back to reviewing the changes
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-ink-soft">
          <span className="font-mono text-ink">
            {decided}/{changes}
          </span>{" "}
          changes decided
        </p>
        <button
          onClick={() => setEditing(true)}
          className="cursor-pointer text-ink-soft transition-colors duration-150 hover:text-brand"
        >
          Rewrite it myself
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface p-4 font-mono text-xs leading-relaxed">
        {segments.map((segment, i) =>
          segment.kind === "same" ? (
            <pre key={i} className="whitespace-pre-wrap text-ink-soft">
              {segment.lines.join("\n")}
            </pre>
          ) : (
            <Change
              key={i}
              before={segment.before}
              after={segment.after}
              decision={decisions[segment.id]}
              onDecide={(d) => decide(segment.id, d)}
            />
          ),
        )}
      </div>
    </div>
  );
}

function Change({
  before,
  after,
  decision,
  onDecide,
}: {
  before: string[];
  after: string[];
  decision: Decision | undefined;
  onDecide: (decision: Decision) => void;
}) {
  const [writing, setWriting] = useState(false);
  const [draft, setDraft] = useState("");

  const edited = typeof decision === "object" ? decision.edited : null;
  const kept = decision === "keep";

  function open() {
    setDraft(edited ?? after.join("\n"));
    setWriting(true);
  }

  if (writing) {
    return (
      <div className="-mx-2 my-1 rounded border border-brand/40 bg-brand/5 p-3">
        <label className="block text-xs font-medium text-ink">
          Write this bit yourself
        </label>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          spellCheck={false}
          rows={Math.max(2, draft.split("\n").length + 1)}
          autoFocus
          className="mt-2 w-full rounded border border-line bg-surface p-2 font-mono text-xs leading-relaxed text-ink outline-none focus:border-brand"
        />
        <div className="mt-2 flex gap-3 text-xs">
          <button
            onClick={() => {
              onDecide({ edited: draft });
              setWriting(false);
            }}
            className="cursor-pointer rounded bg-brand px-3 py-1.5 font-medium text-white transition-opacity duration-150 hover:opacity-90"
          >
            Use mine
          </button>
          <button
            onClick={() => setWriting(false)}
            className="cursor-pointer px-2 py-1.5 text-ink-faint transition-colors duration-150 hover:text-ink"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-2 my-2 rounded border border-line/70 px-2 py-1.5">
      {edited !== null ? (
        <pre className="whitespace-pre-wrap rounded-sm bg-brand/10 px-1 text-ink">
          {edited}
        </pre>
      ) : (
        <>
          {/* What it replaced, on red - the colour says "gone" faster than a
              strikethrough does, and stays readable while it says it. */}
          {before.some((l) => l.trim()) && (
            <pre
              className={`whitespace-pre-wrap rounded-sm px-1 ${
                kept ? "bg-red-100 text-red-900" : "bg-red-50 text-red-800"
              }`}
            >
              {before.join("\n")}
            </pre>
          )}
          {after.some((l) => l.trim()) && !kept && (
            <pre className="whitespace-pre-wrap rounded-sm bg-emerald-50 px-1 text-emerald-900">
              {after.join("\n")}
            </pre>
          )}
        </>
      )}

      {/* Under the change, not over it, and always visible.
          Floating the controls in the corner covered the end of the first line,
          and hiding them until hover meant the one thing you came here to do
          was the one thing you could not see. Three buttons of one width, in a
          box only as wide as they are. */}
      <div className="mt-1.5 inline-flex overflow-hidden rounded-md border border-line bg-surface">
        <button
          onClick={() => onDecide("accept")}
          className={`cursor-pointer w-24 py-1 text-center text-xs whitespace-nowrap transition-colors duration-150 ${
            decision === "accept"
              ? "bg-emerald-100 font-medium text-emerald-900"
              : "text-ink-soft hover:bg-emerald-50 hover:text-emerald-800"
          }`}
        >
          Take new
        </button>
        <button
          onClick={() => onDecide("keep")}
          className={`cursor-pointer border-l border-line w-24 py-1 text-center text-xs whitespace-nowrap transition-colors duration-150 ${
            kept
              ? "bg-red-100 font-medium text-red-900"
              : "text-ink-soft hover:bg-red-50 hover:text-red-800"
          }`}
        >
          Keep mine
        </button>
        <button
          onClick={open}
          className={`cursor-pointer border-l border-line w-24 py-1 text-center text-xs whitespace-nowrap transition-colors duration-150 ${
            edited !== null
              ? "bg-brand/10 font-medium text-brand"
              : "text-ink-soft hover:bg-brand/5 hover:text-brand"
          }`}
        >
          {edited !== null ? "Edited" : "Rewrite"}
        </button>
      </div>
    </div>
  );
}
