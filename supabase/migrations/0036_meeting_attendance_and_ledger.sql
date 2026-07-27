-- ============================================================
-- 0036 — Meeting attendance: final once the meeting ends, and credited the same
--        way events are (0034/0035, now mirrored onto meetings).
--
--   Three things, all on the meetings side of the same machinery:
--
--   A. Self-service attendance closes when the meeting ends. Members registered
--      themselves for ANY past meeting, however old, and the hours landed
--      immediately with nobody approving them — a member could walk back through
--      the whole meeting history granting themselves hours. Members now register
--      while a meeting is upcoming; once it ends, only an admin can change who
--      attended (ManageAttendeesModal, `attendance: admin all`). Same PST end
--      instant as events, so the UI's Past/Upcoming split and the lock agree.
--
--   B. The missing UPDATE policy. `registerMeeting()` upserts, so "Switch to
--      contributor / attendee" runs INSERT ... ON CONFLICT DO UPDATE — which
--      needs an UPDATE policy. 0013 shipped insert + delete + admin-all and no
--      own-row update, so that button has always failed the RLS check silently
--      for non-admins (the first Attend/Contribute click works: no conflicting
--      row yet, so it's a plain insert). Adding the own-row update policy makes
--      it work, gated to before the meeting ends like the other two.
--
--   C. Pre-cutoff meetings credit their attendees. Meetings dated before
--      club_settings.hours_cutoff_date have their derived hours suppressed (so
--      the 0019 import isn't double-counted) and nothing wrote the ledger — the
--      exact hole 0034 closed for events. No meeting predates the cutoff today,
--      so there is nothing to backfill; this is the trigger half only, so a
--      back-dated meeting can't reopen it.
-- ============================================================

-- ============================================================
-- A + B. Own-row policies: only while the meeting is still to come
-- ============================================================

drop policy if exists "attendance: insert self" on public.meeting_attendees;
create policy "attendance: insert self" on public.meeting_attendees
  for insert to authenticated
  with check (
    auth.uid() = member_id
    and exists (
      select 1 from public.meetings m
      where m.id = meeting_id
        and (m.date + coalesce(m.end_time, time '23:59')) at time zone 'America/Los_Angeles' > now()
    )
  );

-- New in 0036: role switching needs this, and never had it.
drop policy if exists "attendance: update self" on public.meeting_attendees;
create policy "attendance: update self" on public.meeting_attendees
  for update to authenticated
  using (
    auth.uid() = member_id
    and exists (
      select 1 from public.meetings m
      where m.id = meeting_id
        and (m.date + coalesce(m.end_time, time '23:59')) at time zone 'America/Los_Angeles' > now()
    )
  )
  -- The same test on the NEW row, not just the old one: `using` alone would let
  -- a member re-point an upcoming meeting's row at a finished meeting and take
  -- the hours that way.
  with check (
    auth.uid() = member_id
    and exists (
      select 1 from public.meetings m
      where m.id = meeting_id
        and (m.date + coalesce(m.end_time, time '23:59')) at time zone 'America/Los_Angeles' > now()
    )
  );

drop policy if exists "attendance: delete self" on public.meeting_attendees;
create policy "attendance: delete self" on public.meeting_attendees
  for delete to authenticated
  using (
    auth.uid() = member_id
    and exists (
      select 1 from public.meetings m
      where m.id = meeting_id
        and (m.date + coalesce(m.end_time, time '23:59')) at time zone 'America/Los_Angeles' > now()
    )
  );

-- ============================================================
-- C. Pre-cutoff meetings: keep attendee list ⇔ ledger in step
-- ============================================================

-- Mirror of sync_event_hours_ledger (0034). Hours match what the derived path
-- pays for a post-cutoff meeting: the meeting's length (1 hr if untimed), plus 1
-- for a contributor. A meeting that isn't pre-cutoff — or is cancelled — has its
-- auto-written rows removed instead, so moving a meeting across the cutoff or
-- cancelling it is safe in both directions and never double-counts.
create or replace function public.sync_meeting_hours_ledger(p_meeting uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_cut date := coalesce((select hours_cutoff_date from public.club_settings where id), '1900-01-01'::date);
  v_pre boolean;
begin
  select not m.canceled and m.date < v_cut
    into v_pre
  from public.meetings m where m.id = p_meeting;

  if v_pre is null then return; end if; -- meeting gone

  if not v_pre then
    delete from public.hours_grants where meeting_id = p_meeting and source = 'attendance';
    return;
  end if;

  insert into public.hours_grants (member_id, hours, source, meeting_id, entry_date, note)
  select a.member_id,
         (case when m.start_time is not null and m.end_time is not null and m.end_time > m.start_time
               then extract(epoch from (m.end_time - m.start_time)) / 3600.0 else 1 end)
         + (case when a.role = 'contributor' then 1 else 0 end),
         'attendance', m.id, m.date, m.title || ' (' || a.role || ')'
  from public.meeting_attendees a
  join public.meetings m on m.id = a.meeting_id
  where a.meeting_id = p_meeting
    and not exists (
      select 1 from public.hours_grants g
      where g.meeting_id = p_meeting and g.member_id = a.member_id and g.source not like 'role\_%'
    );

  -- Role switch, retimed meeting or renamed title → the rows we wrote follow it.
  update public.hours_grants g
  set hours = (case when m.start_time is not null and m.end_time is not null and m.end_time > m.start_time
                    then extract(epoch from (m.end_time - m.start_time)) / 3600.0 else 1 end)
              + (case when a.role = 'contributor' then 1 else 0 end),
      entry_date = m.date,
      note = m.title || ' (' || a.role || ')'
  from public.meetings m
  join public.meeting_attendees a on a.meeting_id = m.id
  where m.id = p_meeting and g.meeting_id = p_meeting and g.member_id = a.member_id
    and g.source = 'attendance';
end;
$$;
revoke all on function public.sync_meeting_hours_ledger(uuid) from public, anon, authenticated;

-- ---- Attendance added or role switched → credit it ----
create or replace function public.on_meeting_attendance_ins()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.sync_meeting_hours_ledger(NEW.meeting_id);
  return NEW;
end;
$$;
revoke all on function public.on_meeting_attendance_ins() from public, anon, authenticated;

drop trigger if exists sync_hours_on_attendance on public.meeting_attendees;
create trigger sync_hours_on_attendance after insert or update on public.meeting_attendees
  for each row execute function public.on_meeting_attendance_ins();

-- ---- Attendance removed → drop only the row we auto-created ----
create or replace function public.on_meeting_attendance_del()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.hours_grants
  where meeting_id = OLD.meeting_id and member_id = OLD.member_id and source = 'attendance';
  return OLD;
end;
$$;
revoke all on function public.on_meeting_attendance_del() from public, anon, authenticated;

drop trigger if exists sync_hours_on_unattendance on public.meeting_attendees;
create trigger sync_hours_on_unattendance after delete on public.meeting_attendees
  for each row execute function public.on_meeting_attendance_del();

-- ---- Meeting edited → its ledger rows follow ----
create or replace function public.on_meeting_hours_upd()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.sync_meeting_hours_ledger(NEW.id);
  return NEW;
end;
$$;
revoke all on function public.on_meeting_hours_upd() from public, anon, authenticated;

drop trigger if exists sync_hours_on_meeting_edit on public.meetings;
create trigger sync_hours_on_meeting_edit
  after update of date, start_time, end_time, canceled, title on public.meetings
  for each row execute function public.on_meeting_hours_upd();
