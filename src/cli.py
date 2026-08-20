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


@cli.command("push-tracks")
def push_tracks():
    """Copy config/tracks.yaml into your account so you can edit it on the website."""
    from src.config import read_tracks_file
    from src.settings import load_settings
    from src.storage import connect, save_tracks, storage_configured

    settings = load_settings(required=())
    if not storage_configured(settings):
        raise SystemExit(
            "No Supabase credentials in .env — nothing to push to. Fill in "
            "SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_EMAIL and SUPABASE_PASSWORD.")
    tracks = read_tracks_file()
    client = connect(settings)
    written = save_tracks(client, client.auth.get_user().user.id, tracks)
    click.echo(f"Published {written} track(s): {', '.join(sorted(tracks))}.")
    click.echo("They are now editable on the Settings page of the website.")


@cli.command("push-profile")
@click.option("--profile", default="master_profile", show_default=True)
def push_profile(profile: str):
    """Copy a local profile YAML into your account, where the site can read it."""
    from src.profile import load_profile
    from src.settings import load_settings
    from src.storage import connect, save_profile, storage_configured

    settings = load_settings(required=())
    if not storage_configured(settings):
        raise SystemExit("No Supabase credentials in .env — nothing to push to.")
    profile_path, _ = resolve_profile(profile)
    client = connect(settings)
    data = load_profile(profile_path)
    save_profile(client, client.auth.get_user().user.id, data)
    name = data.get("contact", {}).get("name", "the profile")
    click.echo(f"Uploaded {name} from {profile_path}.")
    click.echo("The site can now read it; the local file is only a backup.")


@cli.command("import-cv")
@click.option("--file", "file_", type=click.Path(exists=True), required=True,
              help="CV file to import (.docx, .pdf, .txt, .md).")
@click.option("--out", default=None,
              help="Where to write the profile YAML (default: profile/<filename>.yaml).")
@click.option("--tracks", default=None,
              help="Comma-separated track names (default: all tracks in config).")
def import_cv(file_: str, out: str | None, tracks: str | None):
    """Turn any CV file into a profile YAML you can then edit by hand."""
    import pathlib

    from langchain_google_genai import ChatGoogleGenerativeAI

    from src.import_cv import build_profile, extract_text, write_profile
    from src.settings import load_settings

    src_path = pathlib.Path(file_)
    activate_saved_tracks()
    available = sorted(load_tracks())
    track_names = ([t.strip() for t in tracks.split(",")] if tracks
                   else available)
    unknown = [t for t in track_names if t not in available]
    if unknown:
        raise SystemExit(
            f"Unknown track(s): {', '.join(unknown)}. "
            f"Configured tracks: {', '.join(available)}.")
    out_path = pathlib.Path(out) if out else pathlib.Path("profile") / f"{src_path.stem}.yaml"
    if out_path.exists():
        raise SystemExit(f"{out_path} already exists — choose another --out name.")

    llm = ChatGoogleGenerativeAI(model="gemini-pro-latest",
                                 google_api_key=load_settings(required=("GOOGLE_API_KEY",)).google_api_key)
    profile = build_profile(extract_text(src_path), track_names, llm)
    written = write_profile(profile, out_path)
    click.echo(f"Profile written: {written}")
    click.echo("Review it, fix anything the model got wrong, then use "
               f"--profile {written.stem} with the other commands.")


@cli.command("review")
@click.option("--vacancy-id", required=True)
@click.option("--pdf", is_flag=True, default=False,
              help="Build the PDF after the review.")
@click.option("--profile", default="master_profile", show_default=True)
def review(vacancy_id: str, pdf: bool, profile: str):
    """Walk through every change the model made and accept or reject each one."""
    import pathlib
    import subprocess

    from src.config import load_tracks
    from src.review import apply_decisions, build_hunks, find_tailored
    from src.writers import load_cached_vacancy

    profile_path, out_dir = resolve_profile(profile)
    track = vacancy_id.split("-", 1)[0]
    tracks = load_tracks()
    if track not in tracks:
        raise SystemExit(f"Unknown track in id '{vacancy_id}'.")
    master_path = pathlib.Path(tracks[track].master_cv)
    if not master_path.exists():
        raise SystemExit(f"Master CV not found: {master_path}")

    vacancy = load_cached_vacancy(vacancy_id, out_dir / "cache")
    tailored_path = find_tailored(vacancy.company, vacancy.title,
                                  pathlib.Path("cv/tailored"))
    master_text = master_path.read_text(encoding="utf-8")
    tailored_text = tailored_path.read_text(encoding="utf-8")
    hunks = build_hunks(master_text, tailored_text)
    if not hunks:
        click.echo("No differences from the master CV.")
        return

    click.echo(f"{len(hunks)} change(s) against {master_path}\n")
    decisions = []
    for number, hunk in enumerate(hunks, start=1):
        click.echo(f"--- Change {number}/{len(hunks)}  {hunk.section}")
        for line in hunk.master_lines:
            click.echo(click.style(f"  master   | {line}", fg="red"))
        for line in hunk.tailored_lines:
            click.echo(click.style(f"  tailored | {line}", fg="green"))
        answer = click.prompt("  [y] keep tailored  [n] keep master  [e] edit",
                              default="y", show_default=False)
        answer = answer.strip().lower()
        if answer.startswith("n"):
            decisions.append(False)
        elif answer.startswith("e"):
            click.echo("  Enter the replacement text, end with an empty line:")
            typed = []
            while True:
                line = input("  ")
                if not line:
                    break
                typed.append(line)
            decisions.append("\n".join(typed) if typed else False)
        else:
            decisions.append(True)
        click.echo("")

    tailored_path.write_text(
        apply_decisions(master_text, tailored_text, decisions), encoding="utf-8")
    click.echo(f"Saved: {tailored_path}")

    if pdf:
        subprocess.run(["./cv/make_pdf.sh", str(tailored_path)], check=True)


if __name__ == "__main__":
    cli()
