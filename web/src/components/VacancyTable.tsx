"use client";

import { createClient } from "@/lib/supabase/client";
import { useMemo, useState } from "react";

export type Vacancy = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  url: string;
  source: string;
  posted: string | null;
  score: number | null;
  verdict: string | null;
  matching_points: string[] | null;
  gaps: string[] | null;
  flags: string[] | null;
  applications: { status: string; applied_at: string | null }[] | null;
};

const STATUSES = [
  "interested",
  "applied",
  "interview",
  "offer",
  "rejected",
  "declined",
] as const;

/** Days after applying with no status change before a follow-up is suggested. */
export const FOLLOW_UP_AFTER_DAYS = 10;

const STATUS_STYLE: Record<string, string> = {
  interested: "border-line text-ink-soft",
  applied: "border-brand/30 bg-brand/5 text-brand",
  interview: "border-emerald-300 bg-emerald-50 text-emerald-800",
  offer: "border-emerald-400 bg-emerald-100 text-emerald-900",
  rejected: "border-line bg-line-soft text-ink-faint",
  declined: "border-line bg-line-soft text-ink-faint",
};

function scoreStyle(score: number | null) {
  if (score === null) return "bg-line-soft text-ink-faint";
  if (score >= 80) return "bg-emerald-100 text-emerald-900";
  if (score >= 60) return "bg-brand/10 text-brand";
  if (score >= 40) return "bg-amber-100 text-amber-900";
  return "bg-line-soft text-ink-faint";
}

export function daysSince(date: string | null): number | null {
  if (!date) return null;
  return Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
}

/** "12 Aug" reads faster in a column than "2026-08-12". */
function shortDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

type SortKey = "score" | "posted" | "company";

export default function VacancyTable({
  vacancies,
  userId,
}: {
  vacancies: Vacancy[];
  userId: string;
}) {
  const [statuses, setStatuses] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      vacancies.map((v) => [v.id, v.applications?.[0]?.status ?? "interested"]),
    ),
  );
  const [appliedAt, setAppliedAt] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(
      vacancies.map((v) => [v.id, v.applications?.[0]?.applied_at ?? null]),
    ),
  );
  const [expanded, setExpanded] = useState<string | null>(null);
  const [minScore, setMinScore] = useState(0);
  const [hideClosed, setHideClosed] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("score");

  async function changeStatus(vacancyId: string, status: string) {
    const today = new Date().toISOString().slice(0, 10);
    const applied = status === "applied" ? today : appliedAt[vacancyId];

    // Optimistic update: show the change now, persist in the background.
    setStatuses((prev) => ({ ...prev, [vacancyId]: status }));
    setAppliedAt((prev) => ({ ...prev, [vacancyId]: applied ?? null }));

    const supabase = createClient();
    await supabase
      .from("applications")
      .upsert(
        { user_id: userId, vacancy_id: vacancyId, status, applied_at: applied },
        { onConflict: "user_id,vacancy_id" },
      );
  }

  const rows = useMemo(() => {
    const filtered = vacancies.filter((v) => {
      if ((v.score ?? 0) < minScore) return false;
      if (hideClosed && ["rejected", "declined"].includes(statuses[v.id])) return false;
      return true;
    });
    return filtered.sort((a, b) => {
      if (sortKey === "company") return a.company.localeCompare(b.company);
      if (sortKey === "posted") return (b.posted ?? "").localeCompare(a.posted ?? "");
      return (b.score ?? -1) - (a.score ?? -1);
    });
  }, [vacancies, minScore, hideClosed, statuses, sortKey]);

  const sortableHeader = (key: SortKey, label: string) => (
    <button
      onClick={() => setSortKey(key)}
      className={`cursor-pointer transition-colors duration-150 hover:text-ink ${
        sortKey === key ? "text-ink" : ""
      }`}
    >
      {label}
      {sortKey === key && <span aria-hidden="true"> ↓</span>}
    </button>
  );

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-ink-soft">
        <div className="flex items-center gap-3">
          <label htmlFor="minScore" className="whitespace-nowrap">
            Min score
          </label>
          <input
            id="minScore"
            type="range"
            min={0}
            max={90}
            step={10}
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="w-40 cursor-pointer accent-brand"
          />
          <span className="w-6 font-mono text-ink">{minScore}</span>
        </div>

        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={hideClosed}
            onChange={(e) => setHideClosed(e.target.checked)}
            className="h-4 w-4 cursor-pointer accent-brand"
          />
          Hide rejected and declined
        </label>

        <span className="ml-auto font-mono text-ink-faint">
          {rows.length}/{vacancies.length}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-line-soft text-left text-xs font-medium uppercase tracking-wide text-ink-faint">
              <th className="px-3 py-2.5">{sortableHeader("score", "Score")}</th>
              <th className="px-3 py-2.5">Vacancy</th>
              <th className="px-3 py-2.5">{sortableHeader("company", "Company")}</th>
              <th className="hidden px-3 py-2.5 md:table-cell">Location</th>
              <th className="px-3 py-2.5">{sortableHeader("posted", "Posted")}</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5">
                <span className="sr-only">Original posting</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((v) => {
              const status = statuses[v.id];
              const waiting = daysSince(appliedAt[v.id]);
              const needsFollowUp =
                status === "applied" &&
                waiting !== null &&
                waiting >= FOLLOW_UP_AFTER_DAYS;
              const isOpen = expanded === v.id;

              return (
                <tr
                  key={v.id}
                  className="border-b border-line-soft align-top transition-colors duration-150 last:border-0 hover:bg-line-soft/60"
                >
                  <td className="px-3 py-3">
                    <span
                      className={`inline-block rounded px-2 py-0.5 font-mono text-sm ${scoreStyle(v.score)}`}
                    >
                      {v.score ?? "—"}
                    </span>
                  </td>

                  <td className="max-w-md px-3 py-3">
                    <button
                      onClick={() => setExpanded(isOpen ? null : v.id)}
                      aria-expanded={isOpen}
                      className="cursor-pointer text-left font-medium text-ink transition-colors duration-150 hover:text-brand"
                    >
                      {v.title}
                    </button>
                    {needsFollowUp && (
                      <span className="ml-2 whitespace-nowrap rounded bg-accent/10 px-1.5 py-0.5 font-mono text-xs text-accent">
                        follow up {waiting}d
                      </span>
                    )}

                    {isOpen && (
                      <div className="mt-3 space-y-1.5 border-l-2 border-line pl-3 text-xs leading-relaxed text-ink-soft">
                        {v.matching_points?.map((point, i) => (
                          <p key={`m${i}`} className="flex gap-2">
                            <span className="text-emerald-600" aria-hidden="true">+</span>
                            <span>{point}</span>
                          </p>
                        ))}
                        {v.gaps?.map((gap, i) => (
                          <p key={`g${i}`} className="flex gap-2">
                            <span className="text-accent" aria-hidden="true">−</span>
                            <span>{gap}</span>
                          </p>
                        ))}
                        {v.flags?.map((flag, i) => (
                          <p key={`f${i}`} className="flex gap-2 text-red-700">
                            <span aria-hidden="true">!</span>
                            <span>{flag}</span>
                          </p>
                        ))}
                        <p className="pt-1 font-mono text-ink-faint">via {v.source}</p>
                      </div>
                    )}
                  </td>

                  <td className="px-3 py-3 text-ink-soft">{v.company}</td>
                  <td className="hidden px-3 py-3 text-ink-faint md:table-cell">
                    {v.location || "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-ink-faint">
                    {shortDate(v.posted)}
                  </td>

                  <td className="px-3 py-3">
                    <select
                      value={status}
                      onChange={(e) => changeStatus(v.id, e.target.value)}
                      aria-label={`Status for ${v.title}`}
                      className={`cursor-pointer rounded border px-2 py-1 text-xs transition-colors duration-150 ${STATUS_STYLE[status] ?? "border-line"}`}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="px-3 py-3">
                    <a
                      href={v.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open the original posting for ${v.title}`}
                      className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-line px-2 py-1 text-xs text-ink-soft transition-colors duration-150 hover:border-brand hover:text-brand"
                    >
                      Open
                      <svg
                        className="h-3 w-3"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        aria-hidden="true"
                      >
                        <path d="M6 3h7v7M13 3L6.5 9.5M11 9v4H3V5h4" strokeLinecap="round" />
                      </svg>
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {rows.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-ink-faint">
            Nothing matches these filters.
          </p>
        )}
      </div>
    </section>
  );
}
