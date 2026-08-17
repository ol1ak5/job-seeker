import os

import pytest
from dotenv import load_dotenv

from src.settings import load_settings
from src.storage import connect, storage_configured

# This is the one test that deliberately talks to the real project, so it reads
# the developer's .env directly (tests/conftest.py exempts this file).
load_dotenv()

pytestmark = pytest.mark.skipif(
    not os.getenv("SUPABASE_TEST_EMAIL"),
    reason="set SUPABASE_TEST_EMAIL/SUPABASE_TEST_PASSWORD to check RLS isolation")


def test_second_user_cannot_see_first_users_rows():
    """The security guarantee: RLS must hide one user's data from another."""
    settings = load_settings(required=())
    if not storage_configured(settings):
        pytest.skip("Supabase is not configured")

    owner = connect(settings)
    owner_rows = owner.table("vacancies").select("id", count="exact").execute()

    intruder_settings = settings.model_copy(update={
        "supabase_email": os.environ["SUPABASE_TEST_EMAIL"],
        "supabase_password": os.environ["SUPABASE_TEST_PASSWORD"]})
    intruder = connect(intruder_settings)
    intruder_rows = intruder.table("vacancies").select("id", count="exact").execute()

    assert intruder_rows.count == 0, (
        "RLS leak: the second account can read the first account's vacancies")
    if owner_rows.count:
        owner_ids = {row["id"] for row in owner_rows.data}
        intruder_ids = {row["id"] for row in intruder_rows.data}
        assert not (owner_ids & intruder_ids)
