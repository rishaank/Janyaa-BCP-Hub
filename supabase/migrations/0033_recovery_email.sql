-- ============================================================
-- 0033 — recovery emails + self-service password reset
--   School Microsoft mailboxes quarantine/delay our reset mail, so a member can
--   register a PERSONAL address to receive password-reset links at. The address
--   lives in its own table (not a profiles column) so RLS can keep it visible to
--   the member + admins only — profiles are readable by every signed-in member.
--   `password_reset_log` + `check_password_reset_rate()` throttle the public
--   "Forgot password" endpoint (the password-recovery Edge Function).
-- ============================================================

create table if not exists public.member_recovery (
  member_id  uuid primary key references public.profiles(id) on delete cascade,
  email      text not null,
  updated_at timestamptz not null default now()
);

alter table public.member_recovery enable row level security;

-- Own row, or any row if you're an admin (admins set these up for members who
-- can't receive our mail at all).
drop policy if exists "member_recovery read" on public.member_recovery;
create policy "member_recovery read" on public.member_recovery
  for select to authenticated using (member_id = auth.uid() or public.is_admin());

drop policy if exists "member_recovery write" on public.member_recovery;
create policy "member_recovery write" on public.member_recovery
  for all to authenticated
  using (member_id = auth.uid() or public.is_admin())
  with check (member_id = auth.uid() or public.is_admin());

-- ---- rate limiting for the public reset endpoint -----------------------------

-- One row per accepted reset request. The address is stored hashed: strangers can
-- probe the endpoint, and we don't want their addresses accumulating in a table.
create table if not exists public.password_reset_log (
  id         uuid primary key default gen_random_uuid(),
  email_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists password_reset_log_time on public.password_reset_log (created_at desc);
create index if not exists password_reset_log_hash_time on public.password_reset_log (email_hash, created_at desc);

alter table public.password_reset_log enable row level security;
-- No policies: only the Edge Function (service role, bypasses RLS) touches this.

-- Gatekeeper for the password-recovery function. Caps 3/hour for one address and
-- 30/hour across the whole club, so a stranger can't burn the club Gmail's send
-- quota or mailbomb a member. Stamps a row in the same call when allowed.
create or replace function public.check_password_reset_rate(p_email text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  h text := md5(lower(btrim(p_email)));
  per_addr int;
  global int;
begin
  select count(*) into per_addr from public.password_reset_log
   where email_hash = h and created_at > now() - interval '1 hour';
  if per_addr >= 3 then return false; end if;

  select count(*) into global from public.password_reset_log
   where created_at > now() - interval '1 hour';
  if global >= 30 then return false; end if;

  insert into public.password_reset_log (email_hash) values (h);
  return true;
end $$;
revoke execute on function public.check_password_reset_rate(text) from public, anon, authenticated;
grant execute on function public.check_password_reset_rate(text) to service_role;
