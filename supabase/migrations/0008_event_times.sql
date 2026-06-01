-- ============================================================
-- 0008 — Event start/end times
--   • events.start_time / events.end_time — optional clock times for an event.
--     `date` stays the source of truth; when times are set they refine the
--     calendar (.ics) feed into a timed block instead of an all-day event.
-- Run in the Supabase SQL Editor (or applied via the Supabase MCP).
-- ============================================================
alter table public.events add column if not exists start_time time;
alter table public.events add column if not exists end_time   time;
