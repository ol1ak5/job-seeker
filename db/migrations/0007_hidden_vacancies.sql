-- Vacancies you have put away.
--
-- A vacancy is hidden rather than deleted: the search would find a deleted one
-- again and bring it back, while a hidden one stays known and stays away. The
-- dashboard can show it again with one click, which a delete could not undo.

alter table public.vacancies
    add column if not exists hidden_at timestamptz;
