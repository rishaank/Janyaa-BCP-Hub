-- ============================================================
-- 0004 — performance: cover foreign keys with indexes so joins
-- and filters (signups by member, to-dos by event/assignee) stay
-- fast as the club grows. Safe to re-run.
-- ============================================================
create index if not exists event_signups_member_id_idx on public.event_signups (member_id);
create index if not exists event_signups_event_id_idx  on public.event_signups (event_id);
create index if not exists event_todos_event_id_idx     on public.event_todos (event_id);
create index if not exists event_todos_assignee_id_idx  on public.event_todos (assignee_id);
