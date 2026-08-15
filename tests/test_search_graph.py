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
                source="adzuna", posted=datetime.date(2026, 8, 12), description="d"),
        Vacancy(title="Energy Analyst", company="Aurora", url="dup",
                source="greenhouse", description="d"),
        Vacancy(title="Old Role", company="X", url="u2", source="adzuna",
                posted=datetime.date(2026, 6, 1), description="d"),
    ]
    monkeypatch.setattr("src.graphs.search_and_score._collect_vacancies",
                        lambda track, days, limit, client, errors: vacs)
    md_path = run_search("energy", days=14, limit=30, scorer=fake_scorer,
                         out_dir=tmp_path, today=datetime.date(2026, 8, 15))
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
                         out_dir=tmp_path, today=datetime.date(2026, 8, 15))
    assert "Source problems" in md_path.read_text()
