"use client";

import AddVacancy from "@/components/AddVacancy";
import SearchButton, { type Job } from "@/components/SearchButton";
import { useState } from "react";

/**
 * The top of the dashboard: the title and numbers on the left, the two
 * actions on the right. Adding a vacancy opens its form underneath, across
 * the full width, rather than squeezed into the corner the button sits in.
 */
export default function DashboardToolbar({
  userId,
  tracks,
  hasCv,
  latestJob,
  children,
}: {
  userId: string;
  tracks: string[];
  hasCv: boolean;
  latestJob: Job | null;
  /** The title and the numbers. */
  children: React.ReactNode;
}) {
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>{children}</div>
        <SearchButton
          ready={tracks.length > 0 && hasCv}
          hint={
            !hasCv
              ? "Upload your CV first: every vacancy is scored against it."
              : "Set up a search first."
          }
          initialJob={latestJob}
        >
          <button
            onClick={() => setAdding((open) => !open)}
            aria-expanded={adding}
            className="cursor-pointer rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-medium text-ink transition-colors duration-150 hover:border-brand/40 hover:text-brand"
          >
            + Add a vacancy
          </button>
        </SearchButton>
      </div>

      {adding && (
        <AddVacancy userId={userId} tracks={tracks} onClose={() => setAdding(false)} />
      )}
    </div>
  );
}
