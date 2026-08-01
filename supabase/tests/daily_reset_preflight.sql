\set ON_ERROR_STOP on
\pset footer off

\echo '=== deletion target counts (no row contents) ==='
WITH boundary AS (
  SELECT (
    CASE
      WHEN (clock_timestamp() AT TIME ZONE 'America/Vancouver')::time < time '04:00'
        THEN date_trunc('day', clock_timestamp() AT TIME ZONE 'America/Vancouver')
          - interval '20 hours'
      ELSE date_trunc('day', clock_timestamp() AT TIME ZONE 'America/Vancouver')
        + interval '4 hours'
    END
  ) AT TIME ZONE 'America/Vancouver' AS cutoff_at
), old_matches AS (
  SELECT match.id
  FROM public.matches AS match, boundary
  WHERE match.created_at < boundary.cutoff_at
)
SELECT
  boundary.cutoff_at,
  (SELECT count(*)
   FROM public.messages AS message
   WHERE message.created_at < boundary.cutoff_at
      OR message.match_id IN (SELECT id FROM old_matches)) AS target_messages,
  (SELECT count(*)
   FROM public.ratings AS rating
   WHERE rating.created_at < boundary.cutoff_at
      OR rating.match_id IN (SELECT id FROM old_matches)) AS target_ratings,
  (SELECT count(*) FROM old_matches) AS target_matches,
  (SELECT count(*)
   FROM public.queues AS queue
   WHERE queue.created_at < boundary.cutoff_at)
    AS target_queues
FROM boundary;

\echo '=== existing reset function ==='
SELECT coalesce(
  pg_get_functiondef(to_regprocedure('public.daily_reset_job()')),
  'missing'
) AS daily_reset_job_before;

\echo '=== existing foreign keys ==='
SELECT conrelid::regclass AS table_name,
       conname,
       pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE contype = 'f'
  AND conrelid IN (
    'public.messages'::regclass,
    'public.ratings'::regclass,
    'public.matches'::regclass,
    'public.queues'::regclass
  )
ORDER BY conrelid::regclass::text, conname;

\echo '=== existing named cron ==='
DO $$
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    CREATE TEMP TABLE hhu_existing_cron (
      jobid bigint,
      jobname text,
      schedule text,
      command text,
      active boolean
    );
  ELSE
    CREATE TEMP TABLE hhu_existing_cron AS
    SELECT jobid, jobname, schedule, command, active
    FROM cron.job
    WHERE jobname = 'hhu-daily-reset';
  END IF;
END;
$$;

TABLE hhu_existing_cron;
