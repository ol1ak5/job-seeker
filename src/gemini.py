"""Calls to Gemini, kept inside the free tier's limits.

The free tier allows a few requests a minute and a few hundred a day. A search
makes one call per vacancy, so without pacing it trips the per-minute limit
within seconds, and the client library then retries quietly with growing waits
until the runner's time is gone. Here the calls are spaced out, a per-minute
refusal waits as long as Gemini asks and says so in the log, and a daily or
billing refusal stops the work at once, since waiting cannot fix it.

The spacing comes from GEMINI_MIN_INTERVAL (seconds, default 0): the workflow
sets it, a local run with a paid key does not need it.
"""

import os
import re
import time

ATTEMPTS = 4


class QuotaExhausted(Exception):
    """Gemini will not answer again today, or the account has no credit."""


_last_call = 0.0


def _min_interval() -> float:
    return float(os.getenv("GEMINI_MIN_INTERVAL", "0") or 0)


def _is_rate_limit(text: str) -> bool:
    return "429" in text or "RESOURCE_EXHAUSTED" in text or "402" in text


def _is_final(text: str) -> bool:
    # Not "billing": a per-minute refusal also says "check your plan and
    # billing details". The quota that was hit is named, e.g.
    # GenerateRequestsPerDayPerProjectPerModel-FreeTier.
    lowered = text.lower()
    return "perday" in lowered or "per day" in lowered or "prepayment" in lowered


def _retry_delay(text: str) -> float | None:
    match = re.search(r"retryDelay['\"]?\s*[:=]\s*['\"]?(\d+(?:\.\d+)?)s", text)
    return float(match.group(1)) if match else None


def call(fn, *args, **kwargs):
    """Run one model call: spaced from the last, retried on a per-minute limit."""
    global _last_call
    for attempt in range(ATTEMPTS):
        wait = _last_call + _min_interval() - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        _last_call = time.monotonic()
        try:
            return fn(*args, **kwargs)
        except Exception as exc:
            text = str(exc)
            if not _is_rate_limit(text):
                raise
            if _is_final(text):
                raise QuotaExhausted(text[:300]) from exc
            if attempt == ATTEMPTS - 1:
                raise
            delay = _retry_delay(text) or 20 * (attempt + 1)
            print(f"Gemini rate limit, waiting {delay:.0f} s", flush=True)
            time.sleep(delay)
