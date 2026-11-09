import AppHeader from "@/components/AppHeader";
import DashboardToolbar from "@/components/DashboardToolbar";
import type { Job } from "@/components/SearchButton";
import StatLine from "@/components/StatLine";
import VacancyTable from "@/components/VacancyTable";
import type { CustomColumn, Vacancy } from "@/lib/vacancies";
import Link from "next/link";

export type DashboardProps = {
  userId: string;
  tracks: string[];
  /** Whether a CV has been uploaded; the preview leaves it out. */
  hasCv?: boolean;
  vacancies: Vacancy[];
  stats: { total: number; strong: number; applied: number; inProcess: number };
  latestJob: Job | null;
  error: string | null;
  /** False until the database has migration 0005. */
  appliedTextReady?: boolean;
  customColumns?: CustomColumn[];
  /** False until the database has migration 0006. */
  customColumnsReady?: boolean;
};

/**
 * The signed-in home page: a working sheet, not a pitch. The title and where
 * the search stands on the left, the two actions on the right, and everything
 * under them is the list.
 *
 * Kept apart from the page that loads the data so that it renders the same
 * from any source - the database in production, sample rows in a preview.
 */
export default function Dashboard({
  userId,
  tracks,
  hasCv = true,
  vacancies,
  stats,
  latestJob,
  error,
  appliedTextReady = true,
  customColumns = [],
  customColumnsReady = true,
}: DashboardProps) {
  return (
    <main className="min-h-screen">
      <AppHeader wide />

      <div className="mx-auto max-w-7xl px-4 pt-8 pb-20 sm:px-6">
        {error ? (
          <>
            <h1 className="text-3xl font-semibold tracking-tight text-ink">Vacancies</h1>
            <p className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              Could not load vacancies: {error}
            </p>
          </>
        ) : (
          <DashboardToolbar userId={userId} tracks={tracks} hasCv={hasCv} latestJob={latestJob}>
            <h1 className="text-3xl font-semibold tracking-tight text-ink">Vacancies</h1>
            <div className="mt-2">
              <StatLine {...stats} />
            </div>
          </DashboardToolbar>
        )}

        <div className="mt-8">
          {!error && vacancies.length === 0 && (
            <div className="rounded-2xl border border-dashed border-line p-12 text-center">
              <p className="font-medium text-ink">No vacancies yet</p>
              <p className="mt-1 text-sm text-ink-soft">
                Upload your CV, describe what you are looking for, then run the search.
              </p>
              {/* One step at a time: the CV first, since the search needs it. */}
              <Link
                href={hasCv ? "/settings" : "/profile"}
                className="mt-5 inline-flex rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors duration-150 hover:bg-brand-soft"
              >
                {hasCv ? "Set up a search →" : "Upload your CV →"}
              </Link>
            </div>
          )}

          {vacancies.length > 0 && <VacancyTable
              vacancies={vacancies}
              userId={userId}
              appliedTextReady={appliedTextReady}
              customColumns={customColumns}
              customColumnsReady={customColumnsReady}
              lastSearchAt={latestJob?.status === "done" ? latestJob.finished_at : null}
            />}
        </div>
      </div>
    </main>
  );
}
