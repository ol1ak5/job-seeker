"use client";

import type { Cv } from "@/app/cvs/page";
import CvDocument from "@/components/CvDocument";
import CvReview from "@/components/CvReview";
import { useRef, useState } from "react";

type View = "document" | "changes" | "source";

const VIEWS: { key: View; label: string }[] = [
  { key: "document", label: "The CV" },
  { key: "changes", label: "What changed" },
  { key: "source", label: "Source" },
];

/**
 * One generated CV, in the three forms it is actually needed in.
 *
 * The document is what you send, so it opens first. The changes are what you
 * check before sending. The source is what you paste into something else - and
 * it is last, because a CV shown as Markdown is a draft, not a CV, and reading
 * one that way was the first thing to feel wrong about this page.
 */
export default function CvReader({ cv }: { cv: Cv }) {
  const [view, setView] = useState<View>("document");
  const [copied, setCopied] = useState(false);
  const card = useRef<HTMLElement>(null);

  /** What the reader settled on, or the model's version if they have not yet. */
  const text = cv.approved_markdown ?? cv.markdown;

  function download() {
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = cv.filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  /**
   * The browser's own print dialog, which every desktop platform offers as
   * "Save as PDF". It produces the same A4 page cv/make_pdf.sh produces, from
   * the same stylesheet, with selectable text and without a library.
   *
   * The attribute is set on this card alone: without it, a page listing four
   * CVs would put all four on the paper.
   */
  function print() {
    const node = card.current;
    if (!node) return;
    setView("document");
    requestAnimationFrame(() => {
      node.setAttribute("data-printing", "");
      window.print();
      node.removeAttribute("data-printing");
    });
  }

  async function copy() {
    await navigator.clipboard.writeText(text);
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
    <section ref={card} className="rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line-soft px-5 py-3">
        <div>
          <h2 className="text-sm font-medium text-ink">
            {cv.vacancies
              ? `${cv.vacancies.title} — ${cv.vacancies.company}`
              : cv.filename}
          </h2>
          <p className="mt-0.5 font-mono text-xs text-ink-faint">
            {when}
            {cv.approved_markdown && " · your edited version"}
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <button
            onClick={print}
            className="cursor-pointer rounded border border-line px-2 py-1 text-ink-soft transition-colors duration-150 hover:border-brand hover:text-brand"
          >
            Save as PDF
          </button>
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
        </div>
      </div>

      <div className="flex gap-1 border-b border-line-soft px-4 py-2">
        {VIEWS.map((option) => (
          <button
            key={option.key}
            onClick={() => setView(option.key)}
            aria-current={view === option.key ? "true" : undefined}
            className={`cursor-pointer rounded px-2.5 py-1 text-xs transition-colors duration-150 ${
              view === option.key
                ? "bg-brand/10 font-medium text-brand"
                : "text-ink-soft hover:bg-line-soft"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="p-5 sm:p-7">
        {view === "document" && <CvDocument markdown={text} />}
        {view === "changes" && <CvReview cv={cv} />}
        {view === "source" && (
          <pre className="overflow-x-auto font-mono text-xs leading-relaxed whitespace-pre-wrap text-ink-soft">
            {text}
          </pre>
        )}
      </div>
    </section>
  );
}
