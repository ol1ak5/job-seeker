"use client";

import { useEffect, useRef, useState } from "react";
import Frame from "@/components/Frame";

/**
 * "+ Add column": a name, and the table gains a column you type into.
 *
 * Opens as a small box under the button rather than inside the table, which
 * scrolls sideways and would cut off anything hanging below its header.
 */
export default function AddColumn({
  onAdd,
}: {
  /** Resolves to an error message, or null once the column exists. */
  onAdd: (name: string) => Promise<string | null>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    setBusy(true);
    const problem = await onAdd(clean.slice(0, 40));
    setBusy(false);
    if (problem) {
      setError(problem);
      return;
    }
    setName("");
    setError(null);
    setOpen(false);
  }

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap text-ink-soft transition-colors duration-150 hover:text-brand"
      >
        <span aria-hidden className="text-base leading-none">+</span>
        Add column
      </button>

      {open && (
        <Frame small outer="absolute right-0 z-20 mt-2 w-64">
          <form onSubmit={submit} className="p-3">
            <label htmlFor="new-column" className="block text-xs text-ink-faint">
              Column name
            </label>
            <input
              id="new-column"
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              maxLength={40}
              placeholder="Type a name"
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              data-form-type="other"
              className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint/70 focus:border-brand/50"
            />
            {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="cursor-pointer rounded-full px-3 py-1.5 text-sm text-ink-soft hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || !name.trim()}
                className="cursor-pointer rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-soft disabled:opacity-50"
              >
                {busy ? "Adding..." : "Add"}
              </button>
            </div>
          </form>
        </Frame>
      )}
    </div>
  );
}
