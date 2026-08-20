import datetime
import pathlib
from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from src.config import load_tracks, load_watchlist
from src.dedupe import assign_ids, dedupe_in_run, filter_by_age, filter_seen
from src.filters import RELAXATIONS, apply_filters, relax
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
    candidates: list[Vacancy]
    relaxations: int
    dropped: dict
    scored: list[ScoredVacancy]
    md_path: pathlib.Path
    profile_path: str


def _collect_vacancies(track: str, days: int, limit: int, client,
                       errors: list[str]) -> list[Vacancy]:
    cfg = load_tracks()[track]
    settings = load_settings()
    out: list[Vacancy] = []
    try:
        out += search_adzuna(cfg, settings, days, limit, client)
    except Exception as exc:
        errors.append(f"adzuna: {exc}")
    for entry in load_watchlist():
        if track not in entry.tracks:
            continue
        try:
            out += fetch_board(entry, client)
        except Exception as exc:
            errors.append(f"{entry.ats}/{entry.company}: {exc}")
    if settings.rapidapi_key:
        try:
            from src.sources.jsearch import search_jsearch
            out += search_jsearch(cfg, settings.rapidapi_key, days, limit, client)
        except Exception as exc:
            errors.append(f"jsearch: {exc}")
    if settings.tavily_api_key:
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI

            from src.sources.tavily_search import collect as collect_tavily
            extractor = ChatGoogleGenerativeAI(
                model="gemini-flash-latest", google_api_key=settings.google_api_key)
            out += collect_tavily(cfg, settings.tavily_api_key, extractor, client)
        except Exception as exc:
            errors.append(f"tavily: {exc}")
    return out


def search_jobs(state: SearchState) -> dict:
    vacs = _collect_vacancies(state["track"], state["days"], state["limit"],
                              state["client"], state["errors"])
    return {"vacancies": vacs}


def dedupe_filter(state: SearchState) -> dict:
    """Objective removals only: duplicates, stale postings, ones already seen.

    Nothing here is a judgement call, so none of it is ever reconsidered. What
    survives is the pool the selection step draws from, however many times it
    has to draw.
    """
    vacs = dedupe_in_run(state["vacancies"])
    vacs = filter_by_age(vacs, state["days"], state["today"])
    runs_dir = state["out_dir"] / "runs"
    runs_dir.mkdir(parents=True, exist_ok=True)
    vacs = filter_seen(vacs, runs_dir)
    return {"candidates": vacs}


def select(state: SearchState) -> dict:
    """Fill the scoring budget from the pool, at the current strictness."""
    cfg = load_tracks()[state["track"]]
    filters = relax(cfg.filters, state["relaxations"])
    vacs, dropped = apply_filters(state["candidates"], filters)
    vacs = assign_ids(vacs, state["track"], state["today"])[: state["limit"]]
    for v in vacs:
        cache_vacancy(v, state["out_dir"] / "cache")
    return {"vacancies": vacs, "dropped": dropped}


def loosen(state: SearchState) -> dict:
    return {"relaxations": state["relaxations"] + 1}


def enough_found(state: SearchState) -> str:
    """Whether to score what we have, or give up a keyword list and re-select.

    The budget is the same either way - selection is capped at `limit`, so a
    looser pass fills the quota rather than enlarging it. Coming back costs no
    API call and no extra scoring; it only changes which vacancies fill it.
    """
    if len(state["vacancies"]) >= state["limit"]:
        return "score_match"
    if state["relaxations"] >= len(RELAXATIONS):
        return "score_match"
    return "loosen"


def score_match(state: SearchState) -> dict:
    cfg = load_tracks()[state["track"]]
    profile_text = profile_to_text(load_profile(state["profile_path"]), cfg)
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
             state["errors"], dropped=state.get("dropped"))

    from src.storage import save_results

    save_results(state["track"], state["scored"], state["errors"],
                 days=state["days"], limit=state["limit"],
                 dropped=state.get("dropped"))

    return {"md_path": base.with_suffix(".md")}


def build_graph():
    g = StateGraph(SearchState)
    g.add_node("search_jobs", search_jobs)
    g.add_node("dedupe_filter", dedupe_filter)
    g.add_node("select", select)
    g.add_node("loosen", loosen)
    g.add_node("score_match", score_match)
    g.add_node("write_output", write_output)
    g.add_edge(START, "search_jobs")
    g.add_edge("search_jobs", "dedupe_filter")
    g.add_edge("dedupe_filter", "select")
    # the one decision in the run: score what we have, or give up a keyword
    # list and select again from the same pool
    g.add_conditional_edges("select", enough_found,
                            {"loosen": "loosen", "score_match": "score_match"})
    g.add_edge("loosen", "select")
    g.add_edge("score_match", "write_output")
    g.add_edge("write_output", END)
    return g.compile()


def run_search(track: str, days: int, limit: int, scorer,
               out_dir: pathlib.Path = pathlib.Path("output"),
               today: datetime.date | None = None,
               client=None, profile_path: str = "profile/master_profile.yaml") -> pathlib.Path:
    result = build_graph().invoke({
        "track": track, "days": days, "limit": limit,
        "today": today or datetime.date.today(),
        "out_dir": out_dir, "scorer": scorer, "client": client,
        "errors": [], "vacancies": [], "candidates": [], "relaxations": 0,
        "dropped": {}, "scored": [],
        "profile_path": profile_path,
    })
    return result["md_path"]
