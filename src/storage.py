import datetime

from src.models import ScoredVacancy
from src.settings import Settings

FIELDS = ("supabase_url", "supabase_anon_key", "supabase_email", "supabase_password")


def storage_configured(settings: Settings) -> bool:
    return all(getattr(settings, field) for field in FIELDS)


def connect(settings: Settings, client_factory=None):
    """Sign in to Supabase as a normal user, so RLS applies to the CLI too."""
    if not storage_configured(settings):
        return None
    if client_factory is None:
        from supabase import create_client

        client_factory = create_client
    client = client_factory(settings.supabase_url, settings.supabase_anon_key)
    try:
        client.auth.sign_in_with_password({
            "email": settings.supabase_email,
            "password": settings.supabase_password})
    except Exception as exc:
        raise SystemExit(
            f"Could not sign in to Supabase as {settings.supabase_email}: {exc}. "
            f"Check SUPABASE_EMAIL and SUPABASE_PASSWORD, and that the user is "
            f"confirmed (Authentication -> Users -> Auto Confirm User).")
    return client


# Installed by the worker for the length of one job: (client, user_id). The CLI
# leaves it unset and signs in as itself. Same idiom as use_tracks/use_profile.
_SESSION: tuple | None = None


def use_session(client, user_id: str) -> None:
    """Write everything from here on behalf of this account."""
    global _SESSION
    _SESSION = (client, user_id)


def reset_session() -> None:
    global _SESSION
    _SESSION = None


def save_results(track: str, scored: list[ScoredVacancy], errors: list[str],
                 days: int | None = None, limit: int | None = None,
                 dropped: dict | None = None) -> None:
    """Put scored vacancies in the account, wherever they came from.

    Both ways of producing a score end here: a full search through the graph,
    and a single vacancy pasted in by hand. They used to end differently - the
    search reached the database and the single match only reached the terminal -
    which meant a vacancy you found yourself could never appear on the site.

    A run row is only written for a search; a hand-matched vacancy belongs to no
    run, which is what its null run_id says.
    """
    from src.settings import load_settings

    if _SESSION is None:
        settings = load_settings()
        if not storage_configured(settings):
            return
    try:
        if _SESSION is not None:
            client, user_id = _SESSION
        else:
            client = connect(load_settings())
            user_id = client.auth.get_user().user.id
        run_id = None
        if days is not None:
            run_id = save_run(client, user_id, track, days, limit or 0,
                              dropped or {}, errors)
        save_vacancies(client, user_id, run_id, track, scored)
        if run_id:
            finish_run(client, run_id)
    except SystemExit:
        raise
    except Exception as exc:
        errors.append(f"supabase: {exc}")


def save_run(client, user_id: str, track: str, days: int, limit: int,
             dropped: dict, errors: list[str]) -> str:
    result = client.table("runs").insert({
        "user_id": user_id,
        "track": track,
        "status": "running",
        "days": days,
        "result_limit": limit,
        "dropped": dropped or {},
        "sources": {"errors": errors or []},
    }).execute()
    return result.data[0]["id"]


def save_vacancies(client, user_id: str, run_id: str, track: str,
                   scored: list[ScoredVacancy]) -> int:
    rows = []
    for item in scored:
        v = item.vacancy
        rows.append({
            "user_id": user_id,
            "run_id": run_id,
            "ref": v.id,
            "track": track,
            "title": v.title,
            "company": v.company,
            "location": v.location,
            "remote": v.remote,
            "posted": v.posted.isoformat() if v.posted else None,
            "salary": v.salary,
            "url": v.url,
            "source": v.source,
            "description": v.description[:20000],
            "score": item.score.score if item.score else None,
            "verdict": item.score.verdict if item.score else None,
            "matching_points": item.score.matching_points if item.score else [],
            "gaps": item.score.gaps if item.score else [],
            "flags": item.score.flags if item.score else [],
        })
    if not rows:
        return 0
    client.table("vacancies").upsert(rows, on_conflict="user_id,url").execute()
    return len(rows)


def save_profile(client, user_id: str, profile: dict, name: str = "master") -> None:
    """Store the parsed CV in the account.

    This is the input the whole pipeline runs on: the scorer reads it, the CV
    writer rewrites it. While it lived in profile/master_profile.yaml the tool
    only worked for whoever owned that laptop.

    Re-uploading replaces the profile of the same name rather than piling up
    copies - a person has one CV, not a history of them.
    """
    client.table("profiles").upsert({
        "user_id": user_id,
        "name": name,
        "data": profile,
    }, on_conflict="user_id,name").execute()


def load_db_profile(client, user_id: str, name: str = "master") -> dict | None:
    """The uploaded CV, or None when this account has not uploaded one yet."""
    result = (client.table("profiles")
              .select("data")
              .eq("user_id", user_id)
              .eq("name", name)
              .limit(1)
              .execute())
    rows = result.data or []
    return rows[0]["data"] if rows else None


def save_tracks(client, user_id: str, tracks) -> int:
    """Copy local track definitions into the account, so they can be edited online.

    Overwrites a track of the same name: the YAML file is the source being
    published, not something to merge with.
    """
    rows = [{
        "user_id": user_id,
        "name": name,
        "label": name.replace("-", " ").replace("_", " ").capitalize(),
        "data": cfg.model_dump(exclude={"name"}),
    } for name, cfg in tracks.items()]
    if not rows:
        return 0
    client.table("tracks").upsert(rows, on_conflict="user_id,name").execute()
    return len(rows)


def finish_run(client, run_id: str, status: str = "done") -> None:
    client.table("runs").update({
        "status": status,
        "finished_at": datetime.datetime.now(datetime.UTC).isoformat(),
    }).eq("id", run_id).execute()
