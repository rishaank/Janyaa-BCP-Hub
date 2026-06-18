-- ============================================================
-- 0031 — Per-role monthly granting for the Role Hours page.
--   • role_hours_rules.last_granted_month ('YYYY-MM') — stamped when a role's
--     monthly hours are granted, so the UI can show a granted state that resets
--     automatically when the month changes.
--   • grant_role_month(role) — admin-only, grants the current month's hours to
--     that role's members (idempotent) and stamps the rule.
--   • ensure_monthly_role_hours() now stamps every monthly rule it grants.
--   Period is computed in America/Los_Angeles (PST/PDT) to match the rest of the app.
-- ============================================================

alter table public.role_hours_rules add column if not exists last_granted_month text;

-- Per-role manual grant for the current month (admin-only).
create or replace function public.grant_role_month(p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_period text := to_char((now() at time zone 'America/Los_Angeles'), 'YYYY-MM');
begin
  if not public.is_admin() then
    raise exception 'admin only';
  end if;
  insert into public.hours_grants (member_id, hours, source, period, note)
  select p.id, r.hours, 'role_monthly', v_period, 'Auto hours · monthly (' || v_period || ')'
  from public.profiles p
  join public.role_hours_rules r on r.role = p.role
  where r.role = p_role and r.active and r.hours > 0
  on conflict do nothing;
  update public.role_hours_rules set last_granted_month = v_period where role = p_role;
end;
$$;
revoke all on function public.grant_role_month(text) from public, anon;
grant execute on function public.grant_role_month(text) to authenticated;

-- Monthly cron grant — now stamps every monthly rule it processes.
create or replace function public.ensure_monthly_role_hours()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_period text := to_char((now() at time zone 'America/Los_Angeles'), 'YYYY-MM');
begin
  insert into public.hours_grants (member_id, hours, source, period, note)
  select p.id, r.hours, 'role_monthly', v_period, 'Auto hours · monthly (' || v_period || ')'
  from public.profiles p
  join public.role_hours_rules r on r.role = p.role
  where r.cadence = 'monthly' and r.active and r.hours > 0
  on conflict do nothing;
  update public.role_hours_rules set last_granted_month = v_period
   where cadence = 'monthly' and active and hours > 0;
end;
$$;
revoke execute on function public.ensure_monthly_role_hours() from public, anon;
grant execute on function public.ensure_monthly_role_hours() to authenticated;
