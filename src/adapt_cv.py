import datetime
import pathlib
import re

from src.config import load_tracks
from src.llm_text import message_text
from src.profile import load_profile, profile_to_text
from src.prompts.adapt_cv import ADAPT_PROMPT
from src.writers import load_cached_vacancy

TAILORED_DIR = pathlib.Path("cv/tailored")


def _slug(text: str, max_len: int = 48) -> str:
    """Readable file-name part: words joined by hyphens, no punctuation."""
    cleaned = re.sub(r"[^0-9a-zA-Z]+", "-", text).strip("-")
    return cleaned[:max_len].strip("-") or "unknown"


def _joined_name(name: str) -> str:
    return re.sub(r"[^0-9a-zA-Z]+", "", name) or "CV"


def tailored_filename(vacancy_company: str, vacancy_title: str, person_name: str,
                      today: datetime.date) -> str:
    """YYYYMMDD_Company_Vacancy_PersonName.md — one file per application."""
    return (f"{today.strftime('%Y%m%d')}_{_slug(vacancy_company, 28)}"
            f"_{_slug(vacancy_title)}_{_joined_name(person_name)}.md")


def adapt_cv_markdown(vacancy, cfg, profile: dict, llm=None) -> str:
    """Rewrite the profile as a CV aimed at one vacancy.

    Takes the vacancy as an object rather than an id so that it works the same
    whether the posting came from a local cache file or from the database - the
    site and the command line then produce the same document from the same
    prompt, instead of two versions drifting apart.
    """
    if llm is None:
        from langchain_google_genai import ChatGoogleGenerativeAI

        from src.settings import load_settings
        llm = ChatGoogleGenerativeAI(
            model="gemini-pro-latest",
            google_api_key=load_settings(required=("GOOGLE_API_KEY",)).google_api_key)

    messages = ADAPT_PROMPT.format_messages(
        profile=profile_to_text(profile, cfg),
        track=cfg.name,
        section_order=cfg.cv_sections,
        title=vacancy.title,
        company=vacancy.company,
        description=vacancy.description[:12000],
    )
    return message_text(llm.invoke(messages))


def run_adapt_cv(vacancy_id: str, llm=None,
                 out_dir: pathlib.Path = pathlib.Path("output"),
                 today: datetime.date | None = None,
                 profile_path: str = "profile/master_profile.yaml",
                 cv_dir: pathlib.Path = TAILORED_DIR) -> pathlib.Path:
    """Write a vacancy-tailored CV. Master CVs in cv/master/ are never touched."""
    track = vacancy_id.split("-", 1)[0]
    tracks = load_tracks()
    if track not in tracks:
        raise SystemExit(
            f"Cannot infer a known track from id '{vacancy_id}'. "
            f"Known tracks: {sorted(tracks)}.")
    cfg = tracks[track]
    vacancy = load_cached_vacancy(vacancy_id, out_dir / "cache")
    profile = load_profile(profile_path)
    cv_markdown = adapt_cv_markdown(vacancy, cfg, profile, llm)

    today = today or datetime.date.today()
    filename = tailored_filename(vacancy.company, vacancy.title,
                                 profile["contact"]["name"], today)
    out_path = pathlib.Path(cv_dir) / filename
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(cv_markdown, encoding="utf-8")
    return out_path
