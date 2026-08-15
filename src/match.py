import datetime
import pathlib
import re

import httpx

from src.config import load_tracks
from src.models import Score, Vacancy
from src.profile import load_profile, profile_to_text
from src.scoring import score_with_retry
from src.sources.ats_boards import _strip_html
from src.writers import cache_vacancy


def parse_vacancy_text(raw: str) -> Vacancy:
    lines = [ln.strip() for ln in raw.strip().splitlines() if ln.strip()]
    if len(lines) >= 3:
        title, company = lines[0], lines[1]
        description = "\n".join(lines[2:])
    else:
        title, company, description = "Manual vacancy", "Unknown", raw.strip()
    return Vacancy(title=title, company=company, url="", source="manual",
                   description=description)


def fetch_vacancy_url(url: str, client: httpx.Client | None = None) -> Vacancy:
    client = client or httpx.Client(timeout=30, follow_redirects=True)
    resp = client.get(url)
    resp.raise_for_status()
    match = re.search(r"<title[^>]*>(.*?)</title>", resp.text, re.S | re.I)
    title = _strip_html(match.group(1)) if match else "Manual vacancy"
    text = _strip_html(resp.text)
    if len(text) < 200:
        raise SystemExit(
            "Could not extract enough text from that URL (JavaScript-heavy "
            "page?). Copy the posting into a text file and use --file instead.")
    return Vacancy(title=title or "Manual vacancy", company="Unknown", url=url,
                   source="manual", description=text[:20000])


def next_manual_id(track: str, today: datetime.date,
                   cache_dir: pathlib.Path) -> str:
    stamp = today.strftime("%m%d")
    existing = (list(cache_dir.glob(f"{track}-{stamp}-m*.json"))
                if cache_dir.exists() else [])
    return f"{track}-{stamp}-m{len(existing) + 1:02d}"


def run_match(track: str, vacancy: Vacancy, scorer, profile_path: str,
              out_dir: pathlib.Path,
              today: datetime.date) -> tuple[Vacancy, Score | None]:
    cfg = load_tracks()[track]
    cache_dir = out_dir / "cache"
    vacancy = vacancy.model_copy(
        update={"id": next_manual_id(track, today, cache_dir)})
    cache_vacancy(vacancy, cache_dir)
    profile_text = profile_to_text(load_profile(profile_path), cfg)
    score = score_with_retry(scorer, profile_text, cfg.scoring_guidance, vacancy)
    return vacancy, score
