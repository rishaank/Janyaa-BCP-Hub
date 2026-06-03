-- ============================================================
-- 0015 — Auto hours by role
--   • role_hours_rules: one editable rule per role — how many hours and how
--     often (monthly, or per new event created). Admin-editable; seeded with the
--     club defaults.
--   • hours_grants: an append-only ledger of automatically granted hours. A
--     member's total hours now = past event sign-ups + hours_adjustment + grants.
--   • Per-event grants fire from a trigger when an event is created.
--   • Monthly grants are materialized by ensure_monthly_role_hours() (idempotent),
--     run on a pg_cron schedule (1st of each month) — forward-only, so admins can
--     set each member's accurate baseline for the past via the hours stepper.
--   • get_public_dashboard() updated to fold grants into term + all-time hours.
-- ============================================================

create table if not exists public.role_hours_rules (
  role       text primary key,                                   -- matches profiles.role
  hours      numeric not null default 0,
  cadence    text not null default 'monthly' check (cadence in ('monthly', 'per_event')),
  active     boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into public.role_hours_rules (role, hours, cadence) values
  ('operations_lead', 2, 'monthly'),
  ('event_lead',      2, 'per_event'),
  ('pr_lead',         2, 'monthly'),
  ('outreach_lead',   2, 'per_event'),
  ('secretary',       2, 'per_event'),
  ('education_lead',  1, 'monthly')
on conflict (role) do nothing;

create table if not exists public.hours_grants (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.profiles on delete cascade,
  hours      numeric not null,
  source     text not null,                                      -- role_monthly | role_event
  event_id   uuid references public.events on delete cascade,    -- set for per-event grants
  period     text,                                               -- 'YYYY-MM' for monthly grants
  note       text,
  granted_at timestamptz not null default now()
);
-- Idempotency: one monthly grant per member per month; one event grant per member per event.
create unique index if not exists hours_grants_monthly_uniq on public.hours_grants (member_id, period) where source = 'role_monthly';
create unique index if not exists hours_grants_event_uniq   on public.hours_grants (member_id, event_id) where source = 'role_event';
create index if not exists hours_grants_member_idx on public.hours_grants (member_id);

-- ---- Per-event grants: when an event is created, credit members whose role has
--      a per_event rule. (Deleting the event cascades the grant away.) ----
create or replace function public.grant_event_role_hours()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.hours_grants (member_id, hours, source, event_id, note)
  select p.id, r.hours, 'role_event', NEW.id, 'Auto hours · event "' || NEW.name || '"'
  from public.profiles p
  join public.role_hours_rules r on r.role = p.role
  where r.cadence = 'per_event' and r.active and r.hours > 0
  on conflict do nothing;
  return NEW;
end;
$$;
revoke all on function public.grant_event_role_hours() from public, anon, authenticated;

drop trigger if exists grant_event_hours on public.events;
create trigger grant_event_hours after insert on public.events
  for each row execute function public.grant_event_role_hours();

-- ---- Monthly grants: idempotently grant the CURRENT month to monthly-role
--      members. Runs on cron + can be triggered by an admin. Forward-only. ----
create or replace function public.ensure_monthly_role_hours()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_period text := to_char(now(), 'YYYY-MM');
begin
  insert into public.hours_grants (member_id, hours, source, period, note)
  select p.id, r.hours, 'role_monthly', v_period, 'Auto hours · monthly (' || v_period || ')'
  from public.profiles p
  join public.role_hours_rules r on r.role = p.role
  where r.cadence = 'monthly' and r.active and r.hours > 0
  on conflict do nothing;
end;
$$;
grant execute on function public.ensure_monthly_role_hours() to authenticated;

-- Monthly schedule: 1st of the month at 13:00 UTC.
select cron.unschedule('monthly-role-hours') from cron.job where jobname = 'monthly-role-hours';
select cron.schedule('monthly-role-hours', '0 13 1 * *', $$ select public.ensure_monthly_role_hours(); $$);

-- ============================================================
-- RLS
-- ============================================================
alter table public.role_hours_rules enable row level security;
alter table public.hours_grants     enable row level security;

-- Rules: everyone signed in can read; only admins edit.
drop policy if exists "role_hours_rules: read"  on public.role_hours_rules;
drop policy if exists "role_hours_rules: admin" on public.role_hours_rules;
create policy "role_hours_rules: read"  on public.role_hours_rules for select to authenticated using (true);
create policy "role_hours_rules: admin" on public.role_hours_rules for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- Grants: read-only to members; only the SECURITY DEFINER functions write (no
-- insert/update/delete policies, so direct writes are blocked).
drop policy if exists "hours_grants: read" on public.hours_grants;
create policy "hours_grants: read" on public.hours_grants for select to authenticated using (true);

-- Realtime for the admin Auto Hours page.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'role_hours_rules'
  ) then
    execute 'alter publication supabase_realtime add table public.role_hours_rules';
  end if;
end $$;

-- ============================================================
-- get_public_dashboard() — fold auto-hour grants into the hours math.
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
  grants as (
    select
      member_id,
      coalesce(sum(hours), 0) as g_total,
      coalesce(sum(hours) filter (where granted_at::date >= (select start from term)), 0) as g_term
    from public.hours_grants
    group by member_id
  ),
  member_hours as (
    select
      p.id, p.name, p.role, p.avatar_url, p.is_founder,
      coalesce(h.ev_total, 0) + coalesce(p.hours_adjustment, 0) + coalesce(gr.g_total, 0) as hours,
      coalesce(h.ev_term, 0) + coalesce(gr.g_term, 0) as term_hours
    from public.profiles p
    left join hrs h on h.id = p.id
    left join grants gr on gr.member_id = p.id
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
