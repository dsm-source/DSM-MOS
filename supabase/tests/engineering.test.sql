-- M2.7 pgTAP: engineering_jobs status-transition trigger, approved-terminal lock,
-- v_engineering_workload view, engineering_job_history logging, and RLS matrix.

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

BEGIN;

SELECT plan(23);

-- ============================================================
-- Setup: users, roles, customer, sales order, item, engineering_job
-- ============================================================

INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-0000-0000-0000000000e1', 'tap-eng-admin@test.local',      'authenticated', 'authenticated'), -- admin, performs updates
  ('00000000-0000-0000-0000-0000000000e2', 'tap-eng-sales@test.local',      'authenticated', 'authenticated'), -- sales
  ('00000000-0000-0000-0000-0000000000e3', 'tap-eng-engineering@test.local','authenticated', 'authenticated'), -- engineering, assignee
  ('00000000-0000-0000-0000-0000000000e4', 'tap-eng-material@test.local',   'authenticated', 'authenticated'), -- material
  ('00000000-0000-0000-0000-0000000000e5', 'tap-eng-pp@test.local',         'authenticated', 'authenticated'), -- production_planning
  ('00000000-0000-0000-0000-0000000000e6', 'tap-eng-production@test.local', 'authenticated', 'authenticated'), -- production
  ('00000000-0000-0000-0000-0000000000e7', 'tap-eng-qc@test.local',         'authenticated', 'authenticated'), -- qc
  ('00000000-0000-0000-0000-0000000000e8', 'tap-eng-delivery@test.local',   'authenticated', 'authenticated'), -- delivery, not scoped for eng_jobs
  ('00000000-0000-0000-0000-0000000000e9', 'tap-eng-viewer@test.local',     'authenticated', 'authenticated'), -- viewer, not scoped for eng_jobs
  ('00000000-0000-0000-0000-0000000000ea', 'tap-eng-norole@test.local',     'authenticated', 'authenticated'); -- no role, must be denied

INSERT INTO public.user_roles (user_id, role) VALUES
  ('00000000-0000-0000-0000-0000000000e1', 'admin'),
  ('00000000-0000-0000-0000-0000000000e2', 'sales'),
  ('00000000-0000-0000-0000-0000000000e3', 'engineering'),
  ('00000000-0000-0000-0000-0000000000e4', 'material'),
  ('00000000-0000-0000-0000-0000000000e5', 'production_planning'),
  ('00000000-0000-0000-0000-0000000000e6', 'production'),
  ('00000000-0000-0000-0000-0000000000e7', 'qc'),
  ('00000000-0000-0000-0000-0000000000e8', 'delivery'),
  ('00000000-0000-0000-0000-0000000000e9', 'viewer');

INSERT INTO public.customers (id, code, name)
VALUES ('00000000-0000-0000-0000-0000000000f1', 'TAP-ENG-CUST-01', 'PT Tap Engineering Test');

INSERT INTO public.sales_orders (id, customer_id, status, created_by)
VALUES (
  '00000000-0000-0000-0000-0000000000f2',
  '00000000-0000-0000-0000-0000000000f1',
  'draft',
  '00000000-0000-0000-0000-0000000000e2'
);

INSERT INTO public.sales_order_items (id, sales_order_id, item_name, quantity, material_spec)
VALUES ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-0000000000f2', 'Bracket Eng', 3, 'SS304 2mm');

INSERT INTO public.engineering_jobs (id, sales_order_item_id, status)
VALUES ('00000000-0000-0000-0000-0000000000f4', '00000000-0000-0000-0000-0000000000f3', 'draft');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', true);

-- ============================================================
-- Gate: draft -> in_progress requires assigned_to + target_completion_date
-- ============================================================

SELECT throws_ok(
  $$UPDATE public.engineering_jobs SET status = 'in_progress' WHERE id = '00000000-0000-0000-0000-0000000000f4'$$,
  'Set penanggung jawab dan target penyelesaian terlebih dahulu.',
  'gate rejects in_progress transition with neither assigned_to nor target set'
);

UPDATE public.engineering_jobs SET assigned_to = '00000000-0000-0000-0000-0000000000e3'
  WHERE id = '00000000-0000-0000-0000-0000000000f4';

SELECT throws_ok(
  $$UPDATE public.engineering_jobs SET status = 'in_progress' WHERE id = '00000000-0000-0000-0000-0000000000f4'$$,
  'Set penanggung jawab dan target penyelesaian terlebih dahulu.',
  'gate rejects in_progress transition with assigned_to but no target'
);

UPDATE public.engineering_jobs SET target_completion_date = current_date + 7, status = 'in_progress'
  WHERE id = '00000000-0000-0000-0000-0000000000f4';

SELECT is(
  (SELECT status::text FROM public.engineering_jobs WHERE id = '00000000-0000-0000-0000-0000000000f4'),
  'in_progress',
  'draft -> in_progress succeeds once assigned_to and target are set'
);

-- ============================================================
-- Transition to review, then approved: progress locked to 100
-- ============================================================

UPDATE public.engineering_jobs SET status = 'review' WHERE id = '00000000-0000-0000-0000-0000000000f4';

SELECT is(
  (SELECT status::text FROM public.engineering_jobs WHERE id = '00000000-0000-0000-0000-0000000000f4'),
  'review',
  'in_progress -> review succeeds'
);

UPDATE public.engineering_jobs SET status = 'approved' WHERE id = '00000000-0000-0000-0000-0000000000f4';

SELECT is(
  (SELECT progress_percent FROM public.engineering_jobs WHERE id = '00000000-0000-0000-0000-0000000000f4'),
  100::smallint,
  'progress_percent is forced to 100 when status becomes approved'
);

SELECT is(
  (SELECT approved_by FROM public.engineering_jobs WHERE id = '00000000-0000-0000-0000-0000000000f4'),
  '00000000-0000-0000-0000-0000000000e1'::uuid,
  'approved_by is auto-set to the actor on approval'
);

-- ============================================================
-- Approved is terminal: no field may change afterward
-- ============================================================

SELECT throws_ok(
  $$UPDATE public.engineering_jobs SET progress_percent = 50 WHERE id = '00000000-0000-0000-0000-0000000000f4'$$,
  'Job sudah Approved dan tidak dapat diubah lagi',
  'approved job rejects progress_percent update even without a status change'
);

SELECT throws_ok(
  $$UPDATE public.engineering_jobs SET status = 'in_progress' WHERE id = '00000000-0000-0000-0000-0000000000f4'$$,
  'Job sudah Approved dan tidak dapat diubah lagi',
  'approved job rejects any status transition away from approved'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

-- ============================================================
-- v_engineering_workload: queryable + correct columns
-- ============================================================

SELECT has_view('public', 'v_engineering_workload', 'v_engineering_workload view exists');

SELECT columns_are('public', 'v_engineering_workload', ARRAY[
  'assigned_to',
  'assignee_email',
  'total_jobs',
  'draft_count',
  'in_progress_count',
  'review_count',
  'approved_count',
  'avg_progress',
  'overdue_count'
], 'v_engineering_workload exposes the expected columns');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', true);

SELECT is(
  (SELECT total_jobs FROM public.v_engineering_workload WHERE assigned_to = '00000000-0000-0000-0000-0000000000e3'),
  1::bigint,
  'v_engineering_workload aggregates the approved job under its assignee'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

-- ============================================================
-- engineering_job_history: field changes are logged
-- ============================================================

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.engineering_job_history
    WHERE engineering_job_id = '00000000-0000-0000-0000-0000000000f4'
      AND field_changed = 'status'
      AND from_value = 'draft'
      AND to_value = 'in_progress'
      AND changed_by = '00000000-0000-0000-0000-0000000000e1'
  ),
  'engineering_job_history logs the draft -> in_progress status change'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.engineering_job_history
    WHERE engineering_job_id = '00000000-0000-0000-0000-0000000000f4'
      AND field_changed = 'progress_percent'
      AND to_value = '100'
  ),
  'engineering_job_history logs the progress_percent change to 100 on approval'
);

-- ============================================================
-- RLS matrix for engineering_jobs SELECT (scoped to admin/engineering/sales/
-- production_planning/material/production/qc/viewer; delivery and no-role denied)
-- ============================================================

SET LOCAL ROLE authenticated;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e1', true);
SELECT is((SELECT count(*)::int FROM public.engineering_jobs WHERE id = '00000000-0000-0000-0000-0000000000f4'), 1, 'admin can SELECT engineering_jobs');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e2', true);
SELECT is((SELECT count(*)::int FROM public.engineering_jobs WHERE id = '00000000-0000-0000-0000-0000000000f4'), 1, 'sales can SELECT engineering_jobs');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e3', true);
SELECT is((SELECT count(*)::int FROM public.engineering_jobs WHERE id = '00000000-0000-0000-0000-0000000000f4'), 1, 'engineering can SELECT engineering_jobs');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e4', true);
SELECT is((SELECT count(*)::int FROM public.engineering_jobs WHERE id = '00000000-0000-0000-0000-0000000000f4'), 1, 'material can SELECT engineering_jobs');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e5', true);
SELECT is((SELECT count(*)::int FROM public.engineering_jobs WHERE id = '00000000-0000-0000-0000-0000000000f4'), 1, 'production_planning can SELECT engineering_jobs');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e6', true);
SELECT is((SELECT count(*)::int FROM public.engineering_jobs WHERE id = '00000000-0000-0000-0000-0000000000f4'), 1, 'production can SELECT engineering_jobs');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e7', true);
SELECT is((SELECT count(*)::int FROM public.engineering_jobs WHERE id = '00000000-0000-0000-0000-0000000000f4'), 1, 'qc can SELECT engineering_jobs');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e8', true);
SELECT is((SELECT count(*)::int FROM public.engineering_jobs WHERE id = '00000000-0000-0000-0000-0000000000f4'), 0, 'delivery is denied SELECT on engineering_jobs');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000e9', true);
SELECT is((SELECT count(*)::int FROM public.engineering_jobs WHERE id = '00000000-0000-0000-0000-0000000000f4'), 1, 'viewer can SELECT engineering_jobs');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ea', true);
SELECT is((SELECT count(*)::int FROM public.engineering_jobs WHERE id = '00000000-0000-0000-0000-0000000000f4'), 0, 'user with no role is denied SELECT on engineering_jobs');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SELECT * FROM finish();

ROLLBACK;
