import { createClient } from "@/lib/supabase/server";
import type { NextRequest } from "next/server";

/**
 * Asking the engine to do something, and finding out whether it has.
 *
 * A search reads several job boards and then calls a model once per vacancy -
 * minutes of work, which no web request can hold open. So the site records the
 * request as a row, nudges a GitHub Actions runner to pick it up, and the
 * browser watches the row until it changes.
 *
 * The runner is the engine's host: free, nothing to keep awake, and the same
 * Python that runs locally. The cost is a cold start of half a minute, which
 * against a three-minute search is not worth solving.
 */

const GITHUB_API = "https://api.github.com";
const WORKFLOW = "run-job.yml";

function env(name: string): string {
  return (process.env[name] ?? "").trim().replace(/^['"]|['"]$/g, "");
}

async function dispatch(jobId: string): Promise<string | null> {
  const token = env("GITHUB_TOKEN");
  const repo = env("GITHUB_REPO");
  if (!token || !repo) {
    return "Searching is not wired up on this deployment yet.";
  }

  const response = await fetch(
    `${GITHUB_API}/repos/${repo}/actions/workflows/${WORKFLOW}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({
        ref: env("GITHUB_REF") || "main",
        inputs: { job_id: jobId },
      }),
    },
  );

  if (response.status === 204) return null;
  const detail = await response.text();
  return `The engine could not be started (${response.status}). ${detail.slice(0, 200)}`;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Sign in first." }, { status: 401 });
  }

  // One at a time: a second search would read the same boards and score the
  // same vacancies, on the same API allowance.
  const { data: pending } = await supabase
    .from("jobs")
    .select("id")
    .in("status", ["queued", "running"])
    .limit(1);

  if (pending?.length) {
    return Response.json(
      { error: "A search is already running. Wait for it to finish." },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const { data: job, error } = await supabase
    .from("jobs")
    .insert({
      user_id: user.id,
      kind: "search",
      track: body.track ?? null,
      payload: { days: 14, limit: 30 },
    })
    .select()
    .single();

  if (error || !job) {
    return Response.json(
      { error: `Could not queue the search: ${error?.message}` },
      { status: 500 },
    );
  }

  const problem = await dispatch(job.id);
  if (problem) {
    // The row would otherwise sit queued forever with nothing coming for it.
    await supabase
      .from("jobs")
      .update({ status: "failed", error: problem, finished_at: new Date().toISOString() })
      .eq("id", job.id);
    return Response.json({ error: problem }, { status: 502 });
  }

  return Response.json({ job });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Sign in first." }, { status: 401 });
  }

  const { data } = await supabase
    .from("jobs")
    .select("id, status, error, result, created_at, finished_at")
    .order("created_at", { ascending: false })
    .limit(1);

  return Response.json({ job: data?.[0] ?? null });
}
