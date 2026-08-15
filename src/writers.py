import csv
import pathlib

from src.models import ScoredVacancy, Vacancy

CSV_COLUMNS = ["id", "score", "verdict", "title", "company", "location",
               "remote", "posted", "salary", "url", "source"]


def sort_scored(scored: list[ScoredVacancy]) -> list[ScoredVacancy]:
    return sorted(scored,
                  key=lambda s: -1 if s.score is None else s.score.score,
                  reverse=True)


def write_csv(scored: list[ScoredVacancy], path: pathlib.Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
        w.writeheader()
        for item in sort_scored(scored):
            v = item.vacancy
            w.writerow({
                "id": v.id,
                "score": "n/a" if item.score is None else item.score.score,
                "verdict": "" if item.score is None else item.score.verdict,
                "title": v.title, "company": v.company, "location": v.location,
                "remote": "" if v.remote is None else v.remote,
                "posted": v.posted.isoformat() if v.posted else "",
                "salary": v.salary or "", "url": v.url, "source": v.source,
            })


def write_md(scored: list[ScoredVacancy], path: pathlib.Path, track: str,
             errors: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [f"# Run report — track `{track}`", ""]
    if errors:
        lines += ["## Source problems", *[f"- {e}" for e in errors], ""]
    lines.append(f"{len(scored)} vacancies. Sorted by score.\n")
    for item in sort_scored(scored):
        v = item.vacancy
        score_txt = "n/a" if item.score is None else f"{item.score.score}/100 — {item.score.verdict}"
        lines.append(f"## [{v.id}] {v.title} @ {v.company} — {score_txt}")
        meta = [v.location or "location n/a",
                f"posted {v.posted.isoformat()}" if v.posted else "posted n/a",
                v.salary or "salary n/a", v.source, v.url]
        lines.append(" | ".join(meta))
        if item.score:
            lines.append("\n**Matches:**")
            lines += [f"- {m}" for m in item.score.matching_points]
            lines.append("\n**Gaps:**")
            lines += [f"- {g}" for g in item.score.gaps]
            if item.score.flags:
                lines.append("\n**Flags:**")
                lines += [f"- {fl}" for fl in item.score.flags]
        lines.append("")
    path.write_text("\n".join(lines))


def cache_vacancy(vacancy: Vacancy, cache_dir: pathlib.Path) -> None:
    cache_dir.mkdir(parents=True, exist_ok=True)
    (cache_dir / f"{vacancy.id}.json").write_text(vacancy.model_dump_json(indent=2))


def load_cached_vacancy(vacancy_id: str, cache_dir: pathlib.Path) -> Vacancy:
    path = cache_dir / f"{vacancy_id}.json"
    if not path.exists():
        raise SystemExit(
            f"No cached vacancy '{vacancy_id}' in {cache_dir}. "
            f"Run search-and-score first; ids appear in the run CSV.")
    return Vacancy.model_validate_json(path.read_text())
