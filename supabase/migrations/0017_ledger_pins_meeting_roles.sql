-- ============================================================
-- 0017 — Hours ledger + meeting roles + cutoff + AI pins
--   • meeting_attendees.role — attendee (= meeting length hrs) or contributor
--     (= length + 1 hr).
--   • hours_grants becomes the general hours LEDGER: +entry_date (when the
--     activity happened, for the profile breakdown) and +meeting_id.
--   • club_settings.hours_cutoff_date — derived event/meeting hours only count
--     on/after this date; everything before lives in the ledger (so the imported
--     spreadsheet history doesn't double-count old sign-ups). Migration 0018 sets it.
--   • pinned_items — pinned AI cards that survive regeneration (Feature 1).
--   • get_public_dashboard() hours math rewritten: ledger + cutoff-filtered
--     derived events + meeting attendance (role-weighted) + admin adjustment.
-- ============================================================

alter table public.meeting_attendees
  add column if not exists role text not null default 'attendee'
  check (role in ('attendee', 'contributor'));

alter table public.hours_grants add column if not exists entry_date date;
alter table public.hours_grants add column if not exists meeting_id uuid references public.meetings on delete set null;

alter table public.club_settings add column if not exists hours_cutoff_date date;

create table if not exists public.pinned_items (
  id         uuid primary key default gen_random_uuid(),
  surface    text not null,   -- dashboard | insights | suggestions | social
  kind       text not null,   -- insight | suggestion_event | suggestion_location | social
  payload    jsonb not null,  -- snapshot of the card content
  pinned_by  uuid references public.profiles on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists pinned_items_surface_idx on public.pinned_items (surface);

alter table public.pinned_items enable row level security;
drop policy if exists "pinned: all" on public.pinned_items;
create policy "pinned: all" on public.pinned_items for all to authenticated using (true) with check (true);

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pinned_items') then
    execute 'alter publication supabase_realtime add table public.pinned_items';
  end if;
end $$;

-- ---- Dashboard hours math (ledger + cutoff-filtered derived + meetings) ----
create or replace function public.get_public_dashboard()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with term as (
    select coalesce((select term_start_date from public.club_settings where id), '2026-06-01'::date) as start,
           coalesce((select hours_cutoff_date from public.club_settings where id), '1900-01-01'::date) as cut
  ),
  ev as (
    select p.id,
      coalesce(sum(case when e.date < current_date and e.date >= (select cut from term) then e.hours else 0 end), 0) as ev_total,
      coalesce(sum(case when e.date < current_date and e.date >= greatest((select start from term), (select cut from term)) then e.hours else 0 end), 0) as ev_term
    from public.profiles p
    left join public.event_signups s on s.member_id = p.id
    left join public.events e on e.id = s.event_id
    group by p.id
  ),
  mtg as (
    select p.id,
      coalesce(sum(case when m.date < current_date and not m.canceled and m.date >= (select cut from term)
        then (case when a.role = 'contributor' then 1 else 0 end)
           + (case when m.start_time is not null and m.end_time is not null and m.end_time > m.start_time
                   then extract(epoch from (m.end_time - m.start_time)) / 3600.0 else 1 end)
        else 0 end), 0) as m_total,
      coalesce(sum(case when m.date < current_date and not m.canceled and m.date >= greatest((select start from term), (select cut from term))
        then (case when a.role = 'contributor' then 1 else 0 end)
           + (case when m.start_time is not null and m.end_time is not null and m.end_time > m.start_time
                   then extract(epoch from (m.end_time - m.start_time)) / 3600.0 else 1 end)
        else 0 end), 0) as m_term
    from public.profiles p
    left join public.meeting_attendees a on a.member_id = p.id
    left join public.meetings m on m.id = a.meeting_id
    group by p.id
  ),
  led as (
    select member_id,
      coalesce(sum(hours), 0) as g_total,
      coalesce(sum(hours) filter (where coalesce(entry_date, granted_at::date) >= (select start from term)), 0) as g_term
    from public.hours_grants group by member_id
  ),
  member_hours as (
    select p.id, p.name, p.role, p.avatar_url, p.is_founder,
      coalesce(ev.ev_total, 0) + coalesce(mtg.m_total, 0) + coalesce(led.g_total, 0) + coalesce(p.hours_adjustment, 0) as hours,
      coalesce(ev.ev_term, 0) + coalesce(mtg.m_term, 0) + coalesce(led.g_term, 0) as term_hours
    from public.profiles p
    left join ev on ev.id = p.id
    left join mtg on mtg.id = p.id
    left join led on led.member_id = p.id
  )
  select jsonb_build_object(
    'members_count',     (select count(*) from public.profiles),
    'events_count',      (select count(*) from public.events where not is_tentative),
    'upcoming_events',   (select count(*) from public.events where not is_tentative and date >= current_date),
    'tentative_events',  (select count(*) from public.events where is_tentative),
    'upcoming_meetings', (select count(*) from public.meetings where date >= current_date and not canceled),
    'total_hours',       (select coalesce(sum(hours), 0) from member_hours),
    'term_hours',        (select coalesce(sum(term_hours), 0) from member_hours),
    'term_start',        (select start from term),
    'fundraising',       (select jsonb_build_object('raised', coalesce(gofundme_raised, 0), 'target', coalesce(raise_target, 500)) from public.club_settings where id),
    'insights',          (select coalesce(ai_insights, '[]'::jsonb) from public.club_settings where id),
    'leaderboard', (
      select coalesce(jsonb_agg(r), '[]'::jsonb) from (
        select jsonb_build_object('id', id, 'name', name, 'role', role, 'avatar_url', avatar_url,
                                  'is_founder', is_founder, 'hours', round(hours, 1), 'term_hours', round(term_hours, 1)) as r
        from member_hours order by hours desc, name asc limit 8
      ) t
    ),
    'goals', (
      select coalesce(jsonb_agg(r), '[]'::jsonb) from (
        select jsonb_build_object('id', g.id, 'title', g.title, 'detail', g.detail, 'progress', g.progress,
                                  'status', g.status, 'target_date', g.target_date,
                                  'owner_name', op.name, 'owner_role', op.role, 'owner_avatar', op.avatar_url) as r
        from public.goals g left join public.profiles op on op.id = g.owner_id
        where g.status = 'active' order by g.created_at desc limit 6
      ) t
    ),
    'upcoming_events_list', (
      select coalesce(jsonb_agg(r), '[]'::jsonb) from (
        select jsonb_build_object('id', e.id, 'name', e.name, 'date', e.date, 'location', e.location,
                                  'is_tentative', e.is_tentative,
                                  'signups', (select count(*) from public.event_signups s where s.event_id = e.id)) as r
        from public.events e where not e.is_tentative and e.date >= current_date order by e.date asc limit 6
      ) t
    ),
    'upcoming_meetings_list', (
      select coalesce(jsonb_agg(r), '[]'::jsonb) from (
        select jsonb_build_object('id', m.id, 'title', m.title, 'date', m.date, 'start_time', m.start_time,
                                  'attendees', (select count(*) from public.meeting_attendees a where a.meeting_id = m.id)) as r
        from public.meetings m where m.date >= current_date and not m.canceled order by m.date asc, m.start_time asc limit 6
      ) t
    )
  );
$$;
