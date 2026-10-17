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

  // Small pills, like "Tailor CV" in the example on the front page. A failure
  // shows as the tooltip and colour rather than a line of text, so the row
  // keeps its height.
  const pill =
    "cursor-pointer rounded-full border px-3 py-1 text-xs transition-colors duration-150 disabled:opacity-50";
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      {hasCv && (
        <a
          href={`/cvs?vacancy=${vacancyId}`}
          className={`${pill} border-brand/20 bg-brand/10 font-medium text-brand hover:bg-brand/15`}
        >
          Open
        </a>
      )}
      <button
        onClick={start}
        disabled={state === "working"}
        title={error ?? (hasCv ? "Write another CV for this vacancy" : "Write a CV for this vacancy")}
        className={
          hasCv && state !== "failed"
            ? "cursor-pointer text-xs text-ink-faint transition-colors duration-150 hover:text-brand disabled:opacity-50"
            : `${pill} ${state === "failed" ? "border-red-200 text-red-700" : "border-line text-ink-soft hover:border-brand/40 hover:text-brand"}`
        }
      >
        {state === "working" ? (
          "Writing..."
        ) : state === "failed" ? (
          "Retry"
        ) : hasCv ? (
          "Redo"
        ) : (
          "Tailor CV"
        )}
      </button>
    </span>
  );
}
