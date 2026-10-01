# 🎯 Job Seeker

### *Find the roles worth your time, and the words that win them* · *Apps for Your Life*

---

## 🎯 The Problem

Job hunting punishes you twice. First you scroll through hundreds of listings that
look relevant and are not: the wrong seniority, the wrong country, a sales role
wearing an engineer's title. Then, for the few that fit, you rewrite your CV by
hand, guessing which words the recruiter is looking for and quietly hoping the
keyword filter agrees with you.

## 💡 The Solution

Job Seeker searches several job APIs at once, throws out everything that fails
your own criteria **before** paying for an AI opinion, and scores what remains
against your profile with reasons you can argue with. When a vacancy is worth it,
it writes a CV tailored to that posting - mirroring the vacancy's vocabulary,
never inventing a single fact - and walks you through every change so nothing
reaches a recruiter without your approval.

## ✨ Core Features

| Feature | Description |
|---|---|
| **Search where the jobs actually are** | Adzuna, JSearch (Google for Jobs), Tavily web search, and company boards on Greenhouse, Lever and Ashby - each optional, each degrading gracefully when a key is missing |
| **Filter before you pay** | Seniority, job function, years of experience, location and a per-company cap are applied before the LLM is called; one run dropped 539 irrelevant vacancies and spent nothing on them |
| **Score with reasons** | Gemini returns 0-100 plus what matches, what is missing, and hard blockers like work authorisation, so you can disagree with a verdict |
| **Tailor a CV to one vacancy** | The model may re-order, re-emphasise and re-word your real experience to match the posting's language. It may never invent a fact, a metric or a skill |
| **Approve every change** | Step through the diff against your master CV, accept or reject each edit, then produce the PDF |
| **Bring any CV, any profession** | Import a .docx or .pdf and the schema adapts: sections, skills categories and career tracks are YAML, not code |
| **Keep your data yours** | Your profile, CVs and results never leave your machine and are excluded from git by default |

## 🚀 Quick Start

```bash
# Install dependencies
uv sync --extra dev

# Configure keys and profile
cp .env.example .env                       # only GOOGLE_API_KEY is required
cp profile/example_profile.yaml profile/master_profile.yaml
```

Then run the loop:

```bash
uv run jobseeker search-and-score --track energy      # find, filter, score
uv run jobseeker adapt-cv --vacancy-id energy-0817-02 # tailor the CV
```

Found a vacancy yourself? Score it without a search:

```bash
uv run jobseeker match --track ai --url https://example.com/job/123
```

### Testing

```bash
# Run all 97 tests offline (no API calls, no LLM calls)
uv run pytest -q
```

The suite runs against a fictional example profile, so it passes on a fresh clone.

## 🔑 API Keys

| Key | Powers | Free tier |
|---|---|---|
| `GOOGLE_API_KEY` | scoring and CV writing (Gemini) | yes |
| `ADZUNA_APP_ID` · `ADZUNA_APP_KEY` | keyword job search | ~1,000 calls/month |
| `RAPIDAPI_KEY` | JSearch: LinkedIn and Indeed listings via Google for Jobs | limited |
| `TAVILY_API_KEY` | web search for vacancies the APIs miss | ~1,000 searches/month |

Company career boards need no key at all - list the companies you care about in
`config/watchlist.yaml`.

## 🧠 How the Pipeline Works

```
search_jobs  ->  dedupe_filter  ->  score_match  ->  write_output
 Adzuna,          duplicates,       Gemini,          CSV + Markdown
 JSearch,         age, title,       0-100 with       report per run
 Tavily,          seniority,        reasons
 ATS boards       location, cap
```

Two LangGraph pipelines, one for searching and scoring, one for writing a CV, with
the interactive review as the human checkpoint between generation and output.

| Directory | Contents |
|---|---|
| `src/sources/` | one adapter per job source |
| `src/graphs/` | the LangGraph pipelines |
| `src/prompts/` | every prompt sent to the model, in full |
| `config/` | career tracks, filters, company watchlist |
| `profile/` | your profile (private) and a worked example |
| `cv/master/` | your hand-written CVs, never modified by the tool |
| `cv/tailored/` | generated CVs, one file per application |

## 🧩 Built With

**Python 3.11** · **LangGraph** · **LangChain** · **Gemini API** · **pydantic** · **click** · **httpx** · **pytest** · **uv**

## ⚠️ Honest Limits

- **No scraping of LinkedIn, Indeed or Glassdoor.** Their APIs do not offer job
  search to third parties and scraping them breaks their terms; JSearch reaches
  the same listings legitimately through Google for Jobs.
- **Coverage is uneven by market.** Check that a source really carries vacancies
  for your country before relying on it - one live test found four relevant hits
  in a whole national market.
- **Scores are judgements, not verdicts.** They rank vacancies for your
  attention. You still decide.

## 📄 License

Copyright © 2026 Olga Aksenova.

The code in this repository is licensed under the **[Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0)** – see [LICENSE](LICENSE) for the full text.
