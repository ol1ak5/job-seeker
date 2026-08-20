import CvReader from "@/components/CvReader";
import { createClient } from "@/lib/supabase/server";
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

  if (vacancy) query = query.eq("vacancy_id", vacancy);

  const { data, error } = await query;
  const cvs = (data ?? []) as unknown as Cv[];

  return (
    <main className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <h1 className="text-base font-semibold tracking-tight text-ink">
            Tailored CVs
          </h1>
          <Link
            href="/"
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-soft transition-colors duration-150 hover:border-brand hover:text-brand"
          >
            Back to vacancies
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            Could not load them: {error.message}
          </p>
        )}

        {!error && cvs.length === 0 && (
          <div className="rounded-lg border border-dashed border-line bg-surface p-10 text-center">
            <p className="text-sm text-ink-soft">Nothing written yet.</p>
            <p className="mt-2 text-sm text-ink-faint">
              Open a vacancy on the list and ask for a CV tailored to it.
            </p>
          </div>
        )}

        {vacancy && cvs.length > 0 && (
          <p className="mb-4 text-sm text-ink-faint">
            Showing one vacancy.{" "}
            <Link href="/cvs" className="text-brand hover:opacity-80">
              Show all
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
