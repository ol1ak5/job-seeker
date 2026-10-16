"use client";

import type { DemoVacancy } from "@/app/api/search/route";
import { COUNTRIES } from "@/lib/tracks";
import { useState } from "react";

function shortDate(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

/**
 * The shop window: a search anybody can run without an account.
 *
 * No score, no CV, nothing saved. What it demonstrates is that the vacancies
 * are real and current - the reason to sign in is everything this list is
 * missing.
 */
export default function PublicSearch() {
  const [what, setWhat] = useState("");
  const [where, setWhere] = useState("");
  const [country, setCountry] = useState("es");
  const [vacancies, setVacancies] = useState<DemoVacancy[] | null>(null);
  const [broadened, setBroadened] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    if (!what.trim()) return;
    setBusy(true);
    setError(null);

    const query = new URLSearchParams({ what, where, country });
    try {
      const response = await fetch(`/api/search?${query}`);
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "Something went wrong.");
        setVacancies(null);
      } else {
        setVacancies(body.vacancies);
        setBroadened(Boolean(body.broadened));
      }
    } catch {
      setError("Could not reach the server.");
    }
    setBusy(false);
  }

  return (
    <div>
      {/* Not a login or contact form, but browsers guess otherwise and put their
          autofill icons in the fields. Safari ignores autocomplete="off" and goes
          by words like "city" and "job title", so the placeholders avoid them and
          the field names say "search", which it never fills. */}
      <form onSubmit={search} autoComplete="off" className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <div>
          <label htmlFor="search-what" className="block text-sm font-medium text-ink">
            What
          </label>
          <input
            id="search-what"
            name="search-what"
            value={what}
            onChange={(e) => setWhat(e.target.value)}
            placeholder="Type a role"
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            data-bwignore
            data-form-type="other"
            className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand"
          />
        </div>

        <div>
          <label htmlFor="search-where" className="block text-sm font-medium text-ink">
            Where
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="search-where"
              name="search-where"
              value={where}
              onChange={(e) => setWhere(e.target.value)}
              placeholder="Type a place"
              autoComplete="off"
              data-1p-ignore
              data-lpignore="true"
              data-bwignore
              data-form-type="other"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand"
            />
            {/* Each job API searches one national market at a time, so the
                country is picked here and the city above is free text. */}
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              aria-label="Country"
              className="max-w-[45%] cursor-pointer rounded-lg border border-line bg-surface px-2 py-2 text-sm text-ink-soft outline-none focus:border-brand"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="cursor-pointer self-end rounded-full bg-brand px-5 py-2 text-sm font-medium text-white transition-opacity duration-150 hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Searching..." : "Search"}
        </button>
      </form>

      {error && (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      {vacancies && vacancies.length === 0 && (
        <p className="mt-6 rounded-lg border border-dashed border-line p-8 text-center text-sm text-ink-faint">
          Nothing found. Try fewer words, or a different city.
        </p>
      )}

      {vacancies && vacancies.length > 0 && (
        <>
          {broadened && (
            <p className="mt-6 rounded-lg border border-line bg-line-soft px-4 py-2.5 text-sm text-ink-soft">
              Nothing matched all of those words, so this is a wider search on any
              one of them.
            </p>
          )}
          <ul className="mt-6 divide-y divide-line-soft rounded-lg border border-line bg-surface">
            {vacancies.map((v) => (
              <li key={v.id} className="p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <a
                    href={v.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-ink transition-colors duration-150 hover:text-brand"
                  >
                    {v.title}
                  </a>
                  <span className="font-mono text-xs text-ink-faint">
                    {shortDate(v.posted)}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-ink-soft">
                  {v.company}
                  {v.location && <span className="text-ink-faint"> · {v.location}</span>}
                  {v.salary && (
                    <span className="ml-2 font-mono text-xs text-ink-faint">
                      {v.salary}
                    </span>
                  )}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-faint">
                  {v.snippet}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-6 rounded-lg border border-brand/20 bg-brand/5 p-5 text-center">
            <p className="text-sm text-ink">
              This list is not sorted by anything. Sign in and it gets scored
              against your CV, with the gaps spelled out.
            </p>
            <a
              href="/login"
              className="mt-3 inline-block rounded-full bg-brand px-4 py-2 text-sm font-medium text-white transition-opacity duration-150 hover:opacity-90"
            >
              Sign in
            </a>
          </div>
        </>
      )}
    </div>
  );
}
