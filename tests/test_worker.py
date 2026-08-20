"""The worker runs with the service-role key, so isolation is its own problem.

Every test here is really one question: does a job only ever touch the account
that owns it?
"""

import pytest

from src.worker import claim, finish, main, run_search_job


class FakeTable:
    def __init__(self, store, name):
        self.store, self.name = store, name
        self.filters = {}
        self.payload = None

    def select(self, *_, **kwargs):
        self.count_mode = kwargs.get("count")
        return self

    def update(self, payload):
        self.payload = payload
        return self

    def eq(self, column, value):
        self.filters[column] = value
        return self

    def in_(self, column, values):
        self.filters[column] = values
        return self

    def limit(self, _):
        return self

    def execute(self):
        self.store["calls"].append((self.name, self.payload, dict(self.filters)))
        rows = [r for r in self.store["rows"].get(self.name, [])
                if all(r.get(k) == v for k, v in self.filters.items())]
        if self.payload:
            for row in rows:
                row.update(self.payload)

        class Result:
            data = rows
            count = len(rows)
        return Result()


class FakeClient:
    def __init__(self, rows):
        self.store = {"rows": rows, "calls": []}

    def table(self, name):
        return FakeTable(self.store, name)

    @property
    def calls(self):
        return self.store["calls"]


def job_row(**over):
    row = {"id": "job-1", "user_id": "user-1", "kind": "search",
           "track": "energy", "payload": {}, "status": "queued"}
    row.update(over)
    return row


def test_claim_marks_the_job_running():
    client = FakeClient({"jobs": [job_row()]})
    job = claim(client, "job-1")
    assert job["user_id"] == "user-1"
    table, payload, filters = client.calls[-1]
    assert table == "jobs" and payload["status"] == "running"
    assert filters == {"id": "job-1"}


def test_claim_refuses_a_finished_job():
    """A retried workflow must not score everything a second time."""
    client = FakeClient({"jobs": [job_row(status="done")]})
    with pytest.raises(SystemExit, match="already done"):
        claim(client, "job-1")


def test_claim_refuses_an_unknown_job():
    with pytest.raises(SystemExit, match="No job"):
        claim(FakeClient({"jobs": []}), "nope")


def test_finish_records_the_failure_text():
    client = FakeClient({"jobs": [job_row()]})
    finish(client, "job-1", "failed", error="boom")
    _, payload, _ = client.calls[-1]
    assert payload["status"] == "failed" and payload["error"] == "boom"
    assert payload["finished_at"]


def test_a_job_without_a_saved_search_says_so():
    client = FakeClient({"tracks": [], "profiles": []})
    with pytest.raises(SystemExit, match="no saved searches"):
        run_search_job(client, job_row())


def test_a_job_without_a_cv_fails_with_an_explanation(monkeypatch):
    """Scoring against nothing would silently produce nonsense."""
    import src.config
    import src.storage
    from src.config import TrackConfig

    monkeypatch.setattr(src.config, "load_db_tracks",
                        lambda *_: {"energy": TrackConfig(name="energy")})
    monkeypatch.setattr(src.storage, "load_db_profile", lambda *_: None)

    client = FakeClient({})
    with pytest.raises(SystemExit, match="no CV"):
        run_search_job(client, job_row())


def test_the_job_decides_whose_work_this_is(monkeypatch):
    """The service-role key ignores RLS, so the user id must come from the row."""
    import src.config
    import src.storage
    from src.config import TrackConfig

    seen = {}

    def tracks_for(_client, user_id):
        seen["tracks"] = user_id
        return {"energy": TrackConfig(name="energy")}

    def profile_for(_client, user_id):
        seen["profile"] = user_id
        return None                      # stops the job before it does any work

    monkeypatch.setattr(src.config, "load_db_tracks", tracks_for)
    monkeypatch.setattr(src.storage, "load_db_profile", profile_for)

    with pytest.raises(SystemExit, match="no CV"):
        run_search_job(FakeClient({}), job_row(user_id="somebody-else"))

    assert seen == {"tracks": "somebody-else", "profile": "somebody-else"}


def test_main_marks_an_unknown_kind_failed(monkeypatch):
    """A job kind the engine has never heard of must not leave the row running."""
    client = FakeClient({"jobs": [job_row(kind="teleport")]})
    monkeypatch.setattr("src.worker.service_client", lambda: client)
    assert main(["worker", "job-1"]) == 1
    _, payload, _ = client.calls[-1]
    assert payload["status"] == "failed" and "teleport" in payload["error"]


def test_main_needs_exactly_one_argument():
    assert main(["worker"]) == 2


# ------------------------------------------------- writing a CV for one vacancy --

def test_adapt_refuses_a_vacancy_belonging_to_somebody_else():
    """The service-role key would happily fetch it; the query must not."""
    from src.worker import run_adapt_job

    client = FakeClient({"vacancies": []})       # the user_id filter matched nothing
    with pytest.raises(SystemExit, match="does not belong to this account"):
        run_adapt_job(client, job_row(kind="adapt",
                                      payload={"vacancy_id": "someone-elses"}))


def test_adapt_needs_a_vacancy_to_work_on():
    from src.worker import run_adapt_job

    with pytest.raises(SystemExit, match="no vacancy"):
        run_adapt_job(FakeClient({}), job_row(kind="adapt", payload={}))


def test_adapt_explains_a_track_that_was_deleted(monkeypatch):
    """Settings can be deleted after a vacancy was found under them."""
    import src.config
    import src.storage
    from src.worker import run_adapt_job

    monkeypatch.setattr(src.storage, "load_db_profile",
                        lambda *_: {"contact": {"name": "A"}, "sections": []})
    monkeypatch.setattr(src.config, "load_db_tracks", lambda *_: {})

    client = FakeClient({"vacancies": [
        {"id": "v1", "user_id": "user-1", "track": "gone", "title": "t",
         "company": "c", "location": "", "url": "u", "source": "s",
         "description": "d"}]})
    with pytest.raises(SystemExit, match="no longer exists"):
        run_adapt_job(client, job_row(kind="adapt", payload={"vacancy_id": "v1"}))
