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
