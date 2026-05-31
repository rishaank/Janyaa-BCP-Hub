-- ============================================================
-- club_settings — a single shared row for club-wide settings.
-- Holds the editable fundraising goal (anyone can change it, applies to
-- everyone) and the latest GoFundMe figures (written by the sync-gofundme
-- Edge Function).  Run this in the Supabase SQL Editor.
-- ============================================================
create table if not exists public.club_settings (
  id                 boolean primary key default true,
  raise_target       numeric not null default 500,
  gofundme_url       text,
  gofundme_raised    numeric,
  gofundme_goal      numeric,
  gofundme_donations int,
  gofundme_synced_at timestamptz,
  constraint club_settings_single_row check (id)
);

alter table public.club_settings enable row level security;

drop policy if exists club_settings_read   on public.club_settings;
drop policy if exists club_settings_update on public.club_settings;
-- Any signed-in member can read settings and edit the goal (shared for everyone).
create policy club_settings_read   on public.club_settings for select to authenticated using (true);
create policy club_settings_update on public.club_settings for update to authenticated using (true) with check (true);

-- Seed the single row with the current GoFundMe snapshot (captured now), so the
-- live number shows even before the sync function is deployed. `do nothing`
-- protects any goal you later edit from being reset on a re-run.
insert into public.club_settings
  (id, raise_target, gofundme_url, gofundme_raised, gofundme_goal, gofundme_donations, gofundme_synced_at)
values
  (true, 1300,
   'https://www.gofundme.com/f/support-janyaa-every-dollar-makes-a-difference',
   960, 1300, 15, now())
on conflict (id) do nothing;
