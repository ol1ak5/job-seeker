import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * The last step of the OAuth round trip.
 *
 * Google confirmed the identity and Supabase sent the browser back here with a
 * one-time `code`. Exchanging it produces the session, which the Supabase
 * client stores in cookies - from then on Server Components know who is asking.
 *
 * A file named route.ts is a Route Handler: an HTTP endpoint rather than a
 * page, so `/auth/callback` returns a redirect instead of HTML.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(`${origin}/login?error=missing_code`);
}
