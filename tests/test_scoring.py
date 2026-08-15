from src.models import Score, Vacancy
from src.prompts.scoring import SCORING_PROMPT
from src.scoring import score_with_retry

VAC = Vacancy(title="Energy Analyst", company="Aurora", url="u",
              source="adzuna", description="Model power prices in Iberia.")
GOOD = Score(score=85, verdict="strong_match", matching_points=["m"], gaps=[], flags=[])


def test_prompt_includes_all_inputs():
    msgs = SCORING_PROMPT.format_messages(
        profile="PROFILE_TEXT", guidance="GUIDANCE_TEXT",
        title=VAC.title, company=VAC.company, location=VAC.location,
        description=VAC.description)
    joined = " ".join(m.content for m in msgs)
    for token in ("PROFILE_TEXT", "GUIDANCE_TEXT", "Aurora", "power prices"):
        assert token in joined


def test_score_with_retry_success():
    assert score_with_retry(lambda p, g, v: GOOD, "p", "g", VAC) == GOOD


def test_score_with_retry_recovers_once():
    calls = {"n": 0}
    def flaky(p, g, v):
        calls["n"] += 1
        if calls["n"] == 1:
            raise RuntimeError("boom")
        return GOOD
    assert score_with_retry(flaky, "p", "g", VAC) == GOOD


def test_score_with_retry_gives_up():
    def broken(p, g, v):
        raise RuntimeError("boom")
    assert score_with_retry(broken, "p", "g", VAC) is None
