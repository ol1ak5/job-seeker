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


def test_the_subject_survives_every_level_but_the_last():
    """Giving up the subject turns an energy search into a search for anything."""
    from src.filters import RELAXATIONS, relax

    assert relax(ENERGY, 1).domain_include == ENERGY.domain_include
    assert relax(ENERGY, 2).domain_include == ENERGY.domain_include
    assert relax(ENERGY, 2).title_exclude == []
    assert relax(ENERGY, len(RELAXATIONS)).domain_include == []


def test_the_wrong_kind_of_job_is_never_forgiven():
    """Sales and recruitment are not a guess about wording; they are a no."""
    from src.filters import RELAXATIONS, relax

    for level in range(len(RELAXATIONS) + 1):
        assert relax(ENERGY, level).function_exclude == ENERGY.function_exclude


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


# ------------------------------------------------- work authorisation --

AUTH = TrackFilters(authorised_in=["spain", "eu", "european union"])


def test_a_posting_that_demands_authorisation_you_lack_is_flagged_not_dropped():
    """A stated requirement is an opening line, not a locked door."""
    from src.filters import apply_filters, authorisation_note

    us = vac(title="AI Engineer", location="Nebraska, US",
             description="Applicants must be authorized to work in the United States.")
    note = authorisation_note(us, AUTH)
    assert note and "United States" in note
    kept, _ = apply_filters([us], AUTH)
    assert kept == [us]          # still on the list, warning attached


def test_the_phrasings_employers_actually_use():
    from src.filters import authorisation_note

    for wording in (
        "must be legally authorized to work in the United States",
        "work authorization in the US is required",
        "candidates must be eligible to work in the UK",
        "you will need the right to work in Canada",
    ):
        assert authorisation_note(vac(description=wording), AUTH), wording


def test_a_place_you_may_work_raises_nothing():
    from src.filters import authorisation_note

    assert authorisation_note(
        vac(description="You must have the right to work in Spain."), AUTH) is None


def test_no_sponsorship_is_read_against_where_the_job_is():
    """"We do not sponsor visas" only matters where you cannot already work."""
    from src.filters import authorisation_note

    us = vac(location="Austin, Texas, United States",
             description="We are unable to sponsor visas at this time.")
    local = vac(location="Madrid, Spain",
                description="We do not offer visa sponsorship.")
    assert authorisation_note(us, AUTH)
    assert authorisation_note(local, AUTH) is None


def test_silence_about_authorisation_is_not_a_warning():
    from src.filters import authorisation_note

    assert authorisation_note(vac(description="A great team."), AUTH) is None


def test_without_the_setting_nothing_is_checked():
    from src.filters import authorisation_note

    assert authorisation_note(
        vac(description="must be authorized to work in the US"),
        TrackFilters()) is None


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


def test_the_subject_survives_every_level_but_the_last():
    """Giving up the subject turns an energy search into a search for anything."""
    from src.filters import RELAXATIONS, relax

    assert relax(ENERGY, 1).domain_include == ENERGY.domain_include
    assert relax(ENERGY, 2).domain_include == ENERGY.domain_include
    assert relax(ENERGY, 2).title_exclude == []
    assert relax(ENERGY, len(RELAXATIONS)).domain_include == []


def test_the_wrong_kind_of_job_is_never_forgiven():
    """Sales and recruitment are not a guess about wording; they are a no."""
    from src.filters import RELAXATIONS, relax

    for level in range(len(RELAXATIONS) + 1):
        assert relax(ENERGY, level).function_exclude == ENERGY.function_exclude


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


# ------------------------------------------------- remote from where --

REMOTE_OK = TrackFilters(
    locations=["madrid"],
    authorised_in=["spain", "eu", "european union", "europe"],
    allow_remote=True,
    remote_terms=["remote", "teletrabajo", "work from home"],
)


def test_remote_pinned_to_a_country_you_cannot_work_in_is_dropped():
    """The word remote does not erase geography."""
    assert not location_allowed(
        vac(title="AI Engineer - Remote", location="Nebraska, US"), REMOTE_OK)
    assert not location_allowed(
        vac(title="LLM Engineer (Remote)", location="Tumwater, Thurston County"),
        REMOTE_OK)


def test_remote_within_somewhere_you_may_work_is_kept():
    assert location_allowed(
        vac(title="Software Engineer, Integrations (Remote)", location="Europe"),
        REMOTE_OK)
    assert location_allowed(
        vac(title="Analyst (remote)", location="Barcelona, Spain"), REMOTE_OK)


def test_remote_that_says_it_means_anywhere_is_kept():
    assert location_allowed(
        vac(title="AI Engineer - Remote Worldwide", location="San Francisco"),
        REMOTE_OK)
    assert location_allowed(
        vac(title="LLM Engineer", location="New York",
            description="Fully remote, work from anywhere."), REMOTE_OK)


def test_remote_with_no_stated_place_is_still_kept():
    """Nothing stated is unknown, not wrong - the same rule as everywhere else."""
    assert location_allowed(vac(title="Remote AI Engineer", location=""), REMOTE_OK)


def test_without_authorisation_configured_remote_behaves_as_before():
    """Nobody who has not answered the question gets a new filter imposed."""
    old = REMOTE_OK.model_copy(update={"authorised_in": []})
    assert location_allowed(vac(title="AI Engineer - Remote",
                                location="Nebraska, US"), old)
