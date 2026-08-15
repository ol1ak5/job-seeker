import datetime
import pathlib
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from src.config import load_tracks, load_watchlist
from src.dedupe import assign_ids, dedupe_in_run, filter_by_age, filter_seen
from src.models import ScoredVacancy, Vacancy
from src.profile import load_profile, profile_to_text
from src.scoring import score_with_retry
from src.settings import load_settings
from src.sources.adzuna import search_adzuna
from src.sources.ats_boards import fetch_board
from src.writers import cache_vacancy, write_csv, write_md


class SearchState(TypedDict):
    track: str
    days: int
    limit: int
    today: datetime.date
    out_dir: pathlib.Path
    scorer: object
    client: object
    errors: list[str]
    vacancies: list[Vacancy]
    scored: list[ScoredVacancy]
    md_path: pathlib.Path


def _collect_vacancies(track: str, days: int, limit: int, client,
                       errors: list[str]) -> list[Vacancy]:
    cfg = load_tracks()[track]
    out: list[Vacancy] = []
    try:
        out += search_adzuna(cfg, load_settings(), days, limit, client)
    except Exception as exc:
        errors.append(f"adzuna: {exc}")
    for entry in load_watchlist():
        if track not in entry.tracks:
            continue
        try:
            out += fetch_board(entry, client)
        except Exception as exc:
            errors.append(f"{entry.ats}/{entry.company}: {exc}")
    return out


def search_jobs(state: SearchState) -> dict:
    vacs = _collect_vacancies(state["track"], state["days"], state["limit"],
                              state["client"], state["errors"])
    return {"vacancies": vacs}


def dedupe_filter(state: SearchState) -> dict:
    vacs = dedupe_in_run(state["vacancies"])
    vacs = filter_by_age(vacs, state["days"], state["today"])
    runs_dir = state["out_dir"] / "runs"
    runs_dir.mkdir(parents=True, exist_ok=True)
    vacs = filter_seen(vacs, runs_dir)
    vacs = assign_ids(vacs, state["track"], state["today"])[: state["limit"]]
    for v in vacs:
        cache_vacancy(v, state["out_dir"] / "cache")
    return {"vacancies": vacs}


def score_match(state: SearchState) -> dict:
    cfg = load_tracks()[state["track"]]
    profile_text = profile_to_text(load_profile(), state["track"])
    scored = [
        ScoredVacancy(
            vacancy=v,
            score=score_with_retry(state["scorer"], profile_text,
                                   cfg.scoring_guidance, v),
        )
        for v in state["vacancies"]
    ]
    return {"scored": scored}


def write_output(state: SearchState) -> dict:
    stamp = state["today"].isoformat()
    base = state["out_dir"] / "runs" / f"{stamp}_{state['track']}"
    write_csv(state["scored"], base.with_suffix(".csv"))
    write_md(state["scored"], base.with_suffix(".md"), state["track"],
             state["errors"])
    return {"md_path": base.with_suffix(".md")}


def build_graph():
    g = StateGraph(SearchState)
    g.add_node("search_jobs", search_jobs)
    g.add_node("dedupe_filter", dedupe_filter)
    g.add_node("score_match", score_match)
    g.add_node("write_output", write_output)
    g.add_edge(START, "search_jobs")
    g.add_edge("search_jobs", "dedupe_filter")
    g.add_edge("dedupe_filter", "score_match")
    g.add_edge("score_match", "write_output")
    g.add_edge("write_output", END)
    return g.compile()


def run_search(track: str, days: int, limit: int, scorer,
               out_dir: pathlib.Path = pathlib.Path("output"),
               today: datetime.date | None = None,
               client=None) -> pathlib.Path:
    result = build_graph().invoke({
        "track": track, "days": days, "limit": limit,
        "today": today or datetime.date.today(),
        "out_dir": out_dir, "scorer": scorer, "client": client,
        "errors": [], "vacancies": [], "scored": [],
    })
    return result["md_path"]
