-- Restrict direct profile reads to self-view and expose a minimal partner
-- profile DTO through dedicated RPCs.

CREATE OR REPLACE FUNCTION public.get_partner_profile(target_profile_id uuid)
RETURNS TABLE(
  display_name text,
  avatar_url text,
  department text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR target_profile_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT public.can_view_profile(target_profile_id) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.display_name,
    p.avatar_url,
    p.department
  FROM public.profiles p
  WHERE p.id = target_profile_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_match_domain_consistent(target_match_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match public.matches%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR target_match_id IS NULL THEN
    RETURN false;
  END IF;

  SELECT *
  INTO v_match
  FROM public.matches
  WHERE id = target_match_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF auth.uid() NOT IN (v_match.user_1, v_match.user_2) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.profiles p1
    JOIN public.profiles p2
      ON p2.id = v_match.user_2
    WHERE p1.id = v_match.user_1
      AND p1.email_domain IS NOT NULL
      AND p1.email_domain = p2.email_domain
  );
END;
$$;

DROP POLICY IF EXISTS "Profiles visibility" ON public.profiles;
CREATE POLICY "Profiles visibility"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

GRANT EXECUTE ON FUNCTION public.get_partner_profile(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_match_domain_consistent(uuid) TO authenticated, service_role;
