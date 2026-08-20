"use client";

import TagInput from "@/components/TagInput";
import { createClient } from "@/lib/supabase/client";
import {
  COUNTRIES,
  emptyTrack,
  slugify,
  withDefaults,
  type TrackData,
  type TrackRow,
} from "@/lib/tracks";
import { useState } from "react";

type Draft = { id: string | null; label: string; data: TrackData };

function blankDraft(): Draft {
  return { id: null, label: "", data: emptyTrack() };
}

function draftOf(row: TrackRow): Draft {
  return { id: row.id, label: row.label || row.name, data: withDefaults(row.data) };
}

/**
 * The screen where a search is defined.
 *
 * Everything the Python search graph consults - which phrases to send to the
 * job boards, which titles count, which city, what disqualifies a posting -
 * is edited here and saved to the `tracks` table. Row Level Security means the
 * browser can write straight to the database: it can only ever touch rows
 * belonging to the signed-in user.
 */
export default function TrackForm({
  initialTracks,
  userId,
}: {
  initialTracks: TrackRow[];
  userId: string;
}) {
  const [tracks, setTracks] = useState(initialTracks);
  const [draft, setDraft] = useState<Draft>(() =>
    initialTracks.length ? draftOf(initialTracks[0]) : blankDraft(),
  );
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filters = draft.data.filters;
  const name = slugify(draft.label);

  function setData(patch: Partial<TrackData>) {
    setDraft((d) => ({ ...d, data: { ...d.data, ...patch } }));
    setStatus(null);
  }

  function setFilters(patch: Partial<TrackData["filters"]>) {
    setDraft((d) => ({
      ...d,
      data: { ...d.data, filters: { ...d.data.filters, ...patch } },
    }));
    setStatus(null);
  }

  async function save() {
    if (!name) {
      setStatus("Give the search a name first.");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const row = { user_id: userId, name, label: draft.label, data: draft.data };

    const { data, error } = draft.id
      ? await supabase.from("tracks").update(row).eq("id", draft.id).select().single()
      : await supabase.from("tracks").insert(row).select().single();

    setSaving(false);
    if (error) {
      setStatus(
        error.code === "23505"
          ? `You already have a search called "${name}". Pick another name.`
          : `Could not save: ${error.message}`,
      );
      return;
    }

    const saved = data as TrackRow;
    setTracks((prev) => {
      const rest = prev.filter((t) => t.id !== saved.id);
      return [...rest, saved].sort((a, b) => a.name.localeCompare(b.name));
    });
    setDraft(draftOf(saved));
    setStatus("Saved.");
  }

  async function remove() {
    if (!draft.id) return;
    if (!confirm(`Delete the "${draft.label}" search? Vacancies already found stay.`)) {
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.from("tracks").delete().eq("id", draft.id);
    if (error) {
      setStatus(`Could not delete: ${error.message}`);
      return;
    }
    const rest = tracks.filter((t) => t.id !== draft.id);
    setTracks(rest);
    setDraft(rest.length ? draftOf(rest[0]) : blankDraft());
    setStatus("Deleted.");
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[13rem_1fr]">
      {/* ------------------------------------------------- the saved searches */}
      <nav aria-label="Saved searches" className="flex flex-col gap-1">
        {tracks.map((track) => (
          <button
            key={track.id}
            onClick={() => {
              setDraft(draftOf(track));
              setStatus(null);
            }}
            className={`cursor-pointer rounded-lg px-3 py-2 text-left text-sm transition-colors duration-150 ${
              draft.id === track.id
                ? "bg-brand/10 font-medium text-brand"
                : "text-ink-soft hover:bg-line-soft"
            }`}
          >
            {track.label || track.name}
            <span className="block font-mono text-xs text-ink-faint">{track.name}</span>
          </button>
        ))}
        <button
          onClick={() => {
            setDraft(blankDraft());
            setStatus(null);
          }}
          className="mt-1 cursor-pointer rounded-lg border border-dashed border-line px-3 py-2 text-left text-sm text-ink-faint transition-colors duration-150 hover:border-brand hover:text-brand"
        >
          + New search
        </button>
      </nav>

      {/* ------------------------------------------------------------ the form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
        className="space-y-6"
      >
        <section className="space-y-4 rounded-lg border border-line bg-surface p-5">
          <div>
            <label htmlFor="label" className="block text-sm font-medium text-ink">
              What are you looking for?
            </label>
            <input
              id="label"
              value={draft.label}
              onChange={(e) => {
                setDraft((d) => ({ ...d, label: e.target.value }));
                setStatus(null);
              }}
              placeholder="Energy consulting"
              className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand"
            />
            {name && (
              <p className="mt-1 font-mono text-xs text-ink-faint">
                jobseeker search-and-score --track {name}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="country" className="block text-sm font-medium text-ink">
                Country
              </label>
              <p className="mt-0.5 text-xs text-ink-faint">
                Which national job index to search.
              </p>
              <select
                id="country"
                value={draft.data.adzuna_country}
                onChange={(e) => setData({ adzuna_country: e.target.value })}
                className="mt-1.5 w-full cursor-pointer rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <TagInput
              id="locations"
              label="Cities"
              hint="A posting elsewhere is dropped. Leave empty to accept any city."
              values={filters.locations}
              placeholder="madrid"
              onChange={(locations) => setFilters({ locations })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <TagInput
              id="authorised_in"
              label="Where you may already work"
              hint="A remote role pinned to somewhere else is not really open to you. Leave empty to skip the check."
              values={filters.authorised_in}
              placeholder="spain"
              onChange={(authorised_in) => setFilters({ authorised_in })}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={filters.allow_remote}
              onChange={(e) => setFilters({ allow_remote: e.target.checked })}
              className="h-4 w-4 cursor-pointer accent-brand"
            />
            Also keep remote roles, wherever they are based
          </label>
        </section>

        <section className="space-y-4 rounded-lg border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold text-ink">What counts as a match</h2>

          <TagInput
            id="queries"
            label="Search phrases"
            hint="What you would type into a job board. Each phrase is searched separately."
            values={draft.data.queries}
            placeholder="energy market analyst"
            onChange={(queries) => setData({ queries })}
          />

          <TagInput
            id="title_include"
            label="Words that must appear in the job title"
            hint="Usually the level: analyst, associate, consultant. Empty means any title."
            values={filters.title_include}
            placeholder="analyst"
            onChange={(title_include) => setFilters({ title_include })}
          />

          <TagInput
            id="domain_include"
            label="Words that must appear somewhere in the posting"
            hint="The subject. Without this, any analyst role in the right city passes."
            values={filters.domain_include}
            placeholder="energy"
            onChange={(domain_include) => setFilters({ domain_include })}
          />
        </section>

        <section className="space-y-4 rounded-lg border border-line bg-surface p-5">
          <h2 className="text-sm font-semibold text-ink">What to throw away</h2>

          <TagInput
            id="title_exclude"
            label="Too senior (or too junior)"
            hint="Matched against the title only."
            values={filters.title_exclude}
            placeholder="director"
            onChange={(title_exclude) => setFilters({ title_exclude })}
          />

          <TagInput
            id="function_exclude"
            label="Wrong kind of job"
            hint="Departments you never want to see: sales, recruitment, marketing."
            values={filters.function_exclude}
            placeholder="sales"
            onChange={(function_exclude) => setFilters({ function_exclude })}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="years" className="block text-sm font-medium text-ink">
                Maximum years of experience asked for
              </label>
              <p className="mt-0.5 text-xs text-ink-faint">
                Empty means no limit. Postings that state nothing are kept.
              </p>
              <input
                id="years"
                type="number"
                min={0}
                max={40}
                value={filters.max_years_experience ?? ""}
                onChange={(e) =>
                  setFilters({
                    max_years_experience: e.target.value ? Number(e.target.value) : null,
                  })
                }
                className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-sm text-ink outline-none focus:border-brand"
              />
            </div>

            <div>
              <label htmlFor="perCompany" className="block text-sm font-medium text-ink">
                Most results from one company
              </label>
              <p className="mt-0.5 text-xs text-ink-faint">
                Stops a single large employer filling the list.
              </p>
              <input
                id="perCompany"
                type="number"
                min={1}
                max={50}
                value={filters.max_per_company}
                onChange={(e) =>
                  setFilters({ max_per_company: Number(e.target.value) || 1 })
                }
                className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-sm text-ink outline-none focus:border-brand"
              />
            </div>
          </div>
        </section>

        <section className="space-y-2 rounded-lg border border-line bg-surface p-5">
          <label htmlFor="guidance" className="block text-sm font-medium text-ink">
            Notes for the scorer
          </label>
          <p className="text-xs text-ink-faint">
            Written to the model in plain words before it scores each vacancy: the
            level you want, firms you admire, and anything that should score badly.
          </p>
          <textarea
            id="guidance"
            rows={6}
            value={draft.data.scoring_guidance}
            onChange={(e) => setData({ scoring_guidance: e.target.value })}
            placeholder={
              "Target: energy consulting and market analysis at associate level.\n" +
              "Not the target: deal execution - score those down heavily.\n" +
              "My edge: Spanish power market regulation, valuation modelling."
            }
            className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm leading-relaxed text-ink outline-none focus:border-brand"
          />
        </section>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="cursor-pointer rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving..." : draft.id ? "Save changes" : "Create search"}
          </button>
          {draft.id && (
            <button
              type="button"
              onClick={remove}
              className="cursor-pointer rounded-lg border border-line px-4 py-2 text-sm text-ink-soft transition-colors duration-150 hover:border-red-300 hover:text-red-700"
            >
              Delete
            </button>
          )}
          {status && (
            <p
              role="status"
              className={`text-sm ${
                status === "Saved." || status === "Deleted."
                  ? "text-ink-soft"
                  : "text-red-700"
              }`}
            >
              {status}
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
