/**
 * Facts about a vacancy that both halves of the app need.
 *
 * This file carries no "use client" marker, so it stays neutral: a Server
 * Component may call these functions directly, and a Client Component may
 * import them too. A helper defined inside a "use client" file cannot be called
 * from the server at all - React only knows how to send components across that
 * boundary, not plain functions - which is why these live here rather than in
 * VacancyTable.
 */

export type Vacancy = {
  id: string;
  track: string;
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
  applications:
    | {
        status: string;
        applied_at: string | null;
        notes?: string | null;
        applied_text?: string | null;
        /** Values of the columns you added, keyed by column id. */
        extra?: Record<string, string> | null;
      }[]
    | null;
  cvs: { id: string }[] | null;
};

export function statusOf(vacancy: Vacancy): string {
  return vacancy.applications?.[0]?.status ?? "interested";
}

/** A column you added to the table yourself. */
export type CustomColumn = { id: string; name: string };
