import pytest

from src.config import (TrackConfig, load_db_tracks, load_tracks,
                        load_watchlist, reset_tracks, track_from_row,
                        use_tracks)
from src.models import Score, ScoredVacancy, Vacancy


@pytest.fixture(autouse=True)
def _no_override():
    """One test's installed tracks must not leak into the next."""
    reset_tracks()
    yield
    reset_tracks()


def test_vacancy_defaults():
    v = Vacancy(title="Analyst", company="ERM", url="https://x", source="adzuna")
    assert v.id == "" and v.remote is None and v.description == ""


def test_score_verdict_validated():
    s = Score(score=80, verdict="strong_match", matching_points=["a"], gaps=[], flags=[])
    assert ScoredVacancy(vacancy=Vacancy(title="t", company="c", url="u", source="s"), score=s).score.score == 80


def test_load_tracks_has_both_tracks():
    tracks = load_tracks()
    assert set(tracks) == {"energy", "ai"}
    assert tracks["energy"].adzuna_country == "es"
    assert tracks["ai"].adzuna_country == "us"
    assert "M&A" in tracks["energy"].scoring_guidance
    assert len(tracks["energy"].queries) >= 4
    assert "Projects" in tracks["ai"].cv_sections
    assert tracks["energy"].filters.max_per_company == 5
    assert tracks["energy"].filters.max_years_experience == 4
    assert "director" in tracks["ai"].filters.title_exclude


def test_load_watchlist_parses():
    wl = load_watchlist()
    assert isinstance(wl, list)  # may be empty until Task 11 seeds it


# ------------------------------------------------- settings saved on the site --

class FakeTable:
    """Enough of the Supabase query builder to record what was asked for."""

    def __init__(self, rows):
        self.rows = rows
        self.filters = {}

    def select(self, *_):
        return self

    def eq(self, column, value):
        self.filters[column] = value
        return self

    def execute(self):
        return type("Result", (), {"data": self.rows})()


class FakeClient:
    def __init__(self, rows):
        self.table_obj = FakeTable(rows)

    def table(self, name):
        self.table_name = name
        return self.table_obj


def test_track_from_row_uses_the_same_shape_as_yaml():
    """A database row is one YAML block, so one model parses both."""
    row = {"name": "energy", "data": {
        "adzuna_country": "es",
        "queries": ["energy analyst"],
        "filters": {"locations": ["madrid"], "title_include": ["analyst"]},
    }}
    cfg = track_from_row(row)
    assert cfg.name == "energy"
    assert cfg.queries == ["energy analyst"]
    assert cfg.filters.locations == ["madrid"]


def test_track_from_row_tolerates_a_half_filled_form():
    """Nothing in the form is mandatory except the name."""
    cfg = track_from_row({"name": "new-track", "data": {}})
    assert cfg.queries == [] and cfg.scoring_guidance == ""


def test_load_db_tracks_reads_only_this_users_enabled_rows():
    client = FakeClient([{"name": "energy", "data": {"adzuna_country": "es"}}])
    tracks = load_db_tracks(client, "user-123")
    assert set(tracks) == {"energy"}
    assert client.table_name == "tracks"
    assert client.table_obj.filters == {"user_id": "user-123", "enabled": True}


def test_load_db_tracks_empty_when_the_user_saved_nothing():
    assert load_db_tracks(FakeClient([]), "user-123") == {}


def test_use_tracks_overrides_the_yaml_file_everywhere():
    """The graph calls load_tracks() in four places; one install covers them all."""
    use_tracks({"custom": TrackConfig(name="custom", adzuna_country="fr")})
    assert set(load_tracks()) == {"custom"}
    reset_tracks()
    assert set(load_tracks()) == {"energy", "ai"}
