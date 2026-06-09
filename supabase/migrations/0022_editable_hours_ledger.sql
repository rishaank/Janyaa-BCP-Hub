-- ============================================================
-- 0022 — Editable hours ledger (Feature: event-based hour editing on profiles)
--   • Admins can now add / edit / delete ledger rows directly (e.g. log event
--     hours for a member, or fix an imported entry). Adds admin RLS write
--     policies on hours_grants (reads stay open to all members; the existing
--     SECURITY DEFINER writers — role grants, monthly cron — are unaffected).
--   • get_hours_breakdowns() now returns `grant_id` on each entry: the
--     hours_grants row id for editable ledger entries (import / role / manual),
--     null for derived rows (live event sign-ups, meeting attendance, the net
--     admin adjustment) which are managed elsewhere. The profile UI shows
--     edit/delete only on entries that carry a grant_id.
-- ============================================================

-- ---- Admin write access on the ledger ----
drop policy if exists "hours_grants: admin insert" on public.hours_grants;
create policy "hours_grants: admin insert" on public.hours_grants
  for insert to authenticated with check (public.is_admin());

drop policy if exists "hours_grants: admin update" on public.hours_grants;
create policy "hours_grants: admin update" on public.hours_grants
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "hours_grants: admin delete" on public.hours_grants;
create policy "hours_grants: admin delete" on public.hours_grants
  for delete to authenticated using (public.is_admin());

-- ---- Breakdown RPC: expose the ledger row id so entries are editable ----
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
    select hg.member_id,
           (case when hg.source = 'import' then hg.entry_date else coalesce(hg.entry_date, hg.granted_at::date) end) as edate,
           hg.hours::numeric as hours,
           coalesce(nullif(hg.note, ''), 'Hours') as description, hg.source as kind, hg.event_id, hg.meeting_id,
           hg.id as grant_id
    from public.hours_grants hg
    union all
    select s.member_id, e.date, e.hours::numeric, e.name, 'event', e.id, null::uuid, null::uuid
    from public.event_signups s join public.events e on e.id = s.event_id
    where e.date is not null and e.date < current_date and e.date >= (select cut from cfg)
    union all
    select a.member_id, m.date,
      ((case when a.role = 'contributor' then 1 else 0 end)
       + (case when m.start_time is not null and m.end_time is not null and m.end_time > m.start_time
               then extract(epoch from (m.end_time - m.start_time)) / 3600.0 else 1 end))::numeric,
      m.title || ' (' || a.role || ')', 'meeting', null::uuid, m.id, null::uuid
    from public.meeting_attendees a join public.meetings m on m.id = a.meeting_id
    where m.date < current_date and not m.canceled and m.date >= (select cut from cfg)
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
