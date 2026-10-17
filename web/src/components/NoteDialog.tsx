"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A small window for the note on one vacancy.
 *
 * The table keeps every row one line high, so a note there shows only its
 * beginning. Writing and reading the whole of it happens here instead.
 */
export default function NoteDialog({
  title,
  company,
  initial,
  onSave,
  onClose,
}: {
  title: string;
  company: string;
  initial: string;
  onSave: (text: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(initial);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const field = area.current;
    if (!field) return;
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-ink/20 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="note-title"
        className="w-full max-w-lg rounded-2xl border border-line bg-surface p-6 shadow-[0_24px_60px_-24px_rgba(30,58,95,0.45)]"
      >
        <h2 id="note-title" className="text-lg font-semibold tracking-tight text-ink">
          Note
        </h2>
        <p className="mt-0.5 truncate text-sm text-ink-soft">
          {title} · {company}
        </p>

        <textarea
          ref={area}
          rows={7}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSave(text);
          }}
          placeholder="Type a note"
          aria-label={`Note for ${title}`}
          className="mt-4 w-full resize-none rounded-xl border border-line bg-surface px-3.5 py-3 text-sm leading-relaxed text-ink outline-none placeholder:text-ink-faint/70 focus:border-brand/50"
        />

        <div className="mt-4 flex items-center justify-end gap-3">
          <span className="mr-auto text-xs text-ink-faint">⌘ Enter to save</span>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-full px-4 py-2 text-sm text-ink-soft transition-colors duration-150 hover:text-ink"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(text)}
            className="cursor-pointer rounded-full bg-brand px-5 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-soft"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
