-- Fix: after reporting a match, ensure both participants are returned to
-- a clean state (`profiles.status = 'idle'`) and any queue rows are removed.
-- This prevents the reporter from being redirected back into queue recovery
-- when navigating home immediately after a report.

CREATE OR REPLACE FUNCTION public.report_match(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_match public.matches%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT *
  INTO v_match
  FROM public.matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found';
  END IF;

  IF v_user_id NOT IN (v_match.user_1, v_match.user_2) THEN
    RAISE EXCEPTION 'Not a participant in this match';
  END IF;

  IF v_match.status NOT IN ('active', 'finished', 'graded') THEN
    RAISE EXCEPTION 'Match cannot be reported in its current state';
  END IF;

  UPDATE public.matches
  SET status = 'reported'
  WHERE id = p_match_id;

  -- Allow updating the profile status fields via the protected trigger.
  PERFORM set_config('hhu.allow_protected_profile_update', 'on', true);

  UPDATE public.profiles
  SET status = 'idle'
  WHERE id IN (v_match.user_1, v_match.user_2);

  DELETE FROM public.queues
  WHERE user_id IN (v_match.user_1, v_match.user_2);
END;
$$;

REVOKE ALL ON FUNCTION public.report_match(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_match(uuid) TO authenticated, service_role;

