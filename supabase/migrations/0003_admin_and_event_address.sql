-- ============================================================
-- 0003 — Admin access + event address
--   • events.address              — full address for an event location
--   • profiles.is_admin           — admin flag (full control over others)
--   • profiles.hours_adjustment   — admin-settable correction added to a
--                                   member's signup-derived hours
--   • is_admin() helper + admin RLS override policies
-- Run in the Supabase SQL Editor (or applied via the Supabase MCP).
-- ============================================================

alter table public.events   add column if not exists address text;
alter table public.profiles add column if not exists is_admin boolean not null default false;
alter table public.profiles add column if not exists hours_adjustment numeric not null default 0;

-- Is the current user an admin? SECURITY DEFINER so it bypasses RLS (no recursion).
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- ---- Admin override policies (permissive, OR'd with the existing self policies) ----

-- profiles: an admin can edit or remove anyone.
drop policy if exists profiles_admin_update on public.profiles;
drop policy if exists profiles_admin_delete on public.profiles;
create policy profiles_admin_update on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy profiles_admin_delete on public.profiles for delete to authenticated using (public.is_admin());

-- event signups: an admin can sign up / remove anyone (members can still manage only their own).
drop policy if exists signups_admin_all on public.event_signups;
create policy signups_admin_all on public.event_signups for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- events, event_todos, locations, club_settings already grant every signed-in
-- member full management, so admins are covered there.

-- ---- Realtime: broadcast row changes so the UI updates live for everyone. ----
do $$
declare t text;
begin
  foreach t in array array['events','event_signups','event_todos','profiles','locations','club_settings'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---- Bootstrap: make the first member an admin so there is an initial admin. ----
-- (Adjust later from the Members page, or change the WHERE to your @bcp.org email.)
update public.profiles
set is_admin = true
where id = (select id from public.profiles order by joined_date asc, id asc limit 1);
