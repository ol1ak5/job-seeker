-- Work the site asks for and the engine performs.
--
-- A search takes minutes: several job boards, then one model call per vacancy.
-- That is far too long to answer inside a web request, so the site does not run
-- it. It writes a row here, asks the engine to wake up, and watches this row
-- change - which is the only reason the button can exist at all.
--
-- The engine connects with the service-role key, so these rows are the only
-- record of whose work it is doing. Every worker query must filter on user_id
-- from the job: nothing else stands between one account and another.

create table if not exists public.jobs (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references auth.users (id) on delete cascade,
    kind        text not null default 'search'
                check (kind in ('search', 'adapt', 'match')),
    track       text,
    payload     jsonb not null default '{}'::jsonb,
    status      text not null default 'queued'
                check (status in ('queued', 'running', 'done', 'failed')),
    error       text,
    result      jsonb not null default '{}'::jsonb,
    created_at  timestamptz not null default now(),
    started_at  timestamptz,
    finished_at timestamptz
);

create index if not exists jobs_user_created_idx
    on public.jobs (user_id, created_at desc);

-- The site polls the newest unfinished job on every page load.
create index if not exists jobs_pending_idx
    on public.jobs (user_id, status) where status in ('queued', 'running');

alter table public.jobs enable row level security;

drop policy if exists jobs_own on public.jobs;
create policy jobs_own on public.jobs
    for all
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
