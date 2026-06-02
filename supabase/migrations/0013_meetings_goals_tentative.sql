-- ============================================================
-- 0013 — Meetings, leadership goals, tentative events, term tracking
--   • events.is_tentative + nullable events.date (undecided / "TBD" events)
--   • club_settings.term_start_date (leaderboard starts fresh each term)
--   • meeting_series / meetings / meeting_attendees (recurring + one-off mtgs)
--   • goals (leadership goals, shown on the dashboard)
--   • RLS (any signed-in member, attendance own-row), realtime, audit triggers
-- Reuses the is_admin() helper (0003) and log_activity() pattern (0009).
-- ============================================================

-- ---- Tentative events + undecided date -----------------------------------
-- An event can be marked tentative (not yet locked in). When tentative, the
-- date (and other fields) may be left undecided ("TBD"), so date is nullable.
alter table public.events add column if not exists is_tentative boolean not null default false;
alter table public.events alter column date drop not null;

-- ---- Term tracking -------------------------------------------------------
-- The current term's start. Hours "this term" = past events on/after this date,
-- so the leaderboard resets when a new term begins (Summer 2026).
alter table public.club_settings
  add column if not exists term_start_date date not null default '2026-06-01';

-- ---- Meetings ------------------------------------------------------------
-- Recurring meeting schedules, e.g. "every Thursday at 4pm". Concrete meeting
-- rows are materialized from these so attendance has a real row to hang off and
-- individual occurrences can be edited or cancelled.
create table if not exists public.meeting_series (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  weekday     int  not null check (weekday between 0 and 6),  -- 0 = Sunday … 4 = Thursday
  start_time  time,
  end_time    time,
  location    text,
  notes       text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- One concrete meeting. series_id is null for a one-off. A materialized
-- occurrence keeps its series_id so the generator won't recreate it once it's
-- edited or cancelled (generation skips any date that already has a row).
create table if not exists public.meetings (
  id          uuid primary key default gen_random_uuid(),
  series_id   uuid references public.meeting_series on delete set null,
  title       text not null,
  date        date not null,
  start_time  time,
  end_time    time,
  location    text,
  notes       text,
  canceled    boolean not null default false,
  created_at  timestamptz not null default now()
);
-- At most one materialized occurrence per (series, date). One-offs (series_id
-- null) are exempt, so several one-offs can share a date.
create unique index if not exists meetings_series_date_uniq
  on public.meetings (series_id, date) where series_id is not null;
create index if not exists meetings_date_idx on public.meetings (date);

-- Who attended a meeting (own-row, like event signups).
create table if not exists public.meeting_attendees (
  id         uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings on delete cascade,
  member_id  uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  unique (meeting_id, member_id)
);
create index if not exists meeting_attendees_meeting_idx on public.meeting_attendees (meeting_id);
create index if not exists meeting_attendees_member_idx  on public.meeting_attendees (member_id);

-- ---- Leadership goals ----------------------------------------------------
create table if not exists public.goals (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  detail      text,
  owner_id    uuid references public.profiles on delete set null,
  target_date date,
  progress    int  not null default 0 check (progress between 0 and 100),
  status      text not null default 'active',   -- active | done
  created_by  uuid references public.profiles on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists goals_status_idx on public.goals (status);

-- ============================================================
-- Row Level Security — matches the events/locations model: any signed-in
-- member has full access. Attendance is own-row (admins can manage anyone).
-- ============================================================
alter table public.meeting_series    enable row level security;
alter table public.meetings          enable row level security;
alter table public.meeting_attendees enable row level security;
alter table public.goals             enable row level security;

create policy "meeting_series: all" on public.meeting_series for all to authenticated using (true) with check (true);
create policy "meetings: all"       on public.meetings       for all to authenticated using (true) with check (true);
create policy "goals: all"          on public.goals          for all to authenticated using (true) with check (true);

create policy "attendance: read"        on public.meeting_attendees for select to authenticated using (true);
create policy "attendance: insert self" on public.meeting_attendees for insert to authenticated with check (auth.uid() = member_id);
create policy "attendance: delete self" on public.meeting_attendees for delete to authenticated using (auth.uid() = member_id);
create policy "attendance: admin all"   on public.meeting_attendees for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- Audit log — extend log_activity() (0009) to cover meetings + goals.
-- Auto-generated recurring occurrences are NOT logged (would spam history);
-- the recurring schedule itself is logged instead.
-- ============================================================
create or replace function public.log_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor      uuid := auth.uid();
  v_actor_name text;
  v_action     text;
  v_entity     text;
  v_entity_id  uuid;
  v_summary    text;
  v_event_name text;
  v_days       text[] := array['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
begin
  select name into v_actor_name from public.profiles where id = v_actor;

  if TG_TABLE_NAME = 'events' then
    v_entity := 'event';
    if TG_OP = 'INSERT' then
      v_action := 'created'; v_entity_id := NEW.id;
      v_summary := 'created event "' || NEW.name || '"';
    elsif TG_OP = 'UPDATE' then
      v_action := 'updated'; v_entity_id := NEW.id;
      v_summary := 'updated event "' || NEW.name || '"';
    else
      v_action := 'deleted'; v_entity_id := OLD.id;
      v_summary := 'deleted event "' || OLD.name || '"';
    end if;

  elsif TG_TABLE_NAME = 'event_signups' then
    v_entity := 'signup';
    if TG_OP = 'INSERT' then
      select name into v_event_name from public.events where id = NEW.event_id;
      v_action := 'signed_up'; v_entity_id := NEW.event_id;
      v_actor := NEW.member_id;
      select name into v_actor_name from public.profiles where id = NEW.member_id;
      v_summary := 'signed up for "' || coalesce(v_event_name, 'an event') || '"';
    else
      select name into v_event_name from public.events where id = OLD.event_id;
      v_action := 'left'; v_entity_id := OLD.event_id;
      v_actor := OLD.member_id;
      select name into v_actor_name from public.profiles where id = OLD.member_id;
      v_summary := 'left "' || coalesce(v_event_name, 'an event') || '"';
    end if;

  elsif TG_TABLE_NAME = 'event_todos' then
    v_entity := 'todo';
    if TG_OP = 'INSERT' then
      select name into v_event_name from public.events where id = NEW.event_id;
      v_action := 'created'; v_entity_id := NEW.event_id;
      v_summary := 'added to-do "' || NEW.item || '" to "' || coalesce(v_event_name, 'an event') || '"';
    elsif TG_OP = 'DELETE' then
      v_action := 'deleted'; v_entity_id := OLD.event_id;
      v_summary := 'removed to-do "' || OLD.item || '"';
    else
      select name into v_event_name from public.events where id = NEW.event_id;
      v_entity_id := NEW.event_id;
      if NEW.assignee_id is distinct from OLD.assignee_id then
        if NEW.assignee_id is null then
          v_action := 'unclaimed';
          v_summary := 'unclaimed "' || NEW.item || '"';
        else
          v_action := 'claimed';
          v_actor := NEW.assignee_id;
          select name into v_actor_name from public.profiles where id = NEW.assignee_id;
          v_summary := 'claimed "' || NEW.item || '" for "' || coalesce(v_event_name, 'an event') || '"';
        end if;
      elsif NEW.done is distinct from OLD.done then
        v_action := case when NEW.done then 'brought' else 'updated' end;
        v_summary := case when NEW.done
                          then 'marked "' || NEW.item || '" as brought'
                          else 'marked "' || NEW.item || '" as not brought' end;
      else
        v_action := 'updated';
        v_summary := 'updated to-do "' || NEW.item || '"';
      end if;
    end if;

  elsif TG_TABLE_NAME = 'locations' then
    v_entity := 'location';
    if TG_OP = 'INSERT' then
      v_action := 'created'; v_entity_id := NEW.id;
      v_summary := 'added location "' || NEW.name || '"';
    elsif TG_OP = 'UPDATE' then
      v_action := 'updated'; v_entity_id := NEW.id;
      v_summary := 'updated location "' || NEW.name || '"';
    else
      v_action := 'deleted'; v_entity_id := OLD.id;
      v_summary := 'deleted location "' || OLD.name || '"';
    end if;

  elsif TG_TABLE_NAME = 'meetings' then
    v_entity := 'meeting';
    if TG_OP = 'INSERT' then
      if NEW.series_id is not null then return null; end if;  -- auto-generated occurrence: skip
      v_action := 'created'; v_entity_id := NEW.id;
      v_summary := 'scheduled meeting "' || NEW.title || '"';
    elsif TG_OP = 'DELETE' then
      v_action := 'deleted'; v_entity_id := OLD.id;
      v_summary := 'deleted meeting "' || OLD.title || '"';
    else
      v_entity_id := NEW.id;
      if NEW.canceled is distinct from OLD.canceled then
        v_action := case when NEW.canceled then 'canceled' else 'updated' end;
        v_summary := case when NEW.canceled
                          then 'canceled the meeting "' || NEW.title || '"'
                          else 'restored the meeting "' || NEW.title || '"' end;
      else
        v_action := 'updated';
        v_summary := 'updated meeting "' || NEW.title || '"';
      end if;
    end if;

  elsif TG_TABLE_NAME = 'meeting_series' then
    v_entity := 'meeting';
    if TG_OP = 'INSERT' then
      v_action := 'created'; v_entity_id := NEW.id;
      v_summary := 'set up a weekly ' || v_days[NEW.weekday + 1] || ' meeting "' || NEW.title || '"';
    elsif TG_OP = 'DELETE' then
      v_action := 'deleted'; v_entity_id := OLD.id;
      v_summary := 'removed the weekly meeting "' || OLD.title || '"';
    elsif NEW.active is distinct from OLD.active then
      v_entity_id := NEW.id;
      v_action := case when NEW.active then 'updated' else 'canceled' end;
      v_summary := case when NEW.active
                        then 'resumed the weekly meeting "' || NEW.title || '"'
                        else 'paused the weekly meeting "' || NEW.title || '"' end;
    else
      v_entity_id := NEW.id;
      v_action := 'updated';
      v_summary := 'updated the weekly meeting "' || NEW.title || '"';
    end if;

  elsif TG_TABLE_NAME = 'goals' then
    v_entity := 'goal';
    if TG_OP = 'INSERT' then
      v_action := 'created'; v_entity_id := NEW.id;
      v_summary := 'set a new goal "' || NEW.title || '"';
    elsif TG_OP = 'DELETE' then
      v_action := 'deleted'; v_entity_id := OLD.id;
      v_summary := 'removed the goal "' || OLD.title || '"';
    elsif NEW.status is distinct from OLD.status and NEW.status = 'done' then
      v_action := 'completed'; v_entity_id := NEW.id;
      v_summary := 'completed the goal "' || NEW.title || '"';
    else
      v_action := 'updated'; v_entity_id := NEW.id;
      v_summary := 'updated the goal "' || NEW.title || '"';
    end if;

  elsif TG_TABLE_NAME = 'profiles' then
    v_entity := 'profile';
    if TG_OP = 'INSERT' then
      v_action := 'joined'; v_entity_id := NEW.id;
      v_actor := NEW.id; v_actor_name := coalesce(NEW.name, 'A new member');
      v_summary := coalesce(NEW.name, 'A new member') || ' joined the club';
    elsif TG_OP = 'DELETE' then
      v_action := 'deleted'; v_entity_id := OLD.id;
      v_summary := coalesce(OLD.name, 'A member') || '''s account was removed';
    else
      if NEW.role is distinct from OLD.role
         or NEW.is_admin is distinct from OLD.is_admin
         or NEW.hours_adjustment is distinct from OLD.hours_adjustment
         or NEW.name is distinct from OLD.name then
        v_action := 'updated'; v_entity_id := NEW.id;
        v_summary := 'updated ' || coalesce(NEW.name, 'a member') || '''s profile';
      else
        return null;  -- avatar-only / no meaningful change: skip
      end if;
    end if;

  elsif TG_TABLE_NAME = 'club_settings' then
    -- Only the human-meaningful goal edit; skip GoFundMe sync + AI-cache writes.
    if NEW.raise_target is distinct from OLD.raise_target then
      v_entity := 'settings'; v_action := 'updated';
      v_summary := 'changed the fundraising goal to $' || NEW.raise_target;
    else
      return null;
    end if;

  else
    return null;
  end if;

  insert into public.activity_log (actor_id, actor_name, action, entity, entity_id, summary)
  values (v_actor, coalesce(v_actor_name, 'System'), v_action, v_entity, v_entity_id, v_summary);

  return null;  -- AFTER trigger; return value is ignored
end;
$$;

drop trigger if exists log_meeting_series on public.meeting_series;
create trigger log_meeting_series after insert or update or delete on public.meeting_series
  for each row execute function public.log_activity();

drop trigger if exists log_meetings on public.meetings;
create trigger log_meetings after insert or update or delete on public.meetings
  for each row execute function public.log_activity();

drop trigger if exists log_goals on public.goals;
create trigger log_goals after insert or update or delete on public.goals
  for each row execute function public.log_activity();

-- ---- Realtime: live updates across clients ----
do $$
declare t text;
begin
  foreach t in array array['meeting_series','meetings','meeting_attendees','goals'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
