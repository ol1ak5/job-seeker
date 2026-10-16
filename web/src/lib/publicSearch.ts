import { COUNTRIES } from "./tracks";

/**
 * The public search covers every country, through two sources.
 *
 * Adzuna is the better source where it exists - fresh listings, salaries, and
 * a generous free allowance - but it indexes only the markets in COUNTRIES.
 * Everywhere else the search goes to JSearch, which reads Google for Jobs and
 * so reaches almost any country, at the cost of a much smaller free quota.
 */

export type DemoVacancy = {
  id: string;
  title: string;
  company: string;
  location: string;
  posted: string | null;
  salary: string | null;
  url: string;
  snippet: string;
};

export type Source = "adzuna" | "jsearch";

// ISO 3166-1 codes of places people look for work in. Uninhabited territories
// (Antarctica, Bouvet Island and the like) are left out.
const CODES = `ad ae af ag ai al am ao ar as at au aw ax az ba bb bd be bf bg bh bi bj
bl bm bn bo bq br bs bt bw by bz ca cd cf cg ch ci ck cl cm cn co cr cu cv cw cy
cz de dj dk dm do dz ec ee eg eh er es et fi fj fk fm fo fr ga gb gd ge gf gg gh
gi gl gm gn gp gq gr gt gu gw gy hk hn hr ht hu id ie il im in iq ir is it je jm
jo jp ke kg kh ki km kn kp kr kw ky kz la lb lc li lk lr ls lt lu lv ly ma mc md
me mf mg mh mk ml mm mn mo mp mq mr ms mt mu mv mw mx my mz na nc ne ng ni nl no
np nr nu nz om pa pe pf pg ph pk pl pm pr ps pt pw py qa re ro rs ru rw sa sb sc
sd se sg sh si sj sk sl sm sn so sr ss st sv sx sy sz tc td tg th tj tk tl tm tn
to tr tt tv tw tz ua ug us uy uz va vc ve vg vi vn vu wf ws ye yt za zm zw`
  .split(/\s+/)
  .filter(Boolean);

const ADZUNA = new Set<string>(COUNTRIES.map((c) => c.code));
const ALL = new Set<string>(CODES);

export function isSearchCountry(code: string): boolean {
  return ALL.has(code);
}

export function sourceFor(code: string): Source {
  return ADZUNA.has(code) ? "adzuna" : "jsearch";
}

/** "Málaga " and "malaga" are the same place. */
function normal(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Names people type that the English and Spanish official names do not cover.
const COUNTRY_ALIASES: Record<string, string> = {
  uk: "gb", england: "gb", scotland: "gb", wales: "gb", "great britain": "gb",
  "reino unido": "gb", inglaterra: "gb",
  usa: "us", us: "us", america: "us", eeuu: "us", "ee uu": "us",
  holland: "nl", "the netherlands": "nl", holanda: "nl",
  "czech republic": "cz", turkey: "tr", turquia: "tr", korea: "kr",
  "south korea": "kr", uae: "ae", emirates: "ae", russia: "ru",
};

// The largest job markets' cities, so that "London" alone finds the right
// country. A city not listed here is searched in Spain, the site's home market.
const CITY_COUNTRY: Record<string, string> = {
  london: "gb", londres: "gb", manchester: "gb", birmingham: "gb", edinburgh: "gb",
  glasgow: "gb", bristol: "gb", leeds: "gb", cambridge: "gb", oxford: "gb",
  "new york": "us", "nueva york": "us", "san francisco": "us", boston: "us",
  chicago: "us", "los angeles": "us", seattle: "us", austin: "us", houston: "us",
  washington: "us", miami: "us", denver: "us",
  berlin: "de", munich: "de", munchen: "de", hamburg: "de", frankfurt: "de",
  cologne: "de", koln: "de", stuttgart: "de", dusseldorf: "de",
  paris: "fr", lyon: "fr", marseille: "fr", toulouse: "fr", lille: "fr", nice: "fr",
  amsterdam: "nl", rotterdam: "nl", "the hague": "nl", utrecht: "nl", eindhoven: "nl",
  milan: "it", milano: "it", rome: "it", roma: "it", turin: "it", torino: "it",
  warsaw: "pl", varsovia: "pl", krakow: "pl", wroclaw: "pl",
  vienna: "at", viena: "at", wien: "at",
  brussels: "be", bruselas: "be", antwerp: "be",
  zurich: "ch", geneva: "ch", ginebra: "ch", basel: "ch",
  toronto: "ca", vancouver: "ca", montreal: "ca", calgary: "ca",
  sydney: "au", melbourne: "au", brisbane: "au", perth: "au",
  bangalore: "in", bengaluru: "in", mumbai: "in", delhi: "in", hyderabad: "in",
  singapore: "sg", singapur: "sg",
  "sao paulo": "br", "rio de janeiro": "br",
  "mexico city": "mx", "ciudad de mexico": "mx", cdmx: "mx", guadalajara: "mx",
  auckland: "nz", wellington: "nz",
  johannesburg: "za", "cape town": "za",
  lisbon: "pt", lisboa: "pt", porto: "pt", oporto: "pt",
  dublin: "ie", stockholm: "se", estocolmo: "se", copenhagen: "dk",
  oslo: "no", helsinki: "fi", prague: "cz", praga: "cz", athens: "gr",
  dubai: "ae", "buenos aires": "ar", santiago: "cl", bogota: "co", lima: "pe",
  tokyo: "jp",
};

let countryNames: Map<string, string> | null = null;

/** Every country's English and Spanish name, plus the aliases above. */
function countryByName(): Map<string, string> {
  if (countryNames) return countryNames;
  const map = new Map<string, string>();
  for (const locale of ["en", "es"]) {
    const names = new Intl.DisplayNames([locale], { type: "region" });
    for (const code of CODES) {
      const name = names.of(code.toUpperCase());
      if (name) map.set(normal(name), code);
    }
  }
  for (const [alias, code] of Object.entries(COUNTRY_ALIASES)) map.set(alias, code);
  countryNames = map;
  return map;
}

/**
 * One free-text box for the place: "Madrid", "Portugal" and "Lisbon,
 * Portugal" all work.
 *
 * A part that names a country sets the country, and whatever is left is the
 * city. With no country named, a well-known city sets it; anything else is
 * taken as a place in Spain.
 */
export function parsePlace(text: string): { country: string; where: string } {
  const parts = text.split(",").map((p) => p.trim()).filter(Boolean);
  const names = countryByName();

  const whole = names.get(normal(text));
  if (whole) return { country: whole, where: "" };

  for (let i = parts.length - 1; i >= 0; i--) {
    const code = names.get(normal(parts[i]));
    if (code) {
      return { country: code, where: parts.filter((_, j) => j !== i).join(", ") };
    }
  }

  const city = CITY_COUNTRY[normal(parts[0] ?? "")];
  return { country: city ?? "es", where: parts.join(", ") };
}

function plain(html: unknown): string {
  return String(html ?? "").replace(/<\/?[^>]+>/g, "");
}

function range(lo: unknown, hi: unknown): string | null {
  const low = typeof lo === "number" ? lo : null;
  const high = typeof hi === "number" ? hi : null;
  if (low == null && high == null) return null;
  const a = Math.round(low ?? high ?? 0);
  const b = Math.round(high ?? low ?? 0);
  return a === b ? `${a}` : `${a}-${b}`;
}

export function fromAdzuna(item: Record<string, unknown>, index: number): DemoVacancy {
  return {
    id: String(item.id ?? index),
    title: plain(item.title),
    company: String((item.company as { display_name?: string })?.display_name || "Unknown"),
    location: String((item.location as { display_name?: string })?.display_name || ""),
    posted: item.created ? String(item.created).slice(0, 10) : null,
    salary: range(item.salary_min, item.salary_max),
    url: String(item.redirect_url ?? ""),
    // Adzuna returns HTML fragments; the list shows plain text only.
    snippet: plain(item.description).slice(0, 240),
  };
}

export function fromJsearch(job: Record<string, unknown>, index: number): DemoVacancy {
  const location = [job.job_city, job.job_state, job.job_country]
    .filter((part) => typeof part === "string" && part)
    .join(", ");
  return {
    id: String(job.job_id ?? index),
    title: plain(job.job_title),
    company: String(job.employer_name || "Unknown"),
    location,
    posted: job.job_posted_at_datetime_utc
      ? String(job.job_posted_at_datetime_utc).slice(0, 10)
      : null,
    salary: range(job.job_min_salary, job.job_max_salary),
    url: String(job.job_apply_link ?? ""),
    snippet: plain(job.job_description).replace(/\s+/g, " ").slice(0, 240),
  };
}

/**
 * JSearch has no separate location field: the place goes into the query, the
 * way somebody would type it into Google.
 */
export function jsearchQuery(what: string, where: string): string {
  return where ? `${what} in ${where}` : what;
}

/** The two shapes JSearch has answered with: `data: [...]` and `data: { jobs }`. */
export function jsearchJobs(payload: unknown): Record<string, unknown>[] {
  const data = (payload as { data?: unknown })?.data;
  if (Array.isArray(data)) return data;
  const jobs = (data as { jobs?: unknown })?.jobs;
  return Array.isArray(jobs) ? jobs : [];
}
