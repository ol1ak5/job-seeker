import pytest

import src.settings

# tests/test_rls.py is the one integration test that is *supposed* to reach the
# real project: it signs in as two accounts and proves that Row Level Security
# hides one user's rows from the other. It opts out of the isolation below.
NEEDS_REAL_CREDENTIALS = ("test_rls.py",)


@pytest.fixture(autouse=True)
def isolate_from_real_dotenv(monkeypatch, request):
    """Never let a developer's real .env (for example live Supabase credentials)
    leak into the test suite - tests must not reach the network. Harmless
    defaults stand in for the required keys so any path that calls
    load_settings() (such as the write_output storage hook) still works without
    a real .env, and the four SUPABASE_* keys are cleared so storage stays
    unconfigured unless a test configures it explicitly."""
    if request.node.path.name in NEEDS_REAL_CREDENTIALS:
        return
    monkeypatch.setattr(src.settings, "load_dotenv", lambda *a, **k: False)
    monkeypatch.setenv("ADZUNA_APP_ID", "test-adzuna-id")
    monkeypatch.setenv("ADZUNA_APP_KEY", "test-adzuna-key")
    monkeypatch.setenv("GOOGLE_API_KEY", "test-google-key")
    for var in ("SUPABASE_URL", "SUPABASE_ANON_KEY",
                "SUPABASE_EMAIL", "SUPABASE_PASSWORD"):
        monkeypatch.delenv(var, raising=False)
