-- M4.6: Production Planning — routing, operator FK, RLS
-- Run via: supabase test db

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

BEGIN;

-- Setup users (idempotent — shared across pgTAP test files)
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'tap-creator@test.local',      'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a2', 'tap-admin-actor@test.local',  'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a6', 'tap-pp@test.local',           'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'sales'),
  ('00000000-0000-0000-0000-0000000000a2', 'admin'),
  ('00000000-0000-0000-0000-0000000000a6', 'production_planning')
ON CONFLICT DO NOTHING;

INSERT INTO public.operators (id, name, employee_number, is_active) VALUES
  ('00000000-0000-0000-0000-000000000099', 'Operator Test', 'EMP-001', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.customers (id, code, name) VALUES
  ('00000000-0000-0000-0000-0000000000c9', 'M4-CUST', 'PT M4 Test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.sales_orders (id, customer_id, status, created_by) VALUES
  ('00000000-0000-0000-0000-0000000000b9',
   '00000000-0000-0000-0000-0000000000c9', 'draft',
   '00000000-0000-0000-0000-0000000000a1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.sales_order_items (id, sales_order_id, item_name, quantity, material_spec) VALUES
  ('00000000-0000-0000-0000-0000000000d9',
   '00000000-0000-0000-0000-0000000000b9', 'Plate M4', 10, 'SS304')
ON CONFLICT (id) DO NOTHING;

-- Confirm SO → triggers engineering_job + material_status
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
UPDATE public.sales_orders SET status = 'confirmed'
  WHERE id = '00000000-0000-0000-0000-0000000000b9';
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

-- Test setup: bulk-approve job+material directly
-- (full trigger requires in_progress→review→approved step transition)
ALTER TABLE public.engineering_jobs  DISABLE TRIGGER trg_eng_jobs_validate_transition;
ALTER TABLE public.material_statuses DISABLE TRIGGER trg_material_statuses_validate_transition;
UPDATE public.engineering_jobs  SET status = 'approved'
  WHERE sales_order_item_id = '00000000-0000-0000-0000-0000000000d9';
UPDATE public.material_statuses SET status = 'material_ready'
  WHERE engineering_job_id IN (
    SELECT id FROM public.engineering_jobs
    WHERE sales_order_item_id = '00000000-0000-0000-0000-0000000000d9');
ALTER TABLE public.engineering_jobs  ENABLE TRIGGER trg_eng_jobs_validate_transition;
ALTER TABLE public.material_statuses ENABLE TRIGGER trg_material_statuses_validate_transition;

-- Temp table for DO-block result capture
CREATE TEMP TABLE _m4_results (key text PRIMARY KEY, val boolean);
GRANT ALL ON TABLE _m4_results TO authenticated;

SELECT no_plan();

-- ============================================================
-- 1. Default routing → 5 steps, seq 1-5, standard order
-- ============================================================

INSERT INTO production_batches (engineering_job_id, quantity)
SELECT id, 100 FROM engineering_jobs
 WHERE sales_order_item_id = '00000000-0000-0000-0000-0000000000d9' LIMIT 1;

SELECT is((SELECT count(*)::int FROM production_batch_steps s
           JOIN production_batches b ON b.id = s.production_batch_id
           JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
           WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000000d9'),
          5, 'default routing creates 5 steps');

SELECT is((SELECT array_agg(s.process::text ORDER BY s.sequence_order) FROM production_batch_steps s
           JOIN production_batches b ON b.id = s.production_batch_id
           JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
           WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000000d9'),
          ARRAY['laser_cutting','bending','welding_grinding','powder_coating','assembly'],
          'default routing processes in standard order');

SELECT is((SELECT array_agg(s.sequence_order::int ORDER BY s.sequence_order) FROM production_batch_steps s
           JOIN production_batches b ON b.id = s.production_batch_id
           JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
           WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000000d9'),
          ARRAY[1,2,3,4,5], 'default routing sequence_order 1-5');

DELETE FROM production_batch_steps s USING production_batches b, engineering_jobs ej
 WHERE s.production_batch_id = b.id AND b.engineering_job_id = ej.id
   AND ej.sales_order_item_id = '00000000-0000-0000-0000-0000000000d9';
DELETE FROM production_batches b USING engineering_jobs ej
 WHERE b.engineering_job_id = ej.id
   AND ej.sales_order_item_id = '00000000-0000-0000-0000-0000000000d9';

-- ============================================================
-- 2. Custom routing: subset, custom order
-- ============================================================

INSERT INTO production_batches (engineering_job_id, quantity, routing)
SELECT id, 50, '[{"process":"assembly","sequence_order":1},{"process":"welding_grinding","sequence_order":2}]'::jsonb
FROM engineering_jobs
 WHERE sales_order_item_id = '00000000-0000-0000-0000-0000000000d9' LIMIT 1;

SELECT is((SELECT count(*)::int FROM production_batch_steps s
           JOIN production_batches b ON b.id = s.production_batch_id
           JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
           WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000000d9'),
          2, 'custom routing creates only 2 steps');

SELECT is((SELECT array_agg(s.process::text ORDER BY s.sequence_order) FROM production_batch_steps s
           JOIN production_batches b ON b.id = s.production_batch_id
           JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
           WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000000d9'),
          ARRAY['assembly','welding_grinding'],
          'custom routing preserves selected processes + order');

DELETE FROM production_batch_steps s USING production_batches b, engineering_jobs ej
 WHERE s.production_batch_id = b.id AND b.engineering_job_id = ej.id
   AND ej.sales_order_item_id = '00000000-0000-0000-0000-0000000000d9';
DELETE FROM production_batches b USING engineering_jobs ej
 WHERE b.engineering_job_id = ej.id
   AND ej.sales_order_item_id = '00000000-0000-0000-0000-0000000000d9';

-- ============================================================
-- 3. Empty routing [] → fallback 5 default steps
-- ============================================================

INSERT INTO production_batches (engineering_job_id, quantity, routing)
SELECT id, 50, '[]'::jsonb
FROM engineering_jobs
 WHERE sales_order_item_id = '00000000-0000-0000-0000-0000000000d9' LIMIT 1;

SELECT is((SELECT count(*)::int FROM production_batch_steps s
           JOIN production_batches b ON b.id = s.production_batch_id
           JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
           WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000000d9'),
          5, 'empty routing [] falls back to 5 default steps');

DELETE FROM production_batch_steps s USING production_batches b, engineering_jobs ej
 WHERE s.production_batch_id = b.id AND b.engineering_job_id = ej.id
   AND ej.sales_order_item_id = '00000000-0000-0000-0000-0000000000d9';
DELETE FROM production_batches b USING engineering_jobs ej
 WHERE b.engineering_job_id = ej.id
   AND ej.sales_order_item_id = '00000000-0000-0000-0000-0000000000d9';

-- ============================================================
-- 4. operator_id FK → operators(id), not auth.users
-- ============================================================

SELECT has_column('public', 'production_batch_steps', 'operator_id',
  'operator_id column exists on production_batch_steps');

SELECT ok((SELECT pg_get_constraintdef(oid) FROM pg_constraint
           WHERE conname = 'production_batch_steps_operator_id_fkey') LIKE '%operators%',
          'operator_id FK references operators table, not auth.users');

-- Insert batch+step for exception tests, then test via temp table
INSERT INTO production_batches (engineering_job_id, quantity)
SELECT id, 100 FROM engineering_jobs
 WHERE sales_order_item_id = '00000000-0000-0000-0000-0000000000d9' LIMIT 1;

-- Exception tests via DO block → store boolean result → assert top-level
DELETE FROM _m4_results;
DO $$
DECLARE
  step_uuid uuid;
  ok1 boolean := false;
  ok2 boolean := false;
BEGIN
  SELECT id INTO step_uuid FROM production_batch_steps LIMIT 1;

  -- auth.users id (exists in auth.users, not in operators) → FK reject
  BEGIN
    UPDATE production_batch_steps SET operator_id = '00000000-0000-0000-0000-0000000000a2' WHERE id = step_uuid;
  EXCEPTION WHEN foreign_key_violation THEN
    ok1 := true;
  END;

  -- non-existent uuid → FK reject
  BEGIN
    UPDATE production_batch_steps SET operator_id = gen_random_uuid() WHERE id = step_uuid;
  EXCEPTION WHEN foreign_key_violation THEN
    ok2 := true;
  END;

  INSERT INTO _m4_results(key, val) VALUES ('fk_reject_auth', ok1), ('fk_reject_random', ok2);
END $$;

SELECT is(val, true, 'auth.users id rejected by FK to operators')
  FROM _m4_results WHERE key = 'fk_reject_auth';
SELECT is(val, true, 'non-existent operator_id rejected by FK to operators')
  FROM _m4_results WHERE key = 'fk_reject_random';

DELETE FROM production_batch_steps s USING production_batches b, engineering_jobs ej
 WHERE s.production_batch_id = b.id AND b.engineering_job_id = ej.id
   AND ej.sales_order_item_id = '00000000-0000-0000-0000-0000000000d9';
DELETE FROM production_batches b USING engineering_jobs ej
 WHERE b.engineering_job_id = ej.id
   AND ej.sales_order_item_id = '00000000-0000-0000-0000-0000000000d9';

-- ============================================================
-- 5. RLS: planning/admin allowed, sales denied
-- ============================================================

-- production_planning allowed
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a6', true);
SELECT lives_ok('INSERT INTO production_batches (engineering_job_id, quantity) SELECT id, 10 FROM engineering_jobs WHERE sales_order_item_id = ''00000000-0000-0000-0000-0000000000d9'' LIMIT 1',
  'production_planning can INSERT production_batches');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

-- admin allowed
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
SELECT lives_ok('INSERT INTO production_batches (engineering_job_id, quantity) SELECT id, 10 FROM engineering_jobs WHERE sales_order_item_id = ''00000000-0000-0000-0000-0000000000d9'' LIMIT 1',
  'admin can INSERT production_batches');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

-- sales denied
-- Use DO block + temp table (consistent with FK tests above)
DELETE FROM _m4_results;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
DO $$
DECLARE ok boolean := false;
BEGIN
  BEGIN
    INSERT INTO production_batches (engineering_job_id, quantity)
    SELECT id, 10 FROM engineering_jobs WHERE sales_order_item_id = '00000000-0000-0000-0000-0000000000d9' LIMIT 1;
    ok := false;
  EXCEPTION WHEN OTHERS THEN
    ok := true;
  END;
  INSERT INTO _m4_results(key, val) VALUES ('sales_denied', ok);
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SELECT is((SELECT val FROM _m4_results WHERE key = 'sales_denied'), true, 'sales denied INSERT on production_batches (RLS)');

DELETE FROM production_batch_steps s USING production_batches b, engineering_jobs ej
 WHERE s.production_batch_id = b.id AND b.engineering_job_id = ej.id
   AND ej.sales_order_item_id = '00000000-0000-0000-0000-0000000000d9';
DELETE FROM production_batches b USING engineering_jobs ej
 WHERE b.engineering_job_id = ej.id
   AND ej.sales_order_item_id = '00000000-0000-0000-0000-0000000000d9';

SELECT * FROM finish();
ROLLBACK;
