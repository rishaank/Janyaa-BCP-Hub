-- ============================================================
-- 0016 — Shareable event view + AI suggestions / planner / social
--   • events.latitude / longitude — captured from the location autocomplete so
--     the public event view can show a map (UI geocodes the address as a fallback).
--   • club_settings caches for the new AI features (suggestions + social posts).
--   • get_public_event(uuid) — anon-readable single event (no emails) for the
--     shareable full-screen view (Feature 2).
--   • monthly-social pg_cron → ai-social edge function (Feature 5 refresh).
-- ============================================================

alter table public.events add column if not exists latitude  numeric;
alter table public.events add column if not exists longitude numeric;

alter table public.club_settings add column if not exists ai_suggestions   jsonb;
alter table public.club_settings add column if not exists ai_suggestions_at timestamptz;
alter table public.club_settings add column if not exists social_posts      jsonb;
alter table public.club_settings add column if not exists social_posts_at   timestamptz;

-- ---- Public single event for the shareable view ----
create or replace function public.get_public_event(p_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select case when e.id is null then null else jsonb_build_object(
    'id', e.id, 'name', e.name, 'date', e.date, 'start_time', e.start_time, 'end_time', e.end_time,
    'location', e.location, 'address', e.address, 'latitude', e.latitude, 'longitude', e.longitude,
    'hours', e.hours, 'raised', e.raised, 'notes', e.notes, 'instagram_urls', e.instagram_urls,
    'is_tentative', e.is_tentative,
    'attendees', (
      select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'role', p.role, 'avatar_url', p.avatar_url) order by p.name), '[]'::jsonb)
      from public.event_signups s join public.profiles p on p.id = s.member_id where s.event_id = e.id
    )
  ) end
  from public.events e where e.id = p_id;
$$;
revoke all on function public.get_public_event(uuid) from public;
grant execute on function public.get_public_event(uuid) to anon, authenticated;

-- ---- Monthly social-media refresh → ai-social (verify_jwt = false) ----
-- Same pg_cron + pg_net pattern as send-reminders; uses the publishable key.
do $$ begin perform cron.unschedule('monthly-social'); exception when others then null; end $$;
select cron.schedule(
  'monthly-social',
  '0 14 1 * *',
  $req$
  select net.http_post(
    url:='https://sgjcliwmzshhkhjlbdjy.supabase.co/functions/v1/ai-social',
    headers:='{"Content-Type":"application/json","apikey":"sb_publishable_G_CYr7cEiRJhN67ACmhuLg_q2h2yji3"}'::jsonb,
    body:='{"scheduled":true}'::jsonb
  )
  $req$
);
