/**
 * The shape of one saved search.
 *
 * This mirrors `TrackConfig` in src/config.py field for field: the web form
 * writes the `data` column, the Python search graph reads it back through the
 * same names. Change one side and you must change the other.
 */

export type TrackFilters = {
  title_include: string[];
  domain_include: string[];
  title_exclude: string[];
  function_exclude: string[];
  max_years_experience: number | null;
  locations: string[];
  allow_remote: boolean;
  remote_terms: string[];
  max_per_company: number;
};

export type TrackData = {
  adzuna_country: string;
  queries: string[];
  scoring_guidance: string;
  filters: TrackFilters;
};

export type TrackRow = {
  id: string;
  name: string;
  label: string;
  data: TrackData;
  enabled: boolean;
};

/** Countries Adzuna indexes. Anything else returns nothing, so it is a list. */
export const COUNTRIES = [
  { code: "es", name: "Spain" },
  { code: "gb", name: "United Kingdom" },
  { code: "us", name: "United States" },
  { code: "de", name: "Germany" },
  { code: "fr", name: "France" },
  { code: "nl", name: "Netherlands" },
  { code: "it", name: "Italy" },
  { code: "pl", name: "Poland" },
  { code: "at", name: "Austria" },
  { code: "be", name: "Belgium" },
  { code: "ch", name: "Switzerland" },
  { code: "ca", name: "Canada" },
  { code: "au", name: "Australia" },
  { code: "in", name: "India" },
  { code: "sg", name: "Singapore" },
  { code: "br", name: "Brazil" },
  { code: "mx", name: "Mexico" },
] as const;

/** Words that mean "remote" across the languages the sources publish in. */
const REMOTE_TERMS = ["remote", "fully remote", "teletrabajo", "remoto", "work from home"];

/** Titles nobody at analyst or associate level should be shown. */
const SENIOR_TITLES = [
  "director", "head of", "vp", "vice president", "chief", "partner", "principal",
];

export function emptyTrack(): TrackData {
  return {
    adzuna_country: "es",
    queries: [],
    scoring_guidance: "",
    filters: {
      title_include: [],
      domain_include: [],
      title_exclude: [...SENIOR_TITLES],
      function_exclude: [],
      max_years_experience: null,
      locations: [],
      allow_remote: true,
      remote_terms: [...REMOTE_TERMS],
      max_per_company: 5,
    },
  };
}

/**
 * A row saved before a field existed still has to open in the form, so every
 * value falls back to the blank default rather than to `undefined`.
 */
export function withDefaults(data: Partial<TrackData> | null): TrackData {
  const blank = emptyTrack();
  return {
    ...blank,
    ...data,
    filters: { ...blank.filters, ...(data?.filters ?? {}) },
  };
}

/**
 * "Energy consulting" -> "energy-consulting".
 *
 * The result becomes `vacancies.track` and a CLI argument, and the database
 * rejects anything outside [a-z0-9_-], so the slug is built, never typed.
 */
export function slugify(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")  // strip accents: "energia" keeps its i
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
