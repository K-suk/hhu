-- Fix profile update trigger to match the current live profiles schema.
-- The previous version referenced legacy optional columns like `bio`, which
-- are not present in the live table and caused all profile updates to fail.

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

    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'created_at is immutable';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
