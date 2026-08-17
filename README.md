# Job Seeker

A command-line job-search assistant: it searches vacancies across several job
APIs, scores how well each one fits your profile with an LLM, and writes a CV
tailored to a specific vacancy - with a review step so you approve every change
before it reaches the PDF.

Built with LangGraph, LangChain and the Gemini API.

## What it does

```
search-and-score  ->  find vacancies, filter them, score the fit, write a report
adapt-cv          ->  write a CV tailored to one vacancy
review            ->  step through every change and accept or reject it
match             ->  score a single vacancy you found yourself (file or URL)
import-cv         ->  turn any CV file into a profile you can edit
```

Everything is driven by two YAML files: a **profile** (your experience, one
source of truth for every CV) and **tracks** (what to search for and how to
judge a fit). Adding a new career track, or supporting an entirely different
profession, means editing YAML - not code.

## Quick start

```bash
git clone https://github.com/<you>/job-seeker.git
cd job-seeker
uv sync                                   # installs Python 3.11 + dependencies

cp .env.example .env                      # add your API keys, see below
cp profile/example_profile.yaml profile/master_profile.yaml
$EDITOR profile/master_profile.yaml       # replace the example with your own CV

uv run jobseeker search-and-score --track energy
uv run jobseeker adapt-cv --vacancy-id energy-0817-02
uv run jobseeker review --vacancy-id energy-0817-02 --pdf
```

Already have a CV? Skip the manual profile step:

```bash
uv run jobseeker import-cv --file ~/Documents/MyCV.docx
```

## API keys

Only `GOOGLE_API_KEY` is strictly required; every source is optional and the
run continues without the ones you skip. See `.env.example` for links.

| Key | Used for | Free tier |
|---|---|---|
| `GOOGLE_API_KEY` | scoring and CV writing (Gemini) | yes |
| `ADZUNA_APP_ID` / `ADZUNA_APP_KEY` | keyword job search | ~1,000 calls/month |
| `RAPIDAPI_KEY` | JSearch (Google-for-Jobs listings) | limited |
| `TAVILY_API_KEY` | web search for vacancies missing from the APIs | ~1,000 searches/month |

Company career boards (Greenhouse, Lever, Ashby) need no key at all - list the
companies you care about in `config/watchlist.yaml`.

## How it fits together

```
search-and-score
  search_jobs -> dedupe_filter -> score_match -> write_output
   Adzuna,        duplicates,      Gemini,        CSV + Markdown
   JSearch,       age, title,      0-100 with     report per run
   Tavily,        seniority,       reasons
   ATS boards     location, cap
```

Filtering happens **before** the LLM is called, so paid calls are spent only on
plausible vacancies. A run reports what it dropped and why.

CV generation never invents anything: the model may only re-order, re-emphasise
and re-word what the profile already states, and it mirrors the vacancy's own
vocabulary so the overlap is visible to a recruiter and an ATS keyword filter.

| Directory | Contents |
|---|---|
| `src/sources/` | one adapter per job source |
| `src/graphs/` | the LangGraph pipelines |
| `src/prompts/` | every prompt sent to the model |
| `config/` | tracks, filters and the company watchlist |
| `profile/` | your profile (private) and a worked example |
| `cv/master/` | your hand-written CVs, never modified by the tool |
| `cv/tailored/` | generated CVs, one file per application |

## Privacy

Your profile, CVs and search results stay on your machine - `.gitignore`
excludes `profile/master_profile.yaml`, `cv/master/`, `cv/tailored/` and
`output/`. Only the fictional `profile/example_profile.yaml` is committed.

## Tests

```bash
uv run pytest -q     # 97 tests, no network and no LLM calls
```

The suite runs against the example profile, so it passes on a fresh clone.

## Notes and limits

- No LinkedIn, Indeed or Glassdoor scraping. Their APIs do not offer job search
  to third parties, and scraping them violates their terms; JSearch reaches the
  same listings legitimately through Google for Jobs.
- Coverage varies by market. Verify a source has real vacancies for your
  country before relying on it.
- Scores are model judgements. They rank candidates for your attention; they do
  not decide anything for you.
