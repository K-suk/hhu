-- STAGING ONLY. Set hhu.test_user_1 and hhu.test_user_2 to synthetic users.
-- Every change is rolled back, including daily_reset_runs and deleted rows.

BEGIN;

DO $$
BEGIN
  IF current_setting('hhu.test_user_1', true) IS NULL
     OR current_setting('hhu.test_user_2', true) IS NULL THEN
    RAISE EXCEPTION 'Set hhu.test_user_1 and hhu.test_user_2 first';
  END IF;
END;
$$;

SELECT set_config(
  'hhu.test_cutoff',
  (
    CASE
      WHEN (clock_timestamp() AT TIME ZONE 'America/Vancouver')::time < time '04:00'
        THEN date_trunc('day', clock_timestamp() AT TIME ZONE 'America/Vancouver')
          - interval '20 hours'
      ELSE date_trunc('day', clock_timestamp() AT TIME ZONE 'America/Vancouver')
        + interval '4 hours'
    END AT TIME ZONE 'America/Vancouver'
  )::text,
  false
);

CREATE TEMP TABLE hhu_profile_snapshot ON COMMIT DROP AS
SELECT id, gpa
FROM public.profiles
WHERE id IN (
  current_setting('hhu.test_user_1')::uuid,
  current_setting('hhu.test_user_2')::uuid
);

DO $$
BEGIN
  IF (SELECT count(*) FROM hhu_profile_snapshot) <> 2 THEN
    RAISE EXCEPTION 'Both synthetic test profiles must already exist';
  END IF;
END;
$$;

DELETE FROM public.daily_reset_runs
WHERE run_date = (
  current_setting('hhu.test_cutoff')::timestamptz
    AT TIME ZONE 'America/Vancouver'
)::date;

SELECT set_config('hhu.allow_protected_profile_update', 'on', true);

UPDATE public.profiles
SET status = CASE
  WHEN id = current_setting('hhu.test_user_1')::uuid THEN 'waiting'
  ELSE 'matched'
END
WHERE id IN (
  current_setting('hhu.test_user_1')::uuid,
  current_setting('hhu.test_user_2')::uuid
);

-- The old match must be deleted even though its children look new. The match
-- exactly on the cutoff must remain, while only its pre-cutoff children purge.
INSERT INTO public.matches (id, user_1, user_2, course_id, status, created_at)
VALUES
  ('10000000-0000-0000-0000-000000000001',
   current_setting('hhu.test_user_1')::uuid,
   current_setting('hhu.test_user_2')::uuid,
   'beer-101', 'active', current_setting('hhu.test_cutoff')::timestamptz - interval '1 second'),
  ('10000000-0000-0000-0000-000000000002',
   current_setting('hhu.test_user_1')::uuid,
   current_setting('hhu.test_user_2')::uuid,
   'beer-101', 'active', current_setting('hhu.test_cutoff')::timestamptz);

INSERT INTO public.messages (id, match_id, sender_id, content, created_at)
VALUES
  ('20000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001',
   current_setting('hhu.test_user_1')::uuid,
   'new child of old synthetic match',
   current_setting('hhu.test_cutoff')::timestamptz + interval '1 second'),
  ('20000000-0000-0000-0000-000000000002',
   '10000000-0000-0000-0000-000000000002',
   current_setting('hhu.test_user_1')::uuid,
   'old child of boundary synthetic match',
   current_setting('hhu.test_cutoff')::timestamptz - interval '1 second'),
  ('20000000-0000-0000-0000-000000000003',
   '10000000-0000-0000-0000-000000000002',
   current_setting('hhu.test_user_2')::uuid,
   'boundary synthetic message',
   current_setting('hhu.test_cutoff')::timestamptz);

INSERT INTO public.ratings (
  id, match_id, rater_user_id, rated_user_id, grade_point, created_at
)
VALUES
  ('30000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001',
   current_setting('hhu.test_user_1')::uuid,
   current_setting('hhu.test_user_2')::uuid,
   4.0, current_setting('hhu.test_cutoff')::timestamptz + interval '1 second'),
  ('30000000-0000-0000-0000-000000000002',
   '10000000-0000-0000-0000-000000000002',
   current_setting('hhu.test_user_1')::uuid,
   current_setting('hhu.test_user_2')::uuid,
   3.0, current_setting('hhu.test_cutoff')::timestamptz - interval '1 second'),
  ('30000000-0000-0000-0000-000000000003',
   '10000000-0000-0000-0000-000000000002',
   current_setting('hhu.test_user_2')::uuid,
   current_setting('hhu.test_user_1')::uuid,
   4.0, current_setting('hhu.test_cutoff')::timestamptz);

-- Rating inserts update profiles.gpa. Capture that aggregate after insertion so
-- the purge assertion proves raw-row deletion does not erase the saved GPA.
UPDATE hhu_profile_snapshot AS snapshot
SET gpa = profile.gpa
FROM public.profiles AS profile
WHERE profile.id = snapshot.id;

INSERT INTO public.queues (
  id, user_id, course_id, gender_identity, email_domain, status, created_at
)
VALUES
  ('40000000-0000-0000-0000-000000000001',
   current_setting('hhu.test_user_2')::uuid,
   'beer-101', 'Non-binary', 'student.ubc.ca', 'waiting',
   current_setting('hhu.test_cutoff')::timestamptz - interval '1 second'),
  ('40000000-0000-0000-0000-000000000002',
   current_setting('hhu.test_user_1')::uuid,
   'beer-101', 'Non-binary', 'student.ubc.ca', 'waiting',
   current_setting('hhu.test_cutoff')::timestamptz);

SELECT public.daily_reset_job();

DO $$
DECLARE
  v_run public.daily_reset_runs%ROWTYPE;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.matches
    WHERE id = '10000000-0000-0000-0000-000000000001'
  ) OR EXISTS (
    SELECT 1 FROM public.messages
    WHERE id IN (
      '20000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000002'
    )
  ) OR EXISTS (
    SELECT 1 FROM public.ratings
    WHERE id IN (
      '30000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000002'
    )
  ) OR EXISTS (
    SELECT 1 FROM public.queues
    WHERE id = '40000000-0000-0000-0000-000000000001'
  ) THEN
    RAISE EXCEPTION 'pre-cutoff ephemeral rows were not fully deleted';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.matches
    WHERE id = '10000000-0000-0000-0000-000000000002'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.messages
    WHERE id = '20000000-0000-0000-0000-000000000003'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.ratings
    WHERE id = '30000000-0000-0000-0000-000000000003'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.queues
    WHERE id = '40000000-0000-0000-0000-000000000002'
  ) THEN
    RAISE EXCEPTION 'cutoff-boundary ephemeral rows were deleted';
  END IF;

  SELECT * INTO STRICT v_run
  FROM public.daily_reset_runs
  WHERE run_date = (
    current_setting('hhu.test_cutoff')::timestamptz
      AT TIME ZONE 'America/Vancouver'
  )::date;

  IF v_run.status <> 'succeeded'
     OR v_run.deleted_messages <> 2
     OR v_run.deleted_ratings <> 2
     OR v_run.deleted_matches <> 1
     OR v_run.deleted_queues <> 1 THEN
    RAISE EXCEPTION 'daily reset deletion counts were unexpected';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    JOIN hhu_profile_snapshot AS original USING (id)
    WHERE profile.gpa IS DISTINCT FROM original.gpa
  ) THEN
    RAISE EXCEPTION 'profiles.gpa changed during raw rating cleanup';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id IN (
      current_setting('hhu.test_user_1')::uuid,
      current_setting('hhu.test_user_2')::uuid
    )
      AND status = 'idle'
  ) THEN
    RAISE EXCEPTION 'profile with a cutoff-boundary queue or match was reset';
  END IF;
END;
$$;

-- A second invocation on the same local date must be a no-op.
SELECT public.daily_reset_job();

DO $$
BEGIN
  IF (
    SELECT count(*)
    FROM public.daily_reset_runs
    WHERE run_date = (
      current_setting('hhu.test_cutoff')::timestamptz
        AT TIME ZONE 'America/Vancouver'
    )::date
  ) <> 1 THEN
    RAISE EXCEPTION 'daily reset is not idempotent';
  END IF;
END;
$$;

-- Remove the retained synthetic rows, clear the run claim, and confirm that
-- profiles with no queue or match recover to idle on the next test invocation.
DELETE FROM public.messages
WHERE id = '20000000-0000-0000-0000-000000000003';
DELETE FROM public.ratings
WHERE id = '30000000-0000-0000-0000-000000000003';
DELETE FROM public.matches
WHERE id = '10000000-0000-0000-0000-000000000002';
DELETE FROM public.queues
WHERE id = '40000000-0000-0000-0000-000000000002';
DELETE FROM public.daily_reset_runs
WHERE run_date = (
  current_setting('hhu.test_cutoff')::timestamptz
    AT TIME ZONE 'America/Vancouver'
)::date;

SELECT set_config('hhu.allow_protected_profile_update', 'on', true);
UPDATE public.profiles
SET status = CASE
  WHEN id = current_setting('hhu.test_user_1')::uuid THEN 'waiting'
  ELSE 'matched'
END
WHERE id IN (
  current_setting('hhu.test_user_1')::uuid,
  current_setting('hhu.test_user_2')::uuid
);

SELECT public.daily_reset_job();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id IN (
      current_setting('hhu.test_user_1')::uuid,
      current_setting('hhu.test_user_2')::uuid
    )
      AND status <> 'idle'
  ) THEN
    RAISE EXCEPTION 'profile without a remaining queue or match was not reset';
  END IF;

  IF (
    SELECT reset_profiles
    FROM public.daily_reset_runs
    WHERE run_date = (
      current_setting('hhu.test_cutoff')::timestamptz
        AT TIME ZONE 'America/Vancouver'
    )::date
  ) < 2 THEN
    RAISE EXCEPTION 'profile reset count did not include both synthetic users';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    JOIN hhu_profile_snapshot AS original USING (id)
    WHERE profile.gpa IS DISTINCT FROM original.gpa
  ) THEN
    RAISE EXCEPTION 'profiles.gpa changed while profiles returned to idle';
  END IF;

  RAISE NOTICE 'DAILY RESET TEST PASSED';
END;
$$;

ROLLBACK;
