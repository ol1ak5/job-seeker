"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

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
const FOLLOW_UP_AFTER_DAYS = 10;

const SCORE_STYLE = (score: number | null) =>
  score === null
    ? "bg-slate-100 text-slate-500"
    : score >= 80
      ? "bg-emerald-100 text-emerald-800"
      : score >= 60
        ? "bg-sky-100 text-sky-800"
        : score >= 40
          ? "bg-amber-100 text-amber-800"
          : "bg-slate-100 text-slate-500";

function daysSince(date: string | null): number | null {
  if (!date) return null;
  const ms = Date.now() - new Date(date).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export default function VacancyTable({
  vacancies,
  userId,
}: {
  vacancies: Vacancy[];
  userId: string;
}) {
  // Local copy of the statuses so a change shows instantly, without waiting
  // for a round trip to the database.
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

  async function changeStatus(vacancyId: string, status: string) {
    const today = new Date().toISOString().slice(0, 10);
    const applied = status === "applied" ? today : appliedAt[vacancyId];

    setStatuses((prev) => ({ ...prev, [vacancyId]: status }));
    setAppliedAt((prev) => ({ ...prev, [vacancyId]: applied ?? null }));

    const supabase = createClient();
    // upsert: create the tracker row on first change, update it afterwards.
    await supabase
      .from("applications")
      .upsert(
        { user_id: userId, vacancy_id: vacancyId, status, applied_at: applied },
        { onConflict: "user_id,vacancy_id" },
      );
  }

  const rows = vacancies.filter((v) => (v.score ?? 0) >= minScore);

  return (
    <div>
      <div className="mb-4 flex items-center gap-3 text-sm text-slate-600">
        <label htmlFor="minScore">Minimum score</label>
        <input
          id="minScore"
          type="range"
          min={0}
          max={90}
          step={10}
          value={minScore}
          onChange={(e) => setMinScore(Number(e.target.value))}
          className="w-48"
        />
        <span className="w-8 font-medium text-slate-900">{minScore}</span>
        <span className="ml-auto">
          {rows.length} of {vacancies.length}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-medium">Score</th>
              <th className="px-3 py-2 font-medium">Vacancy</th>
              <th className="px-3 py-2 font-medium">Company</th>
              <th className="px-3 py-2 font-medium">Location</th>
              <th className="px-3 py-2 font-medium">Posted</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium"></th>
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

              return (
                <tr key={v.id} className="border-b border-slate-100 align-top last:border-0">
                  <td className="px-3 py-3">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${SCORE_STYLE(v.score)}`}
                    >
                      {v.score ?? "n/a"}
                    </span>
                  </td>

                  <td className="max-w-sm px-3 py-3">
                    <button
                      onClick={() => setExpanded(expanded === v.id ? null : v.id)}
                      className="text-left font-medium text-slate-900 hover:underline"
                    >
                      {v.title}
                    </button>
                    {needsFollowUp && (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                        follow up · {waiting}d
                      </span>
                    )}
                    {expanded === v.id && (
                      <div className="mt-2 space-y-1 text-xs text-slate-600">
                        {v.matching_points?.map((point, i) => (
                          <p key={`m${i}`}>
                            <span className="text-emerald-600">+</span> {point}
                          </p>
                        ))}
                        {v.gaps?.map((gap, i) => (
                          <p key={`g${i}`}>
                            <span className="text-amber-600">−</span> {gap}
                          </p>
                        ))}
                        {v.flags?.map((flag, i) => (
                          <p key={`f${i}`} className="text-red-600">! {flag}</p>
                        ))}
                      </div>
                    )}
                  </td>

                  <td className="px-3 py-3 text-slate-700">{v.company}</td>
                  <td className="px-3 py-3 text-slate-500">{v.location || "—"}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-slate-500">
                    {v.posted ?? "—"}
                  </td>

                  <td className="px-3 py-3">
                    <select
                      value={status}
                      onChange={(e) => changeStatus(v.id, e.target.value)}
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="whitespace-nowrap px-3 py-3">
                    <a
                      href={v.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      Open ↗
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
