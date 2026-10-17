"use client";

import AddColumn from "@/components/AddColumn";
import NoteDialog from "@/components/NoteDialog";
import TailorButton from "@/components/TailorButton";
import { createClient } from "@/lib/supabase/client";
import { relativeTime } from "@/lib/time";
import type { CustomColumn, Vacancy } from "@/lib/vacancies";
import { useEffect, useMemo, useState } from "react";
import Frame from "@/components/Frame";

/**
 * The stage of an application is a fixed list, because the numbers above the
 * table are counted from it. Anything more precise - "second interview on
 * Tuesday" - goes in the note beside it.
 */
const STATUSES = [
  { value: "interested", label: "Interested", tone: "text-ink-soft" },
  { value: "applied", label: "Applied", tone: "text-brand" },
  { value: "interview", label: "Interview", tone: "text-emerald-700" },
  { value: "offer", label: "Offer", tone: "text-emerald-800" },
  { value: "rejected", label: "Rejected", tone: "text-red-700" },
  // Stored as "declined"; shown as Skipped - you said no, before or after applying.
  { value: "declined", label: "Skipped", tone: "text-ink-faint" },
] as const;

/**
 * Column widths are fixed, in rem, so nothing shifts while you type, sort or
 * change a status; text too long for its column is cut with an ellipsis and
 * shown in full on hover. The vacancy title takes whatever width is left.
 *
 * Columns you add yourself go after these. With several of them the table is
 * wider than the page and scrolls sideways rather than squeezing the rest.
 */
type Column = { key: string; label: string; width?: number; custom?: boolean };
const COLUMNS: Column[] = [
  { key: "score", label: "Score", width: 6 },
  { key: "title", label: "Vacancy" },
  { key: "company", label: "Company", width: 8.5 },
  { key: "location", label: "Location", width: 8.5 },
  { key: "posted", label: "Posted", width: 6.5 },
  { key: "status", label: "Status", width: 7.5 },
  { key: "applied", label: "Applied", width: 7.5 },
  { key: "notes", label: "Notes", width: 6 },
  { key: "cv", label: "CV", width: 8 },
];
// Sized so that one column of your own still fits the page beside the rest.
const CUSTOM_WIDTH_REM = 7.5;
const TITLE_MIN_REM = 10.5;

/** The same discs as the example on the front page: solid for a strong match. */
function scoreTone(score: number | null) {
  if (score === null) return "text-ink-faint";
  if (score >= 80) return "bg-brand text-white";
  if (score >= 60) return "bg-brand/10 text-brand";
  return "bg-line-soft text-ink-soft";
}

/** "12 Aug" reads faster in a column than "2026-08-12". */
function shortDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

/**
 * Score, posting date and application date each sort both ways: a click on the
 * column sorts it highest or newest first, a second click reverses it. Rows
 * with nothing in that column always go to the bottom. The application date is
 * the one recorded when the status first became Applied, not the free text.
 */
type SortKey = "score" | "posted" | "applied";
type Sort = { key: SortKey; dir: "desc" | "asc" };
const SORTABLE: Partial<Record<string, SortKey>> = {
  score: "score",
  posted: "posted",
  applied: "applied",
};

export default function VacancyTable({
  vacancies,
  userId,
  appliedTextReady = true,
  lastSearchAt = null,
  customColumns = [],
  customColumnsReady = true,
}: {
  vacancies: Vacancy[];
  userId: string;
  appliedTextReady?: boolean;
  customColumns?: CustomColumn[];
  /** False until the database has migration 0006: no adding columns yet. */
  customColumnsReady?: boolean;
  /** When the last search finished, shown at the right of the filter line. */
  lastSearchAt?: string | null;
}) {
  const first = (v: Vacancy) => v.applications?.[0];
  const initial = (pick: (v: Vacancy) => string) =>
    Object.fromEntries(vacancies.map((v) => [v.id, pick(v)]));

  const [statuses, setStatuses] = useState(() =>
    initial((v) => first(v)?.status ?? "interested"),
  );
  const [notes, setNotes] = useState(() => initial((v) => first(v)?.notes ?? ""));
  const [applied, setApplied] = useState(() => initial((v) => first(v)?.applied_text ?? ""));
  const [savedApplied, setSavedApplied] = useState(applied);
  const [editingNote, setEditingNote] = useState<Vacancy | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [hideClosed, setHideClosed] = useState(false);
  const [appliedAt, setAppliedAt] = useState(() => initial((v) => first(v)?.applied_at ?? ""));
  const [sort, setSort] = useState<Sort>({ key: "score", dir: "desc" });
  const [columns, setColumns] = useState<CustomColumn[]>(customColumns);
  const [extra, setExtra] = useState<Record<string, Record<string, string>>>(() =>
    Object.fromEntries(vacancies.map((v) => [v.id, { ...(first(v)?.extra ?? {}) }])),
  );
  const [savedExtra, setSavedExtra] = useState(extra);
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);

  // A tooltip drawn at a fixed place on screen would drift once the page moves.
  useEffect(() => {
    if (!tip) return;
    const hide = () => setTip(null);
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, [tip]);

  /**
   * Text cut off with an ellipsis, in any cell or header, is shown in full
   * under it as soon as the pointer is on it; a note is shown whole, since the
   * cell only says that there is one. It is drawn outside the table, which scrolls
   * sideways and would clip anything hanging below a row.
   */
  function showFull(event: React.MouseEvent) {
    const el = (event.target as HTMLElement).closest<HTMLElement>("[data-full]");
    if (!el || (!el.hasAttribute("data-always") && el.scrollWidth <= el.clientWidth)) {
      setTip(null);
      return;
    }
    // Measured from the middle of the cell, not the text, so the box opens at
    // the same height in every column, inputs included.
    const box = el.getBoundingClientRect();
    const row = (el.closest("td, th") ?? el).getBoundingClientRect();
    setTip({ text: el.dataset.full ?? "", x: box.left, y: row.top + row.height / 2 + 10 });
  }

  const visible: Column[] = [
    ...COLUMNS,
    ...columns.map((c) => ({ key: c.id, label: c.name, width: CUSTOM_WIDTH_REM, custom: true })),
  ];
  const minWidth = visible.reduce((sum, c) => sum + (c.width ?? TITLE_MIN_REM), 0);

  async function addColumn(name: string): Promise<string | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("custom_columns")
      .insert({ user_id: userId, name, position: columns.length })
      .select("id, name")
      .single();
    if (error || !data) return "Could not add the column. Try again.";
    setColumns((prev) => [...prev, data as CustomColumn]);
    return null;
  }

  async function removeColumn(column: CustomColumn) {
    if (!window.confirm(`Delete the column "${column.name}" and what you wrote in it?`)) return;
    const supabase = createClient();
    const { error } = await supabase.from("custom_columns").delete().eq("id", column.id);
    if (!error) setColumns((prev) => prev.filter((c) => c.id !== column.id));
  }

  // The whole set of a vacancy's own-column values is sent at once, because
  // they share one field; the other fields on the row are left alone.
  function saveExtra(vacancyId: string, columnId: string) {
    const value = (extra[vacancyId]?.[columnId] ?? "").trim();
    if (value === (savedExtra[vacancyId]?.[columnId] ?? "")) return;
    const next = { ...extra[vacancyId], [columnId]: value };
    setExtra((prev) => ({ ...prev, [vacancyId]: next }));
    setSavedExtra((prev) => ({ ...prev, [vacancyId]: next }));
    save(vacancyId, { extra: next });
  }

  // Only the columns being changed are sent, so a status change never wipes
  // a note and a note never resets the status.
  async function save(vacancyId: string, fields: Record<string, unknown>) {
    const supabase = createClient();
    await supabase
      .from("applications")
      .upsert(
        { user_id: userId, vacancy_id: vacancyId, ...fields },
        { onConflict: "user_id,vacancy_id" },
      );
  }

  function changeStatus(vacancyId: string, status: string) {
    setStatuses((prev) => ({ ...prev, [vacancyId]: status }));
    const fields: Record<string, unknown> = { status };
    // The date is still kept behind the scenes, the first time it is applied.
    if (status === "applied" && !appliedAt[vacancyId]) {
      const today = new Date().toISOString().slice(0, 10);
      fields.applied_at = today;
      setAppliedAt((prev) => ({ ...prev, [vacancyId]: today }));
    }
    save(vacancyId, fields);
  }

  function saveApplied(vacancyId: string) {
    const value = applied[vacancyId].trim();
    if (value === savedApplied[vacancyId]) return;
    setSavedApplied((prev) => ({ ...prev, [vacancyId]: value }));
    save(vacancyId, { applied_text: value });
  }

  function saveNote(vacancyId: string, text: string) {
    const value = text.trim();
    setEditingNote(null);
    if (value === notes[vacancyId]) return;
    setNotes((prev) => ({ ...prev, [vacancyId]: value }));
    save(vacancyId, { notes: value });
  }

  const rows = useMemo(() => {
    const filtered = vacancies.filter(
      (v) => !(hideClosed && ["rejected", "declined"].includes(statuses[v.id])),
    );
    const value = (v: Vacancy): number | string | null =>
      sort.key === "score" ? v.score : sort.key === "posted" ? v.posted : appliedAt[v.id] || null;
    return filtered.sort((a, b) => {
      const x = value(a);
      const y = value(b);
      if (x === null || x === "") return y === null || y === "" ? 0 : 1;
      if (y === null || y === "") return -1;
      const order = x < y ? -1 : x > y ? 1 : 0;
      return sort.dir === "desc" ? -order : order;
    });
  }, [vacancies, hideClosed, statuses, sort, appliedAt]);
  const hidden = vacancies.length - rows.length;

  const header = (key: string, label: string) => {
    const by = SORTABLE[key];
    if (!by) return label;
    const active = sort.key === by;
    return (
      <button
        onClick={() =>
          setSort(active ? { key: by, dir: sort.dir === "desc" ? "asc" : "desc" } : { key: by, dir: "desc" })
        }
        aria-label={`Sort by ${label}`}
        className={`inline-flex cursor-pointer items-center gap-1.5 transition-colors duration-150 hover:text-ink ${
          active ? "font-medium text-ink" : ""
        }`}
      >
        {label}
        <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          {active && sort.dir === "desc" ? (
            <path d="M8 3v10M4 9l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          ) : active ? (
            <path d="M8 13V3M4 7l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <path d="M5 3v10M2.5 10.5 5 13l2.5-2.5M11 13V3M8.5 5.5 11 3l2.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
          )}
        </svg>
      </button>
    );
  };

  // Every row is the same height: one line per cell, nothing wraps.
  const cell = "h-[68px] truncate px-3 first:pl-5 last:pr-5";

  return (
    <section>
      <div className="mb-3 flex items-center gap-4 text-sm leading-none text-ink-soft">
        <label className="flex cursor-pointer items-center gap-2 whitespace-nowrap">
          <input
            type="checkbox"
            checked={hideClosed}
            onChange={(e) => setHideClosed(e.target.checked)}
            className="h-4 w-4 cursor-pointer accent-brand"
          />
          Hide rejected and skipped
        </label>
        {hidden > 0 && <span className="whitespace-nowrap text-ink-faint">{hidden} hidden</span>}
        <div className="ml-auto flex items-center gap-5">
          {lastSearchAt && (
            <span className="whitespace-nowrap text-ink-faint">
              Last search ran {relativeTime(lastSearchAt)}
            </span>
          )}
          {customColumnsReady && <AddColumn onAdd={addColumn} />}
        </div>
      </div>

      {/* Framed like the example on the front page: a card inside a card. */}
      <Frame className="overflow-x-auto">
        <table
          className="w-full table-fixed border-separate border-spacing-0 text-left text-sm"
          style={{ minWidth: `${minWidth}rem` }}
          onMouseOver={showFull}
          onMouseLeave={() => setTip(null)}
        >
          <colgroup>
            {visible.map((c) => (
              <col key={c.key} style={c.width ? { width: `${c.width}rem` } : undefined} />
            ))}
          </colgroup>
          <thead>
            <tr className="text-xs text-ink-faint [&>th]:h-11 [&>th]:border-b [&>th]:border-line [&>th]:font-normal">
              {visible.map((c) => (
                <th key={c.key} className={`${cell} ${c.custom ? "group" : ""}`}>
                  {c.custom ? (
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate" data-full={c.label}>{c.label}</span>
                      <button
                        onClick={() => removeColumn({ id: c.key, name: c.label })}
                        aria-label={`Delete the column ${c.label}`}
                        title="Delete this column"
                        className="shrink-0 cursor-pointer text-ink-faint opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:text-red-700 focus-visible:opacity-100"
                      >
                        ×
                      </button>
                    </span>
                  ) : (
                    header(c.key, c.label)
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((v, index) => {
              const status = statuses[v.id];
              const stage = STATUSES.find((s) => s.value === status) ?? STATUSES[0];
              const isOpen = expanded === v.id;
              const toggle = () => setExpanded(isOpen ? null : v.id);
              const line = index < rows.length - 1 || isOpen ? "[&>td]:border-b [&>td]:border-line-soft" : "";

              return [
                <tr
                  key={v.id}
                  className={`align-middle transition-colors duration-150 hover:bg-line-soft/40 ${line}`}
                >
                  <td className={cell}>
                    {v.score === null ? (
                      <span className="text-ink-faint">—</span>
                    ) : (
                      <span
                        className={`grid size-10 place-items-center rounded-full font-mono text-sm font-medium ${scoreTone(v.score)}`}
                      >
                        {v.score}
                      </span>
                    )}
                  </td>

                  <td className={cell}>
                    <span className="flex items-center gap-1.5">
                      <button
                        onClick={toggle}
                        aria-expanded={isOpen}
                        data-full={v.title}
                        className="min-w-0 cursor-pointer truncate text-left font-medium text-ink transition-colors duration-150 hover:text-brand"
                      >
                        {v.title}
                      </button>
                      <a
                        href={v.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open the original posting for ${v.title}`}
                        title="Open the original posting"
                        className="shrink-0 text-ink-faint transition-colors duration-150 hover:text-brand"
                      >
                        <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                          <path d="M6 3h7v7M13 3L6.5 9.5M11 9v4H3V5h4" strokeLinecap="round" />
                        </svg>
                      </a>
                    </span>
                  </td>

                  {/* The text sits in its own line box, like the title beside it, so
                      the full-text box opens at the same height in every column. */}
                  <td className={`${cell} text-ink-soft`}>
                    <span className="block truncate" data-full={v.company}>
                      {v.company}
                    </span>
                  </td>
                  <td className={`${cell} text-ink-soft`}>
                    <span className="block truncate" data-full={v.location ?? undefined}>
                      {v.location || "—"}
                    </span>
                  </td>
                  <td className={`${cell} text-ink-soft`}>{shortDate(v.posted)}</td>

                  <td className={cell}>
                    <label className={`relative inline-flex items-center ${stage.tone}`}>
                      <select
                        value={status}
                        onChange={(e) => changeStatus(v.id, e.target.value)}
                        aria-label={`Status for ${v.title}`}
                        className="cursor-pointer appearance-none bg-transparent pr-5 text-sm font-medium outline-none"
                      >
                        {STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                      <svg className="pointer-events-none absolute right-0 h-3.5 w-3.5 opacity-60" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                        <path d="M3 4.5l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </label>
                  </td>

                  <td className={cell}>
                    <input
                      value={applied[v.id]}
                      onChange={(e) => setApplied((prev) => ({ ...prev, [v.id]: e.target.value }))}
                      onBlur={() => saveApplied(v.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                      }}
                      disabled={!appliedTextReady}
                      title={
                        appliedTextReady ? undefined : "Run db/migrations/0005_applied_text.sql to write here"
                      }
                      data-full={applied[v.id] || undefined}
                      placeholder="Add date"
                      aria-label={`When and how you applied to ${v.title}`}
                      autoComplete="off"
                      data-1p-ignore
                      data-lpignore="true"
                      data-form-type="other"
                      className="w-full truncate border-b border-transparent bg-transparent py-0.5 text-sm text-ink outline-none placeholder:text-ink-faint/70 focus:border-brand/50 disabled:cursor-not-allowed"
                    />
                  </td>

                  <td className={cell}>
                    <button
                      onClick={() => setEditingNote(v)}
                      data-full={notes[v.id] || undefined}
                      data-always
                      className={`max-w-full cursor-pointer truncate text-left transition-colors duration-150 hover:text-brand-soft ${
                        notes[v.id] ? "font-medium text-brand" : "text-ink-faint/70"
                      }`}
                    >
                      {notes[v.id] ? "View note" : "Add note"}
                    </button>
                  </td>

                  <td className={cell}>
                    <TailorButton vacancyId={v.id} hasCv={Boolean(v.cvs?.length)} />
                  </td>

                  {columns.map((c) => (
                    <td key={c.id} className={cell}>
                      <input
                        value={extra[v.id]?.[c.id] ?? ""}
                        onChange={(e) =>
                          setExtra((prev) => ({
                            ...prev,
                            [v.id]: { ...prev[v.id], [c.id]: e.target.value },
                          }))
                        }
                        onBlur={() => saveExtra(v.id, c.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                        }}
                        data-full={extra[v.id]?.[c.id] || undefined}
                        placeholder="Add"
                        aria-label={`${c.name} for ${v.title}`}
                        autoComplete="off"
                        data-1p-ignore
                        data-lpignore="true"
                        data-form-type="other"
                        className="w-full truncate border-b border-transparent bg-transparent py-0.5 text-sm text-ink outline-none placeholder:text-ink-faint/70 focus:border-brand/50"
                      />
                    </td>
                  ))}
                </tr>,

                isOpen && (
                  <tr
                    key={`${v.id}-detail`}
                    className={index < rows.length - 1 ? "[&>td]:border-b [&>td]:border-line-soft" : ""}
                  >
                    <td colSpan={visible.length} className="bg-line-soft/40 px-5 py-5">
                      <p className="mb-3 text-xs text-ink-faint">
                        How your CV compares with this vacancy · found via {v.source}
                      </p>
                      <div className="grid gap-x-10 gap-y-3 text-sm text-ink-soft sm:grid-cols-3">
                        <ul className="space-y-1">
                          <li className="font-medium text-ink">What matches</li>
                          {(v.matching_points ?? []).map((point, i) => (
                            <li key={`m${i}`} className="flex gap-2">
                              <span className="text-emerald-600" aria-hidden="true">+</span>
                              {point}
                            </li>
                          ))}
                        </ul>
                        <ul className="space-y-1">
                          <li className="font-medium text-ink">What is missing</li>
                          {(v.gaps ?? []).map((gap, i) => (
                            <li key={`g${i}`} className="flex gap-2">
                              <span className="text-accent" aria-hidden="true">−</span>
                              {gap}
                            </li>
                          ))}
                        </ul>
                        {Boolean(v.flags?.length) && (
                          <ul className="space-y-1">
                            <li className="font-medium text-ink">Watch out</li>
                            {v.flags!.map((flag, i) => (
                              <li key={`f${i}`} className="flex gap-2 text-red-700">
                                <span aria-hidden="true">!</span>
                                {flag}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>

        {rows.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-ink-faint">
            Nothing matches this filter.
          </p>
        )}
      </Frame>

      {tip && (
        <div
          role="tooltip"
          style={{ left: tip.x - 12, top: tip.y + 2 }}
          className="pointer-events-none fixed z-30 max-w-sm whitespace-pre-line rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink shadow-[0_12px_32px_-16px_rgba(30,58,95,0.35)]"
        >
          {tip.text}
        </div>
      )}

      {editingNote && (
        <NoteDialog
          title={editingNote.title}
          company={editingNote.company}
          initial={notes[editingNote.id]}
          onSave={(text) => saveNote(editingNote.id, text)}
          onClose={() => setEditingNote(null)}
        />
      )}
    </section>
  );
}
