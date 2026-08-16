from typing import Literal

import yaml
from pydantic import BaseModel


class TrackConfig(BaseModel):
    name: str
    adzuna_country: str
    queries: list[str]
    scoring_guidance: str
    cv_sections: str


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
