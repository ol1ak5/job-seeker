import AppHeader from "@/components/AppHeader";
import PageIntro from "@/components/PageIntro";
import TrackForm from "@/components/TrackForm";
import { createClient } from "@/lib/supabase/server";
import { isSessionError } from "@/lib/supabase/session";
import type { TrackRow } from "@/lib/tracks";
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
      <AppHeader />

      <section className="px-4 pt-14 pb-10 sm:px-6 sm:pt-20">
        <PageIntro title="Search settings." subtitle="What to look for, and what to skip." />
      </section>

      <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
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
