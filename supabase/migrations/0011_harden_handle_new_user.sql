-- ============================================================
-- 0011 — Harden handle_new_user()
--   Revoke the default PUBLIC execute grant on the signup trigger function so it
--   can't be invoked directly via /rest/v1/rpc by anon/authenticated. It only
--   ever runs as the on-auth-user-created trigger, which fires regardless of
--   these grants. Clears the "… can execute SECURITY DEFINER function" advisor.
-- ============================================================
revoke all on function public.handle_new_user() from public, anon, authenticated;
