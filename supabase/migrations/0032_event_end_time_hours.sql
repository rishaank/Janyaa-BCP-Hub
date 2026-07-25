-- ============================================================
-- 0032 — Events grant hours when they END (PST), not at UTC midnight.
--
--   Migration 0030 made meetings end-time aware; events were left date-based on
--   `e.date < current_date`. Because the database runs in UTC, current_date rolls
--   over at 00:00 UTC = 5 PM PDT / 4 PM PST the SAME day — so an event dated today
--   with a 7 PM end time credited its sign-ups at 5 PM, two hours before it ended
--   (and an untimed event credited mid-afternoon rather than at end of day).
--
--   Events now use the same instant as meetings:
--       (e.date + coalesce(e.end_time, '23:59')) at time zone 'America/Los_Angeles' <= now()
--   so an event flips upcoming → past and credits its sign-ups the moment it ends
--   in club time. Nothing is materialized — hours stay derived — so moving an
--   event's date/time forward removes the hours again until the new end passes.
--
--   Also enforces the documented rule that TENTATIVE events never earn hours
--   (previously a tentative event with a past date would have counted).
--
--   Touches: get_hours_breakdowns() and get_public_dashboard() (hours + the
--   upcoming-events count and list, which had the same 5 PM cutover).
-- ============================================================

-- ---- Itemized hours breakdown — events count once they end (PST) ----
create or replace function public.get_hours_breakdowns(p_member uuid default null)
returns jsonb language sql security definer set search_path = public stable as $$
  with cfg as (
    select public.current_term_start() as term_start,
           coalesce((select hours_cutoff_date from public.club_settings where id), '1900-01-01'::date) as cut
  ),
  entries as (
    select hg.member_id,
           (case when hg.source = 'import' then hg.entry_date else coalesce(hg.entry_date, hg.granted_at::date) end) as edate,
           hg.hours::numeric as hours,
           coalesce(nullif(hg.note, ''), 'Hours') as description, hg.source as kind, hg.event_id, hg.meeting_id,
           hg.id as grant_id
    from public.hours_grants hg
    union all
    select s.member_id, e.date, e.hours::numeric, e.name, 'event', e.id, null::uuid, null::uuid
    from public.event_signups s join public.events e on e.id = s.event_id
    where e.date is not null and not e.is_tentative and e.date >= (select cut from cfg)
      and (e.date + coalesce(e.end_time, time '23:59')) at time zone 'America/Los_Angeles' <= now()
    union all
    select a.member_id, m.date,
      ((case when a.role = 'contributor' then 1 else 0 end)
       + (case when m.start_time is not null and m.end_time is not null and m.end_time > m.start_time
               then extract(epoch from (m.end_time - m.start_time)) / 3600.0 else 1 end))::numeric,
      m.title || ' (' || a.role || ')', 'meeting', null::uuid, m.id, null::uuid
    from public.meeting_attendees a join public.meetings m on m.id = a.meeting_id
    where not m.canceled and m.date >= (select cut from cfg)
      and (m.date + coalesce(m.end_time, time '23:59')) at time zone 'America/Los_Angeles' <= now()
    union all
    select p.id, null::date, p.hours_adjustment::numeric, 'Manual admin adjustment', 'manual', null::uuid, null::uuid, null::uuid
    from public.profiles p where p.hours_adjustment <> 0
  )
  select coalesce(jsonb_agg(row order by row ->> 'name'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'member_id', p.id, 'name', p.name, 'role', p.role, 'avatar_url', p.avatar_url,
      'total', round(coalesce(sum(en.hours), 0), 1),
      'term_total', round(coalesce(sum(en.hours) filter (where en.edate is not null and en.edate >= (select term_start from cfg)), 0), 1),
      'entries', coalesce(
        jsonb_agg(
          jsonb_build_object('date', en.edate, 'hours', en.hours, 'description', en.description,
                             'kind', en.kind, 'event_id', en.event_id, 'meeting_id', en.meeting_id,
                             'grant_id', en.grant_id)
          order by en.edate desc nulls last
        ) filter (where en.hours is not null), '[]'::jsonb)
    ) as row
    from public.profiles p
    left join entries en on en.member_id = p.id
    where p_member is null or p.id = p_member
    group by p.id, p.name, p.role, p.avatar_url
  ) t;
$$;
revoke execute on function public.get_hours_breakdowns(uuid) from public, anon;
grant execute on function public.get_hours_breakdowns(uuid) to authenticated;

-- ---- Dashboard — event hours + upcoming events use the same end instant ----
create or replace function public.get_public_dashboard()
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  with term as (
    select public.current_term_start() as start,
           coalesce((select hours_cutoff_date from public.club_settings where id), '1900-01-01'::date) as cut
  ),
  ev as (
    select p.id,
      coalesce(sum(case when e.ended and e.date >= (select cut from term) then e.hours else 0 end), 0) as ev_total,
      coalesce(sum(case when e.ended and e.date >= greatest((select start from term), (select cut from term)) then e.hours else 0 end), 0) as ev_term
    from public.profiles p
    left join public.event_signups s on s.member_id = p.id
    left join (
      select e.*, (e.date is not null and not e.is_tentative
        and (e.date + coalesce(e.end_time, time '23:59')) at time zone 'America/Los_Angeles' <= now()) as ended
      from public.events e
    ) e on e.id = s.event_id
    group by p.id
  ),
  mtg as (
    select p.id,
      coalesce(sum(case when not m.canceled and m.date >= (select cut from term)
        and (m.date + coalesce(m.end_time, time '23:59')) at time zone 'America/Los_Angeles' <= now()
        then (case when a.role = 'contributor' then 1 else 0 end)
           + (case when m.start_time is not null and m.end_time is not null and m.end_time > m.start_time
                   then extract(epoch from (m.end_time - m.start_time)) / 3600.0 else 1 end)
        else 0 end), 0) as m_total,
      coalesce(sum(case when not m.canceled and m.date >= greatest((select start from term), (select cut from term))
        and (m.date + coalesce(m.end_time, time '23:59')) at time zone 'America/Los_Angeles' <= now()
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
      coalesce(sum(hours) filter (where (case when source = 'import' then entry_date else coalesce(entry_date, granted_at::date) end) >= (select start from term)), 0) as g_term
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
    'events_term',       (select count(*) from public.events where not is_tentative and date >= (select start from term)),
    'upcoming_events',   (select count(*) from public.events e where not e.is_tentative and e.date is not null
                            and (e.date + coalesce(e.end_time, time '23:59')) at time zone 'America/Los_Angeles' > now()),
    'tentative_events',  (select count(*) from public.events where is_tentative),
    'meetings_count',    (select count(*) from public.meetings where not canceled),
    'meetings_term',     (select count(*) from public.meetings where not canceled and date >= (select start from term)),
    'upcoming_meetings', (select count(*) from public.meetings m where not m.canceled
                            and (m.date + coalesce(m.end_time, time '23:59')) at time zone 'America/Los_Angeles' > now()),
    'total_hours',       (select coalesce(sum(hours), 0) from member_hours),
    'term_hours',        (select coalesce(sum(term_hours), 0) from member_hours),
    'term_start',        (select start from term),
    'fundraising',       (select jsonb_build_object('raised', coalesce(gofundme_raised, 0), 'target', coalesce(raise_target, 500)) from public.club_settings where id),
    'insights',          (select coalesce(ai_insights, '[]'::jsonb) from public.club_settings where id),
    'term_targets',      (select coalesce(term_targets, '[]'::jsonb) from public.club_settings where id),
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
                                  'period', g.period,
                                  'owner_name', op.name, 'owner_role', op.role, 'owner_avatar', op.avatar_url) as r
        from public.goals g left join public.profiles op on op.id = g.owner_id
        where coalesce(g.progress, 0) < 100
        order by (g.period = 'TERM') desc, g.progress desc, g.created_at desc limit 6
      ) t
    ),
    'upcoming_events_list', (
      select coalesce(jsonb_agg(r), '[]'::jsonb) from (
        select jsonb_build_object('id', e.id, 'name', e.name, 'date', e.date, 'location', e.location,
                                  'is_tentative', e.is_tentative,
                                  'signups', (select count(*) from public.event_signups s where s.event_id = e.id)) as r
        from public.events e where not e.is_tentative and e.date is not null
          and (e.date + coalesce(e.end_time, time '23:59')) at time zone 'America/Los_Angeles' > now()
        order by e.date asc limit 6
      ) t
    ),
    'upcoming_meetings_list', (
      select coalesce(jsonb_agg(r), '[]'::jsonb) from (
        select jsonb_build_object('id', m.id, 'title', m.title, 'date', m.date, 'start_time', m.start_time,
                                  'attendees', (select count(*) from public.meeting_attendees a where a.meeting_id = m.id)) as r
        from public.meetings m where not m.canceled
          and (m.date + coalesce(m.end_time, time '23:59')) at time zone 'America/Los_Angeles' > now()
        order by m.date asc, m.start_time asc limit 6
      ) t
    )
  );
$function$;
