-- ============================================================
-- 0023 — Member hours requests (operations-lead review)
--   Regular members can REQUEST hours (activity + hours + optional contribution
--   note). The request goes to the operations lead, who approves (auto-creating a
--   ledger grant for the member) or denies (with a required reason). A denied
--   request surfaces a dismissable red card on the requester's dashboard.
--   • is_ops_lead() — SECURITY DEFINER helper, mirrors is_admin().
--   • RLS: a member sees/creates their own requests; ops leads see all. Decisions
--     and dismissals go through SECURITY DEFINER RPCs (no direct update policy).
-- ============================================================

create table if not exists public.hours_requests (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references public.profiles on delete cascade,
  activity      text not null,
  hours         numeric not null check (hours > 0),
  contribution  text,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  reviewer_id   uuid references public.profiles on delete set null,
  denial_reason text,
  grant_id      uuid references public.hours_grants on delete set null, -- ledger row created on approval
  dismissed     boolean not null default false,                          -- requester dismissed the denial card
  created_at    timestamptz not null default now(),
  decided_at    timestamptz
);
create index if not exists hours_requests_requester_idx on public.hours_requests (requester_id);
create index if not exists hours_requests_status_idx on public.hours_requests (status);

-- Is the caller an operations lead? (mirrors is_admin())
create or replace function public.is_ops_lead()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'operations_lead');
$$;
revoke execute on function public.is_ops_lead() from public, anon;
grant execute on function public.is_ops_lead() to authenticated;

alter table public.hours_requests enable row level security;

drop policy if exists "hours_requests: read" on public.hours_requests;
create policy "hours_requests: read" on public.hours_requests
  for select to authenticated
  using (requester_id = auth.uid() or public.is_ops_lead());

drop policy if exists "hours_requests: insert own" on public.hours_requests;
create policy "hours_requests: insert own" on public.hours_requests
  for insert to authenticated
  with check (requester_id = auth.uid() and status = 'pending');
-- No update/delete policies — decisions + dismissals run through the RPCs below.

-- Realtime: sidebar badge, the requests page, and the dashboard denial card.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'hours_requests') then
    execute 'alter publication supabase_realtime add table public.hours_requests';
  end if;
end $$;

-- Ops lead approves/denies. Approve inserts a ledger grant for the requester
-- (SECURITY DEFINER, so it bypasses the admin-only hours_grants write policy).
create or replace function public.decide_hours_request(p_id uuid, p_approve boolean, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare r public.hours_requests; v_grant uuid;
begin
  if not public.is_ops_lead() then
    raise exception 'Only the operations lead can review hours requests';
  end if;
  select * into r from public.hours_requests where id = p_id and status = 'pending' for update;
  if not found then
    raise exception 'Request not found or already decided';
  end if;
  if p_approve then
    insert into public.hours_grants (member_id, hours, source, entry_date, note)
    values (r.requester_id, r.hours, 'manual', current_date, r.activity)
    returning id into v_grant;
    update public.hours_requests
      set status = 'approved', reviewer_id = auth.uid(), decided_at = now(), grant_id = v_grant, denial_reason = null
      where id = p_id;
  else
    if p_reason is null or btrim(p_reason) = '' then
      raise exception 'A reason is required to deny a request';
    end if;
    update public.hours_requests
      set status = 'denied', reviewer_id = auth.uid(), decided_at = now(), denial_reason = btrim(p_reason)
      where id = p_id;
  end if;
end; $$;
revoke execute on function public.decide_hours_request(uuid, boolean, text) from public, anon;
grant execute on function public.decide_hours_request(uuid, boolean, text) to authenticated;

-- Requester dismisses their own denied-request card.
create or replace function public.dismiss_hours_request(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.hours_requests set dismissed = true
    where id = p_id and requester_id = auth.uid();
end; $$;
revoke execute on function public.dismiss_hours_request(uuid) from public, anon;
grant execute on function public.dismiss_hours_request(uuid) to authenticated;
