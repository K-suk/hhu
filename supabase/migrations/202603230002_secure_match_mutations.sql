-- Lock down direct client updates to matches and funnel allowed mutations
-- through narrowly scoped SECURITY DEFINER functions.

REVOKE UPDATE ON TABLE public.matches FROM authenticated;
REVOKE UPDATE ON TABLE public.matches FROM anon;

DROP POLICY IF EXISTS "Users can report their matches" ON public.matches;

CREATE OR REPLACE FUNCTION public.enforce_match_update_constraints()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.user_1 IS DISTINCT FROM OLD.user_1 THEN
    RAISE EXCEPTION 'user_1 is immutable';
  END IF;

  IF NEW.user_2 IS DISTINCT FROM OLD.user_2 THEN
    RAISE EXCEPTION 'user_2 is immutable';
  END IF;

  IF NEW.course_id IS DISTINCT FROM OLD.course_id THEN
    RAISE EXCEPTION 'course_id is immutable';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status = 'active' AND NEW.status IN ('finished', 'graded', 'reported', 'expired'))
      OR (OLD.status = 'finished' AND NEW.status IN ('graded', 'reported'))
      OR (OLD.status = 'graded' AND NEW.status = 'reported')
    ) THEN
      RAISE EXCEPTION 'invalid match status transition from % to %', OLD.status, NEW.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_match_update_constraints_on_matches ON public.matches;
CREATE TRIGGER enforce_match_update_constraints_on_matches
  BEFORE UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_match_update_constraints();

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
END;
$$;

REVOKE ALL ON FUNCTION public.report_match(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_match(uuid) TO authenticated, service_role;
