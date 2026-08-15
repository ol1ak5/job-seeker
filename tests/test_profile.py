from src.profile import load_profile, profile_to_text


def test_load_profile():
    p = load_profile()
    assert p["contact"]["name"] == "Olga Aksenova"
    assert {"energy", "ai"} <= set(p["headline"])
    assert p["contact"]["phone"]


def test_energy_view_has_transactions_no_projects():
    p = load_profile()
    text = profile_to_text(p, "energy")
    assert "[redacted]" in text
    assert "Job-Seeker" not in text            # projects are ai-only
    assert "[redacted]" in text                  # finance cert kept
    assert "CS50" not in text                  # ai-only course filtered out
    assert "[redacted]" in text                     # energy bullet variant used
    assert "[redacted]" in text


def test_ai_view_has_projects_no_transactions():
    p = load_profile()
    text = profile_to_text(p, "ai")
    assert "Job-Seeker" in text and "k-means" in text
    assert "[redacted]" not in text
    assert "CS50" in text
    assert "[redacted]" not in text


def test_metric_substitution():
    p = load_profile()
    text = profile_to_text(p, "energy")
    assert "[redacted]" in text                  # {metric} filled
    assert "{metric}" not in text              # empty metrics render clean
