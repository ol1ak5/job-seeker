"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

/**
 * A Client Component because it handles a click. Signing out clears the
 * session cookies, then router.refresh() re-runs the Server Components so the
 * page immediately reflects the signed-out state.
 */
export default function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
    >
      Sign out
    </button>
  );
}
