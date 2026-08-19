import SignOutButton from "@/components/SignOutButton";
import VacancyTable, { type Vacancy } from "@/components/VacancyTable";
import { createClient } from "@/lib/supabase/server";
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

  if (!user) {
    redirect("/login");
  }

  const { data: vacancies, error } = await supabase
    .from("vacancies")
    .select("*, applications(status, applied_at)")
    .order("score", { ascending: false, nullsFirst: false });

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Job Seeker</h1>
            <p className="text-sm text-slate-500">{user.email}</p>
          </div>
          <SignOutButton />
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        {error && (
          <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
            Could not load vacancies: {error.message}
          </p>
        )}

        {!error && (!vacancies || vacancies.length === 0) && (
          <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
            No vacancies yet. Run{" "}
            <code className="font-mono">jobseeker search-and-score</code> to fill this in.
          </p>
        )}

        {vacancies && vacancies.length > 0 && (
          <VacancyTable vacancies={vacancies as Vacancy[]} userId={user.id} />
        )}
      </div>
    </main>
  );
}
