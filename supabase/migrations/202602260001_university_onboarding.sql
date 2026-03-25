-- Automatic University Onboarding System
-- Ensure legacy university onboarding trigger/function is removed before backfill.
DO $$
DECLARE
  profile_trigger record;
BEGIN
  FOR profile_trigger IN
    SELECT t.tgname
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE tgrelid = 'public.profiles'::regclass
      AND NOT t.tgisinternal
      AND n.nspname = 'public'
      AND (
        p.proname = 'handle_university_automation'
        OR p.proname = 'handle_university_waitlist_automation'
        OR pg_get_functiondef(p.oid) ILIKE '%university_waitlists%'
      )
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS %I ON public.profiles',
      profile_trigger.tgname
    );
  END LOOP;
END;
$$;

DROP FUNCTION IF EXISTS public.handle_university_automation();

-- Pre-check: only add the column when missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'email_domain'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN email_domain text;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.university (
  email_domain text PRIMARY KEY,
  name text,
  is_unlocked boolean DEFAULT false,
  unlock_threshold integer DEFAULT 10,
  user_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

INSERT INTO public.university (email_domain, name, is_unlocked, unlock_threshold)
VALUES ('ubc.ca', 'University of British Columbia', true, 0)
ON CONFLICT (email_domain) DO NOTHING;

-- Backfill missing profile domains from auth email when possible.
UPDATE public.profiles p
SET email_domain = lower(split_part(u.email, '@', 2))
FROM auth.users u
WHERE p.id = u.id
  AND p.email_domain IS NULL
  AND u.email IS NOT NULL
  AND position('@' IN u.email) > 0;

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

  INSERT INTO public.university (email_domain, name)
  VALUES (NEW.email_domain, NEW.email_domain)
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

CREATE TRIGGER on_profile_email_update
  AFTER INSERT OR UPDATE OF email_domain ON public.profiles
  FOR EACH ROW
  WHEN (NEW.email_domain IS NOT NULL)
  EXECUTE FUNCTION public.handle_university_automation();

ALTER TABLE public.university ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read universities" ON public.university;
CREATE POLICY "Authenticated users can read universities"
  ON public.university
  FOR SELECT
  TO authenticated
  USING (true);

-- Run automation once for existing domains.
INSERT INTO public.university (email_domain, name)
SELECT DISTINCT p.email_domain, p.email_domain
FROM public.profiles p
WHERE p.email_domain IS NOT NULL
ON CONFLICT (email_domain) DO NOTHING;

UPDATE public.university u
SET user_count = stats.user_count,
    is_unlocked = CASE
      WHEN u.is_unlocked THEN true
      WHEN stats.user_count >= u.unlock_threshold THEN true
      ELSE false
    END
FROM (
  SELECT email_domain, count(*)::integer AS user_count
  FROM public.profiles
  WHERE email_domain IS NOT NULL
  GROUP BY email_domain
) AS stats
WHERE u.email_domain = stats.email_domain;
