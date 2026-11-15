"""Find vacancies for one track, keep the ones worth reading, score them.

    collect -> dedupe -> select (loosening if too few) -> score -> write

Every step is a plain function. The only decision in the run is whether the
selection is too thin to be useful, in which case the filters give up one
keyword list and the same pool is selected again.
"""

import datetime
import pathlib
import time

from src.config import TrackConfig, load_tracks, load_watchlist
from src.dedupe import assign_ids, dedupe_in_run, filter_by_age, filter_seen
from src.filters import (RELAXATIONS, apply_filters,
                         authorisation_note, relax)
from src.models import ScoredVacancy, Vacancy
from src.profile import load_profile, profile_to_text
from src import gemini
from src.scoring import score_with_retry
from src.settings import load_settings
from src.sources.adzuna import search_adzuna
from src.sources.ats_boards import fetch_board
from src.writers import cache_vacancy, write_csv, write_md


def log(message: str) -> None:
    """A progress line. Flushed, so a runner's log shows it as it happens."""
    print(message, flush=True)


def _collect_vacancies(track: str, days: int, limit: int, client,
                       errors: list[str]) -> list[Vacancy]:
    cfg = load_tracks()[track]
    settings = load_settings()
    out: list[Vacancy] = []

    def gather(source: str, fetch) -> None:
        started = time.monotonic()
        try:
            found = fetch()
        except Exception as exc:
            errors.append(f"{source}: {exc}")
            log(f"{source}: failed after {time.monotonic() - started:.0f} s ({str(exc)[:150]})")
            return
        out.extend(found)
        log(f"{source}: {len(found)} found in {time.monotonic() - started:.0f} s")

    gather("adzuna", lambda: search_adzuna(cfg, settings, days, limit, client))
    for entry in load_watchlist():
        if track not in entry.tracks:
            continue
        gather(f"{entry.ats}/{entry.company}", lambda entry=entry: fetch_board(entry, client))
    if settings.rapidapi_key:
        from src.sources.jsearch import search_jsearch
        gather("jsearch", lambda: search_jsearch(cfg, settings.rapidapi_key, days, limit, client))
    if settings.tavily_api_key:
        from langchain_google_genai import ChatGoogleGenerativeAI

        from src.sources.tavily_search import collect as collect_tavily
        extractor = ChatGoogleGenerativeAI(
            model="gemini-flash-latest", google_api_key=settings.google_api_key,
            timeout=60, max_retries=0)
        gather("tavily", lambda: collect_tavily(cfg, settings.tavily_api_key, extractor, client))
    return out


def dedupe(vacancies: list[Vacancy], days: int, today: datetime.date,
           out_dir: pathlib.Path) -> list[Vacancy]:
    """Objective removals only: duplicates, stale postings, ones already seen.

    Nothing here is a judgement call, so none of it is ever reconsidered. What
    survives is the pool the selection step draws from, however many times it
    has to draw.
    """
    vacs = dedupe_in_run(vacancies)
    vacs = filter_by_age(vacs, days, today)
    runs_dir = out_dir / "runs"
    runs_dir.mkdir(parents=True, exist_ok=True)
    return filter_seen(vacs, runs_dir)


def select(pool: list[Vacancy], cfg: TrackConfig, track: str, relaxations: int,
           limit: int, today: datetime.date,
           out_dir: pathlib.Path) -> tuple[list[Vacancy], dict]:
    """Fill the scoring budget from the pool, at the given strictness."""
    filters = relax(cfg.filters, relaxations)
    vacs, dropped = apply_filters(pool, filters)
    vacs = assign_ids(vacs, track, today)[:limit]
    for v in vacs:
        cache_vacancy(v, out_dir / "cache")
    return vacs, dropped


def enough_to_be_useful(limit: int) -> int:
    """How thin a result has to be before loosening is worth its cost.

    Not `limit`. Loosening to fill a thirty-slot quota means the last slots get
    whatever is left over, and the run pays a model call for each - the first
    version of this did exactly that and put a cyber security role on an energy
    list. A short list of the right things beats a full list padded with the
    wrong ones.
    """
    return max(8, limit // 3)


def select_with_loosening(pool: list[Vacancy], cfg: TrackConfig, track: str,
                          limit: int, today: datetime.date,
                          out_dir: pathlib.Path) -> tuple[list[Vacancy], dict]:
    """Select, and while the result is too thin, give up a keyword list and retry.

    Coming back costs no API call: the pool is already collected. It costs
    relevance, which is why the bar for doing it is emptiness, not fullness.
    """
    for relaxations in range(len(RELAXATIONS) + 1):
        vacs, dropped = select(pool, cfg, track, relaxations, limit, today, out_dir)
        if len(vacs) >= enough_to_be_useful(limit):
            break
    return vacs, dropped


def score(vacancies: list[Vacancy], cfg: TrackConfig, scorer,
          profile_path: str, errors: list[str] | None = None,
          notes: list[str] | None = None) -> list[ScoredVacancy]:
    """Score each vacancy, returning the ones to save.

    A vacancy whose scoring failed is left out: saved, it would count as seen
    and never be scored, while left out the next search simply tries again.
    Once Gemini's daily quota is spent the rest are kept without a score, so
    the search still shows what it found, and the next search scores them
    first (see src.worker.score_unscored).

    `notes` collects what the person who asked for the search should be told.
    """
    profile_text = profile_to_text(load_profile(profile_path), cfg)
    scored = []
    failed = 0
    for i, v in enumerate(vacancies, start=1):
        started = time.monotonic()
        try:
            result = score_with_retry(scorer, profile_text, cfg.scoring_guidance, v)
        except gemini.QuotaExhausted as exc:
            rest = vacancies[i - 1:]
            log(f"Gemini quota reached: {len(rest)} saved without a score ({exc})")
            if errors is not None:
                errors.append(f"gemini: quota reached ({exc})")
            if notes is not None and gemini.QUOTA_NOTE not in notes:
                notes.append(gemini.QUOTA_NOTE)
            scored.extend(ScoredVacancy(vacancy=u, score=None) for u in rest)
            break
        log(f"Scored {i}/{len(vacancies)} in {time.monotonic() - started:.0f} s: "
            f"{result.score if result else 'no score'} - {v.title[:60]} at {v.company[:40]}")
        if result is None:
            failed += 1
            continue
        # A paperwork warning the model may not have thought to raise. It goes
        # first because it decides whether the rest is worth reading.
        note = authorisation_note(v, cfg.filters)
        if result and note and note not in result.flags:
            result.flags.insert(0, note)
        scored.append(ScoredVacancy(vacancy=v, score=result))
    if failed:
        log(f"{failed} could not be scored and are left for the next search")
    return scored


def write_output(scored: list[ScoredVacancy], track: str, days: int, limit: int,
                 today: datetime.date, out_dir: pathlib.Path,
                 errors: list[str], dropped: dict) -> pathlib.Path:
    base = out_dir / "runs" / f"{today.isoformat()}_{track}"
    write_csv(scored, base.with_suffix(".csv"))
    write_md(scored, base.with_suffix(".md"), track, errors, dropped=dropped)

    from src.storage import save_results

    save_results(track, scored, errors, days=days, limit=limit, dropped=dropped)
    return base.with_suffix(".md")


def run_search(track: str, days: int, limit: int, scorer,
               out_dir: pathlib.Path = pathlib.Path("output"),
               today: datetime.date | None = None,
               client=None, profile_path: str = "profile/master_profile.yaml",
               notes: list[str] | None = None) -> pathlib.Path:
    today = today or datetime.date.today()
    errors: list[str] = []
    cfg = load_tracks()[track]

    log(f"Search '{track}': collecting")
    found = _collect_vacancies(track, days, limit, client, errors)
    pool = dedupe(found, days, today, out_dir)
    log(f"{len(found)} found, {len(pool)} new after removing duplicates, "
        f"old postings and ones already saved")
    selected, dropped = select_with_loosening(pool, cfg, track, limit, today, out_dir)
    log(f"{len(selected)} pass the filters and will be scored")
    scored = score(selected, cfg, scorer, profile_path, errors, notes)
    path = write_output(scored, track, days, limit, today, out_dir, errors, dropped)
    log(f"Search '{track}': {len(scored)} saved")
    return path
