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

  // Plain links sized for a table cell. A failure shows as the link's tooltip
  // and colour rather than a line of text, so the row keeps its height.
  const link = "cursor-pointer text-sm transition-colors duration-150 disabled:opacity-50";
  return (
    <span className="inline-flex items-center gap-3 whitespace-nowrap">
      {hasCv && (
        <a href={`/cvs?vacancy=${vacancyId}`} className={`${link} font-medium text-brand hover:text-brand-soft`}>
          Open
        </a>
      )}
      <button
        onClick={start}
        disabled={state === "working"}
        title={error ?? (hasCv ? "Write another CV for this vacancy" : "Write a CV for this vacancy")}
        className={`${link} inline-flex items-center ${state === "failed" ? "text-red-700" : hasCv ? "text-ink-faint hover:text-brand" : "font-medium text-brand hover:text-brand-soft"}`}
      >
        {state === "working" ? (
          "Writing..."
        ) : state === "failed" ? (
          "Retry"
        ) : hasCv ? (
          "Redo"
        ) : (
          "Tailor"
        )}
      </button>
    </span>
  );
}
