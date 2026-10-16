import TrackForm from "@/components/TrackForm";
import { createClient } from "@/lib/supabase/server";
import { isSessionError } from "@/lib/supabase/session";
import type { TrackRow } from "@/lib/tracks";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = { title: "Search settings - Job Seeker" };

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("tracks")
    .select("id, name, label, data, enabled")
    .order("name");

  if (isSessionError(error)) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-baseline gap-3">
            <h1 className="text-base font-semibold tracking-tight text-ink">
              Search settings
            </h1>
            <p className="hidden text-xs text-ink-faint sm:block">{user.email}</p>
          </div>
          <Link
            href="/"
            className="rounded-full border border-line px-3.5 py-1.5 text-sm text-ink-soft transition-colors duration-150 hover:border-brand hover:text-brand"
          >
            Back to vacancies
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            Could not load your searches: {error.message}
          </p>
        ) : (
          <TrackForm initialTracks={(data ?? []) as TrackRow[]} userId={user.id} />
        )}
      </div>
    </main>
  );
}
