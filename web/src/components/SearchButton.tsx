"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export type Job = {
  id: string;
  status: "queued" | "running" | "done" | "failed";
  error: string | null;
  result: { track?: string; tracks?: string[]; vacancies?: number } | null;
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
 * Start a search and watch it happen.
 *
 * The work is minutes long, so there is no request to wait on - only a row in
 * the database that changes. Polling it every few seconds is enough, and it is
 * honest about what is happening: an unexplained spinner for three minutes
 * reads as a broken page.
 */
export default function SearchButton({
  ready,
  hint = "Set up a search first, and upload your CV.",
  initialJob,
  children,
}: {
  /** Whether the account has a CV and a saved search to run. */
  ready: boolean;
  /** What is missing while it is not ready. */
  hint?: string;
  initialJob: Job | null;
  /** Further actions shown beside the button, such as adding a vacancy. */
  children?: React.ReactNode;
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
      // No track named: the engine runs every saved search in turn.
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
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
    <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap gap-3">
        <button
          onClick={start}
          disabled={busy || starting || !ready}
          className="cursor-pointer rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-soft disabled:opacity-50"
        >
          {busy ? "Searching..." : starting ? "Starting..." : "Run the search"}
        </button>
        {children}
      </div>

      {busy && (
        <p className="max-w-sm text-xs text-ink-soft sm:text-right" role="status">
          {WORDS[job!.status]}. This takes a few minutes - you can leave the page.
        </p>
      )}

      {!busy && !ready && (
        <p className="text-xs text-ink-faint">{hint}</p>
      )}

      {job?.status === "failed" && job.error && (
        <p className="max-w-sm rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {job.error.split("\n").slice(-3).join(" ").slice(0, 300)}
        </p>
      )}

      {error && (
        <p className="max-w-sm rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}
