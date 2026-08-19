/**
 * Reading the Supabase settings in one place, with a message that says what is
 * wrong.
 *
 * Without this the app crashes deep inside the Supabase client with "Invalid
 * URL", which on a hosted deployment surfaces as a bare "Internal Server
 * Error" on every page - including static ones, because the proxy runs first.
 * Missing configuration should name itself.
 */
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const missing = [
    !url && "NEXT_PUBLIC_SUPABASE_URL",
    !key && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(
      `Missing environment variable(s): ${missing.join(", ")}. ` +
        `Set them locally in web/.env.local, and on Vercel under ` +
        `Settings -> Environment Variables. NEXT_PUBLIC_ values are baked in at ` +
        `build time, so redeploy after adding them.`,
    );
  }

  return { url: url!, key: key! };
}
