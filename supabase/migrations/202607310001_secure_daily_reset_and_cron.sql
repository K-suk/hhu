-- Physically purge ephemeral records at 04:00 America/Vancouver.
--
-- pg_cron runs in UTC on Supabase. The job fires at both possible UTC
-- equivalents of 04:00 Pacific time. The wrapper below performs the reset only
-- during the local 04:00 hour, with a 05:00 retry window when the 04:00
-- transaction failed. A successful run is idempotent for the local calendar day.

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE TABLE IF NOT EXISTS public.daily_reset_runs (
  run_date date PRIMARY KEY,
  cutoff_at timestamptz NOT NULL,
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'succeeded')),
  deleted_messages integer NOT NULL DEFAULT 0,
  deleted_ratings integer NOT NULL DEFAULT 0,
  deleted_matches integer NOT NULL DEFAULT 0,
  deleted_queues integer NOT NULL DEFAULT 0,
  reset_profiles integer NOT NULL DEFAULT 0
);

ALTER TABLE public.daily_reset_runs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.daily_reset_runs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.daily_reset_runs TO service_role;

CREATE OR REPLACE FUNCTION public.daily_reset_job()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_local_now timestamp without time zone :=
    clock_timestamp() AT TIME ZONE 'America/Vancouver';
  v_cutoff_local timestamp without time zone;
  v_cutoff timestamptz;
  v_run_date date;
  v_claimed_date date;
  v_deleted_messages integer := 0;
  v_deleted_ratings integer := 0;
  v_deleted_matches integer := 0;
  v_deleted_queues integer := 0;
  v_reset_profiles integer := 0;
BEGIN
  v_cutoff_local := date_trunc('day', v_local_now) + interval '4 hours';

  IF v_local_now < v_cutoff_local THEN
    v_cutoff_local := v_cutoff_local - interval '1 day';
  END IF;

  v_cutoff := v_cutoff_local AT TIME ZONE 'America/Vancouver';
  v_run_date := v_cutoff_local::date;

  -- Serialize manual and scheduled invocations. The run row is committed only
  -- when the whole purge succeeds, so a failed 04:00 transaction can retry.
  PERFORM pg_advisory_xact_lock(hashtextextended('hhu.daily_reset_job', 0));

  INSERT INTO public.daily_reset_runs (run_date, cutoff_at)
  VALUES (v_run_date, v_cutoff)
  ON CONFLICT (run_date) DO NOTHING
  RETURNING run_date INTO v_claimed_date;

  IF v_claimed_date IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.messages AS message
  WHERE message.created_at < v_cutoff
     OR EXISTS (
       SELECT 1
       FROM public.matches AS match
       WHERE match.id = message.match_id
         AND match.created_at < v_cutoff
     );
  GET DIAGNOSTICS v_deleted_messages = ROW_COUNT;

  -- Raw grades are ephemeral. profiles.gpa is an already-computed aggregate
  -- and intentionally remains unchanged by this DELETE.
  DELETE FROM public.ratings AS rating
  WHERE rating.created_at < v_cutoff
     OR EXISTS (
       SELECT 1
       FROM public.matches AS match
       WHERE match.id = rating.match_id
         AND match.created_at < v_cutoff
     );
  GET DIAGNOSTICS v_deleted_ratings = ROW_COUNT;

  DELETE FROM public.matches AS match
  WHERE match.created_at < v_cutoff;
  GET DIAGNOSTICS v_deleted_matches = ROW_COUNT;

  DELETE FROM public.queues AS queue
  WHERE queue.created_at < v_cutoff;
  GET DIAGNOSTICS v_deleted_queues = ROW_COUNT;

  PERFORM set_config('hhu.allow_protected_profile_update', 'on', true);

  UPDATE public.profiles AS profile
  SET status = 'idle'
  WHERE profile.status IN ('searching', 'matched', 'waiting')
    AND NOT EXISTS (
      SELECT 1
      FROM public.queues AS queue
      WHERE queue.user_id = profile.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.matches AS match
      WHERE match.user_1 = profile.id OR match.user_2 = profile.id
    );
  GET DIAGNOSTICS v_reset_profiles = ROW_COUNT;

  UPDATE public.daily_reset_runs
  SET completed_at = clock_timestamp(),
      status = 'succeeded',
      deleted_messages = v_deleted_messages,
      deleted_ratings = v_deleted_ratings,
      deleted_matches = v_deleted_matches,
      deleted_queues = v_deleted_queues,
      reset_profiles = v_reset_profiles
  WHERE run_date = v_run_date;
END;
$$;

CREATE OR REPLACE FUNCTION public.run_daily_reset_if_due()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_local_hour integer := EXTRACT(
    HOUR FROM clock_timestamp() AT TIME ZONE 'America/Vancouver'
  );
BEGIN
  -- 04:00 is the normal run. 05:00 is a retry window: daily_reset_job()
  -- immediately returns when the 04:00 run already committed successfully.
  IF v_local_hour NOT IN (4, 5) THEN
    RETURN;
  END IF;

  PERFORM public.daily_reset_job();
END;
$$;

REVOKE ALL ON FUNCTION public.daily_reset_job() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.run_daily_reset_if_due() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.daily_reset_job() TO service_role;
GRANT EXECUTE ON FUNCTION public.run_daily_reset_if_due() TO service_role;

DO $$
BEGIN
  IF to_regprocedure('cron.schedule(text,text,text)') IS NULL THEN
    RAISE EXCEPTION 'pg_cron named scheduling API is unavailable';
  END IF;

  PERFORM cron.schedule(
    'hhu-daily-reset',
    '0 11,12 * * *',
    'SELECT public.run_daily_reset_if_due();'
  );
END;
$$;
