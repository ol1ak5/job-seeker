import AppHeader from "@/components/AppHeader";
import PageIntro from "@/components/PageIntro";
import ProfileUpload from "@/components/ProfileUpload";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/profileFromCv";
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
      <AppHeader />

      <section className="px-4 pt-14 pb-10 sm:px-6 sm:pt-20">
        <PageIntro title="Your CV." subtitle="Upload it once, update it any time." />
      </section>

      <div className="mx-auto max-w-3xl px-4 pb-20 sm:px-6">
        <ProfileUpload initial={(data?.data as Profile) ?? null} />
      </div>
    </main>
  );
}
