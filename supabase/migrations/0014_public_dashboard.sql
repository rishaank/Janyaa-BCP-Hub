-- ============================================================
-- 0014 — Public dashboard RPC
--   get_public_dashboard(): a SECURITY DEFINER function returning exactly the
--   data the Dashboard renders, as one jsonb blob — counts, term + all-time
--   hours, fundraising, the hours leaderboard, AI insights, active goals, and
--   the upcoming events + meetings lists. Granted to anon so the dashboard can
--   load without a session (Feature 6). It returns no emails and exposes no raw
--   tables to anonymous readers — only the dashboard's own view of the data.
-- ============================================================
create or replace function public.get_public_dashboard()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with term as (
    select coalesce((select term_start_date from public.club_settings where id), '2026-06-01'::date) as start
  ),
  hrs as (
    select
      p.id,
      coalesce(sum(case when e.date < current_date then e.hours else 0 end), 0) as ev_total,
      coalesce(sum(case when e.date < current_date and e.date >= (select start from term) then e.hours else 0 end), 0) as ev_term
    from public.profiles p
    left join public.event_signups s on s.member_id = p.id
    left join public.events e on e.id = s.event_id
    group by p.id
  ),
  member_hours as (
    select
      p.id, p.name, p.role, p.avatar_url, p.is_founder,
      coalesce(h.ev_total, 0) + coalesce(p.hours_adjustment, 0) as hours,
      coalesce(h.ev_term, 0) as term_hours
    from public.profiles p
    left join hrs h on h.id = p.id
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
                                  'is_founder', is_founder, 'hours', hours, 'term_hours', term_hours) as r
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

revoke all on function public.get_public_dashboard() from public;
grant execute on function public.get_public_dashboard() to anon, authenticated;
