\set ON_ERROR_STOP on
\pset footer off

DO $$
DECLARE
  v_job_count integer;
  v_rls_enabled boolean;
BEGIN
  IF to_regprocedure('public.daily_reset_job()') IS NULL
     OR to_regprocedure('public.run_daily_reset_if_due()') IS NULL THEN
    RAISE EXCEPTION 'daily reset functions are missing';
  END IF;

  IF NOT (
    SELECT coalesce(
      procedure.prosecdef
        AND procedure.proconfig @> ARRAY['search_path=pg_catalog, public'],
      false
    )
    FROM pg_proc AS procedure
    WHERE procedure.oid = 'public.daily_reset_job()'::regprocedure
  ) THEN
    RAISE EXCEPTION 'daily_reset_job must be SECURITY DEFINER with a fixed search_path';
  END IF;

  IF has_function_privilege('anon', 'public.daily_reset_job()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.daily_reset_job()', 'EXECUTE')
     OR has_function_privilege('anon', 'public.run_daily_reset_if_due()', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.run_daily_reset_if_due()', 'EXECUTE') THEN
    RAISE EXCEPTION 'daily reset execution leaked to an application role';
  END IF;

  IF NOT has_function_privilege('service_role', 'public.daily_reset_job()', 'EXECUTE')
     OR NOT has_function_privilege(
       'service_role',
       'public.run_daily_reset_if_due()',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'service_role cannot execute daily reset functions';
  END IF;

  SELECT relrowsecurity
  INTO v_rls_enabled
  FROM pg_class
  WHERE oid = 'public.daily_reset_runs'::regclass;

  IF NOT v_rls_enabled THEN
    RAISE EXCEPTION 'daily_reset_runs must have RLS enabled';
  END IF;

  SELECT count(*)
  INTO v_job_count
  FROM cron.job
  WHERE jobname = 'hhu-daily-reset'
    AND schedule = '0 11,12 * * *'
    AND command = 'SELECT public.run_daily_reset_if_due();'
    AND active;

  IF v_job_count <> 1 THEN
    RAISE EXCEPTION 'expected exactly one active hhu-daily-reset cron job';
  END IF;
END;
$$;

\echo '=== registered cron ==='
SELECT jobid, jobname, schedule, command, active
FROM cron.job
WHERE jobname = 'hhu-daily-reset';

\echo '=== function security ==='
SELECT procedure.proname,
       procedure.prosecdef AS security_definer,
       procedure.proconfig,
       has_function_privilege('anon', procedure.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
         AS authenticated_execute,
       has_function_privilege('service_role', procedure.oid, 'EXECUTE')
         AS service_role_execute
FROM pg_proc AS procedure
WHERE procedure.oid IN (
  'public.daily_reset_job()'::regprocedure,
  'public.run_daily_reset_if_due()'::regprocedure
)
ORDER BY procedure.proname;

\echo '=== recent operation log ==='
SELECT run_date, cutoff_at, completed_at, status,
       deleted_messages, deleted_ratings, deleted_matches, deleted_queues,
       reset_profiles
FROM public.daily_reset_runs
ORDER BY run_date DESC
LIMIT 7;

\echo '=== recent cron invocations ==='
SELECT status, return_message, start_time, end_time
FROM cron.job_run_details
WHERE jobid = (
  SELECT jobid FROM cron.job WHERE jobname = 'hhu-daily-reset'
)
ORDER BY start_time DESC
LIMIT 10;
