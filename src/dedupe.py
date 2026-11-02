import csv
import datetime
import pathlib
import re

from src.models import Vacancy

# Employers post one role several times, once per language they also want:
# "Analyst" and "Analyst (Icelandic Speaker)". The note is dropped from the key
# so the copies count as one vacancy.
_LANGUAGE_WORDS = r"speaker|speaking|speaks|fluent|native|language"
_LANGUAGE_NOTE = re.compile(
    rf"\s*[(\[][^)\]]*\b(?:{_LANGUAGE_WORDS})\b[^)\]]*[)\]]"
    rf"|\s+[-–|]\s+[^-–|]*\b(?:{_LANGUAGE_WORDS})\b[^-–|]*$",
    re.IGNORECASE)


def _key(title: str, company: str) -> tuple[str, str]:
    title = " ".join(_LANGUAGE_NOTE.sub("", title).split())
    return title.lower(), company.strip().lower()


def dedupe_in_run(vacancies: list[Vacancy]) -> list[Vacancy]:
    kept: dict[tuple[str, str], Vacancy] = {}
    for v in vacancies:
        k = _key(v.title, v.company)
        # Of the language copies, keep the one without the extra requirement.
        if k not in kept or len(v.title.strip()) < len(kept[k].title.strip()):
            kept[k] = v
    return list(kept.values())


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
