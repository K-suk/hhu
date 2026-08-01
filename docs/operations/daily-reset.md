# Daily reset deployment and recovery runbook

HHU permanently deletes ephemeral match data at 04:00 in
`America/Vancouver`. The database job runs at 11:00 and 12:00 UTC so daylight
saving changes do not shift the user-facing cutoff. Only the invocation that
falls in the local 04:00 hour performs work; 05:00 is a failure retry window.

## Safety boundaries

- Apply and exercise the migration in a dedicated staging or Supabase Preview
  Branch first. Do not run the verification script against production.
- Do not create a data-only dump of messages, matches, queues, or raw ratings.
  That would create another recoverable copy of data promised to be ephemeral.
- Before deployment, confirm that the project has a recent managed backup or
  PITR recovery point. Use that only for a database-wide deployment incident,
  not to recover individual deleted conversations.
- Production deployment requires separate approval. A successful purge cannot
  be rolled back by another SQL migration.

## Pre-flight

1. Confirm the target project and compare migration history. Do not use a
   production project ref during staging verification:

   ```sh
   supabase migration list
   supabase db push --dry-run
   ```

2. Query the Supabase Management API with a fine-grained token that has only
   `backups_read`. Record either the newest `COMPLETED` backup timestamp or the
   PITR `earliest_physical_backup_date_unix` and
   `latest_physical_backup_date_unix` values. Never invoke a restore endpoint as
   part of this check:

   ```sh
   curl --fail-with-body --silent --show-error \
     --header "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
     "https://api.supabase.com/v1/projects/$STAGING_PROJECT_REF/database/backups"
   ```

3. Save a schema-only dump outside the repository and capture the definitions
   that this migration replaces:

   ```sh
   supabase db dump --linked --schema public --file /tmp/hhu-schema-before-reset.sql
   ```

   ```sql
   SELECT pg_get_functiondef('public.daily_reset_job()'::regprocedure);
   SELECT jobid, jobname, schedule, command, active
   FROM cron.job
   WHERE jobname = 'hhu-daily-reset';
   SELECT conrelid::regclass, conname, pg_get_constraintdef(oid)
   FROM pg_constraint
   WHERE conrelid IN (
     'public.messages'::regclass,
     'public.ratings'::regclass,
     'public.matches'::regclass,
     'public.queues'::regclass
   );
   ```

4. Record counts only; do not export row contents. Use the same most-recent
   Pacific 04:00 cutoff as the function:

   ```sql
   WITH boundary AS (
     SELECT (
       CASE
         WHEN (now() AT TIME ZONE 'America/Vancouver')::time < time '04:00'
           THEN date_trunc('day', now() AT TIME ZONE 'America/Vancouver')
             - interval '20 hours'
         ELSE date_trunc('day', now() AT TIME ZONE 'America/Vancouver')
             + interval '4 hours'
       END
     ) AT TIME ZONE 'America/Vancouver' AS cutoff_at
   ), old_matches AS (
     SELECT matches.id
     FROM public.matches, boundary
     WHERE matches.created_at < boundary.cutoff_at
   )
   SELECT
     boundary.cutoff_at,
     (SELECT count(*) FROM public.messages
       WHERE messages.created_at < boundary.cutoff_at
          OR messages.match_id IN (SELECT id FROM old_matches))
       AS target_messages,
     (SELECT count(*) FROM public.ratings
       WHERE ratings.created_at < boundary.cutoff_at
          OR ratings.match_id IN (SELECT id FROM old_matches))
       AS target_ratings,
     (SELECT count(*) FROM old_matches) AS target_matches,
     (SELECT count(*) FROM public.queues, boundary
       WHERE queues.created_at < boundary.cutoff_at)
       AS target_queues
   FROM boundary;
   ```

## Staging verification

Pass two existing synthetic staging user IDs to the psql wrapper. The script
executes inside a transaction and always rolls back. Verify that it reports
`DAILY RESET TEST PASSED`.

```sh
psql "$STAGING_DATABASE_URL" \
  -v test_user_1="00000000-0000-0000-0000-000000000001" \
  -v test_user_2="00000000-0000-0000-0000-000000000002" \
  -f supabase/tests/run_daily_reset_test.psql
```

After applying the migration, inspect the registered job and recent runs:

```sql
SELECT jobid, jobname, schedule, command, active
FROM cron.job
WHERE jobname = 'hhu-daily-reset';

SELECT run_date, cutoff_at, completed_at, status,
       deleted_messages, deleted_ratings, deleted_matches, deleted_queues,
       reset_profiles
FROM public.daily_reset_runs
ORDER BY run_date DESC
LIMIT 7;

SELECT status, return_message, start_time, end_time
FROM cron.job_run_details
WHERE jobid = (
  SELECT jobid FROM cron.job WHERE jobname = 'hhu-daily-reset'
)
ORDER BY start_time DESC
LIMIT 10;
```

The GitHub `staging` environment must contain exactly these secrets before the
manual Quality run. Enter values through `gh secret set --env staging` or the
GitHub environment UI; never put them in command history or repository files:

- `STAGING_DATABASE_URL`
- `E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY`,
  `E2E_SUPABASE_SERVICE_ROLE_KEY`
- `E2E_USER_1_ID`, `E2E_USER_1_EMAIL`, `E2E_USER_1_PASSWORD`
- `E2E_USER_2_ID`, `E2E_USER_2_EMAIL`, `E2E_USER_2_PASSWORD`
- `E2E_REPORT_SUBMIT_URL`, `E2E_REPORT_CONTROL_URL`
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `SUPABASE_ACCESS_TOKEN` (fine-grained `backups_read` only)
- `STAGING_PROJECT_REF`

Dispatch Quality against the implementation branch with `run_staging=true`,
`confirm_staging_backup=YES`, and the verified UTC backup or PITR timestamp in
`staging_backup_at`. The run must report `DAILY RESET TEST PASSED` and four
authenticated Playwright passes with no skips.

The workflow calls the read-only backup endpoint before opening a database
connection. It keeps only the region, backup status/timestamp, and PITR restore
window in `backup-metadata.json`; the access token and raw response are never
written to an artifact.

## Scheduled-run review

After the next 04:00/05:00 `America/Vancouver` window, review both operational
tables. Two pg_cron invocations are expected at 11:00 and 12:00 UTC; exactly one
`daily_reset_runs` row is expected for the Pacific date. The second invocation
is an intentional no-op after a successful 04:00 purge. Confirm that its logged
deletion counts contain no message body or user identifier.

Do not treat a successfully registered job as proof that the scheduler ran.
Production approval remains blocked until `cron.job_run_details` contains the
scheduled staging invocations and `daily_reset_runs.status = 'succeeded'` for
the corresponding Pacific date.

## Production rollout

1. Review the staging evidence and latest backup/PITR timestamp.
2. Obtain explicit approval for the irreversible production change.
3. Run `supabase db push`, then repeat the job-definition queries above.
4. Do not manually invoke `daily_reset_job()` in production. Let the next cron
   window run it and inspect both operational tables afterward.

If a problem is found before the first successful purge, unschedule the job and
restore the previous function definition from the schema-only dump. After a
successful purge, application code and scheduling can be rolled back, but the
deleted ephemeral rows must not be selectively restored.
