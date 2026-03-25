-- Fix: use a custom GUC flag instead of checking 'role' (which cannot be
-- set inside SECURITY DEFINER). This matches the pattern used by
-- hhu.allow_protected_profile_update for other guarded columns.

-- 1. Rewrite the guard trigger to check a custom GUC.
CREATE OR REPLACE FUNCTION public.guard_suspension_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  allow_suspension_update boolean :=
    COALESCE(current_setting('hhu.allow_suspension_update', true), 'off') = 'on';
BEGIN
  IF NOT allow_suspension_update THEN
    IF NEW.is_suspended IS DISTINCT FROM OLD.is_suspended
       OR NEW.suspend_reason IS DISTINCT FROM OLD.suspend_reason
       OR NEW.suspended_at IS DISTINCT FROM OLD.suspended_at
    THEN
      NEW.is_suspended := OLD.is_suspended;
      NEW.suspend_reason := OLD.suspend_reason;
      NEW.suspended_at := OLD.suspended_at;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Rewrite admin functions to set the custom GUC instead of 'role'.
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
  PERFORM set_config('hhu.allow_suspension_update', 'on', true);
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
  PERFORM set_config('hhu.allow_suspension_update', 'on', true);
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

-- 3. Permissions: only postgres (SQL Editor) and service_role can call these.
REVOKE ALL ON FUNCTION public.admin_suspend_user(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_suspend_user(uuid, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.admin_suspend_user(uuid, text) FROM anon;

REVOKE ALL ON FUNCTION public.admin_unsuspend_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_unsuspend_user(uuid) FROM authenticated;
REVOKE ALL ON FUNCTION public.admin_unsuspend_user(uuid) FROM anon;
