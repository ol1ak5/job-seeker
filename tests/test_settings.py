import pytest

import src.settings
from src.settings import load_settings


@pytest.fixture(autouse=True)
def no_dotenv_file(monkeypatch):
    """Isolate tests from a real .env: without this, load_dotenv() re-reads the
    developer's own keys back into the environment and the missing-key test
    can never fail."""
    monkeypatch.setattr(src.settings, "load_dotenv", lambda *a, **k: False)


def test_load_settings_reads_env(monkeypatch):
    monkeypatch.setenv("ADZUNA_APP_ID", "id1")
    monkeypatch.setenv("ADZUNA_APP_KEY", "key1")
    monkeypatch.setenv("GOOGLE_API_KEY", "gkey")
    s = load_settings()
    assert s.adzuna_app_id == "id1"
    assert s.adzuna_app_key == "key1"
    assert s.google_api_key == "gkey"


def test_load_settings_missing_keys_exits(monkeypatch):
    monkeypatch.delenv("ADZUNA_APP_ID", raising=False)
    monkeypatch.delenv("ADZUNA_APP_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    with pytest.raises(SystemExit) as exc:
        load_settings()
    assert "ADZUNA_APP_ID" in str(exc.value)


def test_load_settings_custom_required_subset(monkeypatch):
    """import-cv only needs the Gemini key, not the Adzuna pair."""
    monkeypatch.delenv("ADZUNA_APP_ID", raising=False)
    monkeypatch.delenv("ADZUNA_APP_KEY", raising=False)
    monkeypatch.setenv("GOOGLE_API_KEY", "gkey")
    s = load_settings(required=("GOOGLE_API_KEY",))
    assert s.google_api_key == "gkey"
    assert s.adzuna_app_id == ""
