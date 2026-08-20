# Database

The hosted version stores runs, vacancies, applications and generated CVs in
Supabase (PostgreSQL). The CLI works without it - the database is only needed
for the web interface.

## Setting it up

1. Create a project at [supabase.com](https://supabase.com) (free tier, region
   close to you).
2. Open **SQL Editor** and run every file in `migrations/`, in order.
3. **Authentication → Providers → Google**: enable it and add the OAuth client
   ID and secret from Google Cloud Console.
4. **Settings → API**: copy the values into `.env`:

```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=<anon public key>
SUPABASE_EMAIL=<your account email>       # used by the CLI to sign in
SUPABASE_PASSWORD=<your account password>
```

The CLI signs in as a normal user, so everything it writes goes through Row
Level Security exactly like the website. The service-role key is never used by
this project and must never appear in the frontend - it bypasses RLS entirely.

## Where the search settings live

A track used to be a block in `config/tracks.yaml`, which nobody using the
website can edit. It now lives in the `tracks` table, one row per user, edited on
the Settings page. The `data` column holds the same fields as one YAML block and
is parsed by the same `TrackConfig` model, so both routes produce identical
objects.

Tracks are created and edited on the Settings page. When an account has no
tracks at all the engine falls back to the file, so a checkout with no database
still runs.

## Isolation

Every table has `user_id` and a policy allowing access only when
`auth.uid() = user_id`, with RLS explicitly enabled. Forgetting the
`alter table ... enable row level security` line is the usual way Supabase
projects leak data between users, so `tests/test_rls.py` signs in as two
separate users and asserts that neither can see the other's rows.

## Quotas

Guests run on the site owner's API keys, so `usage_daily` counts searches and CV
generations per user per day, and `user_limits.unlimited` exempts the owner.
Limits live in `config/limits.yaml`.

## Schema at a glance

| Table | Holds |
|---|---|
| `profiles` | the candidate profile CVs are generated from |
| `tracks` | one saved search: what to look for, where, and what to exclude |
| `runs` | one row per search execution, with source and filter statistics |
| `vacancies` | vacancies with their score, verdict and reasoning |
| `applications` | tracker status per vacancy |
| `cvs` | generated CVs, with an approval flag |
| `user_limits`, `usage_daily` | quota override and daily counters |

## How work gets done

A search takes minutes, so the site never runs one. It writes a row to `jobs`
and asks a GitHub Actions runner to pick it up; the browser watches that row.

The worker connects with the **service-role key**, which bypasses Row Level
Security — there is no signed-in session inside a CI runner, and it has to act
for whichever account owns the job. That key belongs in GitHub Actions secrets
and nowhere else: never in the frontend, never in `NEXT_PUBLIC_` anything.

The consequence is that isolation stops being the database's problem for that
one process. Every read and write in `src/worker.py` is scoped to the job's
`user_id`, and `tests/test_worker.py` exists mainly to keep it that way.
