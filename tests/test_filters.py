from src.config import TrackFilters
from src.filters import (apply_filters, domain_allowed, location_allowed,
                         min_years_required, title_allowed, years_allowed)
from src.models import Vacancy

F = TrackFilters(
    title_include=["analyst", "associate"],
    title_exclude=["director", "head of", "vp", "manager", "principal", "chief"],
    function_exclude=["sales", "account executive", "recruiter", "marketing"],
    max_years_experience=4,
    locations=["madrid"],   # mirrors the real config: city, not country
    allow_remote=True,
    remote_terms=["remote", "teletrabajo"],
    max_per_company=2,
)


def vac(title="Energy Analyst", company="C", location="Madrid, Spain", description=""):
    return Vacancy(title=title, company=company, location=location, url="u",
                   source="s", description=description)


def test_title_include_and_exclude():
    assert title_allowed("Energy Market Analyst", F)
    assert title_allowed("Senior Associate, Power", F)
    assert not title_allowed("Associate Director Infrastructure", F)   # exclude wins
    assert not title_allowed("Head of Energy Analytics", F)
    assert not title_allowed("Software Engineer", F)                   # no include match


def test_function_exclude():
    assert not title_allowed("Analyst, Enterprise Sales", F)
    assert not title_allowed("Associate Account Executive", F)


def test_empty_include_allows_anything_not_excluded():
    loose = TrackFilters(title_exclude=["director"])
    assert title_allowed("Anything At All", loose)
    assert not title_allowed("Director of Anything", loose)


def test_min_years_required_english_and_spanish():
    assert min_years_required("We need 5+ years of experience") == 5
    assert min_years_required("3-5 years of relevant experience") == 3
    assert min_years_required("at least 7 years in consulting") == 7
    assert min_years_required("mínimo 5 años de experiencia") == 5
    assert min_years_required("al menos 2 años") == 2
    assert min_years_required("no numbers here") is None


def test_years_allowed():
    assert years_allowed("2+ years of experience", F)
    assert years_allowed("no requirement stated", F)          # unknown passes
    assert not years_allowed("6+ years of experience", F)
    assert years_allowed("3-8 years of experience", F)        # lower bound gates


def test_location_allowed():
    assert location_allowed(vac(location="Madrid, Spain"), F)
    assert location_allowed(vac(location="Remote - EU"), F)   # remote term
    assert not location_allowed(vac(location="London, United Kingdom"), F)
    strict = F.model_copy(update={"allow_remote": False})
    assert not location_allowed(vac(location="Remote - EU"), strict)


def test_apply_filters_counts_and_caps():
    vacancies = [
        vac(title="Energy Analyst", company="A"),
        vac(title="Energy Analyst II", company="A"),
        vac(title="Energy Analyst III", company="A"),        # over cap of 2
        vac(title="Associate Director", company="B"),        # title
        vac(title="Analyst, Sales", company="C"),            # function
        vac(title="Analyst", company="D", description="8+ years required"),  # years
        vac(title="Analyst", company="E", location="Berlin, Germany"),       # location
    ]
    kept, dropped = apply_filters(vacancies, F)
    assert [v.company for v in kept] == ["A", "A"]
    assert dropped == {"title": 1, "function": 1, "domain": 0, "years": 1,
                       "location": 1, "company_cap": 1}


def test_level_range_titles_are_kept():
    """Consultancies advertise ranges: the upper bound must not disqualify."""
    # mirrors the real energy track, where "consultant" is an accepted level
    energy_like = F.model_copy(
        update={"title_include": ["analyst", "associate", "consultant"]})
    assert title_allowed("Consultants to Managers - Commodity Trading", energy_like)
    assert title_allowed("Consultant to Manager - Energy Markets", energy_like)
    assert title_allowed("Analysts to Associates, Power", energy_like)
    # a genuine senior-only posting is still excluded
    assert not title_allowed("Manager - Energy Networks", energy_like)
    assert not title_allowed("Director, Commodities & Energy Trading", energy_like)


def test_location_unstated_is_kept():
    """An empty location is unknown, not wrong: keep it and let the scorer flag it."""
    assert location_allowed(vac(location=""), F)
    assert location_allowed(vac(location="   "), F)


def test_location_stated_elsewhere_is_dropped():
    assert not location_allowed(vac(location="Barcelona, Spain"), F)
    assert not location_allowed(vac(location="London, United Kingdom"), F)


def test_location_multiple_cities_including_target_is_kept():
    assert location_allowed(vac(location="Madrid or Stockholm, Multiple Countries"), F)


def test_location_found_in_title_when_field_empty():
    assert location_allowed(vac(title="Analyst - Energy Projects (Madrid)", location=""), F)


def test_domain_filter_rejects_off_topic_analyst_roles():
    """Seniority and function checks alone pass any analyst in the right city."""
    energy = F.model_copy(update={
        "title_include": ["analyst", "consultant"],
        "domain_include": ["energy", "power", "renewable"],
    })
    on_topic = vac(title="Energy Transactions Analyst",
                   description="support energy transaction advisory")
    off_topic = vac(title="Cyber Security Analyst",
                    description="protect networks and infrastructure")
    assert domain_allowed(on_topic, energy)
    assert not domain_allowed(off_topic, energy)


def test_domain_filter_reads_the_description_too():
    """A generic title at an energy company is still on topic."""
    energy = F.model_copy(update={"domain_include": ["renewable"]})
    v = vac(title="Business Insights Analyst",
            description="Join our renewable generation portfolio team")
    assert domain_allowed(v, energy)


def test_empty_domain_include_allows_everything():
    assert domain_allowed(vac(title="Anything"), F)


# ------------------------------------------------- loosening instead of failing --

ENERGY = F.model_copy(update={
    "title_include": ["analyst", "consultant"],
    "domain_include": ["energy", "renewable"],
})


def test_relax_level_zero_changes_nothing():
    from src.filters import relax
    assert relax(ENERGY, 0) == ENERGY


def test_relax_gives_up_experience_and_title_words_first():
    """A stated years requirement is a wish, not a wall."""
    from src.filters import relax
    loosened = relax(ENERGY, 1)
    assert loosened.max_years_experience is None
    assert loosened.title_include == []
    # the subject is still enforced: the track is still about energy
    assert loosened.domain_include == ENERGY.domain_include
    assert loosened.function_exclude == ENERGY.function_exclude


def test_relax_gives_up_the_subject_only_at_the_last_level():
    from src.filters import relax
    loosened = relax(ENERGY, 2)
    assert loosened.domain_include == [] and loosened.title_exclude == []
    # sales is never wanted, at any level
    assert loosened.function_exclude == ENERGY.function_exclude


def test_relaxing_keeps_more_of_the_same_vacancies():
    from src.filters import relax
    vacancies = [
        vac(title="Energy Analyst", company="A", description="2 years"),
        vac(title="Energy Specialist", company="B", description="renewable"),   # title
        vac(title="Energy Analyst", company="C", description="8+ years required"),
    ]
    strict, _ = apply_filters(vacancies, ENERGY)
    loose, _ = apply_filters(vacancies, relax(ENERGY, 1))
    assert len(strict) == 1
    assert len(loose) == 3
    # nothing new is invented - the wider result contains the narrower one
    assert {v.company for v in strict} <= {v.company for v in loose}
