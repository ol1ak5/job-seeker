import Logo from "@/components/Logo";
import PublicSearch from "@/components/PublicSearch";
import Link from "next/link";

const STEPS = [
  {
    title: "Upload your CV",
    body: "A .docx or .pdf is enough. It becomes your profile: experience, skills and the kind of role you want next.",
  },
  {
    title: "Describe the search",
    body: "Job titles, countries, seniority, words that rule a vacancy out. One search per career you are considering.",
  },
  {
    title: "Read only what fits",
    body: "Run the search and get a short list, each vacancy scored against your CV with the matches and gaps written out.",
  },
  {
    title: "Tailor your CV",
    body: "Pick a vacancy and get your CV rewritten in its language. Review every change, then download the PDF.",
  },
];

const FEATURES = [
  {
    title: "Filters before it judges",
    body: "Wrong seniority, wrong country, a sales role with an engineer's title: all dropped before any AI reads them.",
  },
  {
    title: "Scores with reasons",
    body: "A number out of 100, the points that match and the gaps, written out so you can disagree with the verdict.",
  },
  {
    title: "Never invents a fact",
    body: "The tailored CV re-orders and re-words your real experience. You approve every change before it becomes a PDF.",
  },
];

// An illustration of a scored list, not real data. Companies are described,
// never named, so nobody mistakes the example for a real employer.
const EXAMPLE_ROWS = [
  { title: "Energy Market Analyst", company: "Renewable energy company", place: "Madrid, ES", score: 88 },
  { title: "Power Trading Analyst", company: "Energy trading firm", place: "Remote, EU", score: 74 },
  { title: "Grid Data Analyst", company: "Electricity utility", place: "Barcelona, ES", score: 61 },
];

function scoreTone(score: number) {
  if (score >= 80) return "bg-brand text-white";
  if (score >= 60) return "bg-brand/10 text-brand";
  return "bg-line-soft text-ink-soft";
}

function PillLink({
  href,
  children,
  primary = false,
}: {
  href: string;
  children: React.ReactNode;
  primary?: boolean;
}) {
  const look = primary
    ? "bg-brand text-white hover:bg-brand-soft"
    : "border border-line bg-surface text-ink hover:border-brand/40 hover:text-brand";
  return (
    <a
      href={href}
      className={`inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium transition-colors duration-150 ${look}`}
    >
      {children}
    </a>
  );
}

function SectionHeading({ title, lead }: { title: string; lead: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="text-3xl font-semibold tracking-tight text-balance text-ink sm:text-4xl">
        {title}
      </h2>
      <p className="mt-3 text-ink-soft">{lead}</p>
    </div>
  );
}

/**
 * What a visitor sees before signing in.
 *
 * The search in the middle is real and runs immediately: a portfolio project
 * behind a login screen is a portfolio project nobody looks at.
 */
export default function Landing() {
  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-line/70 bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" aria-label="Job Seeker, home">
            <Logo />
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <a
              href="#how"
              className="hidden rounded-full px-3 py-1.5 text-sm text-ink-soft transition-colors duration-150 hover:text-brand sm:block"
            >
              How it works
            </a>
            <Link
              href="/login"
              className="rounded-full bg-brand px-4 py-1.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-soft"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-16 pb-16 text-center sm:px-6 sm:pt-24">
        {/* One sentence per line: the size scales with the window so that from
            tablet width up neither line ever breaks. */}
        <h1 className="text-4xl font-semibold tracking-tight text-balance text-ink sm:text-[clamp(2rem,6.5vw,4.5rem)] sm:whitespace-nowrap">
          <span className="block">Find the roles worth your time.</span>
          <span className="block text-ink-faint">And the words that win them.</span>
        </h1>
        <p className="mx-auto mt-10 max-w-xl text-lg leading-relaxed text-ink-soft">
          Job Seeker searches several job boards at once, keeps only what fits your
          criteria, scores it against your CV and tailors your CV to the ones you
          choose.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <PillLink href="#search" primary>
            Try a search →
          </PillLink>
          <PillLink href="#how">How it works</PillLink>
        </div>
        <p className="mt-4 text-xs text-ink-faint">
          Search first, sign in later
        </p>

        {/* Product frame */}
        <div className="mx-auto mt-14 max-w-4xl rounded-2xl border border-line bg-surface p-2 shadow-[0_24px_60px_-34px_rgba(30,58,95,0.35)]">
          <div className="overflow-hidden rounded-xl border border-line bg-surface text-left">
            <div className="flex items-center gap-1.5 border-b border-line px-4 py-3">
              <span className="size-2.5 rounded-full bg-line" />
              <span className="size-2.5 rounded-full bg-line" />
              <span className="size-2.5 rounded-full bg-line" />
              <span className="ml-3 text-xs text-ink-faint">
                Energy · 3 new vacancies · example
              </span>
            </div>
            <ul className="divide-y divide-line-soft">
              {EXAMPLE_ROWS.map((row) => (
                <li key={row.title} className="flex items-center gap-4 px-4 py-3.5 sm:px-5">
                  <span
                    className={`grid size-10 shrink-0 place-items-center rounded-full font-mono text-sm font-medium ${scoreTone(row.score)}`}
                  >
                    {row.score}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{row.title}</p>
                    <p className="truncate text-sm text-ink-soft">
                      {row.company} <span className="text-ink-faint">· {row.place}</span>
                    </p>
                  </div>
                  <span className="hidden rounded-full border border-line px-3 py-1 text-xs text-ink-soft sm:block">
                    Tailor CV
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Live search */}
      <section id="search" className="scroll-mt-16 border-y border-line">
        <div className="mx-auto max-w-4xl px-4 py-20 sm:px-6">
          <SectionHeading
            title="Try it now"
            lead="Search live vacancies, no account needed. Signing in adds the part that saves time: each one read against your CV and scored."
          />
          <div className="mt-10 rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <PublicSearch />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-20 sm:px-6">
        <SectionHeading title="How it works" lead="Four steps, from your CV to one tailored to the job." />
        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li key={step.title} className="rounded-2xl border border-line bg-surface p-6">
              <span className="grid size-9 place-items-center rounded-full bg-brand font-mono text-sm text-white">
                {i + 1}
              </span>
              <h3 className="mt-5 font-semibold text-ink">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Features */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <SectionHeading
            title="More than a job board"
            lead="It reads the vacancies so you only read the right ones."
          />
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="rounded-2xl border border-line bg-surface p-6">
                <h3 className="font-semibold text-ink">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing call to action */}
      <section className="px-4 pb-20 sm:px-6">
        <div className="mx-auto max-w-6xl rounded-3xl bg-brand px-6 py-16 text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-balance text-white sm:text-4xl">
            Read ten vacancies, not five hundred.
            <span className="block text-white/55">Spend your time on the ones that fit.</span>
          </h2>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/login"
              className="inline-flex rounded-full bg-white px-5 py-2.5 text-sm font-medium text-brand transition-colors duration-150 hover:bg-line-soft"
            >
              Sign in with Google →
            </Link>
            <a
              href="#search"
              className="inline-flex rounded-full border border-white/25 px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:border-white/60"
            >
              Try a search first
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 text-xs text-ink-faint sm:flex-row sm:justify-between sm:px-6">
          <span>Job Seeker · Built with Python, Next.js and Gemini</span>
          <span>Vacancy data from Adzuna and public company career pages</span>
        </div>
      </footer>
    </main>
  );
}
