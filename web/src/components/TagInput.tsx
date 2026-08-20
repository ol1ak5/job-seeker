"use client";

import { useState } from "react";

/**
 * A list of words, entered one at a time.
 *
 * Every filter in a track is a list of keywords, and a comma-separated text box
 * makes it impossible to see where one keyword ends. Chips make the list
 * countable at a glance and removable one by one.
 */
export default function TagInput({
  id,
  label,
  hint,
  values,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  values: string[];
  placeholder?: string;
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    // Pasting "analyst, associate" should produce two chips, not one.
    const added = raw
      .split(",")
      .map((word) => word.trim().toLowerCase())
      .filter((word) => word && !values.includes(word));
    if (added.length) onChange([...values, ...added]);
    setDraft("");
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add(draft);
    } else if (event.key === "Backspace" && !draft && values.length) {
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {hint && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1.5 focus-within:border-brand">
        {values.map((value) => (
          <span
            key={value}
            className="inline-flex items-center gap-1 rounded bg-line-soft px-2 py-0.5 text-xs text-ink-soft"
          >
            {value}
            <button
              type="button"
              onClick={() => onChange(values.filter((v) => v !== value))}
              aria-label={`Remove ${value}`}
              className="cursor-pointer text-ink-faint transition-colors duration-150 hover:text-red-700"
            >
              &times;
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => draft && add(draft)}
          placeholder={values.length ? "" : placeholder}
          className="min-w-32 flex-1 bg-transparent py-0.5 text-sm text-ink outline-none placeholder:text-ink-faint"
        />
      </div>
    </div>
  );
}
