/**
 * A job the engine never closed.
 *
 * The runner gives up after 20 minutes. Normally it records that the job
 * failed, but a runner that is killed outright records nothing, and the row
 * would stay "running" for ever: the page would keep saying "Searching..." and
 * refuse to start another search. Past this age a queued or running job is
 * treated as failed, whatever the row says.
 */
export const STALE_MINUTES = 25;

export const STALE_ERROR = "The search stopped without finishing. Run it again.";

type JobLike = { status: string; created_at: string; error: string | null };

export function staleSince(now = Date.now()): string {
  return new Date(now - STALE_MINUTES * 60_000).toISOString();
}

export function settle<T extends JobLike>(job: T | null, now = Date.now()): T | null {
  if (!job || !["queued", "running"].includes(job.status)) return job;
  if (new Date(job.created_at).getTime() > now - STALE_MINUTES * 60_000) return job;
  return { ...job, status: "failed", error: STALE_ERROR };
}
