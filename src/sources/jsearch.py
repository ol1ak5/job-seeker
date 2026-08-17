import datetime

import httpx

from src.config import TrackConfig
from src.models import Vacancy

URL = "https://jsearch.p.rapidapi.com/search-v2"
HOST = "jsearch.p.rapidapi.com"


def _date_posted(days: int) -> str:
    if days <= 1:
        return "today"
    if days <= 3:
        return "3days"
    if days <= 7:
        return "week"
    return "month"


def _parse_date(raw: str | None) -> datetime.date | None:
    if not raw:
        return None
    try:
        return datetime.datetime.fromisoformat(raw.replace("Z", "+00:00")).date()
    except ValueError:
        return None


def _salary(job: dict) -> str | None:
    low, high = job.get("job_min_salary"), job.get("job_max_salary")
    if low is None and high is None:
        return None
    return f"{int(low or high)}-{int(high or low)}"


def search_jsearch(cfg: TrackConfig, api_key: str, days: int, limit: int,
                   client: httpx.Client | None = None) -> list[Vacancy]:
    if not api_key or not cfg.jsearch_queries:
        return []
    client = client or httpx.Client(timeout=40)
    headers = {"X-RapidAPI-Key": api_key, "X-RapidAPI-Host": HOST}
    per_query = max(1, limit // len(cfg.jsearch_queries))
    out: list[Vacancy] = []
    for query in cfg.jsearch_queries:
        params = {"query": query, "page": "1", "num_pages": "1",
                  "date_posted": _date_posted(days)}
        if cfg.jsearch_country:
            params["country"] = cfg.jsearch_country
        response = client.get(URL, headers=headers, params=params)
        if response.status_code != 200:
            continue
        data = response.json().get("data")
        jobs = data.get("jobs", []) if isinstance(data, dict) else (data or [])
        for job in jobs[:per_query]:
            location = ", ".join(part for part in (job.get("job_city"),
                                                   job.get("job_country")) if part)
            out.append(Vacancy(
                title=job.get("job_title", ""),
                company=job.get("employer_name") or "Unknown",
                location=location,
                remote=job.get("job_is_remote"),
                posted=_parse_date(job.get("job_posted_at_datetime_utc")),
                salary=_salary(job),
                url=job.get("job_apply_link", ""),
                source="jsearch",
                description=job.get("job_description", ""),
            ))
    return out
