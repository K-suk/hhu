-- Smart age gate: dynamic minimum age by university domain.
ALTER TABLE public.university
ADD COLUMN IF NOT EXISTS min_age integer;

UPDATE public.university
SET min_age = CASE
  WHEN lower(email_domain) LIKE '%.edu' THEN 21
  ELSE 19
END
WHERE min_age IS NULL;

ALTER TABLE public.university
ALTER COLUMN min_age SET DEFAULT 19;

ALTER TABLE public.university
ALTER COLUMN min_age SET NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_university_automation()
RETURNS TRIGGER
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
