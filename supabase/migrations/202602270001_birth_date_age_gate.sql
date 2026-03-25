-- Add birth_date to profiles and map it from auth user metadata
-- during post-verification profile creation.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS birth_date date;

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
        birth_date = COALESCE(EXCLUDED.birth_date, public.profiles.birth_date);

  RETURN NEW;
END;
$$;
