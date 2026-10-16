import {
  type DemoVacancy,
  fromAdzuna,
  fromJsearch,
  isSearchCountry,
  jsearchJobs,
  jsearchQuery,
  sourceFor,
} from "@/lib/publicSearch";
import type { NextRequest } from "next/server";

/**
 * The public demo search: keywords in, vacancies out, no account needed.
 *
 * This is deliberately not the real pipeline. There is no scoring, no filtering
 * beyond what the job board itself does, and nothing is written to the
 * database. It exists so that somebody opening the site sees it work before
 * being asked to sign in.
 *
 * It runs on the server, not in the browser, because the API credentials must
 * never reach the client. Note the missing NEXT_PUBLIC_ prefix: that is the
 * whole difference between a secret and a published string.
 */

const ADZUNA = "https://api.adzuna.com/v1/api/jobs";
const JSEARCH = "https://jsearch.p.rapidapi.com/search-v2";
const JSEARCH_HOST = "jsearch.p.rapidapi.com";
const RESULTS = 12;
const MAX_AGE_DAYS = 30;

/**
 * Identical searches are answered from Vercel's cache rather than from the job
 * board.
 *
 * The free API allowances are small for the whole site - JSearch's especially -
 * and repeated searches (a reload, two people trying the same query) would eat
 * them for no new information.
 */
const CACHE_SECONDS = 60 * 60 * 6;

/**
 * An environment variable that was pasted in by hand.
 *
 * A .env file lets a value be quoted, and every dotenv loader strips those
 * quotes on the way out - so `KEY='abc'` works locally. A hosting dashboard
 * does no such thing: it stores whatever was pasted, quotes included, and the
 * API then rejects the credential with a bare 401 that says nothing about why.
 */
function credential(name: string): string {
  return (process.env[name] ?? "").trim().replace(/^['"]|['"]$/g, "");
}

class NotConfigured extends Error {}

type Found = { vacancies: DemoVacancy[]; broadened: boolean };

async function searchAdzuna(what: string, where: string, country: string): Promise<Found> {
  const appId = credential("ADZUNA_APP_ID");
  const appKey = credential("ADZUNA_APP_KEY");
  if (!appId || !appKey) throw new NotConfigured();

  /**
   * Adzuna's `what` requires every word to appear, so "energy market analyst"
   * finds nothing while "energy analyst" finds plenty. Rather than making the
   * visitor guess that, a fruitless search is retried with `what_or`, which
   * matches any of the words, and the answer says it was broadened.
   */
  async function ask(mode: "what" | "what_or") {
    const url = new URL(`${ADZUNA}/${country}/search/1`);
    url.search = new URLSearchParams({
      app_id: appId,
      app_key: appKey,
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

  let payload = await ask("what");
  let broadened = false;
  if (!payload.results?.length && what.includes(" ")) {
    payload = await ask("what_or");
    broadened = Boolean(payload.results?.length);
  }
  return { vacancies: (payload.results ?? []).map(fromAdzuna), broadened };
}

async function searchJsearch(what: string, where: string, country: string): Promise<Found> {
  const key = credential("RAPIDAPI_KEY");
  if (!key) throw new NotConfigured();

  const url = new URL(JSEARCH);
  url.search = new URLSearchParams({
    query: jsearchQuery(what, where),
    country,
    page: "1",
    num_pages: "1",
    date_posted: "month",
  }).toString();

  const response = await fetch(url, {
    headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": JSEARCH_HOST },
    next: { revalidate: CACHE_SECONDS },
  });
  if (!response.ok) throw new Error(String(response.status));
  const jobs = jsearchJobs(await response.json()).slice(0, RESULTS);
  return { vacancies: jobs.map(fromJsearch), broadened: false };
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const what = (params.get("what") ?? "").trim().slice(0, 100);
  const where = (params.get("where") ?? "").trim().slice(0, 60);
  const country = (params.get("country") ?? "es").toLowerCase();

  if (!what) {
    return Response.json({ error: "Type what you are looking for." }, { status: 400 });
  }
  if (!isSearchCountry(country)) {
    return Response.json({ error: "Unsupported country." }, { status: 400 });
  }

  const search = sourceFor(country) === "adzuna" ? searchAdzuna : searchJsearch;
  try {
    return Response.json(await search(what, where, country));
  } catch (exc) {
    if (exc instanceof NotConfigured) {
      return Response.json(
        { error: "Search for this country is not configured on this deployment." },
        { status: 503 },
      );
    }
    const status = exc instanceof Error ? exc.message : "";
    // 401 and 403 are never the visitor's fault: the deployment's key is wrong.
    // 429 is the free monthly quota running out.
    const error =
      status === "401" || status === "403"
        ? "Search is misconfigured on this deployment - the job board rejected its credentials."
        : status === "429"
          ? "The job board's free allowance is used up for now. Try another country or come back later."
          : /^\d+$/.test(status)
            ? `The job board answered ${status}. Try again shortly.`
            : "Could not reach the job board.";
    return Response.json({ error }, { status: 502 });
  }
}
