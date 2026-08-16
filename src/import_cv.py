import pathlib

import yaml

from src.prompts.import_cv import IMPORT_PROMPT

SUPPORTED = (".docx", ".pdf", ".txt", ".md")


def extract_text(path: pathlib.Path) -> str:
    path = pathlib.Path(path)
    suffix = path.suffix.lower()
    if suffix == ".docx":
        import docx
        text = "\n".join(p.text for p in docx.Document(str(path)).paragraphs)
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
            f"Save the CV as .docx or paste it into a .txt file.")
    return text


def build_profile(cv_text: str, tracks: list[str], llm) -> dict:
    model = llm.with_structured_output(dict)
    messages = IMPORT_PROMPT.format_messages(
        cv_text=cv_text[:20000], tracks=", ".join(tracks))
    return model.invoke(messages)


def write_profile(profile: dict, path: pathlib.Path) -> pathlib.Path:
    path = pathlib.Path(path)
    if path.exists():
        raise SystemExit(f"{path} already exists — choose another --out name.")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        yaml.safe_dump(profile, allow_unicode=True, sort_keys=False, width=88),
        encoding="utf-8")
    return path
