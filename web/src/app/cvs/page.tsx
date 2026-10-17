import AppHeader from "@/components/AppHeader";
import PageIntro from "@/components/PageIntro";
import "@/app/cv.css";

import CvReader from "@/components/CvReader";
import { createClient } from "@/lib/supabase/server";
import { isSessionError } from "@/lib/supabase/session";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = { title: "Tailored CVs - Job Seeker" };

export type Cv = {
  id: string;
  vacancy_id: string | null;
  filename: string;
  markdown: string;
  /** The CV before this vacancy was taken into account. "" for older rows. */
  baseline: string;
  approved_markdown: string | null;
  created_at: string;
  vacancies: { title: string; company: string } | null;
};

export default async function CvsPage({
  searchParams,
}: {
  searchParams: Promise<{ vacancy?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { vacancy } = await searchParams;

  let query = supabase
    .from("cvs")
    .select("id, vacancy_id, filename, markdown, baseline, approved_markdown, created_at, vacancies(title, company)")
    .order("created_at", { ascending: false });

  // Opened from a vacancy: only its newest CV. "Redo" writes a new one rather
  // than overwriting, so older versions exist, but the one to read and send is
  // the latest.
  if (vacancy) query = query.eq("vacancy_id", vacancy).limit(1);

  const { data, error } = await query;

  if (isSessionError(error)) {
    redirect("/login");
  }
  const cvs = (data ?? []) as unknown as Cv[];
  const single = vacancy ? cvs[0]?.vacancies : null;

  return (
    <main className="min-h-screen">
      <AppHeader />

      <section className="px-4 pt-14 pb-10 sm:px-6 sm:pt-20">
        {single ? (
          <PageIntro
            title="Your tailored CV."
            subtitle={`${single.title} at ${single.company}.`}
          />
        ) : (
          <PageIntro title="Tailored CVs." subtitle="One for each vacancy you chose." />
        )}
      </section>

      <div className="mx-auto max-w-4xl px-4 pb-20 sm:px-6">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {/* 42703 is Postgres for "no such column": the code expects a
                migration the database has not been given yet. Saying that is
                far more use than repeating the column name. */}
            {error.code === "42703" ? (
              <>
                <p className="font-medium">This database is behind the code.</p>
                <p className="mt-1">
                  Run{" "}
                  <span className="font-mono">db/migrations/0004_cv_review.sql</span>{" "}
                  in the Supabase SQL editor, then reload. Until then the
                  changes a tailored CV made cannot be shown, because the column
                  holding the earlier version does not exist yet.
                </p>
              </>
            ) : (
              <p>Could not load them: {error.message}</p>
            )}
          </div>
        )}

        {!error && cvs.length === 0 && (
          <div className="rounded-lg border border-dashed border-line bg-surface p-10 text-center">
            <p className="text-sm text-ink-soft">Nothing written yet.</p>
            <p className="mt-2 text-sm text-ink-faint">
              Open a vacancy on the list and ask for a CV tailored to it.
            </p>
          </div>
        )}

        {vacancy && (
          <p className="mb-4 text-sm">
            <Link href="/dashboard" className="text-ink-soft transition-colors duration-150 hover:text-brand">
              ← Back to the vacancies
            </Link>
          </p>
        )}

        <div className="space-y-4">
          {cvs.map((cv) => (
            <CvReader key={cv.id} cv={cv} />
          ))}
        </div>
      </div>
    </main>
  );
}
