import Dashboard from "@/components/Dashboard";
import Landing from "@/components/Landing";
import type { Job } from "@/components/SearchButton";
import { createClient } from "@/lib/supabase/server";
import { isSessionError } from "@/lib/supabase/session";
import { statusOf, type Vacancy } from "@/lib/vacancies";
import { redirect } from "next/navigation";

/**
 * A Server Component: it runs on the server, so it can query the database
 * directly - no API layer in between. Row Level Security still applies, so the
 * query can only ever return rows belonging to the signed-in user.
 *
 * The tracker status lives in a separate table, pulled in through the foreign
 * key `applications.vacancy_id`, so one request returns both.
 */
export default async function HomePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // A visitor with no account is not sent to a login wall: they get the public
  // search, which is the only way anybody ever sees what this does.
  if (!user) {
    return <Landing />;
  }

  // Two later migrations add fields the table reads: 0005 the Applied text,
  // 0006 the values of your own columns. A database without them fails the
  // whole query (Postgres 42703, "no such column"), so the list is retried
  // with less, and whatever is missing simply stays switched off.
  const loadVacancies = (fields: string[]) =>
    supabase
      .from("vacancies")
      .select(`*, applications(${["status", "applied_at", "notes", ...fields].join(", ")}), cvs(id)`)
      .order("score", { ascending: false, nullsFirst: false });

  const [full, { data: trackRows }, { data: jobRows }, columnsResult] =
    await Promise.all([
      loadVacancies(["applied_text", "extra"]),
      supabase.from("tracks").select("name").order("name"),
      supabase
        .from("jobs")
        .select("id, status, error, result, created_at, finished_at")
        // Only searches: a CV that failed belongs to its own row in the
        // table, not under "Run the search".
        .eq("kind", "search")
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("custom_columns")
        .select("id, name")
        .order("position")
        .order("created_at"),
    ]);

  let result = full;
  let appliedTextReady = true;
  let customColumnsReady = !columnsResult.error;
  if (result.error?.code === "42703") {
    customColumnsReady = false;
    result = await loadVacancies(["applied_text"]);
    if (result.error?.code === "42703") {
      appliedTextReady = false;
      result = await loadVacancies([]);
    }
  }
  const { data, error } = result;
  const customColumns = customColumnsReady
    ? ((columnsResult.data ?? []) as { id: string; name: string }[])
    : [];

  // A rejected token is not a data problem, and the only cure is a new session.
  // Asking for one beats printing GoTrue's wording on the page.
  if (isSessionError(error)) {
    redirect("/login");
  }

  // Every saved search lands in one list: the dashboard is a single sheet of
  // vacancies, and one button runs all the searches that fill it.
  // The select string is built at runtime, so its row type cannot be inferred.
  const vacancies = (data ?? []) as unknown as Vacancy[];
  const tracks = (trackRows ?? []).map((t) => t.name as string);
  const latestJob = (jobRows?.[0] as Job) ?? null;

  const stats = {
    total: vacancies.length,
    strong: vacancies.filter((v) => (v.score ?? 0) >= 80).length,
    applied: vacancies.filter((v) => statusOf(v) === "applied").length,
    // Past the application and still alive: talking to them, or an offer.
    inProcess: vacancies.filter((v) => ["interview", "offer"].includes(statusOf(v)))
      .length,
  };

  return (
    <Dashboard
      userId={user.id}
      tracks={tracks}
      vacancies={vacancies}
      stats={stats}
      latestJob={latestJob}
      error={error?.message ?? null}
      appliedTextReady={appliedTextReady}
      customColumns={customColumns}
      customColumnsReady={customColumnsReady}
    />
  );
}
