import pathlib

import click

from src.config import load_tracks

def _track_choices() -> list[str]:
    try:
        return sorted(load_tracks())
    except FileNotFoundError:
        raise SystemExit(
            "config/tracks.yaml not found — run jobseeker from the project "
            "root directory (the folder containing config/ and profile/).")


TRACK_CHOICES = _track_choices()


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
@click.option("--track", type=click.Choice(TRACK_CHOICES), required=True)
@click.option("--days", default=14, show_default=True)
@click.option("--limit", default=30, show_default=True)
@click.option("--profile", default="master_profile", show_default=True)
def search_and_score(track: str, days: int, limit: int, profile: str):
    """Search vacancies for TRACK, score them, write CSV+MD report."""
    from langchain_google_genai import ChatGoogleGenerativeAI

    from src.graphs.search_and_score import run_search
    from src.scoring import make_scorer
    from src.settings import load_settings

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
    from src.graphs.adapt_cv import run_adapt_cv

    profile_path, out_dir = resolve_profile(profile)
    cv_path = run_adapt_cv(vacancy_id, out_dir=out_dir, profile_path=profile_path)
    click.echo(f"CV written: {cv_path}")


@cli.command("match")
@click.option("--track", type=click.Choice(TRACK_CHOICES), required=True)
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
        from src.graphs.adapt_cv import run_adapt_cv
        cv_path = run_adapt_cv(vacancy.id, out_dir=out_dir,
                               profile_path=profile_path)
        click.echo(f"CV written: {cv_path}")


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
    track_names = ([t.strip() for t in tracks.split(",")] if tracks
                   else list(TRACK_CHOICES))
    unknown = [t for t in track_names if t not in TRACK_CHOICES]
    if unknown:
        raise SystemExit(
            f"Unknown track(s): {', '.join(unknown)}. "
            f"Configured tracks: {', '.join(TRACK_CHOICES)}.")
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


if __name__ == "__main__":
    cli()
