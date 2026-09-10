-- ============================================================
-- 0037 — Event links (and Instagram folded into them)
--   Events had ONE link field, `instagram_urls`, while meetings had the general
--   `links` (migration 0030) that renders as favicon+name chips. So an event's
--   sign-up sheet, flyer or drive folder had nowhere to go, and an Instagram
--   post was the only URL an event could carry.
--   • events.links (text[]) — every event URL, same shape as meetings.links.
--   • Backfilled from instagram_urls, so existing posts keep showing. The UI
--     still detects Instagram URLs inside `links` and renders the full embeds
--     on the public event view; everything else becomes a link chip.
--   • get_public_event() returns `links` (it keeps returning `instagram_urls`
--     too, so a cached older bundle doesn't lose the posts mid-rollout).
--   `events.instagram_urls` is now DEPRECATED — kept only as the rollback path
--   and no longer written by the app. Drop it in a later migration.
-- ============================================================

alter table public.events add column if not exists links text[] not null default '{}';

-- Existing Instagram posts become ordinary links (idempotent: only fills a
-- still-empty links array).
update public.events
set links = instagram_urls
where coalesce(array_length(links, 1), 0) = 0
  and coalesce(array_length(instagram_urls, 1), 0) > 0;

-- ---- Public single event for the shareable view — now carries links ----
create or replace function public.get_public_event(p_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select case when e.id is null then null else jsonb_build_object(
    'id', e.id, 'name', e.name, 'date', e.date, 'start_time', e.start_time, 'end_time', e.end_time,
    'location', e.location, 'address', e.address, 'latitude', e.latitude, 'longitude', e.longitude,
    'hours', e.hours, 'raised', e.raised, 'notes', e.notes,
    'links', e.links, 'instagram_urls', e.instagram_urls,
    'is_tentative', e.is_tentative,
    'attendees', (
      select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'role', p.role, 'avatar_url', p.avatar_url) order by p.name), '[]'::jsonb)
      from public.event_signups s join public.profiles p on p.id = s.member_id where s.event_id = e.id
    )
  ) end
  from public.events e where e.id = p_id;
$$;
revoke all on function public.get_public_event(uuid) from public;
grant execute on function public.get_public_event(uuid) to anon, authenticated;
