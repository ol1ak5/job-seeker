"use client";

import { ACCEPTED } from "@/lib/cvText";
import type { Profile } from "@/lib/profileFromCv";
import { useRef, useState } from "react";

function sectionSummary(profile: Profile) {
  return profile.sections.map((s) => ({
    title: s.title,
    count: Array.isArray(s.items) ? s.items.length : 0,
  }));
}

/**
 * The upload screen.
 *
 * A model read the file, so the parsed result is shown back immediately -
 * name, contact line, every section and how many entries it found. That is the
 * only way to notice it dropped half a job history, and it costs one glance.
 */
export default function ProfileUpload({ initial }: { initial: Profile | null }) {
  const [profile, setProfile] = useState<Profile | null>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
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
        setJustSaved(true);
      }
    } catch {
      setError("Could not reach the server.");
    }
    setBusy(false);
    if (input.current) input.current.value = "";
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
      <section className="rounded-lg border border-line bg-surface p-5">
        <h2 className="text-sm font-semibold text-ink">
          {profile ? "Replace your CV" : "Upload your CV"}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          A .pdf, .docx, .txt or .md file. It is read once and stored as
          structured text; every vacancy is then scored against it.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            ref={input}
            type="file"
            accept={ACCEPTED}
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload(file);
            }}
            className="cursor-pointer text-sm text-ink-soft file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:text-sm file:text-ink-soft hover:file:border-brand hover:file:text-brand"
          />
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
      </section>

      {profile && (
        <section className="rounded-lg border border-line bg-surface p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-ink">What was read</h2>
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

          <dl className="mt-5 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {sectionSummary(profile).map((s) => (
              <div key={s.title} className="flex items-baseline justify-between gap-3 border-b border-line-soft pb-2">
                <dt className="text-sm text-ink">{s.title}</dt>
                <dd className="font-mono text-xs text-ink-faint">
                  {s.count} {s.count === 1 ? "entry" : "entries"}
                </dd>
              </div>
            ))}
          </dl>

          {profile.sections.length === 0 && (
            <p className="mt-4 text-sm text-red-800">
              No sections were found. Try a .docx export instead.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
