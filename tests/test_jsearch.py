import datetime

import httpx

from src.config import TrackConfig
from src.sources.jsearch import search_jsearch

CFG = TrackConfig(name="energy", adzuna_country="es", queries=[], scoring_guidance="g",
                  cv_sections="s", jsearch_queries=["energy analyst Madrid"],
                  jsearch_country="es")

REPLY = {"status": "OK", "data": {"cursor": None, "jobs": [{
    "job_title": "Analyst | Energy",
    "employer_name": "Compass Lexecon",
    "job_city": "Madrid", "job_country": "ES",
    "job_is_remote": False,
    "job_posted_at_datetime_utc": "2026-08-12T09:00:00.000Z",
    "job_apply_link": "https://example.com/job/1",
    "job_description": "Support energy market analysis.",
    "job_min_salary": 40000, "job_max_salary": 50000,
}]}}


def make_client(captured):
    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(200, json=REPLY)
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_search_jsearch_maps_fields_and_params():
    captured = []
    out = search_jsearch(CFG, "key", days=14, limit=30, client=make_client(captured))
    assert len(out) == 1
    v = out[0]
    assert v.title == "Analyst | Energy"
    assert v.company == "Compass Lexecon"
    assert v.location == "Madrid, ES"
    assert v.remote is False
    assert v.posted == datetime.date(2026, 8, 12)
    assert v.salary == "40000-50000"
    assert v.url == "https://example.com/job/1"
    assert v.source == "jsearch"
    params = captured[0].url.params
    assert params["country"] == "es"
    assert params["date_posted"] == "month"
    assert "search-v2" in str(captured[0].url)


def test_search_jsearch_date_posted_window():
    captured = []
    search_jsearch(CFG, "key", days=5, limit=10, client=make_client(captured))
    assert captured[0].url.params["date_posted"] == "week"


def test_search_jsearch_without_key_or_queries():
    assert search_jsearch(CFG, "", days=14, limit=10) == []
    empty = CFG.model_copy(update={"jsearch_queries": []})
    assert search_jsearch(empty, "key", days=14, limit=10) == []


def test_search_jsearch_skips_error_response():
    client = httpx.Client(transport=httpx.MockTransport(
        lambda request: httpx.Response(429, json={"message": "quota"})))
    assert search_jsearch(CFG, "key", days=14, limit=10, client=client) == []


def test_search_jsearch_tolerates_missing_fields():
    reply = {"data": {"jobs": [{"job_title": "X", "job_apply_link": "u"}]}}
    client = httpx.Client(transport=httpx.MockTransport(
        lambda request: httpx.Response(200, json=reply)))
    (v,) = search_jsearch(CFG, "key", days=14, limit=10, client=client)
    assert v.company == "Unknown" and v.posted is None and v.salary is None
