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


# Where a posting says you must already be allowed to work. The capture group
# is the place; everything after it up to the first full stop is ignored.
AUTHORISATION = (
    r"(?:legally\s+)?authoris?z?ed\s+to\s+work\s+in\s+(?:the\s+)?([a-z .]{2,28})",
    r"work\s+authoris?z?ation\s+(?:in|for)\s+(?:the\s+)?([a-z .]{2,28})",
    r"(?:eligible|eligibility|right|permit)\s+to\s+work\s+in\s+(?:the\s+)?([a-z .]{2,28})",
    r"must\s+(?:currently\s+)?(?:reside|live)\s+in\s+(?:the\s+)?([a-z .]{2,28})",
)

# "We cannot sponsor a visa" names no country: it means the country the job is
# in, so it only matters where you could not already work.
NO_SPONSORSHIP = re.compile(
    r"(?:do(?:es)?\s+not|cannot|can't|unable\s+to|will\s+not|won't)\s+"
    r"(?:be\s+able\s+to\s+)?(?:offer|provide|consider)?\s*"
    r"(?:visa\s+|immigration\s+|work\s+)?sponsor", re.I)


def _named_place(text: str) -> list[str]:
    found = []
    lowered = text.lower()
    for pattern in AUTHORISATION:
        for match in re.findall(pattern, lowered):
            # "united states. applicants will" -> "united states"
            found.append(re.split(r"[.,;]| and | or ", match.strip())[0].strip())
    return [place for place in found if place]


def authorisation_note(vacancy: Vacancy, f: TrackFilters) -> str | None:
    """A warning about paperwork, not a verdict.

    This deliberately does not drop anything. An employer who writes "must be
    authorised to work in the US" will often still sponsor the right candidate,
    and a stated requirement is an opening line in a conversation rather than a
    locked door. Deciding that is the reader's job; noticing it is this one's.

    Only the explicit wording is caught. Most postings never raise the subject
    at all - of thirty on one real list, five mentioned it - so absence of a
    note means nothing was said, not that nothing is required.
    """
    if not f.authorised_in:
        return None

    allowed = [place.lower() for place in f.authorised_in]

    def permitted(place: str) -> bool:
        return any(a in place or place in a for a in allowed)

    for place in _named_place(vacancy.description):
        if not permitted(place):
            return f"Asks for the right to work in {place.title()}"

    if NO_SPONSORSHIP.search(vacancy.description):
        # No country named, so the job's own location is the one that matters.
        where = vacancy.location.lower()
        if where.strip() and not any(a in where for a in allowed):
            return f"Says it does not sponsor visas, and is based in {vacancy.location}"
    return None


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

    # "Fully remote" is often stated in the body and nowhere else, so the body
    # counts too. Being generous here is safe now that remote_reaches_you asks
    # the harder question afterwards.
    signal = f"{text} {vacancy.description[:2000]}"
    if f.allow_remote and (vacancy.remote or _matches_any(signal, f.remote_terms)):
        return remote_reaches_you(vacancy, f)

    return not vacancy.location.strip()


# "Remote - Worldwide", "work from anywhere", "fully remote (global)". Only
# these promise that where you sit is genuinely nobody's business.
WORLDWIDE = re.compile(
    r"\b(?:world\s?wide|globally|global(?:ly)?\s+remote|remote\s*[-–(:]?\s*global"
    r"|anywhere|any\s+time\s*zone|international(?:ly)?\s+remote)\b", re.I)


def remote_reaches_you(vacancy: Vacancy, f: TrackFilters) -> bool:
    """Remote from where?

    "AI Engineer - Remote" in Nebraska is remote for people who may already work
    in the United States. Treating the word "remote" as if it erased geography
    filled an entire list with roles that cannot legally be taken - and each one
    cost a model call to discover that.

    A remote posting is kept when it names no place at all, when the place it
    names is somewhere the candidate may work, or when it says outright that it
    does not care where you are.
    """
    # Nobody who has not said where they may work gets this filter imposed on
    # them: without that answer the question cannot be asked, let alone judged.
    if not f.authorised_in:
        return True

    where = vacancy.location.strip().lower()
    if not where:
        return True
    if any(a.lower() in where for a in f.authorised_in):
        return True
    return bool(WORLDWIDE.search(f"{vacancy.location} {vacancy.title} "
                                f"{vacancy.description[:2000]}"))


# What each round of loosening gives up, in order.
#
# Experience limits go first: a stated "5+ years" is a wish, not a wall. Title
# words follow, because guessing how an employer worded a heading is the least
# reliable guess in the list.
#
# The subject-matter check is alone on the last rung, and function_exclude is on
# none of them. Those two are not guesses about wording - they are what the
# search is about and what it is never about. Giving up the subject turns an
# energy search into a search for any analyst anywhere, which is how a cyber
# security role ends up on an energy list.
RELAXATIONS = (
    ("max_years_experience", "title_include"),
    ("title_exclude",),
    ("domain_include",),
)


def relax(f: TrackFilters, level: int) -> TrackFilters:
    """The same filters, minus whatever the first `level` rounds give up.

    A keyword list is a guess about how employers word their adverts, and a
    wrong guess should cost a smaller list, not an empty one. Nothing dropped
    here is lost: every vacancy that survives is still read and scored, so a
    genuinely unsuitable one sinks on its own merit instead of never being seen.
    """
    if level <= 0:
        return f
    given_up: dict[str, object] = {}
    for names in RELAXATIONS[:level]:
        for name in names:
            given_up[name] = None if name == "max_years_experience" else []
    return f.model_copy(update=given_up)


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
