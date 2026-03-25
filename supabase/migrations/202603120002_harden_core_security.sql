-- Source-control core RLS policies and harden SECURITY DEFINER RPCs.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.university ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profiles visibility" ON public.profiles;
CREATE POLICY "Profiles visibility"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1
      FROM public.matches
      WHERE (
        (public.matches.user_1 = auth.uid() AND public.matches.user_2 = public.profiles.id)
        OR (public.matches.user_2 = auth.uid() AND public.matches.user_1 = public.profiles.id)
      )
    )
  );

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can see their own matches" ON public.matches;
CREATE POLICY "Users can see their own matches"
  ON public.matches
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_1 OR auth.uid() = user_2);

DROP POLICY IF EXISTS "Users can report their matches" ON public.matches;
CREATE POLICY "Users can report their matches"
  ON public.matches
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_1 OR auth.uid() = user_2)
  WITH CHECK (
    (auth.uid() = user_1 OR auth.uid() = user_2)
    AND status IN ('active', 'finished', 'graded', 'reported')
  );

DROP POLICY IF EXISTS "Users can view messages in their matches" ON public.messages;
CREATE POLICY "Users can view messages in their matches"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.matches
      WHERE public.matches.id = public.messages.match_id
        AND (public.matches.user_1 = auth.uid() OR public.matches.user_2 = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert their own messages" ON public.messages;
CREATE POLICY "Users can insert their own messages"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1
      FROM public.matches
      WHERE public.matches.id = public.messages.match_id
        AND public.matches.status = 'active'
        AND (public.matches.user_1 = auth.uid() OR public.matches.user_2 = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can see their own queue" ON public.queues;
CREATE POLICY "Users can see their own queue"
  ON public.queues
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own queue" ON public.queues;
CREATE POLICY "Users can delete their own queue"
  ON public.queues
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view ratings in their matches" ON public.ratings;
CREATE POLICY "Users can view ratings in their matches"
  ON public.ratings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = rater_user_id OR auth.uid() = rated_user_id);

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
        AND public.matches.status IN ('finished', 'graded')
        AND (
          (public.matches.user_1 = auth.uid() AND public.matches.user_2 = public.ratings.rated_user_id)
          OR (public.matches.user_2 = auth.uid() AND public.matches.user_1 = public.ratings.rated_user_id)
        )
    )
  );

DROP POLICY IF EXISTS "Authenticated users can read universities" ON public.university;
DROP POLICY IF EXISTS "Public university access" ON public.university;
CREATE POLICY "Public university access"
  ON public.university
  FOR SELECT
  TO public
  USING (true);

REVOKE ALL ON FUNCTION public.enrol_course(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enrol_course(text, text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.submit_grade(uuid, uuid, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_grade(uuid, uuid, double precision) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.get_domain_min_age(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_domain_min_age(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enrol_course(
  p_course_id text,
  p_gender_identity text,
  p_email_domain text
)
RETURNS TABLE(match_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_profile_gender text;
  v_profile_email_domain text;
  v_self_queue_id uuid;
  v_candidate_queue_id uuid;
  v_candidate_user_id uuid;
  v_match_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT gender_identity, lower(email_domain)
  INTO v_profile_gender, v_profile_email_domain
  FROM public.profiles
  WHERE id = v_user_id;

  IF v_profile_gender IS NULL OR v_profile_email_domain IS NULL THEN
    RAISE EXCEPTION 'Profile must be complete before matching';
  END IF;

  IF lower(trim(COALESCE(p_email_domain, ''))) <> v_profile_email_domain THEN
    RAISE EXCEPTION 'Email domain mismatch';
  END IF;

  IF trim(COALESCE(p_gender_identity, '')) <> v_profile_gender THEN
    RAISE EXCEPTION 'Gender identity mismatch';
  END IF;

  IF p_course_id IS NULL OR p_gender_identity IS NULL OR p_email_domain IS NULL THEN
    RAISE EXCEPTION 'Missing matching parameters';
  END IF;

  DELETE FROM public.queues WHERE user_id = v_user_id;

  INSERT INTO public.queues (user_id, course_id, gender_identity, email_domain)
  VALUES (v_user_id, p_course_id, v_profile_gender, v_profile_email_domain)
  RETURNING id INTO v_self_queue_id;

  SELECT q.id, q.user_id
  INTO v_candidate_queue_id, v_candidate_user_id
  FROM public.queues q
  JOIN public.profiles p ON p.id = q.user_id
  WHERE q.user_id <> v_user_id
    AND q.email_domain = v_profile_email_domain
    AND q.gender_identity = v_profile_gender
    AND q.course_id = p_course_id
    AND p.status = 'waiting'
  ORDER BY q.created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF v_candidate_queue_id IS NULL THEN
    SELECT q.id, q.user_id
    INTO v_candidate_queue_id, v_candidate_user_id
    FROM public.queues q
    JOIN public.profiles p ON p.id = q.user_id
    WHERE q.user_id <> v_user_id
      AND q.email_domain = v_profile_email_domain
      AND q.gender_identity = v_profile_gender
      AND q.created_at <= now() - interval '1 minute'
      AND p.status = 'waiting'
    ORDER BY q.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1;
  END IF;

  IF v_candidate_queue_id IS NOT NULL THEN
    DELETE FROM public.queues
    WHERE id IN (v_self_queue_id, v_candidate_queue_id);

    INSERT INTO public.matches (user_1, user_2, course_id, status)
    VALUES (v_user_id, v_candidate_user_id, p_course_id, 'active')
    RETURNING id INTO v_match_id;

    UPDATE public.profiles
    SET status = 'matched'
    WHERE id IN (v_user_id, v_candidate_user_id);

    RETURN QUERY SELECT v_match_id;
    RETURN;
  END IF;

  UPDATE public.profiles
  SET status = 'waiting'
  WHERE id = v_user_id;

  RETURN QUERY SELECT NULL::uuid;
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
  WHERE id = p_match_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found';
  END IF;

  IF v_match.status NOT IN ('finished', 'graded') THEN
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

  UPDATE public.matches
  SET status = 'graded'
  WHERE id = p_match_id;
END;
$$;
