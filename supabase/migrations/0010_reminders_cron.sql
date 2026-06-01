-- ============================================================
-- 0010 — Daily to-do reminder emails
--   Schedules the `send-reminders` Edge Function once a day via pg_cron + pg_net
--   (same pattern as the sync-gofundme job). It emails each member the items
--   they claimed to bring for events happening TOMORROW.
--   Runs at 15:00 UTC ≈ 8 AM Pacific. Requires the SMTP_* Edge Function secrets.
-- ============================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Idempotent: drop any previous schedule before re-creating it.
do $$
begin
  perform cron.unschedule('send-reminders-daily');
exception when others then null;
end $$;

select cron.schedule(
  'send-reminders-daily',
  '0 15 * * *',
  $req$
  select net.http_post(
    url:='https://sgjcliwmzshhkhjlbdjy.supabase.co/functions/v1/send-reminders',
    headers:='{"Content-Type":"application/json","apikey":"sb_publishable_G_CYr7cEiRJhN67ACmhuLg_q2h2yji3"}'::jsonb
  )
  $req$
);
