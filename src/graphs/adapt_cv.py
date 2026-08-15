import datetime
import pathlib
import re

from src.profile import load_profile, profile_to_text
from src.prompts.adapt_cv import ADAPT_PROMPT, SECTION_ORDER
from src.writers import load_cached_vacancy


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def run_adapt_cv(vacancy_id: str, llm=None,
                 out_dir: pathlib.Path = pathlib.Path("output"),
                 today: datetime.date | None = None) -> pathlib.Path:
    track = vacancy_id.split("-", 1)[0]
    if track not in ("energy", "ai"):
        raise SystemExit(f"Cannot infer track from id '{vacancy_id}'.")
    vacancy = load_cached_vacancy(vacancy_id, out_dir / "cache")

    if llm is None:
        from langchain_google_genai import ChatGoogleGenerativeAI

        from src.settings import load_settings
        llm = ChatGoogleGenerativeAI(model="gemini-pro-latest",
                                     google_api_key=load_settings().google_api_key)

    messages = ADAPT_PROMPT.format_messages(
        profile=profile_to_text(load_profile(), track),
        track=track,
        section_order=SECTION_ORDER[track],
        title=vacancy.title,
        company=vacancy.company,
        description=vacancy.description[:12000],
    )
    cv_markdown = llm.invoke(messages).content

    today = today or datetime.date.today()
    out_path = (out_dir / "cvs" /
                f"{today.isoformat()}_{track}_{_slug(vacancy.company)}.md")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(cv_markdown)
    return out_path
