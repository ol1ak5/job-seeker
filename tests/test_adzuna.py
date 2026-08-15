import json

import httpx

from src.config import TrackConfig
from src.settings import Settings
from src.sources.adzuna import search_adzuna

CFG = TrackConfig(name="energy", adzuna_country="es",
                  queries=["energy market analyst", "energy consultant"],
                  scoring_guidance="g", cv_sections="s")
SETTINGS = Settings(adzuna_app_id="id", adzuna_app_key="key", google_api_key="g")

FAKE_RESULT = {
    "results": [{
        "title": "Energy Market Analyst",
        "company": {"display_name": "Aurora Energy Research"},
        "location": {"display_name": "Madrid, Spain"},
        "created": "2026-08-12T10:30:00Z",
        "salary_min": 40000, "salary_max": 50000,
        "redirect_url": "https://adzuna.com/job/1",
        "description": "Model Iberian power prices.",
    }]
}


def make_client(captured):
    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        return httpx.Response(200, json=FAKE_RESULT)
    return httpx.Client(transport=httpx.MockTransport(handler))


def test_search_adzuna_parses_and_queries():
    captured = []
    out = search_adzuna(CFG, SETTINGS, days=14, limit=30, client=make_client(captured))
    assert len(out) == 2  # one fake result per query
    v = out[0]
    assert v.title == "Energy Market Analyst"
    assert v.company == "Aurora Energy Research"
    assert v.posted.isoformat() == "2026-08-12"
    assert v.salary == "40000-50000"
    assert v.source == "adzuna"
    assert len(captured) == 2
    assert "/jobs/es/search/1" in str(captured[0].url)
    params = captured[0].url.params
    assert params["max_days_old"] == "14"
    assert params["app_id"] == "id"


def test_search_adzuna_missing_fields():
    def handler(request):
        return httpx.Response(200, json={"results": [{
            "title": "X", "redirect_url": "https://a", }]})
    client = httpx.Client(transport=httpx.MockTransport(handler))
    out = search_adzuna(CFG, SETTINGS, days=7, limit=10, client=client)
    assert out[0].company == "Unknown"
    assert out[0].posted is None and out[0].salary is None
