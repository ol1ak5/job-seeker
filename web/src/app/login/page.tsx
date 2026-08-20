"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

/**
 * "use client" at the top marks this a Client Component: it runs in the
 * browser, which it has to, because it reacts to a click and keeps state.
 */
export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function signInWithGoogle() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      // Where Supabase sends the browser back once Google has confirmed who
      // this is. That route turns the one-time code into a session cookie.
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Job Seeker</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Sign in to see the vacancies scored against your profile.
        </p>

        <button
          onClick={signInWithGoogle}
          disabled={busy}
          className="mt-8 flex w-full cursor-pointer items-center justify-center gap-3 rounded-lg border border-line px-4 py-3 text-sm font-medium text-ink-soft transition-colors duration-150 hover:border-brand hover:text-brand disabled:opacity-60"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z" />
            <path fill="#EA4335" d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.47 14.97.5 12 .5A11 11 0 0 0 2.18 7.05l3.66 2.84C6.71 7.29 9.14 4.75 12 4.75z" />
          </svg>
          {busy ? "Redirecting…" : "Continue with Google"}
        </button>

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
