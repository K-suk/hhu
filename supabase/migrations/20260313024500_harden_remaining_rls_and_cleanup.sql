-- Harden remaining RLS policies that directly reference matches, close
-- university reads to authenticated users, and remove stale helper functions.

CREATE OR REPLACE FUNCTION public.can_access_match(target_match_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.id = target_match_id
      AND (m.user_1 = auth.uid() OR m.user_2 = auth.uid())
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_send_message(target_match_id uuid, target_sender_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> target_sender_id THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.id = target_match_id
      AND m.status = 'active'
      AND (m.user_1 = auth.uid() OR m.user_2 = auth.uid())
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.can_submit_rating(
  target_match_id uuid,
  target_rater_user_id uuid,
  target_rated_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> target_rater_user_id THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.matches m
    WHERE m.id = target_match_id
      AND m.status IN ('finished', 'graded')
      AND (
        (m.user_1 = auth.uid() AND m.user_2 = target_rated_user_id)
        OR
        (m.user_2 = auth.uid() AND m.user_1 = target_rated_user_id)
      )
  );
END;
$$;

DROP POLICY IF EXISTS "Users can insert their own messages" ON public.messages;
CREATE POLICY "Users can insert their own messages"
  ON public.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_send_message(match_id, sender_id));

DROP POLICY IF EXISTS "Users can view messages in their matches" ON public.messages;
CREATE POLICY "Users can view messages in their matches"
  ON public.messages
  FOR SELECT
  TO authenticated
  USING (public.can_access_match(match_id));

DROP POLICY IF EXISTS "Users can insert their own ratings" ON public.ratings;
CREATE POLICY "Users can insert their own ratings"
  ON public.ratings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.can_submit_rating(match_id, rater_user_id, rated_user_id));

DROP POLICY IF EXISTS "Users can view ratings in their matches" ON public.ratings;
CREATE POLICY "Users can view ratings in their matches"
  ON public.ratings
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = rater_user_id
    OR auth.uid() = rated_user_id
  );

DROP POLICY IF EXISTS "Public university access" ON public.university;
CREATE POLICY "Authenticated university access"
  ON public.university
  FOR SELECT
  TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.handle_university_automation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD.email_domain IS NOT NULL
    AND OLD.email_domain IS DISTINCT FROM NEW.email_domain THEN
    UPDATE public.university
    SET user_count = (
      SELECT count(*)
      FROM public.profiles
      WHERE email_domain = OLD.email_domain
    )
    WHERE email_domain = OLD.email_domain;
  END IF;

  INSERT INTO public.university (email_domain, name, min_age)
  VALUES (
    NEW.email_domain,
    NEW.email_domain,
    CASE
      WHEN lower(NEW.email_domain) LIKE '%.edu' THEN 21
      ELSE 19
    END
  )
  ON CONFLICT (email_domain) DO NOTHING;

  UPDATE public.university
  SET user_count = (
    SELECT count(*)
    FROM public.profiles
    WHERE email_domain = NEW.email_domain
  )
  WHERE email_domain = NEW.email_domain;

  UPDATE public.university
  SET is_unlocked = true
  WHERE email_domain = NEW.email_domain
    AND user_count >= unlock_threshold
    AND is_unlocked = false;

  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.handle_new_user_post_verification();

GRANT EXECUTE ON FUNCTION public.can_access_match(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_send_message(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_submit_rating(uuid, uuid, uuid) TO authenticated;
