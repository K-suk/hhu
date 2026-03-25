-- =============================================================================
-- Reconcile remote Supabase state with local codebase.
--
-- Context:
--   Several functions/triggers were added directly in the Supabase SQL editor
--   and were not reflected in local migration files. Conversely, some local
--   migrations had not been applied to the remote database.
--
-- After this migration the full schema is expressed in this codebase alone.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. profiles.birth_date  (local-only → apply to remote)
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_date date;

-- -----------------------------------------------------------------------------
-- 2. enrol_course RPC  (local-only → apply to remote)
--    Previous migration (202602260003) added the table columns but the
--    function may not have been executed on the remote instance.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.enrol_course(text, text);
DROP FUNCTION IF EXISTS public.enrol_course(text, text, text);

CREATE OR REPLACE FUNCTION public.enrol_course(
  p_course_id       text,
  p_gender_identity text,
  p_email_domain    text
)
RETURNS TABLE(match_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id            uuid := auth.uid();
  v_self_queue_id      uuid;
  v_candidate_queue_id uuid;
  v_candidate_user_id  uuid;
  v_match_id           uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_course_id IS NULL OR p_gender_identity IS NULL OR p_email_domain IS NULL THEN
    RAISE EXCEPTION 'Missing matching parameters';
  END IF;

  -- One queue row per user.
  DELETE FROM public.queues WHERE user_id = v_user_id;

  INSERT INTO public.queues (user_id, course_id, gender_identity, email_domain)
  VALUES (v_user_id, p_course_id, p_gender_identity, lower(p_email_domain))
  RETURNING id INTO v_self_queue_id;

  -- 1) Exact match: same domain + gender + course.
  SELECT q.id, q.user_id
  INTO v_candidate_queue_id, v_candidate_user_id
  FROM public.queues q
  JOIN public.profiles p ON p.id = q.user_id
  WHERE q.user_id        <> v_user_id
    AND q.email_domain    = lower(p_email_domain)
    AND q.gender_identity = p_gender_identity
    AND q.course_id       = p_course_id
    AND p.status          = 'waiting'
  ORDER BY q.created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  -- 2) Flexible match: same domain + gender, waiting > 1 minute.
  IF v_candidate_queue_id IS NULL THEN
    SELECT q.id, q.user_id
    INTO v_candidate_queue_id, v_candidate_user_id
    FROM public.queues q
    JOIN public.profiles p ON p.id = q.user_id
    WHERE q.user_id        <> v_user_id
      AND q.email_domain    = lower(p_email_domain)
      AND q.gender_identity = p_gender_identity
      AND q.created_at     <= now() - interval '1 minute'
      AND p.status          = 'waiting'
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

  UPDATE public.profiles SET status = 'waiting' WHERE id = v_user_id;
  RETURN QUERY SELECT NULL::uuid;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. get_domain_min_age  (local-only → apply to remote)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_domain_min_age(p_email_domain text)
RETURNS TABLE(is_known boolean, min_age integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_domain text    := lower(trim(COALESCE(p_email_domain, '')));
  known_min_age     integer;
BEGIN
  IF normalized_domain = '' THEN
    RETURN QUERY SELECT false, 19;
    RETURN;
  END IF;

  SELECT u.min_age INTO known_min_age
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

-- -----------------------------------------------------------------------------
-- 4. handle_auth_user_verified  (replace old handle_new_user_post_verification)
--    Upgrade the auth trigger to also persist birth_date from user metadata.
-- -----------------------------------------------------------------------------
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

  INSERT INTO public.profiles (id, email_domain, birth_date)
  VALUES (
    NEW.id,
    NULLIF(lower(split_part(COALESCE(NEW.email, ''), '@', 2)), ''),
    parsed_birth_date
  )
  ON CONFLICT (id) DO UPDATE
    SET email_domain = COALESCE(EXCLUDED.email_domain, public.profiles.email_domain),
        birth_date   = COALESCE(EXCLUDED.birth_date,   public.profiles.birth_date);

  RETURN NEW;
END;
$$;

-- Swap the trigger from the old function to the new one.
DROP TRIGGER IF EXISTS on_auth_user_verified ON auth.users;
CREATE TRIGGER on_auth_user_verified
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_auth_user_verified();

-- Old function no longer referenced; keep definition for a safe rollback window.
-- DROP FUNCTION IF EXISTS public.handle_new_user_post_verification();

-- -----------------------------------------------------------------------------
-- 5. handle_new_match + trigger  (remote-only → capture in codebase)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET status = 'matched'
  WHERE id IN (NEW.user_1, NEW.user_2);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_match_created ON public.matches;
CREATE TRIGGER on_match_created
  AFTER INSERT ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_match();

-- -----------------------------------------------------------------------------
-- 6. update_user_gpa + trigger  (remote-only → capture in codebase)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_user_gpa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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

DROP TRIGGER IF EXISTS on_rating_inserted ON public.ratings;
CREATE TRIGGER on_rating_inserted
  AFTER INSERT OR UPDATE ON public.ratings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_gpa();

-- -----------------------------------------------------------------------------
-- 7. submit_grade RPC  (remote-only → capture in codebase)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_grade(
  p_match_id      uuid,
  p_rated_user_id uuid,
  p_grade_point   double precision
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ratings (match_id, rater_id, rated_user_id, grade_point)
  VALUES (p_match_id, auth.uid(), p_rated_user_id, p_grade_point);

  UPDATE public.matches SET status = 'graded' WHERE id = p_match_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 8. daily_reset_job  (remote-only → capture in codebase)
--    Called by pg_cron at 04:00 PST daily. Cron schedule must be configured
--    manually in Supabase Dashboard → Database → Cron Jobs.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.daily_reset_job()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.matches  SET status = 'expired' WHERE status = 'active';
  DELETE FROM public.messages;
  DELETE FROM public.queues;
  UPDATE public.profiles SET status = 'idle'    WHERE status IN ('searching', 'matched', 'waiting');
END;
$$;
