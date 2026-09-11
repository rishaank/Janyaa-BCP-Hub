-- ============================================================
-- 0038 — GoFundMe → Givebutter
--
--   The club has left GoFundMe. Donations now go through Givebutter, on Janyaa's
--   campaign (https://givebutter.com/59uJ48, goal $10,000). Janyaa BCP has its
--   own page inside that campaign:
--
--       https://givebutter.com/59uJ48/bellarmine-youth-chapter
--
--   That team page is the club's public donate link: it is what members share,
--   what the QR code points at, and what reports the club's own credited total.
--   A donor arriving on the parent campaign instead has to pick "Bellarmine
--   Youth Chapter" under "Credit a team", which is why the UI says so.
--
--   Janyaa BCP does NOT own the Givebutter account, so there is no API key to
--   read. `sync-donations` scrapes the public pages, as `sync-gofundme` did.
--
--   Naming is deliberately PROVIDER-NEUTRAL (`donations_*`, not `givebutter_*`).
--   This is the second fundraising platform in the Hub's life; the third should
--   cost a column value, not a migration like this one.
--
--   Columns:
--     donations_provider          'givebutter' — picks the scraper adapter
--     donations_url               THE CLUB'S PAGE. Shared, QR'd, and scraped for
--                                 the club's own figures.
--     donations_campaign_url      Janyaa's parent campaign, for context only
--     donations_raised / _count   the club's own totals
--     donations_campaign_*        the whole-campaign figures
--     donations_legacy_*          the final GoFundMe figures, kept separately in
--                                 the data and MERGED into every displayed total
--     donations_sync_status       'ok …' or 'error …' — the scraper is parsing
--                                 someone else's HTML, so when it breaks the
--                                 reason has to be visible without log diving
--
--   The old gofundme_* columns are LEFT IN PLACE as the rollback path (the same
--   way 0037 kept events.instagram_urls). They are deprecated and no longer
--   written; a later migration should drop them.
--
--   Also: the shared goal moves to $10,000 to match the campaign, and becomes
--   ADMIN-ONLY to change (it was editable by any signed-in member).
-- ============================================================

alter table public.club_settings
  add column if not exists donations_provider           text default 'givebutter',
  add column if not exists donations_url                text,
  add column if not exists donations_campaign_url       text,
  add column if not exists donations_team_name          text,
  add column if not exists donations_raised             numeric,
  add column if not exists donations_count              int,
  add column if not exists donations_synced_at          timestamptz,
  add column if not exists donations_campaign_raised    numeric,
  add column if not exists donations_campaign_goal      numeric,
  add column if not exists donations_campaign_donations int,
  add column if not exists donations_legacy_raised      numeric,
  add column if not exists donations_legacy_label       text,
  add column if not exists donations_legacy_url         text,
  add column if not exists donations_sync_status        text;

-- Seed the new platform + fold the finished GoFundMe run into the legacy columns.
-- `donations_raised` is deliberately left NULL: nothing has been scraped yet, and
-- a 0 would read as "the club has raised nothing" rather than "not synced yet".
update public.club_settings set
  donations_provider       = 'givebutter',
  donations_url            = 'https://givebutter.com/59uJ48/bellarmine-youth-chapter',
  donations_campaign_url   = 'https://givebutter.com/59uJ48',
  donations_team_name      = 'Bellarmine Youth Chapter',
  donations_campaign_goal  = 10000,
  donations_legacy_raised  = gofundme_raised,
  donations_legacy_label   = 'GoFundMe',
  donations_legacy_url     = gofundme_url,
  raise_target             = 10000
where id;

comment on column public.club_settings.donations_url is
  'The club''s own Givebutter page: shared with donors, encoded in the QR, and scraped for donations_raised.';
comment on column public.club_settings.donations_legacy_raised is
  'Final GoFundMe total. Merged into every displayed total; kept separate so the two platforms stay distinguishable.';
comment on column public.club_settings.gofundme_raised is
  'DEPRECATED (0038) — superseded by donations_legacy_raised. Kept as the rollback path; no longer written.';

-- ---- The shared goal is now admin-only ----------------------------------
-- club_settings stays member-writable (term targets, auto-terming and the AI
-- caches all live here and that permissiveness is deliberate), so the goal is
-- guarded by column instead of by policy: RLS has no way to say "this one field
-- is admin-only", and `with check` cannot see the OLD row to detect a change.
-- auth.uid() is NULL for the service role, which is how the sync function and
-- the cron keep writing the donations_* columns untouched by this.
create or replace function public.enforce_admin_raise_target()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.raise_target is distinct from OLD.raise_target
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only an admin can change the fundraising goal';
  end if;
  return NEW;
end;
$$;

drop trigger if exists enforce_admin_raise_target on public.club_settings;
create trigger enforce_admin_raise_target
  before update on public.club_settings
  for each row execute function public.enforce_admin_raise_target();

-- PostgREST exposes every function in public, and this one is SECURITY DEFINER;
-- same treatment as log_activity(). (A trigger function can't be called via RPC
-- anyway, but the advisor flags it and the intent should be explicit.)
revoke execute on function public.enforce_admin_raise_target() from public, anon, authenticated;

-- ---- Dashboard RPC -------------------------------------------------------
-- Re-declared in full (copied from 0032) with only the 'fundraising' key changed:
-- it now reads the provider-neutral columns and adds the legacy total.
create or replace function public.get_public_dashboard()
returns jsonb
language sql
stable security definer
set search_path to 'public'
as $function$
  with term as (
    select public.current_term_start() as start,
           coalesce((select hours_cutoff_date from public.club_settings where id), '1900-01-01'::date) as cut
  ),
  ev as (
    select p.id,
      coalesce(sum(case when e.ended and e.date >= (select cut from term) then e.hours else 0 end), 0) as ev_total,
      coalesce(sum(case when e.ended and e.date >= greatest((select start from term), (select cut from term)) then e.hours else 0 end), 0) as ev_term
    from public.profiles p
    left join public.event_signups s on s.member_id = p.id
    left join (
      select e.*, (e.date is not null and not e.is_tentative
        and (e.date + coalesce(e.end_time, time '23:59')) at time zone 'America/Los_Angeles' <= now()) as ended
      from public.events e
    ) e on e.id = s.event_id
    group by p.id
  ),
  mtg as (
    select p.id,
      coalesce(sum(case when not m.canceled and m.date >= (select cut from term)
        and (m.date + coalesce(m.end_time, time '23:59')) at time zone 'America/Los_Angeles' <= now()
        then (case when a.role = 'contributor' then 1 else 0 end)
           + (case when m.start_time is not null and m.end_time is not null and m.end_time > m.start_time
                   then extract(epoch from (m.end_time - m.start_time)) / 3600.0 else 1 end)
        else 0 end), 0) as m_total,
      coalesce(sum(case when not m.canceled and m.date >= greatest((select start from term), (select cut from term))
        and (m.date + coalesce(m.end_time, time '23:59')) at time zone 'America/Los_Angeles' <= now()
        then (case when a.role = 'contributor' then 1 else 0 end)
           + (case when m.start_time is not null and m.end_time is not null and m.end_time > m.start_time
                   then extract(epoch from (m.end_time - m.start_time)) / 3600.0 else 1 end)
        else 0 end), 0) as m_term
    from public.profiles p
    left join public.meeting_attendees a on a.member_id = p.id
    left join public.meetings m on m.id = a.meeting_id
    group by p.id
  ),
  led as (
    select member_id,
      coalesce(sum(hours), 0) as g_total,
      coalesce(sum(hours) filter (where (case when source = 'import' then entry_date else coalesce(entry_date, granted_at::date) end) >= (select start from term)), 0) as g_term
    from public.hours_grants group by member_id
  ),
  member_hours as (
    select p.id, p.name, p.role, p.avatar_url, p.is_founder,
      coalesce(ev.ev_total, 0) + coalesce(mtg.m_total, 0) + coalesce(led.g_total, 0) + coalesce(p.hours_adjustment, 0) as hours,
      coalesce(ev.ev_term, 0) + coalesce(mtg.m_term, 0) + coalesce(led.g_term, 0) as term_hours
    from public.profiles p
    left join ev on ev.id = p.id
    left join mtg on mtg.id = p.id
    left join led on led.member_id = p.id
  )
  select jsonb_build_object(
    'members_count',     (select count(*) from public.profiles),
    'events_count',      (select count(*) from public.events where not is_tentative),
    'events_term',       (select count(*) from public.events where not is_tentative and date >= (select start from term)),
    'upcoming_events',   (select count(*) from public.events e where not e.is_tentative and e.date is not null
                            and (e.date + coalesce(e.end_time, time '23:59')) at time zone 'America/Los_Angeles' > now()),
    'tentative_events',  (select count(*) from public.events where is_tentative),
    'meetings_count',    (select count(*) from public.meetings where not canceled),
    'meetings_term',     (select count(*) from public.meetings where not canceled and date >= (select start from term)),
    'upcoming_meetings', (select count(*) from public.meetings m where not m.canceled
                            and (m.date + coalesce(m.end_time, time '23:59')) at time zone 'America/Los_Angeles' > now()),
    'total_hours',       (select coalesce(sum(hours), 0) from member_hours),
    'term_hours',        (select coalesce(sum(term_hours), 0) from member_hours),
    'term_start',        (select start from term),
    -- Fundraising: the club's online total is its own Givebutter page PLUS the
    -- final GoFundMe figure (0038 merged the retired platform in, so the headline
    -- never drops when the platform changes). `raised` + `target` keep their old
    -- shape so existing dashboard clients are unaffected.
    'fundraising',       (select jsonb_build_object(
                            'raised',          coalesce(donations_raised, 0) + coalesce(donations_legacy_raised, 0),
                            'target',          coalesce(raise_target, 10000),
                            'provider',        coalesce(donations_provider, 'givebutter'),
                            'url',             donations_url,
                            'campaign_url',    donations_campaign_url,
                            'team_name',       donations_team_name,
                            'online_raised',   donations_raised,
                            'legacy_raised',   donations_legacy_raised,
                            'legacy_label',    donations_legacy_label,
                            'campaign_raised', donations_campaign_raised,
                            'campaign_goal',   donations_campaign_goal,
                            'synced_at',       donations_synced_at
                          ) from public.club_settings where id),
    'insights',          (select coalesce(ai_insights, '[]'::jsonb) from public.club_settings where id),
    'term_targets',      (select coalesce(term_targets, '[]'::jsonb) from public.club_settings where id),
    'leaderboard', (
      select coalesce(jsonb_agg(r), '[]'::jsonb) from (
        select jsonb_build_object('id', id, 'name', name, 'role', role, 'avatar_url', avatar_url,
                                  'is_founder', is_founder, 'hours', round(hours, 1), 'term_hours', round(term_hours, 1)) as r
        from member_hours order by hours desc, name asc limit 8
      ) t
    ),
    'goals', (
      select coalesce(jsonb_agg(r), '[]'::jsonb) from (
        select jsonb_build_object('id', g.id, 'title', g.title, 'detail', g.detail, 'progress', g.progress,
                                  'period', g.period,
                                  'owner_name', op.name, 'owner_role', op.role, 'owner_avatar', op.avatar_url) as r
        from public.goals g left join public.profiles op on op.id = g.owner_id
        where coalesce(g.progress, 0) < 100
        order by (g.period = 'TERM') desc, g.progress desc, g.created_at desc limit 6
      ) t
    ),
    'upcoming_events_list', (
      select coalesce(jsonb_agg(r), '[]'::jsonb) from (
        select jsonb_build_object('id', e.id, 'name', e.name, 'date', e.date, 'location', e.location,
                                  'is_tentative', e.is_tentative,
                                  'signups', (select count(*) from public.event_signups s where s.event_id = e.id)) as r
        from public.events e where not e.is_tentative and e.date is not null
          and (e.date + coalesce(e.end_time, time '23:59')) at time zone 'America/Los_Angeles' > now()
        order by e.date asc limit 6
      ) t
    ),
    'upcoming_meetings_list', (
      select coalesce(jsonb_agg(r), '[]'::jsonb) from (
        select jsonb_build_object('id', m.id, 'title', m.title, 'date', m.date, 'start_time', m.start_time,
                                  'attendees', (select count(*) from public.meeting_attendees a where a.meeting_id = m.id)) as r
        from public.meetings m where not m.canceled
          and (m.date + coalesce(m.end_time, time '23:59')) at time zone 'America/Los_Angeles' > now()
        order by m.date asc, m.start_time asc limit 6
      ) t
    )
  );
$function$;

-- ---- Scheduled sync ------------------------------------------------------
-- Replace the every-3h sync-gofundme job with the same cadence against
-- sync-donations. The old job was created out of band and is in no migration
-- file, so its name is not known here: unschedule anything whose command still
-- points at the retired function, then drop the names it was likely given.
do $$
declare j record;
begin
  for j in select jobname from cron.job where command like '%sync-gofundme%' loop
    perform cron.unschedule(j.jobname);
  end loop;
exception when others then null;
end $$;

do $$
begin
  perform cron.unschedule('sync-gofundme');
exception when others then null;
end $$;

do $$
begin
  perform cron.unschedule('sync-gofundme-3h');
exception when others then null;
end $$;

do $$
begin
  perform cron.unschedule('sync-donations-3h');
exception when others then null;
end $$;

select cron.schedule(
  'sync-donations-3h',
  '0 */3 * * *',
  $req$
  select net.http_post(
    url:='https://sgjcliwmzshhkhjlbdjy.supabase.co/functions/v1/sync-donations',
    headers:='{"Content-Type":"application/json","apikey":"sb_publishable_G_CYr7cEiRJhN67ACmhuLg_q2h2yji3"}'::jsonb
  )
  $req$
);
