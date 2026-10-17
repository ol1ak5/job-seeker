import datetime

from langchain_core.messages import AIMessage

from src.adapt_cv import run_adapt_cv, tailored_filename
from src.models import Vacancy
from src.prompts.adapt_cv import ADAPT_PROMPT
from src.writers import cache_vacancy


class FakeLLM:
    def invoke(self, messages):
        return AIMessage(content="# Alex Rivera\nTailored CV body")


def test_prompt_forbids_invention():
    msgs = ADAPT_PROMPT.format_messages(
        profile="P", track="ai", section_order="S",
        title="T", company="C", description="D")
    joined = " ".join(m.content for m in msgs).lower()
    assert "never invent" in joined or "do not invent" in joined


def test_prompt_asks_to_mirror_vacancy_vocabulary():
    msgs = ADAPT_PROMPT.format_messages(
        profile="P", track="energy", section_order="S",
        title="T", company="C", description="D")
    joined = " ".join(m.content for m in msgs).lower()
    assert "vocabulary" in joined and "do not rewrite them" in joined


def test_tailored_filename_format():
    name = tailored_filename("greenyellow.com", "Financial Modelling Analyst",
                             "Alex Rivera", datetime.date(2026, 8, 17))
    assert name == ("20260817_greenyellow-com_Financial-Modelling-Analyst"
                    "_AlexRivera.md")


def test_tailored_filename_is_filesystem_safe():
    name = tailored_filename("A/B & Co.", "Analyst | Energy (Madrid)",
                             "Alex Rivera", datetime.date(2026, 1, 5))
    assert "/" not in name and "|" not in name and "&" not in name
    assert name.startswith("20260105_") and name.endswith("_AlexRivera.md")


def test_run_adapt_cv_writes_to_tailored_dir(tmp_path):
    v = Vacancy(id="ai-0815-01", title="AI Engineer", company="Acme Corp",
                url="u", source="lever", description="Build agents")
    cache_vacancy(v, tmp_path / "cache")
    cv_dir = tmp_path / "tailored"
    out = run_adapt_cv("ai-0815-01", llm=FakeLLM(), out_dir=tmp_path,
                       today=datetime.date(2026, 8, 15), cv_dir=cv_dir,
                       profile_path="profile/example_profile.yaml")
    assert out == cv_dir / "20260815_Acme-Corp_AI-Engineer_AlexRivera.md"
    assert "Tailored CV body" in out.read_text(encoding="utf-8")


def test_run_adapt_cv_never_touches_master_cvs(tmp_path):
    """Master CVs are hand-curated: generation must only ever add new files."""
    import pathlib
    masters = {p: p.read_bytes() for p in pathlib.Path("cv/master").glob("*.md")}
    assert masters, "expected master CVs to exist"
    v = Vacancy(id="energy-0815-09", title="Energy Analyst", company="Zeta",
                url="u", source="jsearch", description="Model power prices")
    cache_vacancy(v, tmp_path / "cache")
    run_adapt_cv("energy-0815-09", llm=FakeLLM(), out_dir=tmp_path,
                 today=datetime.date(2026, 8, 15), cv_dir=tmp_path / "tailored",
                 profile_path="profile/example_profile.yaml")
    for path, content in masters.items():
        assert path.read_bytes() == content


def test_run_adapt_cv_accepts_profile_path(tmp_path):
    import shutil
    alt = tmp_path / "alt.yaml"
    shutil.copy("profile/example_profile.yaml", alt)
    v = Vacancy(id="ai-0815-02", title="AI Engineer", company="Beta",
                url="u", source="lever", description="Build agents")
    cache_vacancy(v, tmp_path / "cache")
    out = run_adapt_cv("ai-0815-02", llm=FakeLLM(), out_dir=tmp_path,
                       today=datetime.date(2026, 8, 15),
                       profile_path=str(alt), cv_dir=tmp_path / "tailored")
    assert out.exists()


def test_prompt_requires_name_heading_and_keeps_the_profiles_own_lines():
    msgs = ADAPT_PROMPT.format_messages(
        profile="P", track="energy", section_order="S",
        title="T", company="C", description="D")
    joined = " ".join(m.content for m in msgs).lower()
    assert "full name from the profile" in joined
    assert "never the type of work" in joined
    # dates and places are copied as written, not re-punctuated
    assert "character for character" in joined and "dashes included" in joined
    # a bullet with nothing to mirror is left alone, skills keep their order
    assert "word for word" in joined
    assert "never reorder items" in joined


def test_cv_falls_back_to_the_scoring_model_when_the_first_one_fails(monkeypatch):
    import src.adapt_cv as adapt
    from src.config import load_tracks

    tried = []

    class Model:
        def __init__(self, model, google_api_key):
            self.model = model

        def invoke(self, messages):
            tried.append(self.model)
            if self.model == adapt.CV_MODELS[0]:
                raise RuntimeError("429 RESOURCE_EXHAUSTED")
            return AIMessage(content="# Alex Rivera\\nFrom the fallback")

    import langchain_google_genai
    monkeypatch.setattr(langchain_google_genai, "ChatGoogleGenerativeAI", Model)
    monkeypatch.setenv("GOOGLE_API_KEY", "test")

    cfg = next(iter(load_tracks().values()))
    vacancy = Vacancy(title="Analyst", company="Acme", location="", url="u",
                      source="manual", description="D")
    profile = {"contact": {"name": "Alex Rivera", "details": []},
               "headline": {"default": "Analyst"}, "sections": []}
    out = adapt.adapt_cv_markdown(vacancy, cfg, profile)

    assert tried == list(adapt.CV_MODELS)
    assert "From the fallback" in out
