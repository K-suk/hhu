-- Flexible matching upgrade for enrol_course RPC.

ALTER TABLE public.queues
  ADD COLUMN IF NOT EXISTS email_domain text;

ALTER TABLE public.queues
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

UPDATE public.queues q
SET email_domain = p.email_domain
FROM public.profiles p
WHERE q.user_id = p.id
  AND q.email_domain IS NULL;

UPDATE public.queues
SET created_at = now()
WHERE created_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_queues_email_domain_gender_course
  ON public.queues (email_domain, gender_identity, course_id);

DROP FUNCTION IF EXISTS public.enrol_course(text, text);
DROP FUNCTION IF EXISTS public.enrol_course(text, text, text);

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
  v_self_queue_id uuid;
  v_candidate_queue_id uuid;
  v_candidate_user_id uuid;
  v_match_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_course_id IS NULL OR p_gender_identity IS NULL OR p_email_domain IS NULL THEN
    RAISE EXCEPTION 'Missing matching parameters';
  END IF;

  -- Keep one queue row per user and lock the request to this transaction.
  DELETE FROM public.queues WHERE user_id = v_user_id;

  INSERT INTO public.queues (user_id, course_id, gender_identity, email_domain)
  VALUES (v_user_id, p_course_id, p_gender_identity, lower(p_email_domain))
  RETURNING id INTO v_self_queue_id;

  -- 1) Exact match: same domain + gender + course.
  SELECT q.id, q.user_id
  INTO v_candidate_queue_id, v_candidate_user_id
  FROM public.queues q
  JOIN public.profiles p ON p.id = q.user_id
  WHERE q.user_id <> v_user_id
    AND q.email_domain = lower(p_email_domain)
    AND q.gender_identity = p_gender_identity
    AND q.course_id = p_course_id
    AND p.status = 'waiting'
  ORDER BY q.created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  -- 2) Flexible match: same domain + gender, waiting > 1 minute.
  IF v_candidate_queue_id IS NULL THEN
    SELECT q.id, q.user_id
    INTO v_candidate_queue_id, v_candidate_user_id
    FROM public.queues q
    JOIN public.profiles p ON p.id = q.user_id
    WHERE q.user_id <> v_user_id
      AND q.email_domain = lower(p_email_domain)
      AND q.gender_identity = p_gender_identity
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
