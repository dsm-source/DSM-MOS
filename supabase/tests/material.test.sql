-- M3.4 pgTAP: material_statuses 1:1 with engineering_job, auto-create on SO confirmed,
-- material_status_history logging, and RLS matrix (SELECT all roles, write material+admin only).

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

BEGIN;

SELECT plan(46);

-- ============================================================
-- Setup: users, roles, customer, sales order, item
-- ============================================================

INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-0000-0000-0000000000b1', 'tap-mat-admin@test.local',      'authenticated', 'authenticated'), -- admin, confirms SO
  ('00000000-0000-0000-0000-0000000000b2', 'tap-mat-sales@test.local',      'authenticated', 'authenticated'), -- sales
  ('00000000-0000-0000-0000-0000000000b3', 'tap-mat-engineering@test.local','authenticated', 'authenticated'), -- engineering
  ('00000000-0000-0000-0000-0000000000b4', 'tap-mat-material@test.local',   'authenticated', 'authenticated'), -- material, performs status updates
  ('00000000-0000-0000-0000-0000000000b5', 'tap-mat-pp@test.local',         'authenticated', 'authenticated'), -- production_planning
  ('00000000-0000-0000-0000-0000000000b6', 'tap-mat-production@test.local', 'authenticated', 'authenticated'), -- production
  ('00000000-0000-0000-0000-0000000000b7', 'tap-mat-qc@test.local',         'authenticated', 'authenticated'), -- qc
  ('00000000-0000-0000-0000-0000000000b8', 'tap-mat-delivery@test.local',   'authenticated', 'authenticated'), -- delivery
  ('00000000-0000-0000-0000-0000000000b9', 'tap-mat-viewer@test.local',     'authenticated', 'authenticated'), -- viewer
  ('00000000-0000-0000-0000-0000000000ba', 'tap-mat-norole@test.local',     'authenticated', 'authenticated'); -- no role, must be denied

INSERT INTO public.user_roles (user_id, role) VALUES
  ('00000000-0000-0000-0000-0000000000b1', 'admin'),
  ('00000000-0000-0000-0000-0000000000b2', 'sales'),
  ('00000000-0000-0000-0000-0000000000b3', 'engineering'),
  ('00000000-0000-0000-0000-0000000000b4', 'material'),
  ('00000000-0000-0000-0000-0000000000b5', 'production_planning'),
  ('00000000-0000-0000-0000-0000000000b6', 'production'),
  ('00000000-0000-0000-0000-0000000000b7', 'qc'),
  ('00000000-0000-0000-0000-0000000000b8', 'delivery'),
  ('00000000-0000-0000-0000-0000000000b9', 'viewer');

INSERT INTO public.customers (id, code, name)
VALUES ('00000000-0000-0000-0000-0000000000c9', 'TAP-MAT-CUST-01', 'PT Tap Material Test');

INSERT INTO public.sales_orders (id, customer_id, status, created_by)
VALUES (
  '00000000-0000-0000-0000-0000000000d9',
  '00000000-0000-0000-0000-0000000000c9',
  'draft',
  '00000000-0000-0000-0000-0000000000b2'
);

INSERT INTO public.sales_order_items (id, sales_order_id, item_name, quantity, material_spec)
VALUES ('00000000-0000-0000-0000-0000000000e9', '00000000-0000-0000-0000-0000000000d9', 'Bracket Material', 4, 'SS304 2mm');

-- ============================================================
-- Auto-create: confirming the SO creates engineering_job + material_statuses (1:1)
-- ============================================================

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);

UPDATE public.sales_orders SET status = 'confirmed' WHERE id = '00000000-0000-0000-0000-0000000000d9';

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SELECT is(
  (SELECT count(*)::int FROM public.engineering_jobs ej
     JOIN public.sales_order_items soi ON soi.id = ej.sales_order_item_id
     WHERE soi.sales_order_id = '00000000-0000-0000-0000-0000000000d9'),
  1,
  'engineering_job auto-created when SO is confirmed'
);

SELECT is(
  (SELECT count(*)::int FROM public.material_statuses ms
     JOIN public.engineering_jobs ej ON ej.id = ms.engineering_job_id
     JOIN public.sales_order_items soi ON soi.id = ej.sales_order_item_id
     WHERE soi.sales_order_id = '00000000-0000-0000-0000-0000000000d9'),
  1,
  'material_statuses row auto-created 1:1 with the engineering_job'
);

-- Capture the job id as the unrestricted transaction owner so later RLS-matrix
-- assertions can target material_statuses directly without going through the
-- (separately-scoped) engineering_jobs SELECT policy.
CREATE TEMP TABLE tap_mat_job AS
SELECT ej.id AS job_id
FROM public.engineering_jobs ej
JOIN public.sales_order_items soi ON soi.id = ej.sales_order_item_id
WHERE soi.sales_order_id = '00000000-0000-0000-0000-0000000000d9';

GRANT SELECT ON tap_mat_job TO authenticated;

SELECT is(
  (SELECT ms.status::text FROM public.material_statuses ms
     WHERE ms.engineering_job_id = (SELECT job_id FROM tap_mat_job)),
  'waiting_material',
  'auto-created material_statuses defaults to waiting_material'
);

-- ============================================================
-- 1:1 uniqueness: a second material_statuses row for the same job must fail
-- ============================================================

SELECT throws_ok(
  $$INSERT INTO public.material_statuses (engineering_job_id, status)
    SELECT ej.id, 'waiting_material'::public.material_status
    FROM public.engineering_jobs ej
    JOIN public.sales_order_items soi ON soi.id = ej.sales_order_item_id
    WHERE soi.sales_order_id = '00000000-0000-0000-0000-0000000000d9'$$,
  '23505',
  NULL,
  'duplicate material_statuses insert for the same engineering_job is rejected (unique violation)'
);

-- ============================================================
-- material_status_history: INSERT and status-change UPDATE are both logged
-- ============================================================

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.material_status_history msh
    JOIN public.material_statuses ms ON ms.id = msh.material_status_id
    JOIN public.engineering_jobs ej ON ej.id = ms.engineering_job_id
    JOIN public.sales_order_items soi ON soi.id = ej.sales_order_item_id
    WHERE soi.sales_order_id = '00000000-0000-0000-0000-0000000000d9'
      AND msh.from_status IS NULL
      AND msh.to_status = 'waiting_material'
  ),
  'material_status_history logs the initial insert (from_status NULL -> waiting_material)'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b4', true);

UPDATE public.material_statuses SET status = 'material_ready', notes = 'stok lengkap'
  WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SELECT is(
  (SELECT ms.status::text FROM public.material_statuses ms
     WHERE ms.engineering_job_id = (SELECT job_id FROM tap_mat_job)),
  'material_ready',
  'material user can update status to material_ready'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM public.material_status_history msh
    JOIN public.material_statuses ms ON ms.id = msh.material_status_id
    JOIN public.engineering_jobs ej ON ej.id = ms.engineering_job_id
    JOIN public.sales_order_items soi ON soi.id = ej.sales_order_item_id
    WHERE soi.sales_order_id = '00000000-0000-0000-0000-0000000000d9'
      AND msh.from_status = 'waiting_material'
      AND msh.to_status = 'material_ready'
      AND msh.changed_by = '00000000-0000-0000-0000-0000000000b4'
      AND msh.changed_at IS NOT NULL
  ),
  'material_status_history logs the waiting_material -> material_ready change with actor and timestamp'
);

-- ============================================================
-- RLS matrix for material_statuses SELECT (PRD §8/§9: semua peran boleh SELECT)
-- ============================================================

SET LOCAL ROLE authenticated;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
SELECT is((SELECT count(*)::int FROM public.material_statuses WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job)), 1, 'admin can SELECT material_statuses');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', true);
SELECT is((SELECT count(*)::int FROM public.material_statuses WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job)), 1, 'sales can SELECT material_statuses');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b3', true);
SELECT is((SELECT count(*)::int FROM public.material_statuses WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job)), 1, 'engineering can SELECT material_statuses');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b4', true);
SELECT is((SELECT count(*)::int FROM public.material_statuses WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job)), 1, 'material can SELECT material_statuses');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b5', true);
SELECT is((SELECT count(*)::int FROM public.material_statuses WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job)), 1, 'production_planning can SELECT material_statuses');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b6', true);
SELECT is((SELECT count(*)::int FROM public.material_statuses WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job)), 1, 'production can SELECT material_statuses');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b7', true);
SELECT is((SELECT count(*)::int FROM public.material_statuses WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job)), 1, 'qc can SELECT material_statuses');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b8', true);
SELECT is((SELECT count(*)::int FROM public.material_statuses WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job)), 1, 'delivery can SELECT material_statuses');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b9', true);
SELECT is((SELECT count(*)::int FROM public.material_statuses WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job)), 1, 'viewer can SELECT material_statuses');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ba', true);
SELECT is((SELECT count(*)::int FROM public.material_statuses WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job)), 0, 'user with no role is denied SELECT on material_statuses');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

-- ============================================================
-- RLS write matrix: only material + admin can update material_statuses
-- ============================================================

SET LOCAL ROLE authenticated;

-- sales (no write role) attempts an update: RLS USING clause filters the row out,
-- so the statement affects 0 rows silently -- verify the value is unchanged.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', true);
UPDATE public.material_statuses SET status = 'waiting_material'
  WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
SELECT is(
  (SELECT ms.status::text FROM public.material_statuses ms
     WHERE ms.engineering_job_id = (SELECT job_id FROM tap_mat_job)),
  'material_ready',
  'sales cannot update material_statuses (RLS denies, value unchanged)'
);

-- user with no role attempts an update: same silent denial.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ba', true);
UPDATE public.material_statuses SET status = 'waiting_material'
  WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
SELECT is(
  (SELECT ms.status::text FROM public.material_statuses ms
     WHERE ms.engineering_job_id = (SELECT job_id FROM tap_mat_job)),
  'material_ready',
  'user with no role cannot update material_statuses (RLS denies, value unchanged)'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b3', true);
UPDATE public.material_statuses SET status = 'waiting_material'
  WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
SELECT is(
  (SELECT ms.status::text FROM public.material_statuses ms
     WHERE ms.engineering_job_id = (SELECT job_id FROM tap_mat_job)),
  'material_ready',
  'engineering cannot update material_statuses (RLS denies, value unchanged)'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b5', true);
UPDATE public.material_statuses SET status = 'waiting_material'
  WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
SELECT is(
  (SELECT ms.status::text FROM public.material_statuses ms
     WHERE ms.engineering_job_id = (SELECT job_id FROM tap_mat_job)),
  'material_ready',
  'production_planning cannot update material_statuses (RLS denies, value unchanged)'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b6', true);
UPDATE public.material_statuses SET status = 'waiting_material'
  WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
SELECT is(
  (SELECT ms.status::text FROM public.material_statuses ms
     WHERE ms.engineering_job_id = (SELECT job_id FROM tap_mat_job)),
  'material_ready',
  'production cannot update material_statuses (RLS denies, value unchanged)'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b7', true);
UPDATE public.material_statuses SET status = 'waiting_material'
  WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
SELECT is(
  (SELECT ms.status::text FROM public.material_statuses ms
     WHERE ms.engineering_job_id = (SELECT job_id FROM tap_mat_job)),
  'material_ready',
  'qc cannot update material_statuses (RLS denies, value unchanged)'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b8', true);
UPDATE public.material_statuses SET status = 'waiting_material'
  WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
SELECT is(
  (SELECT ms.status::text FROM public.material_statuses ms
     WHERE ms.engineering_job_id = (SELECT job_id FROM tap_mat_job)),
  'material_ready',
  'delivery cannot update material_statuses (RLS denies, value unchanged)'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b9', true);
UPDATE public.material_statuses SET status = 'waiting_material'
  WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
SELECT is(
  (SELECT ms.status::text FROM public.material_statuses ms
     WHERE ms.engineering_job_id = (SELECT job_id FROM tap_mat_job)),
  'material_ready',
  'viewer cannot update material_statuses (RLS denies, value unchanged)'
);

-- admin can update
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
UPDATE public.material_statuses SET status = 'partial_material'
  WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job);

SELECT is(
  (SELECT ms.status::text FROM public.material_statuses ms
     WHERE ms.engineering_job_id = (SELECT job_id FROM tap_mat_job)),
  'partial_material',
  'admin can update material_statuses'
);

-- ============================================================
-- RLS write matrix: INSERT (only material + admin per PRD §8)
-- ============================================================

-- Clear the existing row (as admin, permitted) so INSERT attempts below
-- aren't confounded by the unique(engineering_job_id) constraint.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
DELETE FROM public.material_statuses WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job);

-- INSERT denials go through the WITH CHECK clause, so they raise an RLS-violation
-- exception (SQLSTATE 42501) rather than silently affecting 0 rows.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', true);
SELECT throws_ok(
  $$INSERT INTO public.material_statuses (engineering_job_id, status)
    SELECT job_id, 'waiting_material'::public.material_status FROM tap_mat_job$$,
  '42501', NULL, 'sales cannot INSERT material_statuses (RLS WITH CHECK denies)'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b3', true);
SELECT throws_ok(
  $$INSERT INTO public.material_statuses (engineering_job_id, status)
    SELECT job_id, 'waiting_material'::public.material_status FROM tap_mat_job$$,
  '42501', NULL, 'engineering cannot INSERT material_statuses (RLS WITH CHECK denies)'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b5', true);
SELECT throws_ok(
  $$INSERT INTO public.material_statuses (engineering_job_id, status)
    SELECT job_id, 'waiting_material'::public.material_status FROM tap_mat_job$$,
  '42501', NULL, 'production_planning cannot INSERT material_statuses (RLS WITH CHECK denies)'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b6', true);
SELECT throws_ok(
  $$INSERT INTO public.material_statuses (engineering_job_id, status)
    SELECT job_id, 'waiting_material'::public.material_status FROM tap_mat_job$$,
  '42501', NULL, 'production cannot INSERT material_statuses (RLS WITH CHECK denies)'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b7', true);
SELECT throws_ok(
  $$INSERT INTO public.material_statuses (engineering_job_id, status)
    SELECT job_id, 'waiting_material'::public.material_status FROM tap_mat_job$$,
  '42501', NULL, 'qc cannot INSERT material_statuses (RLS WITH CHECK denies)'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b8', true);
SELECT throws_ok(
  $$INSERT INTO public.material_statuses (engineering_job_id, status)
    SELECT job_id, 'waiting_material'::public.material_status FROM tap_mat_job$$,
  '42501', NULL, 'delivery cannot INSERT material_statuses (RLS WITH CHECK denies)'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b9', true);
SELECT throws_ok(
  $$INSERT INTO public.material_statuses (engineering_job_id, status)
    SELECT job_id, 'waiting_material'::public.material_status FROM tap_mat_job$$,
  '42501', NULL, 'viewer cannot INSERT material_statuses (RLS WITH CHECK denies)'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ba', true);
SELECT throws_ok(
  $$INSERT INTO public.material_statuses (engineering_job_id, status)
    SELECT job_id, 'waiting_material'::public.material_status FROM tap_mat_job$$,
  '42501', NULL, 'user with no role cannot INSERT material_statuses (RLS WITH CHECK denies)'
);

-- material can insert
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b4', true);
INSERT INTO public.material_statuses (engineering_job_id, status)
  SELECT job_id, 'waiting_material'::public.material_status FROM tap_mat_job;
SELECT is(
  (SELECT count(*)::int FROM public.material_statuses WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job)),
  1,
  'material can INSERT material_statuses'
);

-- admin can insert (delete the material-inserted row first to respect the unique constraint)
DELETE FROM public.material_statuses WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
INSERT INTO public.material_statuses (engineering_job_id, status)
  SELECT job_id, 'waiting_material'::public.material_status FROM tap_mat_job;
SELECT is(
  (SELECT count(*)::int FROM public.material_statuses WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job)),
  1,
  'admin can INSERT material_statuses'
);

-- ============================================================
-- RLS write matrix: DELETE (only material + admin per PRD §8)
-- ============================================================

-- DELETE denials go through the USING clause, so they silently affect 0 rows
-- rather than raising -- verify the row survives instead of expecting an exception.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b2', true);
DELETE FROM public.material_statuses WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
SELECT is(
  (SELECT count(*)::int FROM public.material_statuses WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job)),
  1,
  'sales cannot DELETE material_statuses (RLS denies, row remains)'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b3', true);
DELETE FROM public.material_statuses WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
SELECT is(
  (SELECT count(*)::int FROM public.material_statuses WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job)),
  1,
  'engineering cannot DELETE material_statuses (RLS denies, row remains)'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b5', true);
DELETE FROM public.material_statuses WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
SELECT is(
  (SELECT count(*)::int FROM public.material_statuses WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job)),
  1,
  'production_planning cannot DELETE material_statuses (RLS denies, row remains)'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b6', true);
DELETE FROM public.material_statuses WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
SELECT is(
  (SELECT count(*)::int FROM public.material_statuses WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job)),
  1,
  'production cannot DELETE material_statuses (RLS denies, row remains)'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b7', true);
DELETE FROM public.material_statuses WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
SELECT is(
  (SELECT count(*)::int FROM public.material_statuses WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job)),
  1,
  'qc cannot DELETE material_statuses (RLS denies, row remains)'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b8', true);
DELETE FROM public.material_statuses WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
SELECT is(
  (SELECT count(*)::int FROM public.material_statuses WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job)),
  1,
  'delivery cannot DELETE material_statuses (RLS denies, row remains)'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b9', true);
DELETE FROM public.material_statuses WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
SELECT is(
  (SELECT count(*)::int FROM public.material_statuses WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job)),
  1,
  'viewer cannot DELETE material_statuses (RLS denies, row remains)'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ba', true);
DELETE FROM public.material_statuses WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
SELECT is(
  (SELECT count(*)::int FROM public.material_statuses WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job)),
  1,
  'user with no role cannot DELETE material_statuses (RLS denies, row remains)'
);

-- material can delete
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b4', true);
DELETE FROM public.material_statuses WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job);
SELECT is(
  (SELECT count(*)::int FROM public.material_statuses WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job)),
  0,
  'material can DELETE material_statuses'
);

-- admin can delete (restore the row first so there's something to delete)
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000b1', true);
INSERT INTO public.material_statuses (engineering_job_id, status)
  SELECT job_id, 'waiting_material'::public.material_status FROM tap_mat_job;
DELETE FROM public.material_statuses WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job);
SELECT is(
  (SELECT count(*)::int FROM public.material_statuses WHERE engineering_job_id = (SELECT job_id FROM tap_mat_job)),
  0,
  'admin can DELETE material_statuses'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SELECT * FROM finish();

ROLLBACK;
