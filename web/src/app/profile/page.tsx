import ProfileUpload from "@/components/ProfileUpload";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/profileFromCv";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata = { title: "Your CV - Job Seeker" };

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("profiles")
    .select("data")
    .eq("name", "master")
    .maybeSingle();

  return (
    <main className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-baseline gap-3">
            <h1 className="text-base font-semibold tracking-tight text-ink">Your CV</h1>
            <p className="hidden text-xs text-ink-faint sm:block">{user.email}</p>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink-soft transition-colors duration-150 hover:border-brand hover:text-brand"
          >
            Back to vacancies
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <ProfileUpload initial={(data?.data as Profile) ?? null} />
      </div>
    </main>
  );
}
