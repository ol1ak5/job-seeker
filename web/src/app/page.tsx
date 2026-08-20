import Landing from "@/components/Landing";
import SignOutButton from "@/components/SignOutButton";
import StatTiles from "@/components/StatTiles";
import VacancyTable, {
  FOLLOW_UP_AFTER_DAYS,
  daysSince,
  type Vacancy,
} from "@/components/VacancyTable";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

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

  const { data, error } = await supabase
    .from("vacancies")
    .select("*, applications(status, applied_at)")
    .order("score", { ascending: false, nullsFirst: false });

  const vacancies = (data ?? []) as Vacancy[];
  const statusOf = (v: Vacancy) => v.applications?.[0]?.status ?? "interested";

  const stats = {
    total: vacancies.length,
    strong: vacancies.filter((v) => (v.score ?? 0) >= 80).length,
    applied: vacancies.filter((v) => statusOf(v) === "applied").length,
    followUps: vacancies.filter((v) => {
      const waiting = daysSince(v.applications?.[0]?.applied_at ?? null);
      return (
        statusOf(v) === "applied" &&
        waiting !== null &&
        waiting >= FOLLOW_UP_AFTER_DAYS
      );
    }).length,
  };

  return (
    <main className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-baseline gap-3">
            <h1 className="text-base font-semibold tracking-tight text-ink">
              Job Seeker
            </h1>
            <p className="hidden text-xs text-ink-faint sm:block">{user.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/settings"
              className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-soft transition-colors duration-150 hover:border-brand hover:text-brand"
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

        {!error && vacancies.length === 0 && (
          <div className="rounded-lg border border-dashed border-line bg-surface p-10 text-center">
            <p className="text-sm text-ink-soft">No vacancies yet.</p>
            <p className="mt-2 text-sm text-ink-faint">
              Describe what you are looking for, then run a search.
            </p>
            <Link
              href="/settings"
              className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-opacity duration-150 hover:opacity-90"
            >
              Set up a search
            </Link>
          </div>
        )}

        {vacancies.length > 0 && (
          <>
            <StatTiles {...stats} />
            <VacancyTable vacancies={vacancies} userId={user.id} />
          </>
        )}
      </div>
    </main>
  );
}
