import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for Client Components - code that runs in the browser.
 * Used for actions the user triggers, such as signing in or out.
 *
 * Both values are public by design: the URL is just an address, and the
 * publishable key only allows *attempting* to authenticate. Row Level Security
 * is what decides which rows anyone can actually read.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
