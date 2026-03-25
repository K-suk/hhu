-- Normalize ratings schema so code, generated types, and SQL agree.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ratings'
      AND column_name = 'rater_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'ratings'
      AND column_name = 'rater_user_id'
  ) THEN
    ALTER TABLE public.ratings RENAME COLUMN rater_id TO rater_user_id;
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.ratings'::regclass
      AND conname = 'unique_match_rating'
  ) THEN
    ALTER TABLE public.ratings
      ADD CONSTRAINT unique_match_rating UNIQUE (match_id, rater_user_id);
  END IF;
END;
$$;

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
BEGIN
  INSERT INTO public.ratings (match_id, rater_user_id, rated_user_id, grade_point)
  VALUES (p_match_id, auth.uid(), p_rated_user_id, p_grade_point);

  UPDATE public.matches
  SET status = 'graded'
  WHERE id = p_match_id;
END;
$$;
