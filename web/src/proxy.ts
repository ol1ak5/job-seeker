import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { supabaseEnv } from "./lib/supabase/env";

/**
 * Runs before every matched request.
 *
 * Next.js 16 renamed this file convention from `middleware.ts` to `proxy.ts`;
 * the exported function has to be named `proxy` to match.
 *
 * Access tokens expire after about an hour. Without refreshing them here the
 * user would silently lose their session while browsing, and Server Components
 * (which cannot write cookies themselves) would start seeing them as signed
 * out. Calling getUser() makes the Supabase client refresh the token when
 * needed and write the new cookies onto the response.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { url, key } = supabaseEnv();

  const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
    },
  });

  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Skip static assets and images: they need no session.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
