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
 * Start a search and watch it happen.
 *
 * The work is minutes long, so there is no request to wait on - only a row in
 * the database that changes. Polling it every few seconds is enough, and it is
 * honest about what is happening: an unexplained spinner for three minutes
 * reads as a broken page.
 */
export default function SearchButton({
  tracks,
  initialJob,
}: {
  tracks: string[];
  initialJob: Job | null;
}) {
  const [job, setJob] = useState<Job | null>(initialJob);
  const [track, setTrack] = useState(tracks[0] ?? "");
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
        {tracks.length > 1 && (
          <select
            value={track}
            onChange={(e) => setTrack(e.target.value)}
            disabled={busy}
            aria-label="Which search to run"
            className="cursor-pointer rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand disabled:opacity-50"
          >
            {tracks.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}

        <button
          onClick={start}
          disabled={busy || starting || !tracks.length}
          className="cursor-pointer rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Searching..." : starting ? "Starting..." : "Search now"}
        </button>

        {busy && (
          <p className="text-sm text-ink-soft" role="status">
            {WORDS[job!.status]}. This takes a few minutes - you can leave the
            page.
          </p>
        )}

        {!busy && !tracks.length && (
          <p className="text-sm text-ink-faint">
            Set up a search first, and upload your CV.
          </p>
        )}
      </div>

      {job?.status === "done" && job.result?.vacancies !== undefined && (
        <p className="mt-3 text-sm text-ink-soft" role="status">
          Last search finished with {job.result.vacancies} vacancies on the{" "}
          <span className="font-mono">{job.result.track}</span> list.
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
