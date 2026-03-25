-- Grading status transitions:
--   active  → finished  (1st user grades)
--   finished → graded   (2nd user grades)

-- 1. Allow rating INSERT when match is active, finished, or graded.
DROP POLICY IF EXISTS "Users can insert their own ratings" ON public.ratings;
CREATE POLICY "Users can insert their own ratings"
  ON public.ratings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = rater_user_id
    AND EXISTS (
      SELECT 1
      FROM public.matches
      WHERE public.matches.id = public.ratings.match_id
        AND public.matches.status IN ('active', 'finished', 'graded')
        AND (
          (public.matches.user_1 = auth.uid() AND public.matches.user_2 = public.ratings.rated_user_id)
          OR (public.matches.user_2 = auth.uid() AND public.matches.user_1 = public.ratings.rated_user_id)
        )
    )
  );

-- 2. Rewrite submit_grade: accept active/finished, transition based on rating count.
CREATE OR REPLACE FUNCTION public.submit_grade(
  p_match_id uuid,
  p_rated_user_id uuid,
  p_grade_point double precision
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_match public.matches%ROWTYPE;
  v_rating_count integer;
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

  IF v_match.status NOT IN ('active', 'finished', 'graded') THEN
    RAISE EXCEPTION 'Match is not gradeable';
  END IF;

  IF v_user_id NOT IN (v_match.user_1, v_match.user_2) THEN
    RAISE EXCEPTION 'Not a participant in this match';
  END IF;

  IF (
    (v_match.user_1 = v_user_id AND v_match.user_2 <> p_rated_user_id)
    OR (v_match.user_2 = v_user_id AND v_match.user_1 <> p_rated_user_id)
  ) THEN
    RAISE EXCEPTION 'Rated user mismatch';
  END IF;

  INSERT INTO public.ratings (match_id, rater_user_id, rated_user_id, grade_point)
  VALUES (p_match_id, v_user_id, p_rated_user_id, p_grade_point);

  SELECT count(*)
  INTO v_rating_count
  FROM public.ratings
  WHERE match_id = p_match_id;

  IF v_rating_count >= 2 THEN
    UPDATE public.matches SET status = 'graded' WHERE id = p_match_id;
  ELSE
    UPDATE public.matches SET status = 'finished' WHERE id = p_match_id;
  END IF;
END;
$$;
