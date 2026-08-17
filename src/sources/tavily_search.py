import json
import re

import httpx

from src.config import TrackConfig
from src.models import Vacancy
from src.prompts.extract_jobs import EXTRACT_JOBS_PROMPT

SEARCH_URL = "https://api.tavily.com/search"


def search_pages(queries: list[str], api_key: str, max_results: int = 5,
                 client: httpx.Client | None = None) -> list[dict]:
    client = client or httpx.Client(timeout=40)
    pages: list[dict] = []
    seen: set[str] = set()
    for query in queries:
        response = client.post(SEARCH_URL, json={
            "api_key": api_key, "query": query, "max_results": max_results,
            "search_depth": "basic", "include_raw_content": True})
        if response.status_code != 200:
            continue
        for item in response.json().get("results", []):
            url = item.get("url", "")
            if not url or url in seen:
                continue
            seen.add(url)
            pages.append({
                "url": url,
                "title": item.get("title", ""),
                "content": (item.get("raw_content") or item.get("content") or "")[:12000],
            })
    return pages


def _parse_jobs(raw: str) -> list[dict]:
    text = str(raw).strip()
    fenced = re.search(r"```(?:json)?\s*(.*?)```", text, re.S)
    if fenced:
        text = fenced.group(1).strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return []
    return data if isinstance(data, list) else []


def extract_vacancies(pages: list[dict], llm) -> list[Vacancy]:
    vacancies: list[Vacancy] = []
    for page in pages:
        messages = EXTRACT_JOBS_PROMPT.format_messages(
            url=page["url"], title=page["title"], content=page["content"])
        reply = llm.invoke(messages)
        for item in _parse_jobs(getattr(reply, "content", reply)):
            if not isinstance(item, dict) or not item.get("title"):
                continue
            vacancies.append(Vacancy(
                title=item.get("title", ""),
                company=item.get("company") or "Unknown",
                location=item.get("location") or "",
                url=item.get("url") or page["url"],
                source="tavily",
                description=item.get("description") or "",
            ))
    return vacancies


def collect(cfg: TrackConfig, api_key: str, llm,
            client: httpx.Client | None = None) -> list[Vacancy]:
    if not (api_key and cfg.tavily_queries):
        return []
    return extract_vacancies(search_pages(cfg.tavily_queries, api_key, client=client), llm)
