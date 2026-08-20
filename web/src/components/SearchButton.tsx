"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export type Job = {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  error: string | null;
  result: { track?: string; vacancies?: number } | null;
  created_at: string;
  finished_at: string | null;
};

const POLL_MS = 5000;

const WORDS: Record<Job["status"], string> = {
  queued: "Waking the engine up",
  running: "Reading the job boards and scoring what it finds",
  done: "Finished",
  failed: "Failed",
};

/**
 * "20 minutes ago". The count of what a run found is deliberately not shown
 * here: it was true when the run ended, and a vacancy deleted since would make
 * it a lie. The tiles above hold the current number, and only one of the two
 * can be the source of truth.
 */
function relativeTime(iso: string | null): string {
  if (!iso) return "recently";
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/**
 * Start a search and watch it happen.
 *
 * The work is minutes long, so there is no request to wait on - only a row in
 * the database that changes. Polling it every few seconds is enough, and it is
 * honest about what is happening: an unexplained spinner for three minutes
 * reads as a broken page.
 */
export default function SearchButton({
  track,
  initialJob,
}: {
  track: string;
  initialJob: Job | null;
}) {
  const [job, setJob] = useState<Job | null>(initialJob);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const router = useRouter();
  const wasBusy = useRef(false);

  const busy = job?.status === "queued" || job?.status === "running";

  const poll = useCallback(async () => {
    const response = await fetch("/api/jobs");
    if (!response.ok) return;
    const { job: latest } = await response.json();
    setJob(latest);
  }, []);

  useEffect(() => {
    if (!busy) {
      // The run that just ended put rows in the table the page has not read.
      if (wasBusy.current) router.refresh();
      wasBusy.current = false;
      return;
    }
    wasBusy.current = true;
    const timer = setInterval(poll, POLL_MS);
    return () => clearInterval(timer);
  }, [busy, poll, router]);

  async function start() {
    setStarting(true);
    setError(null);
    try {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ track }),
      });
      const data = await response.json();
      if (!response.ok) setError(data.error ?? "Could not start the search.");
      else setJob(data.job);
    } catch {
      setError("Could not reach the server.");
    }
    setStarting(false);
  }

  return (
    <div className="mb-4 rounded-lg border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={start}
          disabled={busy || starting || !track}
          className="cursor-pointer rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
        >
          {busy
            ? "Searching..."
            : starting
              ? "Starting..."
              : `Search ${track}`}
        </button>

        {busy && (
          <p className="text-sm text-ink-soft" role="status">
            {WORDS[job!.status]}. This takes a few minutes - you can leave the
            page.
          </p>
        )}

        {!busy && !track && (
          <p className="text-sm text-ink-faint">
            Set up a search first, and upload your CV.
          </p>
        )}
      </div>

      {job?.status === "done" && (
        <p className="mt-3 text-sm text-ink-soft" role="status">
          Last search ran {relativeTime(job.finished_at)} on the{" "}
          <span className="font-mono">{job.result?.track ?? "saved"}</span> list.
        </p>
      )}

      {job?.status === "failed" && job.error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {job.error.split("\n").slice(-3).join(" ").slice(0, 300)}
        </p>
      )}

      {error && (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}
