from typing import Callable

from src import gemini
from src.models import Score, Vacancy
from src.prompts.scoring import SCORING_PROMPT

Scorer = Callable[[str, str, Vacancy], Score]


def make_scorer(llm) -> Scorer:
    chain = SCORING_PROMPT | llm.with_structured_output(Score)

    def scorer(profile_text: str, guidance: str, vacancy: Vacancy) -> Score:
        return chain.invoke({
            "profile": profile_text,
            "guidance": guidance,
            "title": vacancy.title,
            "company": vacancy.company,
            "location": vacancy.location,
            "description": vacancy.description[:12000],
        })

    return scorer


def score_with_retry(scorer: Scorer, profile_text: str, guidance: str,
                     vacancy: Vacancy) -> Score | None:
    for _ in range(2):
        try:
            return gemini.call(scorer, profile_text, guidance, vacancy)
        except gemini.QuotaExhausted:
            raise
        except Exception as exc:
            print(f"Scoring {vacancy.title[:60]} failed: {str(exc)[:200]}", flush=True)
            continue
    return None
