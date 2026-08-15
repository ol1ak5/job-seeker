import datetime

import httpx
import pytest

from src.match import (fetch_vacancy_url, next_manual_id, parse_vacancy_text,
                       run_match)
from src.models import Score

TODAY = datetime.date(2026, 8, 15)
GOOD = Score(score=80, verdict="strong_match", matching_points=["m"],
             gaps=["g"], flags=[])


def test_parse_vacancy_text_structured():
    v = parse_vacancy_text("Energy Analyst\nAurora\nModel Iberian power prices.\nMore.")
    assert v.title == "Energy Analyst" and v.company == "Aurora"
    assert v.description.startswith("Model Iberian")
    assert v.source == "manual"


def test_parse_vacancy_text_blob():
    v = parse_vacancy_text("just one line of text")
    assert v.title == "Manual vacancy" and v.company == "Unknown"
    assert v.description == "just one line of text"


def test_fetch_vacancy_url():
    html = "<html><title>ML Engineer - Acme</title><body><p>" + "Build agents. " * 30 + "</p></body></html>"
    client = httpx.Client(transport=httpx.MockTransport(
        lambda req: httpx.Response(200, text=html)))
    v = fetch_vacancy_url("https://acme.com/job", client)
    assert v.title == "ML Engineer - Acme"
    assert "Build agents." in v.description
    assert v.url == "https://acme.com/job"


def test_fetch_vacancy_url_too_little_text():
    client = httpx.Client(transport=httpx.MockTransport(
        lambda req: httpx.Response(200, text="<html><body>JS app</body></html>")))
    with pytest.raises(SystemExit) as exc:
        fetch_vacancy_url("https://spa.com/job", client)
    assert "--file" in str(exc.value)


def test_next_manual_id_increments(tmp_path):
    assert next_manual_id("energy", TODAY, tmp_path) == "energy-0815-m01"
    (tmp_path / "energy-0815-m01.json").write_text("{}")
    assert next_manual_id("energy", TODAY, tmp_path) == "energy-0815-m02"
    (tmp_path / "energy-0815-m03.json").write_text("{}")
    assert next_manual_id("energy", TODAY, tmp_path) == "energy-0815-m04"


def test_run_match_caches_and_scores(tmp_path):
    v = parse_vacancy_text("Energy Analyst\nAurora\nModel power prices.")
    out_v, score = run_match("energy", v, lambda p, g, vac: GOOD,
                             "profile/master_profile.yaml", tmp_path, TODAY)
    assert out_v.id == "energy-0815-m01"
    assert (tmp_path / "cache" / "energy-0815-m01.json").exists()
    assert score == GOOD
