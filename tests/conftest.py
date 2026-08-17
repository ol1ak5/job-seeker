import pytest

import src.settings


@pytest.fixture(autouse=True)
def isolate_from_real_dotenv(monkeypatch):
    """Never let a developer's real .env (e.g. real Supabase credentials) leak
    into the test suite - tests must not reach the network. Harmless defaults
    stand in for the required keys so any test path that happens to call
    load_settings() (for example the write_output storage hook) still works
    without a real .env. The four SUPABASE_* keys are explicitly cleared so
    storage stays unconfigured by default; a test that needs it configured
    sets those explicitly. tests/test_rls.py opts in to real credentials via
    real env vars exported in the shell, not via .env auto-loading."""
    monkeypatch.setattr(src.settings, "load_dotenv", lambda *a, **k: False)
    monkeypatch.setenv("ADZUNA_APP_ID", "test-adzuna-id")
    monkeypatch.setenv("ADZUNA_APP_KEY", "test-adzuna-key")
    monkeypatch.setenv("GOOGLE_API_KEY", "test-google-key")
    for var in ("SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_EMAIL", "SUPABASE_PASSWORD"):
        monkeypatch.delenv(var, raising=False)
