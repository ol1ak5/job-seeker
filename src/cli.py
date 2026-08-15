import pathlib

import click

from src.config import load_tracks

TRACK_CHOICES = sorted(load_tracks())


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


if __name__ == "__main__":
    cli()
