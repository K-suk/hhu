-- Admin functions for suspending/unsuspending users.
-- These are SECURITY DEFINER and set 'role' = 'service_role' so the
-- guard_suspension_columns trigger allows the mutation.
-- Only service_role and postgres can EXECUTE these functions.

CREATE OR REPLACE FUNCTION public.admin_suspend_user(
  p_user_id uuid,
  p_reason text DEFAULT 'Policy violation'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('role', 'service_role', true);
  PERFORM set_config('hhu.allow_protected_profile_update', 'on', true);

  UPDATE public.profiles
  SET is_suspended = true,
      suspend_reason = COALESCE(p_reason, 'Policy violation'),
      suspended_at = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for user %', p_user_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unsuspend_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('role', 'service_role', true);
  PERFORM set_config('hhu.allow_protected_profile_update', 'on', true);

  UPDATE public.profiles
  SET is_suspended = false,
      suspend_reason = NULL,
      suspended_at = NULL
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for user %', p_user_id;
  END IF;
END;
$$;

-- Lock down: only service_role and postgres (superuser) can call these.
REVOKE ALL ON FUNCTION public.admin_suspend_user(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_suspend_user(uuid, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.admin_suspend_user(uuid, text) FROM anon;

REVOKE ALL ON FUNCTION public.admin_unsuspend_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_unsuspend_user(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.admin_unsuspend_user(uuid) FROM anon;
