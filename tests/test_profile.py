import pytest

from src.config import load_tracks
from src.profile import load_profile, profile_to_text

TRACKS = load_tracks()
EXAMPLE_PROFILE = "profile/example_profile.yaml"


def test_load_profile():
    p = load_profile(EXAMPLE_PROFILE)
    assert p["contact"]["name"] == "Alex Rivera"
    assert any("alex.rivera@example.com" in str(d) for d in p["contact"]["details"])
    assert {"energy", "ai"} <= set(p["headline"]["variants"])
    assert [s["title"] for s in p["sections"]][0] == "Work Experience"


def test_energy_view():
    text = profile_to_text(load_profile(EXAMPLE_PROFILE), TRACKS["energy"])
    assert "Grid Study" in text          # tracks: [energy] subitem
    assert "Delivered 20+ market research reports" in text  # {metric} substituted
    assert "{metric}" not in text
    assert "Power Price Forecaster" not in text      # projects section is ai-only


def test_ai_view():
    text = profile_to_text(load_profile(EXAMPLE_PROFILE), TRACKS["ai"])
    assert "Power Price Forecaster" in text and "Built with:" in text
    assert "Grid Study" not in text      # energy-only subitem excluded


def test_ai_only_bullet_omitted_on_energy_track():
    """id `internal-tools` has variants.ai text and variants.energy: '' -> omitted on energy."""
    energy_text = profile_to_text(load_profile(EXAMPLE_PROFILE), TRACKS["energy"])
    ai_text = profile_to_text(load_profile(EXAMPLE_PROFILE), TRACKS["ai"])
    assert "cutting a two-day manual process to under an hour" not in energy_text
    assert "cutting a two-day manual process to under an hour" in ai_text


def test_all_skill_categories_render():
    text = profile_to_text(load_profile(EXAMPLE_PROFILE), TRACKS["energy"])
    for label in ["Databases/Market Data", "Languages", "Frameworks",
                  "Libraries", "Office"]:
        assert f"- **{label}:**" in text   # master CVs use bold labels


def test_custom_section_needs_no_code_change():
    """A profession-specific section type renders without touching src/."""
    profile = {
        "contact": {"name": "Dr Who", "details": ["Gallifrey"]},
        "headline": {"variants": {"energy": "Time Lord"}},
        "sections": [
            {"title": "Publications", "type": "list",
             "items": [{"text": "A Study of Time", "dates": "1963"}]},
            {"title": "Volunteering", "type": "text",
             "items": ["Saved Earth repeatedly"]},
        ],
    }
    text = profile_to_text(profile, TRACKS["energy"])
    assert "## Publications" in text and "A Study of Time | *1963*" in text
    assert "## Volunteering" in text and "Saved Earth repeatedly" in text


def test_unknown_section_type_exits():
    profile = {"contact": {"name": "X", "details": []},
               "headline": {"variants": {"energy": "h"}},
               "sections": [{"title": "Odd", "type": "carousel", "items": []}]}
    with pytest.raises(SystemExit) as exc:
        profile_to_text(profile, TRACKS["energy"])
    assert "carousel" in str(exc.value)


def test_missing_variant_exits():
    profile = {"contact": {"name": "X", "details": []},
               "headline": {"variants": {"energy": "h"}},
               "sections": [{"title": "S", "type": "list",
                             "items": [{"variants": {"ai": "only ai"}}]}]}
    with pytest.raises(SystemExit) as exc:
        profile_to_text(profile, TRACKS["energy"])
    assert "energy" in str(exc.value)


def test_subitems_label_is_its_own_block():
    """Without blank lines around it the label glues onto the previous bullet."""
    text = profile_to_text(load_profile(EXAMPLE_PROFILE), TRACKS["energy"])
    lines = text.splitlines()
    index = lines.index("**Selected Projects:**")
    assert lines[index - 1] == ""
    assert lines[index + 1] == ""


def test_course_and_degree_names_are_bold():
    """Master CVs bold the course/degree name and leave the issuer plain."""
    text = profile_to_text(load_profile(EXAMPLE_PROFILE), TRACKS["energy"])
    assert "- **Machine Learning Specialization** by DeepLearning.AI" in text
    assert "- **MSc in Energy Economics** |" in text


def test_use_profile_overrides_the_local_file():
    """The account's CV wins over profile/master_profile.yaml everywhere."""
    from src.profile import load_profile, reset_profile, use_profile

    uploaded = {"contact": {"name": "Someone From The Database"},
                "headline": "x", "sections": []}
    try:
        use_profile(uploaded)
        # the default path is never opened once a profile is installed
        assert load_profile()["contact"]["name"] == "Someone From The Database"
        assert load_profile("profile/example_profile.yaml")["contact"]["name"] \
            == "Someone From The Database"
    finally:
        reset_profile()


def test_reset_profile_returns_to_the_file():
    from src.profile import load_profile, reset_profile, use_profile

    use_profile({"contact": {"name": "Someone Else"}, "headline": "", "sections": []})
    reset_profile()
    assert "contact" in load_profile("profile/example_profile.yaml")


def test_a_corrected_section_replaces_only_that_section():
    """A correction made on the site stands in for one section; the rest render as usual."""
    profile = load_profile(EXAMPLE_PROFILE)
    first, second = profile["sections"][0]["title"], profile["sections"][1]["title"]
    untouched = profile_to_text(profile, TRACKS["energy"])
    profile["section_edits"] = {first: "- Corrected by hand"}
    text = profile_to_text(profile, TRACKS["energy"])

    assert f"## {first}\n- Corrected by hand" in text
    assert untouched.split(f"## {second}")[1] == text.split(f"## {second}")[1]


def test_a_blank_correction_leaves_the_section_as_read():
    profile = load_profile(EXAMPLE_PROFILE)
    untouched = profile_to_text(profile, TRACKS["energy"])
    profile["section_edits"] = {profile["sections"][0]["title"]: "   "}
    assert profile_to_text(profile, TRACKS["energy"]) == untouched
