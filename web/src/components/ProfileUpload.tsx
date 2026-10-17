"use client";

import { ACCEPTED } from "@/lib/cvText";
import type { Profile } from "@/lib/profileFromCv";
import { currentSectionText } from "@/lib/profileText";
import { useRef, useState } from "react";
import Frame from "@/components/Frame";

/**
 * The upload screen.
 *
 * A model read the file, so what it saved is shown back straight away: name,
 * contact line and the sections it found. Reading a CV can drop or merge
 * things, so any one section can be opened and corrected on its own, and the
 * correction is what the agent uses.
 */
export default function ProfileUpload({ initial }: { initial: Profile | null }) {
  const [profile, setProfile] = useState<Profile | null>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ title: string; text: string } | null>(null);
  const [savingText, setSavingText] = useState(false);
  const [textStatus, setTextStatus] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    setJustSaved(false);

    const body = new FormData();
    body.append("cv", file);
    try {
      const response = await fetch("/api/profile", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Upload failed.");
      } else {
        setProfile(data.profile);
        setEditing(null);
        setTextStatus(null);
        setJustSaved(true);
      }
    } catch {
      setError("Could not reach the server.");
    }
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  async function saveSection(title: string, value: string | null) {
    setSavingText(true);
    setTextStatus(null);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: title, text: value }),
      });
      const data = await response.json();
      if (!response.ok) {
        setTextStatus(data.error ?? "Could not save.");
      } else {
        setProfile(data.profile);
        setEditing(null);
        setTextStatus(value === null ? `${title}: back to what was read from your CV.` : `${title}: saved.`);
      }
    } catch {
      setTextStatus("Could not reach the server.");
    }
    setSavingText(false);
  }

  async function remove() {
    if (!confirm("Delete your CV from this site? Vacancies already found stay.")) return;
    setBusy(true);
    const response = await fetch("/api/profile", { method: "DELETE" });
    setBusy(false);
    if (response.ok) {
      setProfile(null);
      setJustSaved(false);
    } else {
      setError("Could not delete.");
    }
  }

  return (
    <div className="space-y-6">
      <Frame className="p-5">
        <h2 className="text-sm font-semibold text-ink">
          Submit your CV
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          A .pdf, .docx, .txt or .md file. It is read once and stored as
          structured text.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {/* The browser's own file control speaks the browser's language
              ("Seleccionar archivo"); a hidden one behind an English button
              keeps the page in one language. */}
          <input
            ref={input}
            id="cv-file"
            type="file"
            accept={ACCEPTED}
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                setFileName(file.name);
                upload(file);
              }
            }}
            className="sr-only"
          />
          <label
            htmlFor="cv-file"
            className={`cursor-pointer rounded-full border border-line px-4 py-2 text-sm font-medium text-ink transition-colors duration-150 hover:border-brand/40 hover:text-brand ${
              busy ? "pointer-events-none opacity-50" : ""
            }`}
          >
            Choose a file
          </label>
          <span className="text-sm text-ink-faint">{fileName ?? "No file chosen"}</span>
          {busy && (
            <span className="text-sm text-ink-soft" role="status">
              Reading it - about fifteen seconds.
            </span>
          )}
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        )}
        {justSaved && !error && (
          <p className="mt-4 text-sm text-ink-soft" role="status">
            Saved. Check below that nothing was lost.
          </p>
        )}
      </Frame>

      {profile && (
        <Frame className="p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-ink">What the agent reads</h2>
            <button
              onClick={remove}
              disabled={busy}
              className="cursor-pointer text-sm text-ink-faint transition-colors duration-150 hover:text-red-700"
            >
              Delete my CV
            </button>
          </div>

          <p className="mt-3 text-lg font-medium text-ink">
            {profile.contact?.name || "No name found"}
          </p>
          <p className="mt-0.5 text-sm text-ink-soft">
            {(profile.contact?.details ?? []).join(" · ") || "No contact details found"}
          </p>

          {profile.sections.length === 0 ? (
            <p className="mt-4 text-sm text-red-800">
              No sections were found. Try a .docx export instead.
            </p>
          ) : (
            <ul className="mt-5 divide-y divide-line border-y border-line">
              {profile.sections.map((section) => {
                const corrected = Boolean(profile.section_edits?.[section.title]?.trim());
                const open = editing?.title === section.title;
                return (
                  <li key={section.title} className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-sm text-ink">
                        {section.title}
                        {corrected && (
                          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                            Corrected
                          </span>
                        )}
                      </span>
                      <button
                        onClick={() => {
                          setTextStatus(null);
                          setEditing(open ? null : { title: section.title, text: currentSectionText(profile, section) });
                        }}
                        aria-expanded={open}
                        className="cursor-pointer text-sm text-ink-soft transition-colors duration-150 hover:text-brand"
                      >
                        {open ? "Close" : "Correct"}
                      </button>
                    </div>

                    {open && editing && (
                      <div className="mt-3">
                        <textarea
                          value={editing.text}
                          onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                          rows={Math.min(16, Math.max(5, editing.text.split("\n").length + 1))}
                          spellCheck={false}
                          aria-label={`${section.title}, as the agent reads it`}
                          className="w-full rounded-xl border border-line bg-surface px-4 py-3 font-mono text-[13px] leading-relaxed text-ink outline-none focus:border-brand/50"
                        />
                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          <button
                            onClick={() => saveSection(section.title, editing.text)}
                            disabled={savingText || editing.text.trim() === currentSectionText(profile, section)}
                            className="cursor-pointer rounded-full bg-brand px-5 py-2 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-soft disabled:opacity-50"
                          >
                            {savingText ? "Saving..." : "Save"}
                          </button>
                          {corrected && (
                            <button
                              onClick={() => saveSection(section.title, null)}
                              disabled={savingText}
                              className="cursor-pointer text-sm text-ink-soft transition-colors duration-150 hover:text-red-700"
                            >
                              Restore the original
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {textStatus && (
            <p role="status" className="mt-3 text-sm text-ink-soft">
              {textStatus}
            </p>
          )}
          <p className="mt-3 text-xs text-ink-faint">
            What the agent reads is your CV as saved here. Uploading a new CV replaces any corrections.
          </p>
        </Frame>
      )}
    </div>
  );
}
