import re

from src.config import TrackFilters
from src.models import Vacancy

# "5+ years", "3-5 years", "at least 7 years", "mínimo 5 años", "al menos 2 años"
YEAR_PATTERNS = (
    r"(\d{1,2})\s*\+?\s*(?:-|–|to)?\s*\d{0,2}\s*(?:years?|yrs?)\b",
    r"(?:at least|minimum of|min\.?|minimum)\s*(\d{1,2})\s*(?:years?|yrs?)",
    r"(?:m[ií]nimo|al menos|por lo menos)\s*(?:de\s*)?(\d{1,2})\s*a[nñ]os",
    r"(\d{1,2})\s*\+?\s*a[nñ]os\s+de\s+experiencia",
)


def _matches_any(text: str, needles: list[str]) -> bool:
    lowered = text.lower()
    return any(needle.lower() in lowered for needle in needles)


# Consultancies advertise level ranges: "Consultants to Managers - Commodity
# Trading" is open from Consultant upwards, so the seniority word after "to"
# must not disqualify the posting.
LEVEL_RANGE = re.compile(
    r"\b(analysts?|associates?|consultants?|engineers?)\s+(?:to|-|–|/)\s*\w", re.I)


def title_allowed(title: str, f: TrackFilters) -> bool:
    if _matches_any(title, f.function_exclude):
        return False
    if _matches_any(title, f.title_exclude) and not LEVEL_RANGE.search(title):
        return False
    if f.title_include:
        return _matches_any(title, f.title_include)
    return True


def domain_allowed(vacancy: Vacancy, f: TrackFilters) -> bool:
    """Is this vacancy even about the right field?

    Seniority and function filters both pass a "Cyber Security Analyst" in
    Madrid - it is an analyst, it is not sales, it is in the right city. Only a
    subject-matter check keeps the track on topic.
    """
    if not f.domain_include:
        return True
    return _matches_any(f"{vacancy.title} {vacancy.description}", f.domain_include)


def min_years_required(text: str) -> int | None:
    """Lowest year requirement stated anywhere in the text, or None if unstated.

    The lower bound is what gates a candidate: "3-5 years" is open to 3 years of
    experience. Taking the minimum errs toward keeping a vacancy; the LLM's
    seniority flag is the second line of defence.
    """
    lowered = text.lower()
    years = []
    for pattern in YEAR_PATTERNS:
        years.extend(int(m) for m in re.findall(pattern, lowered))
    return min(years) if years else None


def years_allowed(description: str, f: TrackFilters) -> bool:
    if f.max_years_experience is None:
        return True
    required = min_years_required(description)
    return required is None or required <= f.max_years_experience


def location_allowed(vacancy: Vacancy, f: TrackFilters) -> bool:
    """Wanted city named, remote, or location simply not stated.

    An unstated location is not a mismatch, so it is kept and left for the
    scorer to flag - the same rule the experience filter uses. Several of the
    strongest vacancies found so far carry no location field at all. A location
    that IS stated and names another city is a real mismatch and is dropped.
    """
    if not f.locations:
        return True
    text = f"{vacancy.location} {vacancy.title}"
    if _matches_any(text, f.locations):
        return True
    if f.allow_remote and (vacancy.remote or _matches_any(text, f.remote_terms)):
        return True
    return not vacancy.location.strip()


def apply_filters(vacancies: list[Vacancy],
                  f: TrackFilters) -> tuple[list[Vacancy], dict[str, int]]:
    dropped = {"title": 0, "function": 0, "domain": 0, "years": 0, "location": 0,
               "company_cap": 0}
    kept: list[Vacancy] = []
    per_company: dict[str, int] = {}
    for vacancy in vacancies:
        if _matches_any(vacancy.title, f.function_exclude):
            dropped["function"] += 1
            continue
        if not title_allowed(vacancy.title, f):
            dropped["title"] += 1
            continue
        if not domain_allowed(vacancy, f):
            dropped["domain"] += 1
            continue
        if not years_allowed(vacancy.description, f):
            dropped["years"] += 1
            continue
        if not location_allowed(vacancy, f):
            dropped["location"] += 1
            continue
        company = vacancy.company.strip().lower()
        if per_company.get(company, 0) >= f.max_per_company:
            dropped["company_cap"] += 1
            continue
        per_company[company] = per_company.get(company, 0) + 1
        kept.append(vacancy)
    return kept, dropped
