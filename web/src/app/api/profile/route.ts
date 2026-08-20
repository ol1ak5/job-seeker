import { createClient } from "@/lib/supabase/server";
import { UnreadableCv, extractCvText } from "@/lib/cvText";
import { CvNotUnderstood, profileFromCv } from "@/lib/profileFromCv";
import type { NextRequest } from "next/server";

/**
 * Uploading a CV.
 *
 * Reading it takes a Gemini call - fifteen seconds or so - which is short
 * enough to answer inside the request. The visitor uploads and sees the parsed
 * profile straight away, rather than being told to come back later on their
 * very first interaction with the product.
 *
 * Authorisation is checked here even though the page is signed-in only: a
 * route handler is a public URL, and the session is the only thing standing
 * between it and the open internet.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Sign in first." }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("cv");
  if (!(file instanceof File) || !file.size) {
    return Response.json({ error: "Choose a file first." }, { status: 400 });
  }

  const { data: trackRows } = await supabase.from("tracks").select("name");
  const tracks = (trackRows ?? []).map((t) => t.name as string);

  let profile;
  try {
    profile = await profileFromCv(await extractCvText(file), tracks);
  } catch (exc) {
    if (exc instanceof UnreadableCv || exc instanceof CvNotUnderstood) {
      return Response.json({ error: exc.message }, { status: 422 });
    }
    return Response.json(
      { error: "Something went wrong reading that CV. Try again." },
      { status: 500 },
    );
  }

  const { error } = await supabase
    .from("profiles")
    .upsert(
      { user_id: user.id, name: "master", data: profile },
      { onConflict: "user_id,name" },
    );

  if (error) {
    return Response.json({ error: `Could not save: ${error.message}` }, { status: 500 });
  }
  return Response.json({ profile });
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Sign in first." }, { status: 401 });
  }

  const { error } = await supabase.from("profiles").delete().eq("name", "master");
  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ deleted: true });
}
