-- ============================================================
-- 0020 — Fix year typos in the imported hours (0019)
--   The Sep/Oct/Dec 2026 "Club Meeting" rows were fall-2025 meetings entered with
--   the wrong year (they're out of chronological order in the source sheet). Shift
--   them back a year. Hours are unchanged, so per-member totals stay exact; this
--   also corrects their (wrongly inflated) "this term" classification.
-- ============================================================
update public.hours_grants
set entry_date = (entry_date - interval '1 year')::date
where source = 'import'
  and entry_date >= '2026-09-01' and entry_date <= '2026-12-31';
