import datetime

import pytest

from src.review import apply_decisions, build_hunks, find_tailored

MASTER = """# Alex Rivera

## Work Experience

### M&A Analyst | [redacted] CIB
*Madrid, Spain* *Sept 2024 - Present*

- Delivered 15+ energy market research analyses
- Prepared 100+ client-facing materials

## Skills

- **Languages:** Python, SQL, VBA
"""

TAILORED = """# Alex Rivera

## Work Experience

### M&A Analyst | [redacted] CIB
*Madrid, Spain* *Sept 2024 - Present*

- Delivered 15+ investment analyses and energy market research
- Prepared 100+ business cases and client-facing materials

## Skills

- **Languages:** Python, SQL, VBA
"""


def test_build_hunks_finds_changes_with_section():
    hunks = build_hunks(MASTER, TAILORED)
    assert len(hunks) == 1
    hunk = hunks[0]
    assert hunk.section == "### M&A Analyst | [redacted] CIB"
    assert any("energy market research analyses" in line for line in hunk.master_lines)
    assert any("investment analyses" in line for line in hunk.tailored_lines)


def test_identical_texts_have_no_hunks():
    assert build_hunks(MASTER, MASTER) == []


def test_apply_decisions_accept_keeps_tailored():
    hunks = build_hunks(MASTER, TAILORED)
    result = apply_decisions(MASTER, TAILORED, [True] * len(hunks))
    assert "investment analyses" in result
    assert "business cases" in result


def test_apply_decisions_reject_restores_master():
    hunks = build_hunks(MASTER, TAILORED)
    result = apply_decisions(MASTER, TAILORED, [False] * len(hunks))
    assert "investment analyses" not in result
    assert "energy market research analyses" in result
    assert result.endswith("\n")


def test_apply_decisions_custom_text():
    hunks = build_hunks(MASTER, TAILORED)
    custom = ["- Delivered 15+ investment analyses\n- Prepared 100+ client-facing materials"]
    result = apply_decisions(MASTER, TAILORED, custom)
    assert "- Delivered 15+ investment analyses" in result
    assert "business cases" not in result


def test_apply_decisions_wrong_count_exits():
    with pytest.raises(SystemExit):
        apply_decisions(MASTER, TAILORED, [])


def test_find_tailored_picks_newest_match(tmp_path):
    old = tmp_path / "20260101_greenyellow-com_Financial-Modelling-Analyst_AlexRivera.md"
    new = tmp_path / "20260817_greenyellow-com_Financial-Modelling-Analyst_AlexRivera.md"
    other = tmp_path / "20260817_acme_Data-Analyst_AlexRivera.md"
    for path in (old, new, other):
        path.write_text("x", encoding="utf-8")
    found = find_tailored("greenyellow.com", "Financial Modelling Analyst", tmp_path)
    assert found == new


def test_find_tailored_without_match_exits(tmp_path):
    with pytest.raises(SystemExit) as exc:
        find_tailored("Nobody", "Nothing", tmp_path)
    assert "adapt-cv" in str(exc.value)
