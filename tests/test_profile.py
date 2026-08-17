import pytest

from src.config import load_tracks
from src.profile import load_profile, profile_to_text

TRACKS = load_tracks()


def test_load_profile():
    p = load_profile()
    assert p["contact"]["name"] == "Olga Aksenova"
    assert any("[redacted]" in str(d) for d in p["contact"]["details"])
    assert {"energy", "ai"} <= set(p["headline"]["variants"])
    assert [s["title"] for s in p["sections"]][0] == "Work Experience"


def test_energy_view():
    text = profile_to_text(load_profile(), TRACKS["energy"])
    assert "[redacted]" in text
    assert "[redacted]" in text            # energy-only subitem
    assert "[redacted]" in text
    assert "Job-Seeker" not in text      # projects section is ai-only
    assert "[redacted]" in text
    assert "internal committees" in text  # energy-only bullet variant
    assert "{metric}" not in text


def test_ai_view():
    text = profile_to_text(load_profile(), TRACKS["ai"])
    assert "Job-Seeker" in text and "k-means" in text
    assert "[redacted]" not in text
    assert "internal committees" not in text
    assert "Built with:" in text


def test_all_skill_categories_render():
    text = profile_to_text(load_profile(), TRACKS["energy"])
    for label in ["Databases/Market Data", "Languages", "Frameworks",
                  "Developer Tools", "Libraries", "Office"]:
        assert f"- **{label}:**" in text   # master CVs use bold labels
    assert "CNMV" in text


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
    text = profile_to_text(load_profile(), TRACKS["energy"])
    lines = text.splitlines()
    index = lines.index("**Selected Transactions & Research:**")
    assert lines[index - 1] == ""
    assert lines[index + 1] == ""
