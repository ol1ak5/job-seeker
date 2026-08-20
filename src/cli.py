import pathlib

import click

from src.config import load_tracks


def resolve_track(name: str) -> str:
    """Check the track exists, after pulling in whatever the user saved online.

    The available names cannot be known when this module is imported: they may
    live in the database, behind a login. So the check happens when a command
    runs, not when click builds its option list.
    """
    activate_saved_tracks()
    try:
        available = sorted(load_tracks())
    except FileNotFoundError:
        raise SystemExit(
            "config/tracks.yaml not found — run jobseeker from the project "
            "root directory (the folder containing config/ and profile/).")
    if name not in available:
        raise SystemExit(
            f"Unknown track '{name}'. Available: {', '.join(available)}. "
            f"Add or edit tracks on the Settings page of the website.")
    return name


def activate_saved_tracks() -> None:
    """Install this account's search settings and CV, if Supabase is configured.

    The account is the source of truth; the local files are the fallback for a
    setup with no database at all. Both are installed in one visit so the CLI
    signs in once rather than twice.
    """
    from src.config import load_db_tracks, use_tracks
    from src.profile import use_profile
    from src.settings import load_settings
    from src.storage import connect, load_db_profile, storage_configured

    settings = load_settings(required=())
    if not storage_configured(settings):
        return
    try:
        client = connect(settings)
        user_id = client.auth.get_user().user.id
        saved = load_db_tracks(client, user_id)
        profile = load_db_profile(client, user_id)
    except SystemExit:
        raise
    except Exception as exc:
        click.echo(f"Could not read your account ({exc}); using the local "
                   f"config/ and profile/ files.", err=True)
        return
    if saved:
        use_tracks(saved)
    if profile:
        use_profile(profile)


def resolve_profile(name: str) -> tuple[str, pathlib.Path]:
    """Return (profile_path, out_dir) for a profile name or path."""
    path = name if name.endswith(".yaml") else f"profile/{name}.yaml"
    stem = pathlib.Path(path).stem
    out_dir = pathlib.Path("output") if stem == "master_profile" else pathlib.Path("output") / stem
    if not pathlib.Path(path).exists():
        raise SystemExit(f"Profile file not found: {path}")
    return path, out_dir


@click.group()
def cli():
    """Job-seeker: search vacancies, score matches, adapt CVs."""


@cli.command("search-and-score")
@click.option("--track", required=True)
@click.option("--days", default=14, show_default=True)
@click.option("--limit", default=30, show_default=True)
@click.option("--profile", default="master_profile", show_default=True)
def search_and_score(track: str, days: int, limit: int, profile: str):
    """Search vacancies for TRACK, score them, write CSV+MD report."""
    from langchain_google_genai import ChatGoogleGenerativeAI

    from src.graphs.search_and_score import run_search
    from src.scoring import make_scorer
    from src.settings import load_settings

    track = resolve_track(track)
    profile_path, out_dir = resolve_profile(profile)
    settings = load_settings()
    llm = ChatGoogleGenerativeAI(model="gemini-flash-latest",
                                 google_api_key=settings.google_api_key)
    md_path = run_search(track, days, limit, make_scorer(llm), out_dir=out_dir,
                         profile_path=profile_path)
    click.echo(f"Report written: {md_path}")


@cli.command("adapt-cv")
@click.option("--vacancy-id", required=True)
@click.option("--profile", default="master_profile", show_default=True)
def adapt_cv(vacancy_id: str, profile: str):
    """Generate a tailored Markdown CV for a previously listed vacancy."""
    from src.adapt_cv import run_adapt_cv

    profile_path, out_dir = resolve_profile(profile)
    cv_path = run_adapt_cv(vacancy_id, out_dir=out_dir, profile_path=profile_path)
    click.echo(f"CV written: {cv_path}")


@cli.command("match")
@click.option("--track", required=True)
@click.option("--file", "file_", type=click.Path(exists=True), default=None,
              help="Text file: line 1 title, line 2 company, rest description.")
@click.option("--url", default=None, help="Job posting URL to fetch.")
@click.option("--adapt-cv", "adapt", is_flag=True, default=False,
              help="Also generate the tailored CV.")
@click.option("--profile", default="master_profile", show_default=True)
def match(track: str, file_: str | None, url: str | None, adapt: bool,
          profile: str):
    """Score ONE vacancy you found yourself — no search, no report files."""
    import datetime
    import pathlib

    from langchain_google_genai import ChatGoogleGenerativeAI

    from src.match import fetch_vacancy_url, parse_vacancy_text, run_match
    from src.scoring import make_scorer
    from src.settings import load_settings

    if bool(file_) == bool(url):
        raise SystemExit("Provide exactly one of --file or --url.")
    vacancy = (parse_vacancy_text(pathlib.Path(file_).read_text())
               if file_ else fetch_vacancy_url(url))

    profile_path, out_dir = resolve_profile(profile)
    settings = load_settings()
    llm = ChatGoogleGenerativeAI(model="gemini-flash-latest",
                                 google_api_key=settings.google_api_key)
    vacancy, score = run_match(track, vacancy, make_scorer(llm),
                               profile_path, out_dir, datetime.date.today())

    click.echo(f"[{vacancy.id}] {vacancy.title} @ {vacancy.company}")
    if score is None:
        click.echo("Scoring failed twice — try again.")
        return
    click.echo(f"Score: {score.score}/100 — {score.verdict}")
    click.echo("Matches: " + "; ".join(score.matching_points))
    click.echo("Gaps: " + "; ".join(score.gaps))
    if score.flags:
        click.echo("Flags: " + "; ".join(score.flags))
    if adapt:
        from src.adapt_cv import run_adapt_cv
        cv_path = run_adapt_cv(vacancy.id, out_dir=out_dir,
                               profile_path=profile_path)
        click.echo(f"CV written: {cv_path}")


