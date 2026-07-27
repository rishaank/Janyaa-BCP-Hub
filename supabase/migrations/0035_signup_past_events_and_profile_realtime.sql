-- ============================================================
-- 0035 — Members can't sign themselves up for an event that already happened;
--        the profile page can watch the hours ledger live.
--
--   Attendance on a PAST event is an admin record-keeping act, not a member
--   action: the Events / EventView cards have always hidden Sign up + Leave once
--   an event ends, and admins add or remove those attendees through
--   ManageAttendeesModal (covered by `signups_admin_all`, migration 0003). The
--   own-row policies never enforced that, though — they checked *who*, never
--   *when* — so a member could still sign themselves up for a finished event
--   straight through the API and, since 0034, mint their own ledger hours for it.
--
--   Both own-row policies now carry the same end-of-event instant the UI and the
--   hours model use (0032): an event is open to self-service until
--       (date + coalesce(end_time, '23:59')) at time zone 'America/Los_Angeles'
--   has passed. Undated tentative events stay open — they haven't happened yet.
--   Leaving is restricted the same way, so nobody can drop off a past event and
--   wipe the hours they earned for it; an admin can still do both.
--
--   Meetings are deliberately NOT changed: members self-report attendance there
--   *after* the fact ("I attended" on the meeting card), so the same restriction
--   would break that flow.
-- ============================================================

-- ---- Self sign-up / leave: only while the event hasn't ended ----
drop policy if exists "signups: insert self" on public.event_signups;
create policy "signups: insert self" on public.event_signups
  for insert to authenticated
  with check (
    auth.uid() = member_id
    and exists (
      select 1 from public.events e
      where e.id = event_id
        and (e.date is null
             or (e.date + coalesce(e.end_time, time '23:59')) at time zone 'America/Los_Angeles' > now())
    )
  );

drop policy if exists "signups: delete self" on public.event_signups;
create policy "signups: delete self" on public.event_signups
  for delete to authenticated
  using (
    auth.uid() = member_id
    and exists (
      select 1 from public.events e
      where e.id = event_id
        and (e.date is null
             or (e.date + coalesce(e.end_time, time '23:59')) at time zone 'America/Los_Angeles' > now())
    )
  );

-- ---- Live hours on the profile page ----
-- ProfilePage subscribes to the tables behind its own cards. `hours_grants` was
-- the one missing from the publication, which mattered more after 0034 made the
-- ledger the thing that moves when an admin adds an attendee to a past event.
-- Reads are already open to signed-in members, so realtime inherits that.
alter publication supabase_realtime add table public.hours_grants;
