-- Disposable local PostgreSQL fixture for daily-reset verification.
-- This file is never applied to a linked Supabase project.

\set ON_ERROR_STOP on

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END;
$$;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  status text,
  gpa numeric
);

CREATE TABLE public.matches (
  id uuid PRIMARY KEY,
  user_1 uuid REFERENCES public.profiles(id),
  user_2 uuid REFERENCES public.profiles(id),
  course_id text NOT NULL,
  status text,
  created_at timestamptz
);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY,
  match_id uuid REFERENCES public.matches(id),
  sender_id uuid REFERENCES public.profiles(id),
  content text NOT NULL,
  created_at timestamptz
);

CREATE TABLE public.ratings (
  id uuid PRIMARY KEY,
  match_id uuid REFERENCES public.matches(id),
  rater_user_id uuid REFERENCES public.profiles(id),
  rated_user_id uuid REFERENCES public.profiles(id),
  grade_point double precision NOT NULL,
  created_at timestamptz,
  CONSTRAINT unique_match_rating UNIQUE (match_id, rater_user_id)
);

CREATE TABLE public.queues (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES public.profiles(id),
  course_id text NOT NULL,
  gender_identity text NOT NULL,
  email_domain text NOT NULL,
  status text,
  created_at timestamptz
);

CREATE OR REPLACE FUNCTION public.update_user_gpa()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.profiles
  SET gpa = (
    SELECT round(avg(grade_point)::numeric, 2)
    FROM public.ratings
    WHERE rated_user_id = NEW.rated_user_id
  )
  WHERE id = NEW.rated_user_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_rating_inserted
AFTER INSERT OR UPDATE ON public.ratings
FOR EACH ROW
EXECUTE FUNCTION public.update_user_gpa();

INSERT INTO public.profiles (id, status, gpa)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'idle', NULL),
  ('00000000-0000-4000-8000-000000000002', 'idle', NULL);
