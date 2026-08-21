"use client";

import type { Cv } from "@/app/cvs/page";
import CvDocument from "@/components/CvDocument";
import CvSource from "@/components/CvSource";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

type View = "document" | "source";

const VIEWS: { key: View; label: string }[] = [
  { key: "document", label: "The CV" },
  { key: "source", label: "Text and changes" },
];

/**
 * One generated CV, in the three forms it is actually needed in.
 *
 * The document is what you send, so it opens first. Behind it is the text with
 * the model's changes marked in place - deciding about them and rewriting the
 * whole thing were two screens until it became clear they are one job.
 */
export default function CvReader({ cv }: { cv: Cv }) {
  const [view, setView] = useState<View>("document");
  const [copied, setCopied] = useState(false);

  /** What the reader settled on, or the model's version if they have not yet. */
  const saved = cv.approved_markdown ?? cv.markdown;
  const [text, setText] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const router = useRouter();

  const edited = text !== saved;

  async function saveText() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("cvs")
      .update({ approved_markdown: text })
      .eq("id", cv.id);
    setSaving(false);
    setNote(error ? `Could not save: ${error.message}` : "Saved.");
    if (!error) router.refresh();
  }

  function download() {
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = cv.filename;
    link.click();
    URL.revokeObjectURL(url);
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
    <section className="rounded-lg border border-line bg-surface">
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
          <a
            href={`/cvs/${cv.id}/print`}
            target="_blank"
            rel="noreferrer"
            className="cursor-pointer rounded border border-line px-2 py-1 text-ink-soft transition-colors duration-150 hover:border-brand hover:text-brand"
          >
            Save as PDF
          </a>
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
        {view === "source" && (
          <div>
            <CvSource
              baseline={cv.baseline}
              generated={cv.markdown}
              value={text}
              onChange={(next) => {
                setText(next);
                setNote(null);
              }}
            />
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <button
                onClick={saveText}
                disabled={saving || !edited}
                className="cursor-pointer rounded-lg bg-brand px-3 py-1.5 font-medium text-white transition-opacity duration-150 hover:opacity-90 disabled:opacity-40"
              >
                {saving ? "Saving..." : "Save my version"}
              </button>
              <button
                onClick={() => {
                  setText(saved);
                  setNote(null);
                }}
                disabled={!edited}
                className="cursor-pointer text-ink-faint transition-colors duration-150 hover:text-ink disabled:opacity-40"
              >
                Undo my changes
              </button>
              {note && <span className="text-ink-faint">{note}</span>}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
