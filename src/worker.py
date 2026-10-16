"""Perform one job the site asked for.

Invoked by GitHub Actions, never by a person: `python -m src.worker <job_id>`.
It is the engine's only entry point from the outside, which is why it does its
own bookkeeping - marking the job running, done or failed - rather than leaving
that to whoever called it.

It connects with the service-role key, which bypasses Row Level Security. That
is deliberate: the worker acts for whichever account owns the job, and no
signed-in session exists inside a CI runner. The price is that isolation stops
being the database's problem and becomes this file's: every read and write must
be scoped to `job["user_id"]`, and nothing here may take a user id from
anywhere else.
"""

import datetime
import os
import sys
import traceback


def service_client():
    """A Supabase client with the secret key. Never expose this key.

    Supabase renamed its keys: what the docs used to call `service_role` is now
    a secret key beginning `sb_secret_`. Both still work, so the old variable
    name is accepted for projects created before the change.
    """
    from supabase import create_client

    url = os.environ["SUPABASE_URL"]
    key = (os.environ.get("SUPABASE_SECRET_KEY")
           or os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ""))
    if not key:
        raise SystemExit(
            "SUPABASE_SECRET_KEY is not set. The worker cannot act for a user "
            "without it: Supabase → Settings → API Keys → Secret keys. It is "
            "the key beginning sb_secret_, not the publishable one.")
    return create_client(url, key)


def claim(client, job_id: str) -> dict:
    """Take the job and mark it running, or refuse if somebody already has it."""
    rows = client.table("jobs").select("*").eq("id", job_id).execute().data or []
    if not rows:
        raise SystemExit(f"No job {job_id}.")
    job = rows[0]
    if job["status"] not in ("queued", "running"):
        raise SystemExit(f"Job {job_id} is already {job['status']}.")
    client.table("jobs").update({
        "status": "running",
        "started_at": _now(),
    }).eq("id", job_id).execute()
    return job


def finish(client, job_id: str, status: str, error: str = "",
           result: dict | None = None) -> None:
    client.table("jobs").update({
        "status": status,
        "error": error[:4000] or None,
        "result": result or {},
        "finished_at": _now(),
    }).eq("id", job_id).execute()


def _now() -> str:
    return datetime.datetime.now(datetime.UTC).isoformat()


def run_search_job(client, job: dict) -> dict:
    """A full search for the account that asked for it."""
    import pathlib

    from langchain_google_genai import ChatGoogleGenerativeAI

    from src.config import load_db_tracks, use_tracks
    from src.search_and_score import run_search
    from src.profile import use_profile
    from src.scoring import make_scorer
    from src.settings import load_settings
    from src.storage import load_db_profile, use_session

    user_id = job["user_id"]
    use_session(client, user_id)

    tracks = load_db_tracks(client, user_id)
    if not tracks:
        raise SystemExit(
            "This account has no saved searches. Set one up on the Settings "
            "page before searching.")
    use_tracks(tracks)

    profile = load_db_profile(client, user_id)
    if not profile:
        raise SystemExit(
            "This account has no CV. Upload one before searching - every "
            "vacancy is scored against it.")
    use_profile(profile)

    track = job.get("track") or sorted(tracks)[0]
    if track not in tracks:
        raise SystemExit(f"Unknown track '{track}' for this account.")

    payload = job.get("payload") or {}
    days = int(payload.get("days", 14))
    limit = int(payload.get("limit", 30))

    settings = load_settings()
    llm = ChatGoogleGenerativeAI(model="gemini-flash-latest",
                                 google_api_key=settings.google_api_key)
    # The report files land in the runner's temporary disk and die with it; the
    # database is the only output that outlives the job.
    run_search(track, days, limit, make_scorer(llm),
               out_dir=pathlib.Path("output"))

    found = (client.table("vacancies").select("id", count="exact")
             .eq("user_id", user_id).eq("track", track).execute())
    return {"track": track, "vacancies": found.count or 0}


def run_adapt_job(client, job: dict) -> dict:
    """Rewrite the CV for one vacancy the user picked."""
    import datetime

    from src.adapt_cv import adapt_cv_markdown, tailored_filename
    from src.profile import profile_to_text
    from src.config import load_db_tracks
    from src.storage import load_db_profile, save_cv

    user_id = job["user_id"]
    vacancy_id = (job.get("payload") or {}).get("vacancy_id")
    if not vacancy_id:
        raise SystemExit("This job carries no vacancy to write a CV for.")

    rows = (client.table("vacancies").select("*")
            .eq("id", vacancy_id).eq("user_id", user_id).execute().data or [])
    if not rows:
        raise SystemExit("That vacancy does not belong to this account.")
    row = rows[0]

    profile = load_db_profile(client, user_id)
    if not profile:
        raise SystemExit("This account has no CV to adapt. Upload one first.")

    tracks = load_db_tracks(client, user_id)
    cfg = tracks.get(row["track"])
    if cfg is None:
        raise SystemExit(
            f"The vacancy belongs to a search called '{row['track']}' that no "
            f"longer exists. Recreate it, or add the vacancy to another search.")

    from src.models import Vacancy
    vacancy = Vacancy(title=row["title"], company=row["company"],
                      location=row["location"] or "", url=row["url"],
                      source=row["source"], description=row["description"] or "")

    markdown = adapt_cv_markdown(vacancy, cfg, profile)
    # What the profile alone renders as, so the reader can see what the vacancy
    # changed rather than having to trust it.
    baseline = profile_to_text(profile, cfg)
    filename = tailored_filename(vacancy.company, vacancy.title,
                                 profile.get("contact", {}).get("name", "CV"),
                                 datetime.date.today())
    cv_id = save_cv(client, user_id, vacancy_id, filename, markdown, baseline)
    return {"cv_id": cv_id, "filename": filename, "vacancy_id": vacancy_id}


HANDLERS = {"search": run_search_job, "adapt": run_adapt_job}


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: python -m src.worker <job_id>", file=sys.stderr)
        return 2

    job_id = argv[1]
    client = service_client()
    job = claim(client, job_id)

    handler = HANDLERS.get(job["kind"])
    if handler is None:
        finish(client, job_id, "failed", f"Unknown job kind '{job['kind']}'.")
        return 1

    try:
        result = handler(client, job)
    except SystemExit as exc:
        finish(client, job_id, "failed", str(exc))
        return 1
    except Exception:
        finish(client, job_id, "failed", traceback.format_exc())
        return 1

    finish(client, job_id, "done", result=result)
    print(f"Job {job_id} done: {result}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
