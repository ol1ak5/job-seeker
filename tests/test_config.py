from src.config import load_tracks, load_watchlist
from src.models import Score, ScoredVacancy, Vacancy


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
