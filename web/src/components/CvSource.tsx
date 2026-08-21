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
  const kept = decision === "keep";
  const shown = kept ? before : after;
  const other = kept ? after : before;

  return (
    <div className="group relative -mx-2 my-0.5 rounded px-2 py-0.5 hover:bg-line-soft/60">
      {/* Struck-through: what this replaced, so the choice is visible without
          leaving the page or remembering what used to be there. */}
      {other.some((l) => l.trim()) && (
        <pre
          className={`whitespace-pre-wrap line-through decoration-1 ${
            kept ? "text-emerald-700/50" : "text-red-700/50"
          }`}
        >
          {other.join("\n")}
        </pre>
      )}
      {shown.some((l) => l.trim()) && (
        <pre
          className={`whitespace-pre-wrap rounded-sm ${
            kept ? "bg-line-soft text-ink" : "bg-emerald-50 text-emerald-900"
          }`}
        >
          {shown.join("\n")}
        </pre>
      )}

      <span
        className={`absolute right-2 top-0.5 flex gap-1 rounded border border-line bg-surface px-1 py-0.5 transition-opacity duration-150 ${
          decision ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
        }`}
      >
        <button
          onClick={() => onDecide("accept")}
          aria-label="Take the new wording"
          title="Take the new wording"
          className={`cursor-pointer rounded px-1.5 ${
            decision === "accept"
              ? "bg-emerald-100 text-emerald-900"
              : "text-ink-faint hover:text-emerald-700"
          }`}
        >
          ✓
        </button>
        <button
          onClick={() => onDecide("keep")}
          aria-label="Keep what I had"
          title="Keep what I had"
          className={`cursor-pointer rounded px-1.5 ${
            kept ? "bg-line-soft text-ink" : "text-ink-faint hover:text-red-700"
          }`}
        >
          ✕
        </button>
      </span>
    </div>
  );
}
