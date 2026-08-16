import pathlib

import pytest
import yaml

from src.import_cv import build_profile, extract_text, write_profile

SAMPLE = {
    "contact": {"name": "Jane Roe", "details": ["Berlin", "jane@x.com"]},
    "headline": {"variants": {"ai": "Nurse moving into health AI"}},
    "sections": [{"title": "Work Experience", "type": "entries",
                  "items": [{"heading": "Nurse | Charité", "dates": "2020 - 2024",
                             "bullets": [{"default": "Ran the ward"}]}]}],
}


class FakeLLM:
    def __init__(self, payload=SAMPLE):
        self.payload = payload

    def with_structured_output(self, *_args, **_kwargs):
        return self

    def invoke(self, _messages):
        return self.payload


def test_extract_text_plain(tmp_path):
    f = tmp_path / "cv.txt"
    f.write_text("Jane Roe\nNurse", encoding="utf-8")
    assert "Jane Roe" in extract_text(f)


def test_extract_text_unknown_suffix(tmp_path):
    f = tmp_path / "cv.rtf"
    f.write_text("x", encoding="utf-8")
    with pytest.raises(SystemExit) as exc:
        extract_text(f)
    assert ".docx" in str(exc.value)


def test_extract_text_empty_file(tmp_path):
    f = tmp_path / "cv.txt"
    f.write_text("   ", encoding="utf-8")
    with pytest.raises(SystemExit):
        extract_text(f)


def test_build_profile_returns_schema():
    profile = build_profile("Jane Roe, nurse", ["ai"], FakeLLM())
    assert profile["contact"]["name"] == "Jane Roe"
    assert profile["sections"][0]["type"] == "entries"


def test_write_profile_roundtrip(tmp_path):
    out = write_profile(SAMPLE, tmp_path / "jane.yaml")
    loaded = yaml.safe_load(out.read_text(encoding="utf-8"))
    assert loaded["contact"]["name"] == "Jane Roe"


def test_write_profile_refuses_overwrite(tmp_path):
    path = tmp_path / "jane.yaml"
    path.write_text("existing", encoding="utf-8")
    with pytest.raises(SystemExit) as exc:
        write_profile(SAMPLE, path)
    assert "exists" in str(exc.value)


def test_imported_profile_renders(tmp_path):
    """A profile produced by import must work with the normal renderer."""
    from src.config import load_tracks
    from src.profile import profile_to_text
    text = profile_to_text(SAMPLE, load_tracks()["ai"])
    assert "Jane Roe" in text and "Ran the ward" in text
