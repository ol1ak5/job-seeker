import csv
import datetime

from src.dedupe import assign_ids, dedupe_in_run, filter_by_age, filter_seen
from src.models import Vacancy

TODAY = datetime.date(2026, 8, 15)


def vac(title="T", company="C", posted=None):
    return Vacancy(title=title, company=company, url="u", source="s", posted=posted)


def test_dedupe_in_run_normalizes():
    out = dedupe_in_run([vac("AI Engineer", "Acme"), vac("ai engineer ", "ACME"), vac("Other", "Acme")])
    assert len(out) == 2


def test_filter_by_age_keeps_unknown_and_recent():
    recent = vac(posted=datetime.date(2026, 8, 10))
    old = vac(title="Old", posted=datetime.date(2026, 7, 1))
    unknown = vac(title="Unknown")
    out = filter_by_age([recent, old, unknown], days=14, today=TODAY)
    assert {v.title for v in out} == {"T", "Unknown"}


def test_filter_seen_reads_prior_csvs(tmp_path):
    with open(tmp_path / "2026-08-14_ai.csv", "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["id", "title", "company"])
        w.writeheader()
        w.writerow({"id": "ai-0814-01", "title": "AI Engineer", "company": "Acme"})
    out = filter_seen([vac("AI engineer", "acme"), vac("New Role", "Acme")], tmp_path)
    assert [v.title for v in out] == ["New Role"]


def test_assign_ids_newest_first():
    a = vac("A", posted=datetime.date(2026, 8, 1))
    b = vac("B", posted=datetime.date(2026, 8, 14))
    c = vac("C")  # unknown date -> last
    out = assign_ids([a, b, c], track="ai", today=TODAY)
    assert [(v.id, v.title) for v in out] == [
        ("ai-0815-01", "B"), ("ai-0815-02", "A"), ("ai-0815-03", "C")]
