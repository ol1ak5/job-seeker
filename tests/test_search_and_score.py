import datetime
import pathlib

from src.search_and_score import run_search
from src.models import Score, Vacancy


def fake_scorer(profile_text, guidance, vacancy):
    return Score(score=70, verdict="worth_applying",
                 matching_points=["m"], gaps=["g"], flags=[])


def test_run_search_end_to_end(tmp_path, monkeypatch):
    vacs = [
        Vacancy(title="Energy Analyst", company="Aurora", url="u1",
                source="adzuna", location="Madrid, Spain",
                posted=datetime.date(2026, 8, 12), description="d"),
        Vacancy(title="Energy Analyst", company="Aurora", url="dup",
                source="greenhouse", location="Madrid, Spain", description="d"),
        Vacancy(title="Old Role", company="X", url="u2", source="adzuna",
                location="Madrid, Spain",
                posted=datetime.date(2026, 6, 1), description="d"),
    ]
    monkeypatch.setattr("src.search_and_score._collect_vacancies",
                        lambda track, days, limit, client, errors: vacs)
    md_path = run_search("energy", days=14, limit=30, scorer=fake_scorer,
                         out_dir=tmp_path, today=datetime.date(2026, 8, 15),
                         profile_path="profile/example_profile.yaml")
    assert md_path.exists()
    csv_path = tmp_path / "runs" / "2026-08-15_energy.csv"
    assert csv_path.exists()
    text = csv_path.read_text()
    assert "energy-0815-01" in text and "dup" not in text and "Old Role" not in text
    assert (tmp_path / "cache" / "energy-0815-01.json").exists()
    assert "70/100" in md_path.read_text()


def test_run_search_source_failure_isolated(tmp_path, monkeypatch):
    def failing_collect(track, days, limit, client, errors):
        errors.append("adzuna: HTTP 500")
        return [Vacancy(title="Ok", company="C", url="u", source="lever",
                        description="d")]
    monkeypatch.setattr("src.search_and_score._collect_vacancies",
                        failing_collect)
    md_path = run_search("energy", days=14, limit=30, scorer=fake_scorer,
                         out_dir=tmp_path, today=datetime.date(2026, 8, 15),
                         profile_path="profile/example_profile.yaml")
    assert "Source problems" in md_path.read_text()


def test_run_search_uses_profile_path(tmp_path, monkeypatch):
    import shutil
    alt = tmp_path / "alt_profile.yaml"
    shutil.copy("profile/example_profile.yaml", alt)
    seen_paths = []
    import src.search_and_score as sas
    real_load = sas.load_profile
    monkeypatch.setattr(sas, "load_profile",
                        lambda path="profile/example_profile.yaml":
                        (seen_paths.append(path) or real_load(path)))
    monkeypatch.setattr("src.search_and_score._collect_vacancies",
                        lambda track, days, limit, client, errors: [
                            Vacancy(title="T", company="C", url="u",
                                    source="adzuna", description="d")])
    run_search("energy", days=14, limit=30, scorer=fake_scorer,
               out_dir=tmp_path, today=datetime.date(2026, 8, 15),
               profile_path=str(alt))
    assert seen_paths == [str(alt)]


# ------------------------------------------------- the loop that stops "nothing found" --

def _strict_track():
    from src.config import TrackConfig, TrackFilters

    return TrackConfig(name="t", filters=TrackFilters(
        title_include=["quantum"],          # matches nothing below
        max_years_experience=1,
        domain_include=["energy"],
        max_per_company=99))


def _pool(n):
    return [Vacancy(title=f"Energy Analyst {i}", company=f"C{i}", location="Madrid",
                    url=f"https://job/{i}", source="s",
                    description="energy markets, 6+ years of experience")
            for i in range(n)]


def test_selection_loosens_until_the_budget_is_filled(tmp_path):
    """A too-strict keyword list must cost results, not produce an empty run."""
    import src.search_and_score as pipeline

    cfg, pool, today = _strict_track(), _pool(12), datetime.date(2026, 8, 15)

    strict, _ = pipeline.select(pool, cfg, "t", 0, 30, today, tmp_path)
    assert strict == []                                   # strict pass finds nothing

    loosened, _ = pipeline.select(pool, cfg, "t", 1, 30, today, tmp_path)
    assert len(loosened) == 12

    chosen, _ = pipeline.select_with_loosening(pool, cfg, "t", 30, today, tmp_path)
    # twelve good ones is a useful answer; it does not keep loosening to reach 30
    assert len(chosen) == 12


def test_loosening_stops_at_a_useful_result_not_a_full_one(tmp_path, monkeypatch):
    """Padding a quota with leftovers is what put a cyber role on an energy list."""
    import src.search_and_score as pipeline

    assert pipeline.enough_to_be_useful(30) == 10
    assert pipeline.enough_to_be_useful(9) == 8    # never demands more than it can use

    levels = []
    real_select = pipeline.select

    def spy(pool, cfg, track, relaxations, *rest):
        levels.append(relaxations)
        return real_select(pool, cfg, track, relaxations, *rest)

    monkeypatch.setattr(pipeline, "select", spy)
    pipeline.select_with_loosening(_pool(12), _strict_track(), "t", 30,
                                   datetime.date(2026, 8, 15), tmp_path)
    assert levels == [0, 1]                         # stopped as soon as it had enough


def test_loosening_stops_rather_than_looping_forever(tmp_path, monkeypatch):
    import src.search_and_score as pipeline
    from src.filters import RELAXATIONS

    levels = []
    real_select = pipeline.select

    def spy(pool, cfg, track, relaxations, *rest):
        levels.append(relaxations)
        return real_select(pool, cfg, track, relaxations, *rest)

    monkeypatch.setattr(pipeline, "select", spy)
    chosen, _ = pipeline.select_with_loosening(
        [], _strict_track(), "t", 30, datetime.date(2026, 8, 15), tmp_path)
    assert chosen == []
    assert levels == list(range(len(RELAXATIONS) + 1))


GOOD = Score(score=80, verdict="strong_match", matching_points=[], gaps=[], flags=[])


def test_a_vacancy_without_a_score_is_not_kept(monkeypatch):
    from src import search_and_score
    from src.config import TrackConfig
    from src.models import Vacancy

    monkeypatch.setattr(search_and_score, "load_profile", lambda *_: {})
    monkeypatch.setattr(search_and_score, "profile_to_text", lambda *_: "")
    monkeypatch.setattr(search_and_score, "score_with_retry",
                        lambda _s, _p, _g, v: None if v.title == "Broken" else GOOD)
    vacs = [Vacancy(title=t, company="C", url=t, source="s") for t in ("Good", "Broken")]
    notes: list[str] = []

    kept = search_and_score.score(vacs, TrackConfig(name="energy"), None, "p", notes=notes)

    assert [s.vacancy.title for s in kept] == ["Good"]
    assert notes == []


def test_a_spent_quota_stops_scoring_and_says_so(monkeypatch):
    from src import gemini, search_and_score
    from src.config import TrackConfig
    from src.models import Vacancy

    def refuse(*_):
        raise gemini.QuotaExhausted("per day")

    monkeypatch.setattr(search_and_score, "load_profile", lambda *_: {})
    monkeypatch.setattr(search_and_score, "profile_to_text", lambda *_: "")
    monkeypatch.setattr(search_and_score, "score_with_retry", refuse)
    vacs = [Vacancy(title=t, company="C", url=t, source="s") for t in ("A", "B")]
    notes: list[str] = []

    kept = search_and_score.score(vacs, TrackConfig(name="energy"), None, "p", notes=notes)

    # Kept without a score, so the search still shows what it found.
    assert [(s.vacancy.title, s.score) for s in kept] == [("A", None), ("B", None)]
    assert notes == ["Gemini's daily limit ran out."]
