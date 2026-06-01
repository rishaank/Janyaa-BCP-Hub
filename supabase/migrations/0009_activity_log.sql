-- ============================================================
-- 0009 — Activity log (admin-only audit trail)
--   • activity_log: one human-readable row per meaningful change.
--   • log_activity(): a SECURITY DEFINER trigger that writes those rows for
--     events / signups / to-dos / locations / profiles / settings, capturing
--     auth.uid() as the actor (NULL ⇒ "System", e.g. cron/edge functions).
--   • RLS: admins read; nobody writes directly (only the definer trigger does).
--   • Added to the realtime publication so the History page updates live.
-- Reuses the is_admin() helper from 0003.
-- ============================================================

create table if not exists public.activity_log (
  id         bigint generated always as identity primary key,
  actor_id   uuid references public.profiles(id) on delete set null,
  actor_name text,
  action     text not null,   -- created | updated | deleted | signed_up | left | claimed | unclaimed | brought | joined
  entity     text not null,   -- event | signup | todo | location | profile | settings
  entity_id  uuid,
  summary    text not null,
  created_at timestamptz not null default now()
);
create index if not exists activity_log_created_idx on public.activity_log (created_at desc);

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

-- ---- Attach the trigger to every tracked table ----
drop trigger if exists log_events on public.events;
create trigger log_events after insert or update or delete on public.events
  for each row execute function public.log_activity();

drop trigger if exists log_event_signups on public.event_signups;
create trigger log_event_signups after insert or delete on public.event_signups
  for each row execute function public.log_activity();

drop trigger if exists log_event_todos on public.event_todos;
create trigger log_event_todos after insert or update or delete on public.event_todos
  for each row execute function public.log_activity();

drop trigger if exists log_locations on public.locations;
create trigger log_locations after insert or update or delete on public.locations
  for each row execute function public.log_activity();

drop trigger if exists log_profiles on public.profiles;
create trigger log_profiles after insert or update or delete on public.profiles
  for each row execute function public.log_activity();

drop trigger if exists log_club_settings on public.club_settings;
create trigger log_club_settings after update on public.club_settings
  for each row execute function public.log_activity();

-- Trigger-only function: never call it over the API. Revoke the default PUBLIC
-- grant too (triggers still fire — they run as the owner regardless of grants).
revoke all on function public.log_activity() from public, anon, authenticated;

-- ---- RLS: admins read; writes only happen inside the definer trigger ----
alter table public.activity_log enable row level security;
drop policy if exists activity_log_read on public.activity_log;
create policy activity_log_read on public.activity_log
  for select to authenticated using (public.is_admin());

-- ---- Realtime: live updates on the History page ----
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'activity_log'
  ) then
    execute 'alter publication supabase_realtime add table public.activity_log';
  end if;
end $$;
