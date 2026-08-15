import pytest
from src.settings import load_settings


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
