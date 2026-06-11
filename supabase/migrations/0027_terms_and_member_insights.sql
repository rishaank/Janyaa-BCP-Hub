-- ============================================================
-- 0027 — Editable club terms + per-member AI insight
--   1. profiles.ai_insight(_at): cached Gemini insight for each member's
--      profile (written by the ai-member-insight Edge Function via the
--      service role; auto-refreshes monthly, manual refresh on the profile).
--   2. terms: one row per club term (label + start/end). Auto-materialized
--      seasonally by ensure_terms() while club_settings.auto_terming is on;
--      admins can edit/add/delete rows (RLS). Each row caches a per-term AI
--      summary (ai-terms Edge Function).
--   3. current_term_start() now prefers the terms table (so admin edits move
--      "this term" everywhere: dashboard, breakdowns, leaderboard), falling
--      back to the seasonal rule when no row covers today.
-- ============================================================

-- 1. Per-member AI insight cache.
alter table public.profiles
  add column if not exists ai_insight jsonb,
  add column if not exists ai_insight_at timestamptz;

-- 2. Terms.
create table if not exists public.terms (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  start_date date not null unique,
  end_date date not null,
  source text not null default 'auto' check (source in ('auto', 'manual')),
  ai_summary jsonb,
  ai_summary_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);

alter table public.terms enable row level security;
drop policy if exists "terms read" on public.terms;
create policy "terms read" on public.terms
  for select to authenticated using (true);
drop policy if exists "terms insert admin" on public.terms;
create policy "terms insert admin" on public.terms
  for insert to authenticated with check (public.is_admin());
drop policy if exists "terms update admin" on public.terms;
create policy "terms update admin" on public.terms
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "terms delete admin" on public.terms;
create policy "terms delete admin" on public.terms
  for delete to authenticated using (public.is_admin());

-- Live updates on the Terms page.
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'terms'
  ) then
    execute 'alter publication supabase_realtime add table public.terms';
  end if;
end $$;

-- Auto-terming toggle (admins manage it from the Terms page).
alter table public.club_settings add column if not exists auto_terming boolean not null default true;

-- Materialize seasonal terms (Winter=Dec–Feb, Spring=Mar–May, Summer=Jun–Aug,
-- Fall=Sep–Nov) from the club's earliest activity through today. Idempotent:
-- a seasonal window already covered by ANY existing term (e.g. one an admin
-- edited) is skipped, so manual edits are never overwritten. No-op when
-- auto-terming is off.
create or replace function public.ensure_terms()
returns void language plpgsql security definer set search_path = '' as $$
declare
  first_d date;
  d date;
  term_end date;
  lbl text;
begin
  if not coalesce((select auto_terming from public.club_settings where id), true) then
    return;
  end if;

  select least(
    coalesce((select min(date) from public.events where date is not null), current_date),
    coalesce((select min(date) from public.meetings), current_date)
  ) into first_d;

  -- Season start covering first_d.
  d := case
    when extract(month from first_d) = 12 then make_date(extract(year from first_d)::int, 12, 1)
    when extract(month from first_d) <= 2 then make_date(extract(year from first_d)::int - 1, 12, 1)
    when extract(month from first_d) <= 5 then make_date(extract(year from first_d)::int, 3, 1)
    when extract(month from first_d) <= 8 then make_date(extract(year from first_d)::int, 6, 1)
    else make_date(extract(year from first_d)::int, 9, 1)
  end;

  while d <= current_date loop
    term_end := (d + interval '3 months')::date - 1;
    lbl := case extract(month from d)::int
      when 12 then 'Winter ' || extract(year from d)::int
      when 3 then 'Spring ' || extract(year from d)::int
      when 6 then 'Summer ' || extract(year from d)::int
      else 'Fall ' || extract(year from d)::int
    end;
    if not exists (
      select 1 from public.terms t where t.start_date <= term_end and t.end_date >= d
    ) then
      insert into public.terms (label, start_date, end_date, source)
      values (lbl, d, term_end, 'auto')
      on conflict (start_date) do nothing;
    end if;
    d := (d + interval '3 months')::date;
  end loop;
end $$;
revoke execute on function public.ensure_terms() from public, anon;
grant execute on function public.ensure_terms() to authenticated, service_role;

-- 3. current_term_start(): the terms table wins; seasonal rule as fallback.
create or replace function public.current_term_start()
returns date language sql stable set search_path = '' as $$
  select coalesce(
    (select t.start_date from public.terms t
      where t.start_date <= current_date and t.end_date >= current_date
      order by t.start_date desc limit 1),
    case
      when extract(month from current_date) = 12 then make_date(extract(year from current_date)::int, 12, 1)
      when extract(month from current_date) <= 2 then make_date(extract(year from current_date)::int - 1, 12, 1)
      when extract(month from current_date) <= 5 then make_date(extract(year from current_date)::int, 3, 1)
      when extract(month from current_date) <= 8 then make_date(extract(year from current_date)::int, 6, 1)
      else make_date(extract(year from current_date)::int, 9, 1)
    end
  );
$$;

-- Seed the seasonal history now.
select public.ensure_terms();
