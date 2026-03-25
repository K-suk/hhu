-- Add suspension fields to profiles.
-- Only set by admins (service_role); RLS prevents users from modifying these columns.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_suspended boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspend_reason text,
  ADD COLUMN IF NOT EXISTS suspended_at timestamptz;

-- Prevent users from setting suspension fields on themselves.
-- The existing UPDATE policy allows users to modify their own profile,
-- so we add a trigger to guard the suspension columns.
CREATE OR REPLACE FUNCTION public.guard_suspension_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_suspended IS DISTINCT FROM OLD.is_suspended
     OR NEW.suspend_reason IS DISTINCT FROM OLD.suspend_reason
     OR NEW.suspended_at IS DISTINCT FROM OLD.suspended_at
  THEN
    -- Only service_role (admin) may change suspension fields.
    IF current_setting('role', true) <> 'service_role' THEN
      NEW.is_suspended := OLD.is_suspended;
      NEW.suspend_reason := OLD.suspend_reason;
      NEW.suspended_at := OLD.suspended_at;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_suspension_columns ON public.profiles;
CREATE TRIGGER trg_guard_suspension_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_suspension_columns();
