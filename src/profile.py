import re

import yaml

from src.config import TrackConfig


def load_profile(path: str = "profile/master_profile.yaml") -> dict:
    """The CV in force: the one uploaded to the account, else the local file.

    Same arrangement as load_tracks - the CLI installs the signed-in user's
    profile once at startup and every later call sees it, so the graph nodes
    need no database handle of their own.
    """
    if _INSTALLED is not None:
        return _INSTALLED
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)


# Set by use_profile() for the length of one run; None means "read the file".
_INSTALLED: dict | None = None


def use_profile(profile: dict) -> None:
    global _INSTALLED
    _INSTALLED = profile


def reset_profile() -> None:
    global _INSTALLED
    _INSTALLED = None


def _clean(text) -> str:
    return re.sub(r"\s{2,}", " ", str(text)).strip()


def _visible(item: dict, track_name: str) -> bool:
    """No `tracks:` key means the item shows on every track."""
    tracks = item.get("tracks")
    return tracks is None or track_name in tracks


def _variant_text(item: dict, track_name: str) -> str:
    """Text for this track. Explicit empty variant means omit; missing both is an error."""
    variants = item.get("variants") or {}
    if track_name in variants:
        return variants[track_name] or ""
    text = item.get("default")
    if text is None:
        raise SystemExit(
            f"Profile item has no text for track '{track_name}': add "
            f"'variants.{track_name}' or a 'default'. Item keys: {sorted(item)}.")
    return text


def _item_text(item: dict, track_name: str) -> str:
    if "variants" in item or "default" in item:
        raw = _variant_text(item, track_name)
    else:
        raw = item.get("text", "")
    if not raw:
        return ""
    return _clean(raw.replace("{metric}", item.get("metric") or ""))


def _render_entries(items, track_name, out):
    for item in items:
        if not _visible(item, track_name):
            continue
        dates = item.get("dates")
        out.append(f"\n### {_clean(item.get('heading', ''))}")
        place = _clean(item.get("subheading", ""))
        if place or dates:
            line = " ".join(part for part in
                            (f"*{place}*" if place else "", f"*{dates}*" if dates else "")
                            if part)
            out.append(line)
        for bullet in item.get("bullets", []):
            if not _visible(bullet, track_name):
                continue
            text = _item_text(bullet, track_name)
            if text:
                out.append(f"- {text}")
        visible_subs = [s for s in item.get("subitems", []) if _visible(s, track_name)]
        if visible_subs and item.get("subitems_label"):
            # blank lines keep the label its own block in Markdown, otherwise it
            # glues itself onto the previous bullet
            out.append("")
            out.append(f"**{item['subitems_label']}**")
            out.append("")
        for sub in visible_subs:
            sub_dates = sub.get("dates")
            out.append(f"- {_clean(sub.get('heading', ''))}"
                       + (f" | *{sub_dates}*" if sub_dates else ""))
            for sub_bullet in sub.get("bullets", []):
                if _visible(sub_bullet, track_name):
                    text = _item_text(sub_bullet, track_name)
                    if text:
                        out.append(f"  - {text}")


def _render_categories(items, track_name, out):
    for item in items:
        if _visible(item, track_name):
            out.append(f"- **{item['label']}:** {', '.join(item['values'])}")


def _render_inline(items, track_name, out):
    values = []
    for item in items:
        if isinstance(item, str):
            values.append(item)
        elif _visible(item, track_name):
            text = _item_text(item, track_name)
            if text:
                values.append(text)
    out.append(" · ".join(values))


def _render_list(items, track_name, out):
    for item in items:
        if isinstance(item, str):
            out.append(f"- {item}")
            continue
        if not _visible(item, track_name):
            continue
        text = _item_text(item, track_name)
        if not text:
            continue
        dates = item.get("dates")
        out.append(f"- {text}" + (f" | *{dates}*" if dates else ""))


def _render_text(items, track_name, out):
    for item in items:
        if isinstance(item, str):
            out.append(_clean(item))
            continue
        if _visible(item, track_name):
            text = _item_text(item, track_name)
            if text:
                out.append(text)


RENDERERS = {
    "entries": _render_entries,
    "categories": _render_categories,
    "inline": _render_inline,
    "list": _render_list,
    "text": _render_text,
}


def profile_to_text(profile: dict, track: TrackConfig) -> str:
    """The CV as the model reads it: for scoring, and as the source of a tailor.

    Reading an uploaded CV can drop or merge things - a two-column PDF is the
    usual culprit - so the site lets you correct the text this produces. When
    you have, your version is used as it stands, for every track.
    """
    edited = profile.get("edited_text")
    if isinstance(edited, str) and edited.strip():
        return edited.strip()

    name = track.name
    out: list[str] = []
    contact = profile["contact"]
    out.append(f"# {contact['name']}")
    out.append(f"**{_clean(_variant_text(profile['headline'], name))}**")
    details = [d if isinstance(d, str) else d.get("value", "")
               for d in contact.get("details", [])]
    out.append(" · ".join(d for d in details if d))

    for section in profile.get("sections", []):
        if not _visible(section, name):
            continue
        stype = section.get("type", "list")
        if stype not in RENDERERS:
            raise SystemExit(
                f"Unknown section type '{stype}' in section "
                f"'{section.get('title')}'. Known types: {', '.join(sorted(RENDERERS))}.")
        out.append(f"\n## {section['title']}")
        RENDERERS[stype](section.get("items", []), name, out)

    return "\n".join(out)
