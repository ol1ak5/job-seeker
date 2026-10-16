import PublicSearch from "@/components/PublicSearch";
import Link from "next/link";

const AFTER_SIGN_IN = [
  {
    title: "Scored against your CV",
    body: "Every vacancy gets a number out of 100, the points that match, and the gaps - written out, not guessed at.",
  },
  {
    title: "Searched on a schedule",
    body: "Your searches run by themselves each morning across several job boards and company career pages, not just one index.",
  },
  {
    title: "Tracked to the end",
    body: "Applied, interviewing, rejected - and a nudge when a company has been quiet for ten days.",
  },
];

/**
 * What a visitor sees before signing in.
 *
 * The search at the top is real and runs immediately: a portfolio project
 * behind a login screen is a portfolio project nobody looks at.
 */
export default function Landing() {
  return (
    <main className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <h1 className="text-base font-semibold tracking-tight text-ink">Job Seeker</h1>
          <Link
            href="/login"
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-soft transition-colors duration-150 hover:border-brand hover:text-brand"
          >
            Sign in
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-sm font-medium text-brand">Job search, minus the scrolling</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Find the openings, then find out which ones are worth your evening.
        </h2>
        <p className="mt-3 max-w-2xl text-ink-soft">
          Search live vacancies below - no account needed. Signing in adds the part
          that actually saves time: each one read against your CV and scored.
        </p>

        <div className="mt-8">
          <PublicSearch />
        </div>

        <section className="mt-14 border-t border-line pt-10">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-faint">
            What signing in adds
          </h3>
          <dl className="mt-5 grid gap-6 sm:grid-cols-3">
            {AFTER_SIGN_IN.map((item) => (
              <div key={item.title}>
                <dt className="text-sm font-medium text-ink">{item.title}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-ink-soft">
                  {item.body}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <footer className="mt-14 border-t border-line pt-6 text-xs text-ink-faint">
          Built with Python and Gemini. Vacancy data from Adzuna and public
          company career pages.
        </footer>
      </div>
    </main>
  );
}
