import pytest

from src import gemini


@pytest.fixture(autouse=True)
def no_waiting(monkeypatch):
    waits = []
    monkeypatch.setattr(gemini.time, "sleep", waits.append)
    monkeypatch.setenv("GEMINI_MIN_INTERVAL", "0")
    return waits


def test_a_per_minute_limit_waits_as_long_as_gemini_asks(no_waiting):
    calls = []

    def flaky():
        calls.append(1)
        if len(calls) == 1:
            raise RuntimeError("429 RESOURCE_EXHAUSTED GenerateRequestsPerMinute "
                               "check your plan and billing details 'retryDelay': '23s'")
        return "ok"

    assert gemini.call(flaky) == "ok"
    assert no_waiting == [23.0]


def test_a_daily_limit_stops_at_once(no_waiting):
    def refused():
        raise RuntimeError("429 RESOURCE_EXHAUSTED GenerateRequestsPerDayPerProjectPerModel-FreeTier")

    with pytest.raises(gemini.QuotaExhausted):
        gemini.call(refused)
    assert no_waiting == []


def test_spent_credit_stops_at_once():
    def refused():
        raise RuntimeError("402 RESOURCE_EXHAUSTED Your prepayment credits are depleted")

    with pytest.raises(gemini.QuotaExhausted):
        gemini.call(refused)


def test_other_errors_are_not_retried():
    calls = []

    def broken():
        calls.append(1)
        raise ValueError("bad json")

    with pytest.raises(ValueError):
        gemini.call(broken)
    assert len(calls) == 1


def test_calls_are_spaced_out(no_waiting, monkeypatch):
    monkeypatch.setenv("GEMINI_MIN_INTERVAL", "6")
    monkeypatch.setattr(gemini, "_last_call", 0.0)
    clock = iter([100.0, 100.0, 101.0, 101.0])
    monkeypatch.setattr(gemini.time, "monotonic", lambda: next(clock))
    gemini.call(lambda: None)
    gemini.call(lambda: None)
    assert no_waiting == [5.0]
