-- Cache AI-generated insights on the shared settings row so the whole club sees
-- the same set and we only call Gemini on demand (never on every page load).
alter table public.club_settings
  add column if not exists ai_insights jsonb,
  add column if not exists ai_insights_at timestamptz;
