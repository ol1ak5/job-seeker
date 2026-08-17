-- Job Seeker: initial schema.
--
-- Run this in the Supabase SQL editor (or via psql with the connection string).
-- Every table carries user_id and has Row Level Security enabled, so a user can
-- only ever read or write their own rows - the isolation is enforced by the
-- database, not by application code.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- profiles --
-- The candidate profile that CVs are generated from, stored as JSON.
create table if not exists public.profiles (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users (id) on delete cascade,
    name        text not null default 'master',
    data        jsonb not null,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    unique (user_id, name)
);

-- -------------------------------------------------------------------- runs --
-- One row per search-and-score execution.
create table if not exists public.runs (
    id           uuid primary key default gen_random_uuid(),
    user_id      uuid not null references auth.users (id) on delete cascade,
    track        text not null,
    status       text not null default 'running'
                 check (status in ('running', 'done', 'failed')),
    days         integer,
    result_limit integer,
    sources      jsonb not null default '{}'::jsonb,  -- per-source counts and errors
    dropped      jsonb not null default '{}'::jsonb,  -- filter drop counts
    error        text,
    started_at   timestamptz not null default now(),
    finished_at  timestamptz
);

create index if not exists runs_user_started_idx
    on public.runs (user_id, started_at desc);

-- --------------------------------------------------------------- vacancies --
-- A vacancy with its score. Re-scoring overwrites; no score history in v1.
create table if not exists public.vacancies (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid not null references auth.users (id) on delete cascade,
    run_id          uuid references public.runs (id) on delete set null,
    ref             text not null,                    -- e.g. energy-0817-02
    track           text not null,
    title           text not null,
    company         text not null default 'Unknown',
    location        text not null default '',
    remote          boolean,
    posted          date,
    salary          text,
    url             text not null,
    source          text not null,
    description     text not null default '',
    score           integer check (score between 0 and 100),
    verdict         text check (verdict in
                    ('strong_match', 'worth_applying', 'stretch', 'skip')),
    matching_points jsonb not null default '[]'::jsonb,
    gaps            jsonb not null default '[]'::jsonb,
    flags           jsonb not null default '[]'::jsonb,
    created_at      timestamptz not null default now(),
    unique (user_id, url)
);

create index if not exists vacancies_user_score_idx
    on public.vacancies (user_id, track, score desc);

-- ------------------------------------------------------------ applications --
-- The tracker: where each vacancy stands.
create table if not exists public.applications (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users (id) on delete cascade,
    vacancy_id  uuid not null references public.vacancies (id) on delete cascade,
    status      text not null default 'interested'
                check (status in ('interested', 'applied', 'interview',
                                  'offer', 'rejected', 'declined')),
    applied_at  date,
    notes       text not null default '',
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    unique (user_id, vacancy_id)
);

-- --------------------------------------------------------------------- cvs --
-- Generated CVs, one row per (vacancy, generation).
create table if not exists public.cvs (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users (id) on delete cascade,
    vacancy_id  uuid references public.vacancies (id) on delete cascade,
    filename    text not null,
    markdown    text not null,
    approved    boolean not null default false,
    created_at  timestamptz not null default now()
);

create index if not exists cvs_user_created_idx
    on public.cvs (user_id, created_at desc);

-- ------------------------------------------------------------ user_limits --
-- Daily quota counters plus the per-account override. Guest accounts run on the
-- site owner's API keys, so their usage has to be capped.
create table if not exists public.user_limits (
    user_id    uuid primary key references auth.users (id) on delete cascade,
    unlimited  boolean not null default false,
    created_at timestamptz not null default now()
);

create table if not exists public.usage_daily (
    user_id  uuid not null references auth.users (id) on delete cascade,
    day      date not null default current_date,
    searches integer not null default 0,
    cvs      integer not null default 0,
    primary key (user_id, day)
);

-- -------------------------------------------------------------- updated_at --
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
    for each row execute function public.touch_updated_at();

drop trigger if exists applications_touch on public.applications;
create trigger applications_touch before update on public.applications
    for each row execute function public.touch_updated_at();

-- ---------------------------------------------------- row level security --
-- Every table: a user sees and touches only their own rows. Without the
-- `enable` line a policy has no effect, which is the classic Supabase leak.
alter table public.profiles     enable row level security;
alter table public.runs         enable row level security;
alter table public.vacancies    enable row level security;
alter table public.applications enable row level security;
alter table public.cvs          enable row level security;
alter table public.user_limits  enable row level security;
alter table public.usage_daily  enable row level security;

do $$
declare
    t text;
begin
    foreach t in array array['profiles', 'runs', 'vacancies', 'applications',
                             'cvs', 'user_limits', 'usage_daily']
    loop
        execute format('drop policy if exists %I_own on public.%I', t, t);
        execute format(
            'create policy %I_own on public.%I
             for all
             to authenticated
             using (auth.uid() = user_id)
             with check (auth.uid() = user_id)', t, t);
    end loop;
end;
$$;

-- New sign-ups get a limits row automatically.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.user_limits (user_id) values (new.id)
    on conflict (user_id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
