-- Columns you add to the vacancy table yourself.
--
-- Everybody tracks something the table does not have: a recruiter's name, a
-- referral, the salary they mentioned on the phone. Rather than guess at those
-- one by one, the dashboard lets you add a column, name it, and type into it
-- for each vacancy.
--
-- A column is a row here. What you type lives on the application, in `extra`,
-- keyed by the column's id, so renaming a column keeps its values and deleting
-- one leaves nothing else touched.

create table if not exists public.custom_columns (
    id         uuid primary key default gen_random_uuid(),
    user_id    uuid not null references auth.users (id) on delete cascade,
    name       text not null check (char_length(name) between 1 and 40),
    position   integer not null default 0,
    created_at timestamptz not null default now()
);

create index if not exists custom_columns_user_idx
    on public.custom_columns (user_id, position);

-- Same rule as every other table: a user only ever sees their own rows.
alter table public.custom_columns enable row level security;

drop policy if exists custom_columns_own on public.custom_columns;
create policy custom_columns_own on public.custom_columns
    for all
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

alter table public.applications
    add column if not exists extra jsonb not null default '{}'::jsonb;
