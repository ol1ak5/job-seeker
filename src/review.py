import difflib
import pathlib

from pydantic import BaseModel

from src.graphs.adapt_cv import _slug


class Hunk(BaseModel):
    tag: str
    section: str
    master_lines: list[str]
    tailored_lines: list[str]


def _section_for(lines: list[str], index: int) -> str:
    for line in reversed(lines[:index]):
        if line.startswith("#"):
            return line.strip()
    return ""


def build_hunks(master_text: str, tailored_text: str) -> list[Hunk]:
    master_lines = master_text.splitlines()
    tailored_lines = tailored_text.splitlines()
    matcher = difflib.SequenceMatcher(None, master_lines, tailored_lines)
    hunks: list[Hunk] = []
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            continue
        hunks.append(Hunk(
            tag=tag,
            section=_section_for(tailored_lines, j1),
            master_lines=master_lines[i1:i2],
            tailored_lines=tailored_lines[j1:j2],
        ))
    return hunks


def apply_decisions(master_text: str, tailored_text: str, decisions: list) -> str:
    master_lines = master_text.splitlines()
    tailored_lines = tailored_text.splitlines()
    matcher = difflib.SequenceMatcher(None, master_lines, tailored_lines)
    opcodes = [op for op in matcher.get_opcodes() if op[0] != "equal"]
    if len(decisions) != len(opcodes):
        raise SystemExit(
            f"Got {len(decisions)} decisions for {len(opcodes)} changes - "
            f"the CV files must not change while reviewing.")

    out: list[str] = []
    index = 0
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            out.extend(tailored_lines[j1:j2])
            continue
        decision = decisions[index]
        index += 1
        if decision is True:
            out.extend(tailored_lines[j1:j2])
        elif decision is False:
            out.extend(master_lines[i1:i2])
        else:
            out.extend(str(decision).splitlines())
    return "\n".join(out) + "\n"


def find_tailored(company: str, title: str,
                  cv_dir: pathlib.Path) -> pathlib.Path:
    cv_dir = pathlib.Path(cv_dir)
    company_slug = _slug(company, 28).lower()
    title_slug = _slug(title).lower()
    matches = [p for p in cv_dir.glob("*.md")
               if company_slug in p.name.lower() and title_slug in p.name.lower()]
    if not matches:
        raise SystemExit(
            f"No tailored CV for '{title}' at '{company}' in {cv_dir}. "
            f"Run adapt-cv for this vacancy first.")
    return sorted(matches)[-1]
