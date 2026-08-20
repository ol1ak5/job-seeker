-- Search settings, per user.
--
-- Until now a "track" (what to search for, where, and what to exclude) lived in
-- config/tracks.yaml on the developer's machine. That file cannot be edited by
-- somebody using the website, so the same definition moves into the database,
-- one row per track per user. The CLI falls back to the YAML file when a user
-- has no rows yet, so nothing breaks for a local-only setup.
--
-- The body is stored as jsonb rather than twenty columns: it is exactly one
-- YAML block, it is validated by the same pydantic model on the way in and out,
-- and adding a filter later needs no migration.

create table if not exists public.tracks (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references auth.users (id) on delete cascade,
    name       text not null,                    -- slug used by the CLI: --track energy
    label      text not null default '',         -- what the user sees: "Energy consulting"
    data       jsonb not null default '{}'::jsonb,
    enabled    boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, name),
    -- vacancies.track stores this name, so it has to stay URL- and CLI-safe
    constraint tracks_name_slug check (name ~ '^[a-z0-9][a-z0-9_-]*$')
);

create index if not exists tracks_user_idx on public.tracks (user_id, name);

drop trigger if exists tracks_touch on public.tracks;
create trigger tracks_touch before update on public.tracks
    for each row execute function public.touch_updated_at();

-- Same rule as every other table: a user only ever sees their own rows.
alter table public.tracks enable row level security;

drop policy if exists tracks_own on public.tracks;
create policy tracks_own on public.tracks
    for all
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
