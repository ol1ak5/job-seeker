-- What you write in the Applied column.
--
-- `applied_at` is a date the dashboard fills in when a vacancy is marked as
-- applied. People record more than a day there - "via referral, 3 Oct", "sent
-- twice" - so the column on the page is free text, kept beside the date rather
-- than replacing it.

alter table public.applications
    add column if not exists applied_text text not null default '';
