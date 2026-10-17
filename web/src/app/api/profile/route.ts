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

/**
 * Saving your correction of one section of the text the agent reads.
 *
 * Sent as `{ section, text }`, the section named by its title; `text: null`
 * goes back to what was read from the CV. Corrections are kept inside the
 * profile, so uploading a new CV replaces them with everything else.
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Sign in first." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const section = body?.section;
  const text = body?.text;
  if (typeof section !== "string" || (text !== null && typeof text !== "string")) {
    return Response.json({ error: "Send the section and its text." }, { status: 400 });
  }
  if (typeof text === "string" && text.length > 20_000) {
    return Response.json({ error: "That section is too long." }, { status: 400 });
  }

  const { data: row, error: readError } = await supabase
    .from("profiles")
    .select("data")
    .eq("name", "master")
    .maybeSingle();
  if (readError || !row) {
    return Response.json({ error: "Upload a CV first." }, { status: 404 });
  }

  const data = { ...(row.data as Record<string, unknown>) };
  const sections = (data.sections as { title: string }[] | undefined) ?? [];
  if (!sections.some((s) => s.title === section)) {
    return Response.json({ error: "That section is not in your CV." }, { status: 404 });
  }

  const edits = { ...((data.section_edits as Record<string, string> | undefined) ?? {}) };
  if (text && text.trim()) edits[section] = text.trim();
  else delete edits[section];
  data.section_edits = edits;

  const { error } = await supabase.from("profiles").update({ data }).eq("name", "master");
  if (error) {
    return Response.json({ error: `Could not save: ${error.message}` }, { status: 500 });
  }
  return Response.json({ profile: data });
}
