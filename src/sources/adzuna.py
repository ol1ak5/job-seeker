import datetime

import httpx

from src.config import TrackConfig
from src.models import Vacancy
from src.settings import Settings

BASE = "https://api.adzuna.com/v1/api/jobs"


def _parse_date(raw: str | None) -> datetime.date | None:
    if not raw:
        return None
    return datetime.datetime.fromisoformat(raw.replace("Z", "+00:00")).date()


def _salary(item: dict) -> str | None:
    lo, hi = item.get("salary_min"), item.get("salary_max")
    if lo is None and hi is None:
        return None
    return f"{int(lo or hi)}-{int(hi or lo)}"


def search_adzuna(cfg: TrackConfig, settings: Settings, days: int, limit: int,
                  client: httpx.Client | None = None) -> list[Vacancy]:
    client = client or httpx.Client(timeout=30)
    per_query = max(1, limit // len(cfg.queries))
    out: list[Vacancy] = []
    for query in cfg.queries:
        resp = client.get(
            f"{BASE}/{cfg.adzuna_country}/search/1",
            params={
                "app_id": settings.adzuna_app_id,
                "app_key": settings.adzuna_app_key,
                "what": query,
                "max_days_old": days,
                "results_per_page": per_query,
                "content-type": "application/json",
            },
        )
        resp.raise_for_status()
        for item in resp.json().get("results", []):
            out.append(Vacancy(
                title=item.get("title", ""),
                company=(item.get("company") or {}).get("display_name", "Unknown") or "Unknown",
                location=(item.get("location") or {}).get("display_name", ""),
                posted=_parse_date(item.get("created")),
                salary=_salary(item),
                url=item.get("redirect_url", ""),
                source="adzuna",
                description=item.get("description", ""),
            ))
    return out
