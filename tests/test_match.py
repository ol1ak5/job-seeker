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
                             "profile/example_profile.yaml", tmp_path, TODAY)
    assert out_v.id == "energy-0815-m01"
    assert (tmp_path / "cache" / "energy-0815-m01.json").exists()
    assert score == GOOD


def test_match_cli_requires_exactly_one_input(tmp_path):
    from click.testing import CliRunner

    from src.cli import cli

    runner = CliRunner()
    neither = runner.invoke(cli, ["match", "--track", "ai"])
    assert neither.exit_code != 0
    assert "exactly one" in (str(neither.output) + str(neither.exception))

    f = tmp_path / "jd.txt"
    f.write_text("T\nC\nDesc")
    both = runner.invoke(cli, ["match", "--track", "ai", "--file", str(f),
                               "--url", "https://x.com"])
    assert both.exit_code != 0
    assert "exactly one" in (str(both.output) + str(both.exception))


def test_a_hand_matched_vacancy_is_saved_like_a_searched_one(monkeypatch, tmp_path):
    """One destination for both paths: the terminal is not where results live."""
    import datetime

    import src.storage as storage
    from src.match import parse_vacancy_text, run_match
    from src.models import Score

    saved = {}

    def fake_save(track, scored, errors, days=None, limit=None, dropped=None):
        saved["track"] = track
        saved["scored"] = scored
        saved["days"] = days      # None means "no run behind this one"

    monkeypatch.setattr(storage, "save_results", fake_save)

    vacancy = parse_vacancy_text("Energy Analyst\nAurora\nWe need someone.")
    scorer = lambda *_: Score(score=71, verdict="worth_applying",
                              matching_points=["m"], gaps=[], flags=[])
    run_match("energy", vacancy, scorer, "profile/example_profile.yaml",
              tmp_path, datetime.date(2026, 8, 20))

    assert saved["track"] == "energy"
    assert saved["days"] is None
    assert saved["scored"][0].score.score == 71
    assert saved["scored"][0].vacancy.source == "manual"
