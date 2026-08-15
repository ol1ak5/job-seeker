import datetime
from typing import Literal

from pydantic import BaseModel, Field


class Vacancy(BaseModel):
    id: str = ""
    title: str
    company: str
    location: str = ""
    remote: bool | None = None
    posted: datetime.date | None = None
    salary: str | None = None
    url: str
    source: str
    description: str = ""


class Score(BaseModel):
    score: int = Field(ge=0, le=100)
    verdict: Literal["strong_match", "worth_applying", "stretch", "skip"]
    matching_points: list[str]
    gaps: list[str]
    flags: list[str]


class ScoredVacancy(BaseModel):
    vacancy: Vacancy
    score: Score | None = None
