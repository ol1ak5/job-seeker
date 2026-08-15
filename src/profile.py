import re

import yaml

from src.config import TrackConfig


def load_profile(path: str = "profile/master_profile.yaml") -> dict:
    with open(path) as f:
        return yaml.safe_load(f)


def _variant_text(item: dict, track_name: str) -> str:
    variants = item.get("variants") or {}
    text = variants.get(track_name) or item.get("default")
    if not text:
        raise SystemExit(
            f"Profile has no text variant for track '{track_name}' and no "
            f"'default'. Available variants: {sorted(variants)}. "
            f"Add a variant or a default in the profile YAML.")
    return text


def _clean(text: str) -> str:
    return re.sub(r"\s{2,}", " ", text).strip()


def _bullet_text(bullet: dict, track_name: str) -> str:
    text = _variant_text(bullet, track_name).replace(
        "{metric}", bullet.get("metric") or "")
    return _clean(text)


def profile_to_text(profile: dict, track: TrackConfig) -> str:
    name = track.name
    lines: list[str] = []
    c = profile["contact"]
    lines.append(f"# {c['name']} — {_clean(_variant_text(profile['headline'], name))}")
    lines.append(f"{c['location']} | {c['phone']} | {c['email']} | {c['linkedin']} | {c['github']}")

    lines.append("\n## Work Experience")
    for job in profile["experience"]:
        lines.append(f"\n### {job['title']} | {job['company']} ({job['dates']})")
        for b in job["bullets"]:
            lines.append(f"- {_bullet_text(b, name)}")
        if track.include_transactions:
            for t in job.get("transactions", []):
                lines.append(f"- Selected transaction: {t['name']} ({t['date']})")
                for tb in t["bullets"]:
                    lines.append(f"  - {tb}")

    lines.append("\n## Skills")
    s = profile["skills"]
    lines.append(f"- Databases/Market Data: {', '.join(s['market_data'])}")
    lines.append(f"- Languages: {', '.join(s['languages'])}")
    lines.append(f"- Frameworks: {', '.join(s['frameworks'])}")
    lines.append(f"- Developer Tools: {', '.join(s['developer_tools'])}")
    lines.append(f"- Libraries: {', '.join(s['libraries'])}")
    lines.append(f"- Office: {', '.join(s['office'])}")

    lines.append("\n## Spoken Languages")
    lines.append(", ".join(profile["spoken_languages"]))

    lines.append("\n## Education")
    for e in profile["education"]:
        lines.append(f"- {e['degree']} | {e['school']} | GPA {e['gpa']}")

    lines.append("\n## Certifications")
    for cert in profile["certifications"]:
        if name in cert["tracks"]:
            lines.append(f"- {cert['name']} | {cert['issuer']} | {cert['date']} ({cert['group']})")

    if track.include_projects:
        lines.append("\n## Projects & Hackathons")
        for p in profile["projects"]:
            lines.append(f"\n### {p['name']} ({p['date']}) — {p['link']}")
            for b in p["bullets"]:
                lines.append(f"- {_clean(b)}")
            lines.append(f"- Built with: {', '.join(p['built_with'])}")

    return "\n".join(lines)
