"use client";

import type { Cv } from "@/app/cvs/page";
import CvReview from "@/components/CvReview";
import { useState } from "react";

/**
 * One generated CV: readable, copyable, downloadable.
 *
 * It is shown as the Markdown the model produced rather than rendered prose,
 * because that text is the thing you will paste somewhere else and edit. Making
 * it look like a finished document would hide the parts worth correcting.
 */
export default function CvReader({ cv }: { cv: Cv }) {
  const [view, setView] = useState<"changes" | "text">("changes");
  const [copied, setCopied] = useState(false);

  function download() {
    const blob = new Blob([cv.markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = cv.filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function copy() {
    await navigator.clipboard.writeText(cv.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const when = new Date(cv.created_at).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <section className="rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line-soft px-5 py-3">
        <div>
          <h2 className="text-sm font-medium text-ink">
            {cv.vacancies
              ? `${cv.vacancies.title} — ${cv.vacancies.company}`
              : cv.filename}
          </h2>
          <p className="mt-0.5 font-mono text-xs text-ink-faint">{when}</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <button
            onClick={copy}
            className="cursor-pointer text-ink-soft transition-colors duration-150 hover:text-brand"
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={download}
            className="cursor-pointer text-ink-soft transition-colors duration-150 hover:text-brand"
          >
            Download
          </button>
          <button
            onClick={() => setView(view === "changes" ? "text" : "changes")}
            className="cursor-pointer text-ink-faint transition-colors duration-150 hover:text-ink"
          >
            {view === "changes" ? "Show the whole text" : "Show what changed"}
          </button>
        </div>
      </div>

      <div className="p-5">
        {view === "changes" ? (
          <CvReview cv={cv} />
        ) : (
          <pre className="overflow-x-auto font-mono text-xs leading-relaxed whitespace-pre-wrap text-ink-soft">
            {cv.approved_markdown ?? cv.markdown}
          </pre>
        )}
      </div>
    </section>
  );
}
