import AddVacancy from "@/components/AddVacancy";
import Landing from "@/components/Landing";
import Logo from "@/components/Logo";
import SearchButton, { type Job } from "@/components/SearchButton";
import SignOutButton from "@/components/SignOutButton";
import StatTiles from "@/components/StatTiles";
import TrackTabs from "@/components/TrackTabs";
import VacancyTable from "@/components/VacancyTable";
import { createClient } from "@/lib/supabase/server";
import { isSessionError } from "@/lib/supabase/session";
import { needsFollowUp, statusOf, type Vacancy } from "@/lib/vacancies";
import Link from "next/link";
import { redirect } from "next/navigation";

/**
 * A Server Component: it runs on the server, so it can query the database
 * directly - no API layer in between. Row Level Security still applies, so the
 * query can only ever return rows belonging to the signed-in user.
 *
 * The tracker status lives in a separate table, pulled in through the foreign
 * key `applications.vacancy_id`, so one request returns both.
 */
export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ track?: string }>;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // A visitor with no account is not sent to a login wall: they get the public
  // search, which is the only way anybody ever sees what this does.
  if (!user) {
    return <Landing />;
  }

  const [{ data, error }, { data: trackRows }, { data: jobRows }] =
    await Promise.all([
      supabase
        .from("vacancies")
        .select("*, applications(status, applied_at), cvs(id)")
        .order("score", { ascending: false, nullsFirst: false }),
      supabase.from("tracks").select("name").order("name"),
      supabase
        .from("jobs")
        .select("id, status, error, result, created_at, finished_at")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

  // A rejected token is not a data problem, and the only cure is a new session.
  // Asking for one beats printing GoTrue's wording on the page.
  if (isSessionError(error)) {
    redirect("/login");
  }

  const all = (data ?? []) as Vacancy[];
  const tracks = (trackRows ?? []).map((t) => t.name as string);
  const latestJob = (jobRows?.[0] as Job) ?? null;

  // Two tracks are two careers. Showing one at a time is what makes the
  // numbers below mean anything: a strong match for energy and a strong match
  // for AI are not four of the same thing.
  const counts: Record<string, number> = {};
  for (const v of all) counts[v.track] = (counts[v.track] ?? 0) + 1;

  const wanted = (await searchParams).track;
  const active =
    wanted && tracks.includes(wanted) ? wanted : (tracks[0] ?? "");
  const vacancies = tracks.length > 1 ? all.filter((v) => v.track === active) : all;

  const stats = {
    total: vacancies.length,
    strong: vacancies.filter((v) => (v.score ?? 0) >= 80).length,
    applied: vacancies.filter((v) => statusOf(v) === "applied").length,
    followUps: vacancies.filter((v) =>
      needsFollowUp(statusOf(v), v.applications?.[0]?.applied_at ?? null),
    ).length,
  };

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-line/70 bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <h1>
              <Logo />
            </h1>
            <p className="hidden text-xs text-ink-faint sm:block">{user.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/cvs"
              className="rounded-full border border-line px-3.5 py-1.5 text-sm text-ink-soft transition-colors duration-150 hover:border-brand hover:text-brand"
            >
              Tailored
            </Link>
            <Link
              href="/profile"
              className="rounded-full border border-line px-3.5 py-1.5 text-sm text-ink-soft transition-colors duration-150 hover:border-brand hover:text-brand"
            >
              My CV
            </Link>
            <Link
              href="/settings"
              className="rounded-full border border-line px-3.5 py-1.5 text-sm text-ink-soft transition-colors duration-150 hover:border-brand hover:text-brand"
            >
              Settings
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            Could not load vacancies: {error.message}
          </p>
        )}

        <TrackTabs tracks={tracks} active={active} counts={counts} />

        {vacancies.length > 0 && <StatTiles {...stats} />}

        {!error && (
          <SearchButton track={active} initialJob={latestJob} />
        )}

        {!error && <AddVacancy userId={user.id} tracks={tracks} active={active} />}

        {!error && vacancies.length === 0 && (
          <div className="rounded-lg border border-dashed border-line bg-surface p-10 text-center">
            <p className="text-sm text-ink-soft">No vacancies yet.</p>
            <p className="mt-2 text-sm text-ink-faint">
              Describe what you are looking for, then run a search.
            </p>
            <Link
              href="/settings"
              className="mt-4 inline-block rounded-full bg-brand px-4 py-2 text-sm font-medium text-white transition-opacity duration-150 hover:opacity-90"
            >
              Set up a search
            </Link>
          </div>
        )}

        {vacancies.length > 0 && (
          <VacancyTable vacancies={vacancies} userId={user.id} />
        )}
      </div>
    </main>
  );
}
