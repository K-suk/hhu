-- Create profile only after email verification.
-- This replaces the legacy "create profile on user created" trigger.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

CREATE OR REPLACE FUNCTION public.handle_auth_user_verified()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email_domain)
  VALUES (
    NEW.id,
    NULLIF(lower(split_part(COALESCE(NEW.email, ''), '@', 2)), '')
  )
  ON CONFLICT (id) DO UPDATE
    SET email_domain = COALESCE(EXCLUDED.email_domain, public.profiles.email_domain);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_verified ON auth.users;
CREATE TRIGGER on_auth_user_verified
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_auth_user_verified();
