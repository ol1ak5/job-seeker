"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Frame from "@/components/Frame";

/**
 * A vacancy the user found themselves.
 *
 * Most openings are found by accident - a link from a friend, something on
 * LinkedIn - and until now those could not be tracked here at all, so the
 * dashboard only ever knew about half of a real job search.
 *
 * It is stored exactly like a searched one, with source "manual" and no score.
 * Scoring it against the CV needs the Python engine and comes with the search
 * button; the tracking half works now and is useful on its own.
 */
export default function AddVacancy({
  userId,
  tracks,
  onClose,
}: {
  userId: string;
  tracks: string[];
  /** Called on cancel, and once the vacancy is saved. */
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    company: "",
    location: "",
    url: "",
    description: "",
    track: tracks[0] || "manual",
  });
  const router = useRouter();

  function set(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setError(null);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form.title.trim() || !form.company.trim()) {
      setError("A title and a company are the minimum.");
      return;
    }
    setBusy(true);

    const supabase = createClient();
    const { error } = await supabase.from("vacancies").insert({
      user_id: userId,
      track: form.track,
      // the searched vacancies carry ids like energy-0817-02; this marks the
      // ones that arrived by hand so a later run never mistakes them for its own
      ref: `manual-${Date.now().toString(36)}`,
      title: form.title.trim(),
      company: form.company.trim(),
      location: form.location.trim(),
      // the url is the unique key per user, so a blank one still needs a value
      url: form.url.trim() || `manual:${crypto.randomUUID()}`,
      source: "manual",
      description: form.description.trim(),
    });

    setBusy(false);
    if (error) {
      setError(
        error.code === "23505"
          ? "That link is already on your list."
          : `Could not save: ${error.message}`,
      );
      return;
    }
    setForm({ ...form, title: "", company: "", location: "", url: "", description: "" });
    onClose();
    router.refresh();
  }

  const field =
    "mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint/70 focus:border-brand";

  return (
    <Frame outer="mt-6">
      <form onSubmit={save} className="space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="v-title" className="block text-sm font-medium text-ink">
              Job title
            </label>
            <input
              id="v-title"
              name="search-v-title"
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              data-form-type="other"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Type a job title"
              className={field}
            />
          </div>
          <div>
            <label htmlFor="v-company" className="block text-sm font-medium text-ink">
              Company
            </label>
            <input
              id="v-company"
              name="search-v-company"
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              data-form-type="other"
              value={form.company}
              onChange={(e) => set("company", e.target.value)}
              placeholder="Type a company"
              className={field}
            />
          </div>
          <div>
            <label htmlFor="v-location" className="block text-sm font-medium text-ink">
              Location
            </label>
            <input
              id="v-location"
              name="search-v-location"
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              data-form-type="other"
              value={form.location}
              onChange={(e) => set("location", e.target.value)}
              placeholder="Type a city or country"
              className={field}
            />
          </div>
          <div>
            <label htmlFor="v-url" className="block text-sm font-medium text-ink">
              Link
            </label>
            <input
              id="v-url"
              name="search-v-url"
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              data-form-type="other"
              value={form.url}
              onChange={(e) => set("url", e.target.value)}
              placeholder="Paste the link"
              className={field}
            />
          </div>
        </div>

        <div>
          <label htmlFor="v-description" className="block text-sm font-medium text-ink">
            The posting
          </label>
          <p className="mt-0.5 text-xs text-ink-faint">
            Paste the whole advert. It is what the scorer will read once scoring
            reaches this page.
          </p>
          <textarea
            id="v-description"
            rows={6}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            className={`${field} leading-relaxed`}
          />
        </div>

        {tracks.length > 1 && (
          <div>
            <label htmlFor="v-track" className="block text-sm font-medium text-ink">
              Which search does it belong to
            </label>
            <select
              id="v-track"
              value={form.track}
              onChange={(e) => set("track", e.target.value)}
              className={`${field} cursor-pointer`}
            >
              {tracks.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="cursor-pointer rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-soft disabled:opacity-50"
          >
            {busy ? "Saving..." : "Add to my list"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer text-sm text-ink-faint transition-colors duration-150 hover:text-ink"
          >
            Cancel
          </button>
        </div>
      </form>
    </Frame>
  );
}
