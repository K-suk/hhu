-- Lock down direct client updates to profiles and funnel approved mutations
-- through narrowly scoped SECURITY DEFINER functions.

REVOKE UPDATE ON TABLE public.profiles FROM authenticated;
REVOKE UPDATE ON TABLE public.profiles FROM anon;

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE OR REPLACE FUNCTION public.enforce_profile_update_constraints()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  allow_protected_update boolean :=
    COALESCE(current_setting('hhu.allow_protected_profile_update', true), 'off') = 'on';
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'profile id is immutable';
  END IF;

  IF NOT allow_protected_update THEN
    IF NEW.email_domain IS DISTINCT FROM OLD.email_domain THEN
      RAISE EXCEPTION 'email_domain is not directly editable';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'profile status is not directly editable';
    END IF;

    IF NEW.birth_date IS DISTINCT FROM OLD.birth_date THEN
      RAISE EXCEPTION 'birth_date is not directly editable';
    END IF;

    IF NEW.gpa IS DISTINCT FROM OLD.gpa THEN
      RAISE EXCEPTION 'gpa is not directly editable';
    END IF;

    IF NEW.bio IS DISTINCT FROM OLD.bio THEN
      RAISE EXCEPTION 'bio is not directly editable';
    END IF;

    IF NEW.year_of_study IS DISTINCT FROM OLD.year_of_study THEN
      RAISE EXCEPTION 'year_of_study is not directly editable';
    END IF;

    IF NEW.ig_handle IS DISTINCT FROM OLD.ig_handle THEN
      RAISE EXCEPTION 'ig_handle is not directly editable';
    END IF;

    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'created_at is immutable';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_profile_update_constraints_on_profiles ON public.profiles;
CREATE TRIGGER enforce_profile_update_constraints_on_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_update_constraints();

CREATE OR REPLACE FUNCTION public.validate_profile_text_input(
  p_value text,
  p_field_name text,
  p_min_length integer,
  p_max_length integer
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_value text := trim(COALESCE(p_value, ''));
BEGIN
  IF char_length(v_value) < p_min_length THEN
    RAISE EXCEPTION '% is too short', p_field_name;
  END IF;

  IF char_length(v_value) > p_max_length THEN
    RAISE EXCEPTION '% is too long', p_field_name;
  END IF;

  IF v_value ~ '<[^>]*>' THEN
    RAISE EXCEPTION '% cannot contain HTML', p_field_name;
  END IF;

  RETURN v_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_profile_gender_identity(p_value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_value text := trim(COALESCE(p_value, ''));
BEGIN
  IF v_value NOT IN ('Male', 'Female', 'Non-binary') THEN
    RAISE EXCEPTION 'Invalid gender_identity';
  END IF;

  RETURN v_value;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_profile_setup(
  p_display_name text,
  p_department text,
  p_gender_identity text
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email_domain text;
  v_display_name text;
  v_department text;
  v_gender_identity text;
  v_profile public.profiles%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT NULLIF(lower(split_part(COALESCE(u.email, ''), '@', 2)), '')
  INTO v_email_domain
  FROM auth.users u
  WHERE u.id = v_user_id;

  IF v_email_domain IS NULL THEN
    RAISE EXCEPTION 'Verified email domain is required';
  END IF;

  v_display_name := public.validate_profile_text_input(
    p_display_name,
    'display_name',
    2,
    50
  );
  v_department := public.validate_profile_text_input(
    p_department,
    'department',
    2,
    80
  );
  v_gender_identity := public.validate_profile_gender_identity(p_gender_identity);

  PERFORM set_config('hhu.allow_protected_profile_update', 'on', true);

  UPDATE public.profiles
  SET display_name = v_display_name,
      department = v_department,
      gender_identity = v_gender_identity,
      email_domain = COALESCE(email_domain, v_email_domain),
      status = 'idle'
  WHERE id = v_user_id
  RETURNING * INTO v_profile;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  RETURN v_profile;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_profile_basics(
  p_display_name text,
  p_department text
)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_display_name text;
  v_department text;
  v_profile public.profiles%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  v_display_name := public.validate_profile_text_input(
    p_display_name,
    'display_name',
    2,
    50
  );
  v_department := public.validate_profile_text_input(
    p_department,
    'department',
    2,
    80
  );

  UPDATE public.profiles
  SET display_name = v_display_name,
      department = v_department
  WHERE id = v_user_id
  RETURNING * INTO v_profile;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  RETURN v_profile;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_profile_avatar(p_avatar_url text)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_avatar_url text := trim(COALESCE(p_avatar_url, ''));
  v_profile public.profiles%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_avatar_url = '' THEN
    RAISE EXCEPTION 'avatar_url is required';
  END IF;

  IF char_length(v_avatar_url) > 2048 THEN
    RAISE EXCEPTION 'avatar_url is too long';
  END IF;

  UPDATE public.profiles
  SET avatar_url = v_avatar_url
  WHERE id = v_user_id
  RETURNING * INTO v_profile;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  RETURN v_profile;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_profile_idle()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM set_config('hhu.allow_protected_profile_update', 'on', true);

  UPDATE public.profiles
  SET status = 'idle'
  WHERE id = v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_auth_user_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parsed_birth_date date;
BEGIN
  parsed_birth_date := CASE
    WHEN COALESCE(NEW.raw_user_meta_data->>'birth_date', '') ~ '^\d{4}-\d{2}-\d{2}$'
      THEN (NEW.raw_user_meta_data->>'birth_date')::date
    ELSE NULL
  END;

  PERFORM set_config('hhu.allow_protected_profile_update', 'on', true);

  INSERT INTO public.profiles (id, email_domain, birth_date)
  VALUES (
    NEW.id,
    NULLIF(lower(split_part(COALESCE(NEW.email, ''), '@', 2)), ''),
    parsed_birth_date
  )
  ON CONFLICT (id) DO UPDATE
    SET email_domain = COALESCE(EXCLUDED.email_domain, public.profiles.email_domain),
        birth_date = COALESCE(EXCLUDED.birth_date, public.profiles.birth_date);

  RETURN NEW;
END;
$$;

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

    PERFORM set_config('hhu.allow_protected_profile_update', 'on', true);

    UPDATE public.profiles
    SET status = 'matched'
    WHERE id IN (v_user_id, v_candidate_user_id);

    RETURN QUERY SELECT v_match_id;
    RETURN;
  END IF;

  PERFORM set_config('hhu.allow_protected_profile_update', 'on', true);

  UPDATE public.profiles
  SET status = 'waiting'
  WHERE id = v_user_id;

  RETURN QUERY SELECT NULL::uuid;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('hhu.allow_protected_profile_update', 'on', true);

  UPDATE public.profiles
  SET status = 'matched'
  WHERE id IN (NEW.user_1, NEW.user_2);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user_gpa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM set_config('hhu.allow_protected_profile_update', 'on', true);

  UPDATE public.profiles
  SET gpa = (
    SELECT ROUND(AVG(grade_point)::numeric, 2)
    FROM public.ratings
    WHERE rated_user_id = NEW.rated_user_id
  )
  WHERE id = NEW.rated_user_id;
  RETURN NEW;
END;
$$;

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

  PERFORM set_config('hhu.allow_protected_profile_update', 'on', true);

  UPDATE public.profiles
  SET status = 'idle'
  WHERE id IN (v_match.user_1, v_match.user_2);
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

  PERFORM set_config('hhu.allow_protected_profile_update', 'on', true);

  UPDATE public.profiles
  SET status = 'idle'
  WHERE id = v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.daily_reset_job()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.matches SET status = 'expired' WHERE status = 'active';
  DELETE FROM public.messages;
  DELETE FROM public.queues;

  PERFORM set_config('hhu.allow_protected_profile_update', 'on', true);

  UPDATE public.profiles
  SET status = 'idle'
  WHERE status IN ('searching', 'matched', 'waiting');
END;
$$;

REVOKE ALL ON FUNCTION public.complete_profile_setup(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_profile_setup(text, text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.update_profile_basics(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_profile_basics(text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.update_profile_avatar(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_profile_avatar(text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.set_profile_idle() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_profile_idle() TO authenticated, service_role;
