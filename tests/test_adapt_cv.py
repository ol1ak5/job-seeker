import datetime

from langchain_core.messages import AIMessage

from src.graphs.adapt_cv import run_adapt_cv
from src.models import Vacancy
from src.prompts.adapt_cv import ADAPT_PROMPT
from src.writers import cache_vacancy


class FakeLLM:
    def invoke(self, messages):
        return AIMessage(content="# Olga Aksenova\nTailored CV body")


def test_prompt_forbids_invention():
    msgs = ADAPT_PROMPT.format_messages(
        profile="P", track="ai", section_order="S",
        title="T", company="C", description="D")
    joined = " ".join(m.content for m in msgs).lower()
    assert "never invent" in joined or "do not invent" in joined


def test_run_adapt_cv_writes_file(tmp_path):
    v = Vacancy(id="ai-0815-01", title="AI Engineer", company="Acme Corp",
                url="u", source="lever", description="Build agents")
    cache_vacancy(v, tmp_path / "cache")
    out = run_adapt_cv("ai-0815-01", llm=FakeLLM(), out_dir=tmp_path,
                       today=datetime.date(2026, 8, 15))
    assert out == tmp_path / "cvs" / "2026-08-15_ai_acme-corp.md"
    assert "Tailored CV body" in out.read_text()


def test_run_adapt_cv_accepts_profile_path(tmp_path):
    import shutil
    alt = tmp_path / "alt.yaml"
    shutil.copy("profile/master_profile.yaml", alt)
    v = Vacancy(id="ai-0815-02", title="AI Engineer", company="Beta",
                url="u", source="lever", description="Build agents")
    cache_vacancy(v, tmp_path / "cache")
    out = run_adapt_cv("ai-0815-02", llm=FakeLLM(), out_dir=tmp_path,
                       today=datetime.date(2026, 8, 15),
                       profile_path=str(alt))
    assert out.exists()
