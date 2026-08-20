import datetime

import pytest

from src.models import Score, ScoredVacancy, Vacancy
from src.settings import Settings
from src.storage import (connect, finish_run, save_run, save_vacancies,
                         storage_configured)

CONFIGURED = Settings(adzuna_app_id="a", adzuna_app_key="b", google_api_key="c",
                      supabase_url="https://x.supabase.co", supabase_anon_key="k",
                      supabase_email="me@example.com", supabase_password="pw")


class FakeTable:
    def __init__(self, log, name):
        self.log, self.name, self.payload, self.filters = log, name, None, {}

    def insert(self, payload):
        self.payload = payload
        return self

    def upsert(self, payload, on_conflict=None):
        self.payload = payload
        self.on_conflict = on_conflict
        return self

    def update(self, payload):
        self.payload = payload
        return self

    def eq(self, column, value):
        self.filters[column] = value
        return self

    def execute(self):
        self.log.append((self.name, self.payload, self.filters))

        class Result:
            data = [{"id": "run-1"}]
        return Result()


class FakeAuth:
    def __init__(self, ok=True):
        self.ok = ok

    def sign_in_with_password(self, creds):
        if not self.ok:
            raise RuntimeError("Invalid login credentials")

        class Session:
            class user:
                id = "user-1"
        return Session()


class FakeClient:
    def __init__(self, ok=True):
        self.log = []
        self.auth = FakeAuth(ok)

    def table(self, name):
        return FakeTable(self.log, name)


def vac(url="https://job/1", score=78):
    v = Vacancy(id="energy-0817-01", title="Energy Analyst", company="Acme",
                location="Madrid", url=url, source="jsearch",
                posted=datetime.date(2026, 8, 12), description="d")
    s = None if score is None else Score(score=score, verdict="worth_applying",
                                         matching_points=["m"], gaps=["g"], flags=[])
    return ScoredVacancy(vacancy=v, score=s)


def test_storage_configured():
    assert storage_configured(CONFIGURED)
    assert not storage_configured(CONFIGURED.model_copy(update={"supabase_url": ""}))


def test_connect_returns_none_when_not_configured():
    assert connect(CONFIGURED.model_copy(update={"supabase_email": ""})) is None


def test_connect_signs_in():
    client = FakeClient()
    assert connect(CONFIGURED, client_factory=lambda url, key: client) is client


def test_connect_reports_bad_credentials():
    with pytest.raises(SystemExit) as exc:
        connect(CONFIGURED, client_factory=lambda url, key: FakeClient(ok=False))
    assert "SUPABASE_EMAIL" in str(exc.value)


def test_save_run_returns_id():
    client = FakeClient()
    run_id = save_run(client, "user-1", "energy", 14, 30, {"title": 3}, ["adzuna: 500"])
    assert run_id == "run-1"
    table, payload, _ = client.log[0]
    assert table == "runs"
    assert payload["user_id"] == "user-1" and payload["track"] == "energy"
    assert payload["dropped"] == {"title": 3}


def test_save_vacancies_maps_fields():
    client = FakeClient()
    written = save_vacancies(client, "user-1", "run-1", "energy", [vac(), vac("https://job/2", None)])
    assert written == 2
    table, payload, _ = client.log[0]
    assert table == "vacancies"
    first, second = payload
    assert first["ref"] == "energy-0817-01" and first["score"] == 78
    assert first["verdict"] == "worth_applying" and first["posted"] == "2026-08-12"
    assert second["score"] is None and second["verdict"] is None


def test_finish_run_sets_status():
    client = FakeClient()
    finish_run(client, "run-1", status="done")
    table, payload, filters = client.log[0]
    assert table == "runs" and payload["status"] == "done"
    assert payload["finished_at"] and filters == {"id": "run-1"}


def test_save_tracks_publishes_the_yaml_file():
    from src.config import load_tracks
    from src.storage import save_tracks

    client = FakeClient()
    written = save_tracks(client, "user-1", load_tracks())
    assert written == 2
    table, payload, _ = client.log[0]
    assert table == "tracks"
    energy = next(row for row in payload if row["name"] == "energy")
    assert energy["user_id"] == "user-1" and energy["label"] == "Energy"
    # the body is one YAML block, so the form can read every filter back
    assert energy["data"]["filters"]["locations"] == ["madrid"]
    assert "name" not in energy["data"]   # it is the column, not the body


def test_save_tracks_with_nothing_to_publish():
    from src.storage import save_tracks
    client = FakeClient()
    assert save_tracks(client, "user-1", {}) == 0
    assert client.log == []
