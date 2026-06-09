-- ============================================================
-- 0024 — Hours requests: admin-on-behalf + ops-lead-only direct ledger edits
--   • Only the operations lead may edit the hours ledger directly. Everyone else
--     — members AND admins — submits requests. Admins may submit ON BEHALF OF
--     another member; submitted_by records who actually sent it.
--   • Submissions go through submit_hours_request() (SECURITY DEFINER), so the
--     direct insert policy on hours_requests is dropped.
--   • hours_grants direct-write policies move from is_admin() to is_ops_lead().
--     Safe: the trigger / monthly cron / approval RPC that also write the ledger
--     are all SECURITY DEFINER and bypass RLS.
-- ============================================================

alter table public.hours_requests
  add column if not exists submitted_by uuid references public.profiles on delete set null;

-- Direct ledger writes: operations lead only.
drop policy if exists "hours_grants: admin insert" on public.hours_grants;
drop policy if exists "hours_grants: admin update" on public.hours_grants;
drop policy if exists "hours_grants: admin delete" on public.hours_grants;
drop policy if exists "hours_grants: ops insert" on public.hours_grants;
drop policy if exists "hours_grants: ops update" on public.hours_grants;
drop policy if exists "hours_grants: ops delete" on public.hours_grants;
create policy "hours_grants: ops insert" on public.hours_grants
  for insert to authenticated with check (public.is_ops_lead());
create policy "hours_grants: ops update" on public.hours_grants
  for update to authenticated using (public.is_ops_lead()) with check (public.is_ops_lead());
create policy "hours_grants: ops delete" on public.hours_grants
  for delete to authenticated using (public.is_ops_lead());

-- Read a request: the recipient, the admin who submitted it, or any ops lead.
drop policy if exists "hours_requests: read" on public.hours_requests;
create policy "hours_requests: read" on public.hours_requests
  for select to authenticated
  using (requester_id = auth.uid() or submitted_by = auth.uid() or public.is_ops_lead());

-- Submissions run through the RPC below (sets submitted_by = caller).
drop policy if exists "hours_requests: insert own" on public.hours_requests;

create or replace function public.submit_hours_request(
  p_requester uuid, p_activity text, p_hours numeric, p_contribution text default null
) returns public.hours_requests
language plpgsql security definer set search_path = public as $$
declare r public.hours_requests;
begin
  -- You can request for yourself; admins can request on behalf of anyone.
  if auth.uid() <> p_requester and not public.is_admin() then
    raise exception 'You can only request hours for yourself';
  end if;
  if p_hours is null or p_hours <= 0 then
    raise exception 'Hours must be greater than 0';
  end if;
  insert into public.hours_requests (requester_id, submitted_by, activity, hours, contribution)
  values (p_requester, auth.uid(), p_activity, p_hours, nullif(btrim(p_contribution), ''))
  returning * into r;
  return r;
end; $$;
revoke execute on function public.submit_hours_request(uuid, text, numeric, text) from public, anon;
grant execute on function public.submit_hours_request(uuid, text, numeric, text) to authenticated;
