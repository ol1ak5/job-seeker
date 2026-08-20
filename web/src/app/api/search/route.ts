import { COUNTRIES } from "@/lib/tracks";
import type { NextRequest } from "next/server";

/**
 * The public demo search: keywords in, vacancies out, no account needed.
 *
 * This is deliberately not the real pipeline. There is no scoring, no filtering
 * beyond what the job board itself does, and nothing is written to the
 * database. It exists so that somebody opening the site sees it work before
 * being asked to sign in.
 *
 * It runs on the server, not in the browser, because the Adzuna credentials
 * must never reach the client. Note the missing NEXT_PUBLIC_ prefix: that is
 * the whole difference between a secret and a published string.
 */

const BASE = "https://api.adzuna.com/v1/api/jobs";
const RESULTS = 12;
const MAX_AGE_DAYS = 30;

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

/**
 * Identical searches are answered from Vercel's cache rather than from Adzuna.
 *
 * The free API allowance is a few hundred calls a day for the whole site, and
 * repeated searches - a reload, two people trying the example query - would eat
 * it for no new information.
 */
const CACHE_SECONDS = 60 * 60 * 6;

function salaryOf(item: Record<string, unknown>): string | null {
  const lo = item.salary_min as number | undefined;
  const hi = item.salary_max as number | undefined;
  if (lo == null && hi == null) return null;
  const low = Math.round(lo ?? hi ?? 0);
  const high = Math.round(hi ?? lo ?? 0);
  return low === high ? `${low}` : `${low}-${high}`;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const what = (params.get("what") ?? "").trim().slice(0, 100);
  const where = (params.get("where") ?? "").trim().slice(0, 60);
  const country = (params.get("country") ?? "es").toLowerCase();

  if (!what) {
    return Response.json({ error: "Type what you are looking for." }, { status: 400 });
  }
  if (!COUNTRIES.some((c) => c.code === country)) {
    return Response.json({ error: "Unsupported country." }, { status: 400 });
  }

  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) {
    return Response.json(
      { error: "Search is not configured on this deployment." },
      { status: 503 },
    );
  }

  /**
   * Adzuna's `what` requires every word to appear, so "energy market analyst"
   * finds nothing while "energy analyst" finds plenty. Rather than making the
   * visitor guess that, a fruitless search is retried with `what_or`, which
   * matches any of the words, and the answer says it was broadened.
   */
  async function ask(mode: "what" | "what_or") {
    const url = new URL(`${BASE}/${country}/search/1`);
    url.search = new URLSearchParams({
      app_id: appId!,
      app_key: appKey!,
      [mode]: what,
      where,
      max_days_old: String(MAX_AGE_DAYS),
      results_per_page: String(RESULTS),
      "content-type": "application/json",
    }).toString();

    const response = await fetch(url, { next: { revalidate: CACHE_SECONDS } });
    if (!response.ok) throw new Error(String(response.status));
    return (await response.json()) as { results?: Record<string, unknown>[] };
  }

  let payload: { results?: Record<string, unknown>[] };
  let broadened = false;
  try {
    payload = await ask("what");
    if (!payload.results?.length && what.trim().includes(" ")) {
      payload = await ask("what_or");
      broadened = Boolean(payload.results?.length);
    }
  } catch (exc) {
    const status = exc instanceof Error ? exc.message : "";
    return Response.json(
      {
        error: /^\d+$/.test(status)
          ? `The job board answered ${status}. Try again shortly.`
          : "Could not reach the job board.",
      },
      { status: 502 },
    );
  }

  const vacancies: DemoVacancy[] = (payload.results ?? []).map((item, index) => ({
    id: String(item.id ?? index),
    title: String(item.title ?? "").replace(/<\/?[^>]+>/g, ""),
    company: String((item.company as { display_name?: string })?.display_name || "Unknown"),
    location: String((item.location as { display_name?: string })?.display_name || ""),
    posted: item.created ? String(item.created).slice(0, 10) : null,
    salary: salaryOf(item),
    url: String(item.redirect_url ?? ""),
    // Adzuna returns HTML fragments; the list shows plain text only.
    snippet: String(item.description ?? "").replace(/<\/?[^>]+>/g, "").slice(0, 240),
  }));

  return Response.json({ vacancies, broadened });
}
