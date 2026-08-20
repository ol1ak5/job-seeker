from typing import Literal

import yaml
from pydantic import BaseModel


class TrackFilters(BaseModel):
    title_include: list[str] = []
    domain_include: list[str] = []
    title_exclude: list[str] = []
    function_exclude: list[str] = []
    max_years_experience: int | None = None
    locations: list[str] = []
    allow_remote: bool = True
    remote_terms: list[str] = []
    max_per_company: int = 5


class TrackConfig(BaseModel):
    # Everything but the name is optional: a track created through the website
    # starts as a name and a city, and is filled in over time.
    name: str
    adzuna_country: str = ""
    queries: list[str] = []
    scoring_guidance: str = ""
    cv_sections: str = ""
    filters: TrackFilters = TrackFilters()
    tavily_queries: list[str] = []
    jsearch_queries: list[str] = []
    jsearch_country: str = ""
    master_cv: str = ""


class WatchlistEntry(BaseModel):
    company: str
    ats: Literal["greenhouse", "lever", "ashby"]
    board_token: str
    tracks: list[str]


def load_tracks(path: str = "config/tracks.yaml") -> dict[str, TrackConfig]:
    """The tracks in force right now: the user's saved ones, else the YAML file.

    Four places inside the search graph ask for the configuration while a run is
    in progress. Rather than thread the signed-in user through all of them, the
    CLI installs that user's tracks once at startup with `use_tracks`, and every
    later call here sees them.
    """
    if _INSTALLED is not None:
        return _INSTALLED
    return read_tracks_file(path)


def read_tracks_file(path: str = "config/tracks.yaml") -> dict[str, TrackConfig]:
    """The YAML file itself, whatever else has been installed."""
    with open(path) as f:
        raw = yaml.safe_load(f) or {}
    return {name: TrackConfig(name=name, **cfg) for name, cfg in raw.items()}


# Set by use_tracks() for the length of one CLI run; None means "read the file".
_INSTALLED: dict[str, TrackConfig] | None = None


def use_tracks(tracks: dict[str, TrackConfig]) -> None:
    """Make these tracks the answer to every later load_tracks() call."""
    global _INSTALLED
    _INSTALLED = tracks


def reset_tracks() -> None:
    global _INSTALLED
    _INSTALLED = None


def track_from_row(row: dict) -> TrackConfig:
    """Turn one `tracks` row into the model the rest of the code already uses.

    The jsonb `data` column holds exactly what one YAML block holds, so the
    website and the local file produce identical objects downstream.
    """
    return TrackConfig(name=row["name"], **(row.get("data") or {}))


def load_db_tracks(client, user_id: str) -> dict[str, TrackConfig]:
    """The tracks this user saved on the website. Empty dict if they saved none."""
    result = (client.table("tracks")
              .select("name, data")
              .eq("user_id", user_id)
              .eq("enabled", True)
              .execute())
    return {row["name"]: track_from_row(row) for row in (result.data or [])}


def load_watchlist(path: str = "config/watchlist.yaml") -> list[WatchlistEntry]:
    with open(path) as f:
        raw = yaml.safe_load(f) or []
    return [WatchlistEntry(**e) for e in raw]
