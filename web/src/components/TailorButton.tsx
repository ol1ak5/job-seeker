"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Ask the engine to rewrite the CV for one vacancy.
 *
 * The same machinery as the search button - a job row, a runner, a poll - but
 * one model call rather than thirty, so it comes back in well under a minute.
 */
export default function TailorButton({
  vacancyId,
  hasCv,
}: {
  vacancyId: string;
  hasCv: boolean;
}) {
  const [state, setState] = useState<"idle" | "working" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );

  async function start() {
    setState("working");
    setError(null);

    const response = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "adapt", vacancy_id: vacancyId }),
    });
    const data = await response.json();
    if (!response.ok) {
      setState("failed");
      setError(data.error ?? "Could not start.");
      return;
    }

    timer.current = setInterval(async () => {
      const poll = await fetch("/api/jobs");
      if (!poll.ok) return;
      const { adapt } = await poll.json();
      if (!adapt || adapt.status === "queued" || adapt.status === "running") return;

      if (timer.current) clearInterval(timer.current);
      if (adapt.status === "failed") {
        setState("failed");
        setError(adapt.error?.split("\n").slice(-2).join(" ").slice(0, 200) ?? null);
      } else {
        setState("idle");
        router.refresh();
      }
    }, 4000);
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <button
        onClick={start}
        disabled={state === "working"}
        className="cursor-pointer rounded border border-line px-2 py-1 text-xs text-ink-soft transition-colors duration-150 hover:border-brand hover:text-brand disabled:opacity-50"
      >
        {state === "working"
          ? "Writing..."
          : hasCv
            ? "Write another CV"
            : "Tailor my CV for this"}
      </button>

      {hasCv && (
        <a
          href={`/cvs?vacancy=${vacancyId}`}
          className="text-xs text-brand transition-opacity duration-150 hover:opacity-80"
        >
          Read the CV
        </a>
      )}

      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
