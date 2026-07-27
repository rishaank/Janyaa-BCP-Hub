-- ============================================================
-- 0034 — Event hours consistency: attendee list ⇔ ledger ⇔ events.hours
--
--   Adding a member to a PAST event silently granted them nothing. Hours for an
--   event reach a member down one of two mutually exclusive paths:
--
--     • post-cutoff events — derived live in get_hours_breakdowns() from
--       event_signups, so a new attendee is credited the instant they're added;
--     • pre-cutoff events (date < club_settings.hours_cutoff_date, 2026-06-03)
--       — derived hours are deliberately suppressed so the one-time spreadsheet
--       import (0019) isn't double-counted, and the hours live in hours_grants.
--
--   Nothing wrote the second path, so an admin adding an attendee to a pre-cutoff
--   event produced a sign-up row with no hours anywhere — visible on the event,
--   absent from the member's hours history. Seven of the club's events predate
--   the cutoff, i.e. every event on record today.
--
--   Two halves:
--     A. Backfill — reconcile the three fields that had drifted apart, with the
--        imported hours taking precedence over events.hours.
--     B. Triggers — keep them in step from here on, so this can't recur.
--
--   Role grants (source 'role_event' / 'role_monthly') are never touched: those
--   are credited for organizing an event, not for attending it, so they are
--   deliberately independent of the event's per-attendee hours.
-- ============================================================

-- ============================================================
-- A. Backfill
-- ============================================================

-- ---- A1. events.hours := the imported per-attendee hours ----
-- Where an event's imported ledger rows agree on a single figure, that figure is
-- the truth (it's what the members were actually credited); events.hours was the
-- estimate typed in when the event was seeded. Three events disagreed:
--   Evergreen Valley Square Farmer's Market 2026-03-29   3 → 4
--   Evergreen Valley Square Farmer's Market 2025-11-30   3 → 4
--   St. Andrew's Kit Making Workshop        2025-03-20   1 → 6
update public.events e
set hours = src.imported
from (
  select g.event_id, min(g.hours) as imported
  from public.hours_grants g
  where g.source = 'import' and g.event_id is not null
  group by g.event_id
  having count(distinct g.hours) = 1
) src
where src.event_id = e.id and e.hours is distinct from src.imported;

-- ---- A2. Attendees with no hours row on a pre-cutoff event ----
-- The bug itself. Four sign-ups had no hours down either path:
--   Manas Chekka  · EVSFM Fundraiser      2026-03-29
--   Arjun Thakur  · Sunday Friends Outreach 2026-04-26 / 2025-05-25 / 2025-04-27
insert into public.hours_grants (member_id, hours, source, event_id, entry_date, note)
select s.member_id, e.hours, 'signup', e.id, e.date, e.name
from public.event_signups s
join public.events e on e.id = s.event_id
where e.date is not null
  and not e.is_tentative
  and e.date < coalesce((select hours_cutoff_date from public.club_settings where id), '1900-01-01'::date)
  and not exists (
    select 1 from public.hours_grants g
    where g.event_id = e.id and g.member_id = s.member_id and g.source not like 'role\_%'
  );

-- ---- A3. Hours for an event, but missing from its attendee list ----
-- The mirror image: Aarush carried 3.0 imported hours for Vasona Park
-- (2025-08-24) while the event didn't list him.
insert into public.event_signups (event_id, member_id)
select distinct g.event_id, g.member_id
from public.hours_grants g
where g.event_id is not null
  and g.source not like 'role\_%'
  and not exists (
    select 1 from public.event_signups s
    where s.event_id = g.event_id and s.member_id = g.member_id
  );

-- ============================================================
-- B. Keep the three in step from here on
-- ============================================================

-- Reconcile ONE pre-cutoff event's ledger against its attendee list:
--   • every attendee without an event-linked ledger row gets a 'signup' row;
--   • every event-linked row (bar role grants) tracks events.hours + events.date.
-- An event that isn't pre-cutoff — or is tentative/undated — has its 'signup'
-- rows removed instead: hours there come from the derived path, and leaving a
-- row behind would double-count. This makes rescheduling an event across the
-- cutoff, or flagging it tentative, safe in both directions.
create or replace function public.sync_event_hours_ledger(p_event uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_cut date := coalesce((select hours_cutoff_date from public.club_settings where id), '1900-01-01'::date);
  v_pre boolean;
begin
  select e.date is not null and not e.is_tentative and e.date < v_cut
    into v_pre
  from public.events e where e.id = p_event;

  if v_pre is null then return; end if; -- event gone

  if not v_pre then
    delete from public.hours_grants where event_id = p_event and source = 'signup';
    return;
  end if;

  insert into public.hours_grants (member_id, hours, source, event_id, entry_date, note)
  select s.member_id, e.hours, 'signup', e.id, e.date, e.name
  from public.event_signups s
  join public.events e on e.id = s.event_id
  where s.event_id = p_event
    and not exists (
      select 1 from public.hours_grants g
      where g.event_id = p_event and g.member_id = s.member_id and g.source not like 'role\_%'
    );

  update public.hours_grants g
  set hours = e.hours, entry_date = e.date
  from public.events e
  where e.id = p_event and g.event_id = p_event and g.source not like 'role\_%'
    and (g.hours is distinct from e.hours or g.entry_date is distinct from e.date);
end;
$$;
revoke all on function public.sync_event_hours_ledger(uuid) from public, anon, authenticated;

-- ---- Attendee added → credit them (pre-cutoff events only) ----
create or replace function public.on_event_signup_ins()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.sync_event_hours_ledger(NEW.event_id);
  return NEW;
end;
$$;
revoke all on function public.on_event_signup_ins() from public, anon, authenticated;

drop trigger if exists sync_hours_on_signup on public.event_signups;
create trigger sync_hours_on_signup after insert on public.event_signups
  for each row execute function public.on_event_signup_ins();

-- ---- Attendee removed → drop the row we auto-created, and only that ----
-- Imported and hand-entered rows survive: an admin logged those deliberately,
-- and an attendee removed by mistake shouldn't lose imported history.
create or replace function public.on_event_signup_del()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.hours_grants
  where event_id = OLD.event_id and member_id = OLD.member_id and source = 'signup';
  return OLD;
end;
$$;
revoke all on function public.on_event_signup_del() from public, anon, authenticated;

drop trigger if exists sync_hours_on_unsignup on public.event_signups;
create trigger sync_hours_on_unsignup after delete on public.event_signups
  for each row execute function public.on_event_signup_del();

-- ---- Event edited → its ledger rows follow ----
-- Editing an event's hours restates what attending it was worth, so the rows
-- linked to it move with it (imported ones included — the admin typing a new
-- number is the later, deliberate word). Fires on the fields that decide which
-- side of the cutoff the event sits on, too.
create or replace function public.on_event_hours_upd()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.sync_event_hours_ledger(NEW.id);
  return NEW;
end;
$$;
revoke all on function public.on_event_hours_upd() from public, anon, authenticated;

drop trigger if exists sync_hours_on_event_edit on public.events;
create trigger sync_hours_on_event_edit after update of hours, date, is_tentative on public.events
  for each row execute function public.on_event_hours_upd();
