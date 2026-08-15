import re

import yaml


def load_profile(path: str = "profile/master_profile.yaml") -> dict:
    with open(path) as f:
        return yaml.safe_load(f)


def _bullet_text(bullet: dict, track: str) -> str:
    text = bullet[track].replace("{metric}", bullet.get("metric") or "")
    return re.sub(r"\s{2,}", " ", text).strip()


def profile_to_text(profile: dict, track: str) -> str:
    lines: list[str] = []
    c = profile["contact"]
    lines.append(f"# {c['name']} — {profile['headline'][track]}")
    lines.append(f"{c['location']} | {c['phone']} | {c['email']} | {c['linkedin']} | {c['github']}")

    lines.append("\n## Work Experience")
    for job in profile["experience"]:
        lines.append(f"\n### {job['title']} | {job['company']} ({job['dates']})")
        for b in job["bullets"]:
            lines.append(f"- {_bullet_text(b, track)}")
        if track == "energy":
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
        if track in cert["tracks"]:
            lines.append(f"- {cert['name']} | {cert['issuer']} | {cert['date']} ({cert['group']})")

    if track == "ai":
        lines.append("\n## Projects & Hackathons")
        for p in profile["projects"]:
            lines.append(f"\n### {p['name']} ({p['date']}) — {p['link']}")
            for b in p["bullets"]:
                clean = re.sub(r"\s{2,}", " ", b).strip()
                lines.append(f"- {clean}")
            lines.append(f"- Built with: {', '.join(p['built_with'])}")

    return "\n".join(lines)
