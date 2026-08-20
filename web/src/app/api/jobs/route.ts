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

  // Naming the missing variable turns a guessing game into a fact. Note that
  // Vercel reads environment variables when a deployment is created, so adding
  // one to the project does nothing until the project is redeployed - which is
  // the usual reason this message appears at all.
  const missing = [
    !token && "GITHUB_TOKEN",
    !repo && "GITHUB_REPO",
  ].filter(Boolean);

  if (missing.length) {
    return `Searching is not wired up yet: ${missing.join(" and ")} ${
      missing.length > 1 ? "are" : "is"
    } missing from this deployment. Add ${
      missing.length > 1 ? "them" : "it"
    } in Vercel and redeploy - environment variables only reach a deployment that was built after they were saved.`;
  }
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    return `GITHUB_REPO should look like owner/repository, not "${repo}".`;
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

  // GitHub answers 404 rather than 403 when a token may not touch a resource,
  // so that a token cannot be used to discover which private repositories
  // exist. The repository is found; the token is simply not allowed to know
  // that. Repeating GitHub's "Not Found" would send the reader looking for a
  // missing repository that is not missing.
  if (response.status === 404) {
    return (
      `GitHub will not start the workflow for ${repo}. It answers "not found" ` +
      `both when the repository does not exist and when the token may not see ` +
      `it, so check the token: it must list this repository under Repository ` +
      `access, and have Actions set to Read and write.`
    );
  }
  if (response.status === 401) {
    return "GitHub rejected the token. It may have been mistyped, revoked or expired.";
  }

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
