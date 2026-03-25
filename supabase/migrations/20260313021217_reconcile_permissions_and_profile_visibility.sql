-- Reconcile live database permissions with the application runtime and
-- remove the direct matches table dependency from the profiles visibility RLS.

GRANT USAGE ON SCHEMA public TO anon, authenticated;

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
    WHERE
      (m.user_1 = auth.uid() AND m.user_2 = target_profile_id)
      OR
      (m.user_2 = auth.uid() AND m.user_1 = target_profile_id)
  );
END;
$$;

DROP POLICY IF EXISTS "Profiles visibility" ON public.profiles;
CREATE POLICY "Profiles visibility"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.can_view_profile(id));

CREATE OR REPLACE FUNCTION public.get_domain_min_age(p_email_domain text)
RETURNS TABLE(is_known boolean, min_age integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_domain text := lower(trim(COALESCE(p_email_domain, '')));
  known_min_age integer;
BEGIN
  IF normalized_domain = '' THEN
    RETURN QUERY SELECT false, 19;
    RETURN;
  END IF;

  SELECT u.min_age
  INTO known_min_age
  FROM public.university u
  WHERE u.email_domain = normalized_domain;

  IF known_min_age IS NOT NULL THEN
    RETURN QUERY SELECT true, known_min_age;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT false, CASE WHEN normalized_domain LIKE '%.edu' THEN 21 ELSE 19 END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_view_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_domain_min_age(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enrol_course(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_grade(uuid, uuid, double precision) TO authenticated;

GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT ON TABLE public.matches TO authenticated;
GRANT UPDATE ON TABLE public.matches TO authenticated;
GRANT SELECT ON TABLE public.university TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.queues TO authenticated;
GRANT SELECT, INSERT ON TABLE public.messages TO authenticated;
GRANT SELECT, INSERT ON TABLE public.ratings TO authenticated;
