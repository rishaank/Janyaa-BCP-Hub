-- ============================================================
-- 0026 — Security hardening (from the Supabase security advisors)
--   1. current_term_start(): pin search_path (advisor: function_search_path_mutable).
--   2. avatars bucket: drop the unrestricted SELECT policy on storage.objects so
--      anonymous clients can no longer LIST every file (which leaks member UUIDs
--      in the folder names). Avatar images are still served fine — the bucket is
--      public, and public-URL downloads don't go through RLS. Members keep
--      own-folder SELECT (used by upload-with-upsert).
--   3. club_settings.reminders_sent_at: lets the send-reminders Edge Function
--      self-throttle unauthenticated (cron) runs, so a stranger hitting the
--      public endpoint can't spam members with duplicate reminder emails.
-- ============================================================

-- 1. The only flagged function still missing a pinned search_path.
alter function public.current_term_start() set search_path = '';

-- 2. No more bucket-wide listing; reads scoped to the caller's own folder.
drop policy if exists "avatars read" on storage.objects;
create policy "avatars read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- 3. Last unauthenticated reminder run (see supabase/functions/send-reminders).
alter table public.club_settings add column if not exists reminders_sent_at timestamptz;
