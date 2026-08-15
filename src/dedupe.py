import csv
import datetime
import pathlib

from src.models import Vacancy


def _key(title: str, company: str) -> tuple[str, str]:
    return title.strip().lower(), company.strip().lower()


def dedupe_in_run(vacancies: list[Vacancy]) -> list[Vacancy]:
    seen: set[tuple[str, str]] = set()
    out = []
    for v in vacancies:
        k = _key(v.title, v.company)
        if k not in seen:
            seen.add(k)
            out.append(v)
    return out


def filter_by_age(vacancies: list[Vacancy], days: int,
                  today: datetime.date) -> list[Vacancy]:
    cutoff = today - datetime.timedelta(days=days)
    return [v for v in vacancies if v.posted is None or v.posted >= cutoff]


def filter_seen(vacancies: list[Vacancy],
                runs_dir: pathlib.Path) -> list[Vacancy]:
    seen: set[tuple[str, str]] = set()
    for path in sorted(pathlib.Path(runs_dir).glob("*.csv")):
        with open(path, newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                seen.add(_key(row.get("title", ""), row.get("company", "")))
    return [v for v in vacancies if _key(v.title, v.company) not in seen]


def assign_ids(vacancies: list[Vacancy], track: str,
               today: datetime.date) -> list[Vacancy]:
    ordered = sorted(
        vacancies,
        key=lambda v: (v.posted is None, -(v.posted.toordinal() if v.posted else 0)),
    )
    stamp = today.strftime("%m%d")
    out = []
    for i, v in enumerate(ordered, start=1):
        out.append(v.model_copy(update={"id": f"{track}-{stamp}-{i:02d}"}))
    return out
