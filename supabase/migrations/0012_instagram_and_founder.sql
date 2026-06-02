-- ============================================================
-- 0012 — Instagram links on events + Founder flag on profiles
--   • events.instagram_urls — zero or more Instagram post links per event.
--   • profiles.is_founder    — marks club founders (shown as a badge in the UI).
-- ============================================================
alter table public.events   add column if not exists instagram_urls text[] not null default '{}';
alter table public.profiles add column if not exists is_founder boolean not null default false;
