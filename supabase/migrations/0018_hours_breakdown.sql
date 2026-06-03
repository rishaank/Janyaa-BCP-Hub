-- ============================================================
-- 0018 — Hours breakdown RPC (Feature 3)
--   get_hours_breakdowns(p_member) returns, per member, the full itemized hours
--   history (ledger entries + cutoff-filtered event sign-ups + meeting attendance
--   + the admin adjustment), with a total + term total. p_member null = everyone
--   (for the global export). Authenticated-only (member transparency).
-- ============================================================
create or replace function public.get_hours_breakdowns(p_member uuid default null)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with cfg as (
    select coalesce((select term_start_date from public.club_settings where id), '2026-06-01'::date) as term_start,
           coalesce((select hours_cutoff_date from public.club_settings where id), '1900-01-01'::date) as cut
  ),
  entries as (
    -- ledger (imported history, role grants, manual ledger entries)
    select hg.member_id, coalesce(hg.entry_date, hg.granted_at::date) as edate, hg.hours::numeric as hours,
           coalesce(nullif(hg.note, ''), 'Hours') as description, hg.source as kind, hg.event_id, hg.meeting_id
    from public.hours_grants hg
    union all
    -- derived past event sign-ups (on/after the cutoff)
    select s.member_id, e.date, e.hours::numeric, e.name, 'event', e.id, null::uuid
    from public.event_signups s join public.events e on e.id = s.event_id
    where e.date is not null and e.date < current_date and e.date >= (select cut from cfg)
    union all
    -- derived meeting attendance (on/after the cutoff), role-weighted
    select a.member_id, m.date,
      ((case when a.role = 'contributor' then 1 else 0 end)
       + (case when m.start_time is not null and m.end_time is not null and m.end_time > m.start_time
               then extract(epoch from (m.end_time - m.start_time)) / 3600.0 else 1 end))::numeric,
      m.title || ' (' || a.role || ')', 'meeting', null::uuid, m.id
    from public.meeting_attendees a join public.meetings m on m.id = a.meeting_id
    where m.date < current_date and not m.canceled and m.date >= (select cut from cfg)
    union all
    -- net admin adjustment (a single line)
    select p.id, null::date, p.hours_adjustment::numeric, 'Manual admin adjustment', 'manual', null::uuid, null::uuid
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
                             'kind', en.kind, 'event_id', en.event_id, 'meeting_id', en.meeting_id)
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
