import SignOutButton from "@/components/SignOutButton";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/** Colour the score badge by how promising the vacancy is. */
const VERDICT_STYLE: Record<string, string> = {
  strong_match: "bg-emerald-100 text-emerald-800",
  worth_applying: "bg-sky-100 text-sky-800",
  stretch: "bg-amber-100 text-amber-800",
  skip: "bg-slate-100 text-slate-500",
};

type Vacancy = {
  id: string;
  ref: string;
  track: string;
  title: string;
  company: string;
  location: string | null;
  url: string;
  source: string;
  score: number | null;
  verdict: string | null;
  matching_points: string[];
  gaps: string[];
  flags: string[];
};

/**
 * A Server Component: it runs on the server, so it can query the database
 * directly - no API layer in between. Row Level Security still applies, so the
 * query can only ever return rows belonging to the signed-in user.
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
    .select("*")
    .order("score", { ascending: false, nullsFirst: false });

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Job Seeker</h1>
            <p className="text-sm text-slate-500">{user.email}</p>
          </div>
          <SignOutButton />
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8">
        {error && (
          <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
            Could not load vacancies: {error.message}
          </p>
        )}

        {!error && (!vacancies || vacancies.length === 0) && (
          <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">
            No vacancies yet. Run <code className="font-mono">jobseeker search-and-score</code> to fill this in.
          </p>
        )}

        <ul className="space-y-4">
          {(vacancies as Vacancy[] | null)?.map((vacancy) => (
            <li
              key={vacancy.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <a
                    href={vacancy.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-base font-medium text-slate-900 hover:underline"
                  >
                    {vacancy.title}
                  </a>
                  <p className="mt-1 text-sm text-slate-500">
                    {vacancy.company}
                    {vacancy.location ? ` · ${vacancy.location}` : ""} · {vacancy.source}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${
                    VERDICT_STYLE[vacancy.verdict ?? ""] ?? "bg-slate-100 text-slate-500"
                  }`}
                >
                  {vacancy.score ?? "n/a"}
                </span>
              </div>

              {vacancy.matching_points?.length > 0 && (
                <ul className="mt-4 space-y-1 text-sm text-slate-700">
                  {vacancy.matching_points.slice(0, 3).map((point, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-emerald-600">+</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              )}

              {vacancy.gaps?.length > 0 && (
                <ul className="mt-2 space-y-1 text-sm text-slate-500">
                  {vacancy.gaps.slice(0, 2).map((gap, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-amber-600">−</span>
                      <span>{gap}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
