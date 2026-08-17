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
