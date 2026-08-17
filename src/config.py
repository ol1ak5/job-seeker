from typing import Literal

import yaml
from pydantic import BaseModel


class TrackFilters(BaseModel):
    title_include: list[str] = []
    title_exclude: list[str] = []
    function_exclude: list[str] = []
    max_years_experience: int | None = None
    locations: list[str] = []
    allow_remote: bool = True
    remote_terms: list[str] = []
    max_per_company: int = 5


class TrackConfig(BaseModel):
    name: str
    adzuna_country: str
    queries: list[str]
    scoring_guidance: str
    cv_sections: str
    filters: TrackFilters = TrackFilters()


class WatchlistEntry(BaseModel):
    company: str
    ats: Literal["greenhouse", "lever", "ashby"]
    board_token: str
    tracks: list[str]


def load_tracks(path: str = "config/tracks.yaml") -> dict[str, TrackConfig]:
    with open(path) as f:
        raw = yaml.safe_load(f) or {}
    return {name: TrackConfig(name=name, **cfg) for name, cfg in raw.items()}


def load_watchlist(path: str = "config/watchlist.yaml") -> list[WatchlistEntry]:
    with open(path) as f:
        raw = yaml.safe_load(f) or []
    return [WatchlistEntry(**e) for e in raw]
