import pytest

from src.config import load_tracks
from src.profile import load_profile, profile_to_text

TRACKS = load_tracks()


def test_load_profile():
    p = load_profile()
    assert p["contact"]["name"] == "Olga Aksenova"
    assert p["contact"]["phone"]
    assert {"energy", "ai"} <= set(p["headline"]["variants"])


def test_energy_view_has_transactions_no_projects():
    p = load_profile()
    text = profile_to_text(p, TRACKS["energy"])
    assert "[redacted]" in text
    assert "[redacted]" in text
    assert "Job-Seeker" not in text
    assert "[redacted]" in text
    assert "CS50" not in text
    assert "[redacted]" in text


def test_ai_view_has_projects_no_transactions():
    p = load_profile()
    text = profile_to_text(p, TRACKS["ai"])
    assert "Job-Seeker" in text and "k-means" in text
    assert "[redacted]" not in text
    assert "CS50" in text
    assert "[redacted]" not in text


def test_metric_substitution():
    p = load_profile()
    text = profile_to_text(p, TRACKS["energy"])
    assert "[redacted]" in text
    assert "{metric}" not in text


def test_unknown_track_without_default_exits():
    p = load_profile()
    ghost = TRACKS["energy"].model_copy(update={"name": "marketing"})
    with pytest.raises(SystemExit) as exc:
        profile_to_text(p, ghost)
    assert "marketing" in str(exc.value)
