import csv
import datetime

import pytest

from src.models import Score, ScoredVacancy, Vacancy
from src.writers import (cache_vacancy, load_cached_vacancy, sort_scored,
                         write_csv, write_md)


def sv(vid, score):
    v = Vacancy(id=vid, title=f"T{vid}", company="C", url="u", source="adzuna",
                posted=datetime.date(2026, 8, 10), description="desc")
    s = None if score is None else Score(score=score, verdict="stretch",
                                         matching_points=["mp"], gaps=["g"], flags=["f"])
    return ScoredVacancy(vacancy=v, score=s)


def test_sort_scored_none_last():
    out = sort_scored([sv("a", 50), sv("b", None), sv("c", 90)])
    assert [x.vacancy.id for x in out] == ["c", "a", "b"]


def test_write_csv(tmp_path):
    path = tmp_path / "run.csv"
    write_csv([sv("a", 77), sv("b", None)], path)
    rows = list(csv.DictReader(open(path)))
    assert rows[0]["score"] == "77" and rows[1]["score"] == "n/a"
    assert rows[0]["posted"] == "2026-08-10"


def test_write_md(tmp_path):
    path = tmp_path / "run.md"
    write_md([sv("a", 77)], path, track="ai", errors=["adzuna: HTTP 500"])
    text = path.read_text()
    assert "77" in text and "mp" in text and "Source problems" in text


def test_cache_roundtrip(tmp_path):
    v = sv("ai-0815-01", 50).vacancy
    cache_vacancy(v, tmp_path)
    loaded = load_cached_vacancy("ai-0815-01", tmp_path)
    assert loaded == v


def test_cache_missing_exits(tmp_path):
    with pytest.raises(SystemExit):
        load_cached_vacancy("nope-01", tmp_path)
