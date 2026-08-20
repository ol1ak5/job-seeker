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
  cvs: { id: string }[] | null;
};

/** Days after applying with no status change before a follow-up is suggested. */
export const FOLLOW_UP_AFTER_DAYS = 10;

export function daysSince(date: string | null): number | null {
  if (!date) return null;
  return Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
}

export function statusOf(vacancy: Vacancy): string {
  return vacancy.applications?.[0]?.status ?? "interested";
}

/** Applied, and the company has said nothing since. */
export function needsFollowUp(status: string, appliedAt: string | null): boolean {
  const waiting = daysSince(appliedAt);
  return status === "applied" && waiting !== null && waiting >= FOLLOW_UP_AFTER_DAYS;
}
