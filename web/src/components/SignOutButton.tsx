"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

/**
 * A Client Component because it handles a click. Signing out clears the
 * session cookies, then router.refresh() re-runs the Server Components so the
 * page immediately reflects the signed-out state. It lands on the home page,
 * which signed out is the landing page, rather than on a sign-in form.
 */
export default function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      className="ml-1 cursor-pointer whitespace-nowrap rounded-full border border-line px-3.5 py-1.5 text-sm text-ink-soft transition-colors duration-150 hover:border-brand/40 hover:text-brand"
    >
      Sign out
    </button>
  );
}
