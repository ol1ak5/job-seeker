import json
import pathlib
import re

import yaml

from src.llm_text import message_text
from src.prompts.import_cv import IMPORT_PROMPT

SUPPORTED = (".docx", ".pdf", ".txt", ".md")


def extract_text(path: pathlib.Path) -> str:
    path = pathlib.Path(path)
    suffix = path.suffix.lower()
    if suffix == ".docx":
        import docx
        document = docx.Document(str(path))
        parts = [p.text for p in document.paragraphs]
        for table in document.tables:
            for row in table.rows:
                parts.extend(cell.text for cell in row.cells)
        text = "\n".join(parts)
    elif suffix == ".pdf":
        from pypdf import PdfReader
        text = "\n".join(page.extract_text() or "" for page in PdfReader(str(path)).pages)
    elif suffix in (".txt", ".md"):
        text = path.read_text(encoding="utf-8")
    else:
        raise SystemExit(
            f"Unsupported file type '{suffix}'. Supported: {', '.join(SUPPORTED)}.")
    if not text.strip():
        raise SystemExit(
            f"No text could be extracted from {path} (scanned image PDF?). "
            f"Supported formats: {', '.join(SUPPORTED)}. Save the CV as .docx "
            f"or paste its text into a .txt file.")
    return text


def _parse_profile_json(raw) -> dict:
    """Accept a dict (test fakes) or a JSON string, possibly fenced, from the model."""
    if isinstance(raw, dict):
        data = raw
    else:
        text = str(raw).strip()
        fenced = re.search(r"```(?:json)?\s*(.*?)```", text, re.S)
        if fenced:
            text = fenced.group(1).strip()
        try:
            data = json.loads(text)
        except json.JSONDecodeError as exc:
            raise SystemExit(
                f"The model did not return valid JSON ({exc}). "
                f"Try running import-cv again, or convert the CV to .txt first.")
    if not isinstance(data, dict) or "contact" not in data or "sections" not in data:
        raise SystemExit(
            "The model's profile is missing 'contact' or 'sections'. "
            "Try running import-cv again, or build the profile by hand from "
            "profile/master_profile.yaml as an example.")
    return data


def build_profile(cv_text: str, tracks: list[str], llm) -> dict:
    messages = IMPORT_PROMPT.format_messages(
        cv_text=cv_text[:20000], tracks=", ".join(tracks))
    reply = llm.invoke(messages)
    raw = getattr(reply, "content", reply)
    # a dict is already the parsed profile (tests, and models that
    # return structured output directly); anything else is text
    return _parse_profile_json(raw if isinstance(raw, dict) else message_text(reply))


def write_profile(profile: dict, path: pathlib.Path) -> pathlib.Path:
    path = pathlib.Path(path)
    if path.exists():
        raise SystemExit(f"{path} already exists — choose another --out name.")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        yaml.safe_dump(profile, allow_unicode=True, sort_keys=False, width=88),
        encoding="utf-8")
    return path
