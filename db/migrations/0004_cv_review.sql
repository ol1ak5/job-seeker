-- Reviewing what the model changed.
--
-- A tailored CV is only trustworthy if you can see what was altered. Storing
-- the generated text alone makes that impossible: there is nothing to compare
-- it against, and a model that quietly dropped a job or invented a metric looks
-- exactly like one that did well.
--
-- So each row keeps both sides. `baseline` is the CV as the profile alone would
-- render it, before the vacancy was taken into account; `markdown` is what came
-- back. `approved` holds the version the reader settled on after accepting,
-- rejecting or rewriting each change - which is the one worth sending.

alter table public.cvs
    add column if not exists baseline text not null default '';

alter table public.cvs
    add column if not exists approved_markdown text;

-- The old boolean said only that somebody had looked. What matters is what they
-- decided, and that now lives in approved_markdown being present or not.
alter table public.cvs
    drop column if exists approved;
