import datetime
import pathlib

from src.graphs.search_and_score import run_search
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
    monkeypatch.setattr("src.graphs.search_and_score._collect_vacancies",
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
    monkeypatch.setattr("src.graphs.search_and_score._collect_vacancies",
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
    import src.graphs.search_and_score as sas
    real_load = sas.load_profile
    monkeypatch.setattr(sas, "load_profile",
                        lambda path="profile/example_profile.yaml":
                        (seen_paths.append(path) or real_load(path)))
    monkeypatch.setattr("src.graphs.search_and_score._collect_vacancies",
                        lambda track, days, limit, client, errors: [
                            Vacancy(title="T", company="C", url="u",
                                    source="adzuna", description="d")])
    run_search("energy", days=14, limit=30, scorer=fake_scorer,
               out_dir=tmp_path, today=datetime.date(2026, 8, 15),
               profile_path=str(alt))
    assert seen_paths == [str(alt)]


# ------------------------------------------------- the loop that stops "nothing found" --

def test_selection_loosens_until_the_budget_is_filled(monkeypatch, tmp_path):
    """A too-strict keyword list must cost results, not produce an empty run."""
    import src.graphs.search_and_score as graph
    from src.config import TrackConfig, TrackFilters
    from src.models import Vacancy

    strict = TrackConfig(name="t", filters=TrackFilters(
        title_include=["quantum"],          # matches nothing below
        max_years_experience=1,
        domain_include=["energy"],
        max_per_company=99))
    monkeypatch.setattr(graph, "load_tracks", lambda *_, **__: {"t": strict})

    pool = [Vacancy(title=f"Energy Analyst {i}", company=f"C{i}", location="Madrid",
                    url=f"https://job/{i}", source="s",
                    description="energy markets, 6+ years of experience")
            for i in range(12)]

    state = {"track": "t", "days": 14, "limit": 30,
             "today": datetime.date(2026, 8, 15),
             "out_dir": tmp_path, "candidates": pool, "relaxations": 0}

    first = graph.select(state)
    assert first["vacancies"] == []                       # strict pass finds nothing
    assert graph.enough_found({**state, **first}) == "loosen"

    state["relaxations"] = graph.loosen(state)["relaxations"]
    second = graph.select(state)
    assert len(second["vacancies"]) == 12
    # twelve good ones is a useful answer; it does not keep loosening to reach 30
    assert graph.enough_found({**state, **second}) == "score_match"


def test_loosening_stops_at_a_useful_result_not_a_full_one(tmp_path):
    """Padding a quota with leftovers is what put a cyber role on an energy list."""
    import src.graphs.search_and_score as graph

    assert graph.enough_to_be_useful(30) == 10
    assert graph.enough_to_be_useful(9) == 8       # never demands more than it can use
    thin = {"vacancies": list(range(9)), "limit": 30, "relaxations": 0}
    full_enough = {"vacancies": list(range(10)), "limit": 30, "relaxations": 0}
    assert graph.enough_found(thin) == "loosen"
    assert graph.enough_found(full_enough) == "score_match"


def test_loosening_stops_rather_than_looping_forever():
    import src.graphs.search_and_score as graph
    from src.filters import RELAXATIONS

    exhausted = {"vacancies": [], "limit": 30, "relaxations": len(RELAXATIONS)}
    assert graph.enough_found(exhausted) == "score_match"


def test_the_graph_really_has_the_loop_wired():
    """The conditional edge is the reason LangGraph is here at all."""
    import src.graphs.search_and_score as graph

    compiled = graph.build_graph()
    edges = compiled.get_graph()
    names = {n for n in edges.nodes}
    assert {"select", "loosen"} <= names
    assert any(e.source == "loosen" and e.target == "select" for e in edges.edges)
