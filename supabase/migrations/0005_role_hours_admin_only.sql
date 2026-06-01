-- Role + hours are admin-only.
-- Remove the self-update policy so members can no longer change their own role
-- or hours via the API. Only admins (profiles_admin_update from 0003) can edit
-- profiles. New profiles are still created by the SECURITY DEFINER signup trigger.
drop policy if exists "profiles: update self" on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
