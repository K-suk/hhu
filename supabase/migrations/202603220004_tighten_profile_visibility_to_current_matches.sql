-- Restrict profile visibility to self-view or current/recent matches only.

CREATE OR REPLACE FUNCTION public.can_view_profile(target_profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  IF auth.uid() = target_profile_id THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE (
      (m.user_1 = auth.uid() AND m.user_2 = target_profile_id)
      OR
      (m.user_2 = auth.uid() AND m.user_1 = target_profile_id)
    )
      AND m.status IN ('active', 'finished')
  );
END;
$$;
