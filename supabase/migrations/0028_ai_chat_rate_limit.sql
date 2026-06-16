-- ============================================================
-- 0028 — AI chatbot usage log + rate limiter
--   The /ai-planning chatbot calls Gemini, which is on the free tier, so each
--   member is rate-limited. `ai_chat_log` records one row per answered message;
--   `check_ai_chat_rate(p_member)` is the gatekeeper the Edge Function calls
--   (SECURITY DEFINER, service-role only) — it enforces a per-minute, hourly,
--   and daily cap and, when allowed, stamps a row.
-- ============================================================

create table if not exists public.ai_chat_log (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists ai_chat_log_member_time on public.ai_chat_log (member_id, created_at desc);

alter table public.ai_chat_log enable row level security;
-- Members may read their OWN usage (so the UI can show "x left today"); only the
-- Edge Function (service role, bypasses RLS) ever writes.
drop policy if exists "ai_chat_log own read" on public.ai_chat_log;
create policy "ai_chat_log own read" on public.ai_chat_log
  for select to authenticated using (member_id = auth.uid());

-- Returns { allowed, reason, retry_after_seconds, used_today, day_limit }. When
-- allowed, inserts a usage row in the same call so the check and the spend can't
-- drift. Caps: 4/min (burst), 20/hour, 60/day per member.
create or replace function public.check_ai_chat_rate(p_member uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  per_min int; per_hour int; per_day int;
  min_cap constant int := 4;
  hour_cap constant int := 20;
  day_cap constant int := 60;
begin
  select
    count(*) filter (where created_at > now() - interval '1 minute'),
    count(*) filter (where created_at > now() - interval '1 hour'),
    count(*) filter (where created_at > now() - interval '1 day')
  into per_min, per_hour, per_day
  from public.ai_chat_log where member_id = p_member;

  if per_min >= min_cap then
    return jsonb_build_object('allowed', false, 'reason', 'minute', 'retry_after_seconds', 30,
                              'used_today', per_day, 'day_limit', day_cap);
  elsif per_hour >= hour_cap then
    return jsonb_build_object('allowed', false, 'reason', 'hour', 'retry_after_seconds', 600,
                              'used_today', per_day, 'day_limit', day_cap);
  elsif per_day >= day_cap then
    return jsonb_build_object('allowed', false, 'reason', 'day', 'retry_after_seconds', 3600,
                              'used_today', per_day, 'day_limit', day_cap);
  end if;

  insert into public.ai_chat_log (member_id) values (p_member);
  return jsonb_build_object('allowed', true, 'used_today', per_day + 1, 'day_limit', day_cap);
end $$;
revoke execute on function public.check_ai_chat_rate(uuid) from public, anon, authenticated;
grant execute on function public.check_ai_chat_rate(uuid) to service_role;
