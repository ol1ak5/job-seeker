import datetime
import html
import re

import httpx

from src.config import WatchlistEntry
from src.models import Vacancy

URLS = {
    "greenhouse": "https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true",
    "lever": "https://api.lever.co/v0/postings/{token}?mode=json",
    "ashby": "https://api.ashbyhq.com/posting-api/job-board/{token}",
}


def _strip_html(text: str) -> str:
    text = html.unescape(text or "")
    text = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", text)
    return re.sub(r"<[^>]+>", " ", text).strip()


def _iso_date(raw: str | None) -> datetime.date | None:
    if not raw:
        return None
    return datetime.datetime.fromisoformat(raw.replace("Z", "+00:00")).date()


def _parse_greenhouse(data: dict, entry: WatchlistEntry) -> list[Vacancy]:
    return [Vacancy(
        title=j.get("title", ""),
        company=entry.company,
        location=(j.get("location") or {}).get("name", ""),
        posted=_iso_date(j.get("updated_at")),
        url=j.get("absolute_url", ""),
        source="greenhouse",
        description=_strip_html(j.get("content", "")),
    ) for j in data.get("jobs", [])]


def _parse_lever(data: list, entry: WatchlistEntry) -> list[Vacancy]:
    out = []
    for j in data:
        ts = j.get("createdAt")
        posted = (datetime.datetime.fromtimestamp(ts / 1000, tz=datetime.UTC).date()
                  if ts else None)
        out.append(Vacancy(
            title=j.get("text", ""),
            company=entry.company,
            location=(j.get("categories") or {}).get("location", ""),
            posted=posted,
            url=j.get("hostedUrl", ""),
            source="lever",
            description=j.get("descriptionPlain") or _strip_html(j.get("description", "")),
        ))
    return out


def _parse_ashby(data: dict, entry: WatchlistEntry) -> list[Vacancy]:
    return [Vacancy(
        title=j.get("title", ""),
        company=entry.company,
        location=j.get("location", ""),
        remote=j.get("isRemote"),
        posted=_iso_date(j.get("publishedAt")),
        url=j.get("jobUrl") or j.get("applyUrl", ""),
        source="ashby",
        description=j.get("descriptionPlain") or _strip_html(j.get("descriptionHtml", "")),
    ) for j in data.get("jobs", [])]


PARSERS = {"greenhouse": _parse_greenhouse, "lever": _parse_lever, "ashby": _parse_ashby}


def fetch_board(entry: WatchlistEntry,
                client: httpx.Client | None = None) -> list[Vacancy]:
    client = client or httpx.Client(timeout=30, follow_redirects=True)
    resp = client.get(URLS[entry.ats].format(token=entry.board_token))
    resp.raise_for_status()
    return PARSERS[entry.ats](resp.json(), entry)
