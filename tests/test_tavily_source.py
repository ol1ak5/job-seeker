import httpx

from src.config import TrackConfig
from src.sources.tavily_search import collect, extract_vacancies, search_pages

CFG = TrackConfig(name="energy", adzuna_country="es", queries=[],
                  scoring_guidance="g", cv_sections="s",
                  tavily_queries=["energy analyst jobs Madrid"])

TAVILY_REPLY = {"results": [
    {"url": "https://climatechangecareers.com/job/erm/madrid",
     "title": "Analyst - Energy Transactions | ERM | Madrid",
     "raw_content": "ERM is hiring an Analyst - Energy Transactions in Madrid, Spain."},
]}

JOBS_JSON = """[
  {"title": "Analyst - Energy Transactions", "company": "ERM",
   "location": "Madrid, Spain", "description": "Support energy transaction advisory."}
]"""


class FakeLLM:
    def __init__(self, text=JOBS_JSON):
        self.text = text
        self.calls = 0

    def invoke(self, _messages):
        self.calls += 1

        class Reply:
            content = self.text
        return Reply()


def tavily_client():
    return httpx.Client(transport=httpx.MockTransport(
        lambda request: httpx.Response(200, json=TAVILY_REPLY)))


def test_search_pages_returns_normalised_dicts():
    pages = search_pages(["energy analyst Madrid"], "key", client=tavily_client())
    assert len(pages) == 1
    assert pages[0]["url"].startswith("https://climatechangecareers.com")
    assert "ERM is hiring" in pages[0]["content"]


def test_search_pages_skips_failed_queries():
    client = httpx.Client(transport=httpx.MockTransport(
        lambda request: httpx.Response(401, json={"error": "bad key"})))
    assert search_pages(["q"], "key", client=client) == []


def test_extract_vacancies_parses_json_array():
    pages = [{"url": "https://x.com/job", "title": "t", "content": "text"}]
    vacancies = extract_vacancies(pages, FakeLLM())
    assert len(vacancies) == 1
    assert vacancies[0].company == "ERM"
    assert vacancies[0].source == "tavily"
    assert vacancies[0].url == "https://x.com/job"


def test_extract_vacancies_handles_fenced_json():
    pages = [{"url": "https://x.com/job", "title": "t", "content": "text"}]
    vacancies = extract_vacancies(pages, FakeLLM("```json\n" + JOBS_JSON + "\n```"))
    assert len(vacancies) == 1


def test_extract_vacancies_skips_bad_json():
    pages = [{"url": "https://x.com/job", "title": "t", "content": "text"}]
    assert extract_vacancies(pages, FakeLLM("sorry, no jobs here")) == []


def test_collect_end_to_end():
    vacancies = collect(CFG, "key", FakeLLM(), client=tavily_client())
    assert len(vacancies) == 1 and vacancies[0].title.startswith("Analyst")
