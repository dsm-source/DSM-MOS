-- M7: Checkpoint full-flow gate
-- Proves the single continuous path required for M7 sign-off, end to end:
--   final batch QC pass -> create delivery draft -> prepared -> shipped
--   -> delivered -> sales order auto-completes.
-- Run via: supabase test db supabase/tests/m7_full_flow.test.sql

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

BEGIN;

-- ============================================================
-- Section 0: Setup users, roles, fixtures
-- ============================================================

INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-0000-0000-0000000000f1', 'tap-m7-sales@test.local',      'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000f2', 'tap-m7-admin@test.local',      'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000f3', 'tap-m7-production@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000f4', 'tap-m7-qc@test.local',         'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000f5', 'tap-m7-delivery@test.local',   'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role) VALUES
  ('00000000-0000-0000-0000-0000000000f1', 'sales'),
  ('00000000-0000-0000-0000-0000000000f2', 'admin'),
  ('00000000-0000-0000-0000-0000000000f3', 'production'),
  ('00000000-0000-0000-0000-0000000000f4', 'qc'),
  ('00000000-0000-0000-0000-0000000000f5', 'delivery')
ON CONFLICT DO NOTHING;

INSERT INTO public.operators (id, name, employee_number, is_active) VALUES
  ('00000000-0000-0000-0000-0000000000f9', 'Operator M7 Test', 'EMP-M7-1', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.customers (id, code, name) VALUES
  ('00000000-0000-0000-0000-0000000000fe', 'M7-FLOW-CUST', 'PT M7 Full Flow Test')
ON CONFLICT (id) DO NOTHING;

CREATE TEMP TABLE _m7f_ids (key text PRIMARY KEY, val uuid);
GRANT ALL ON TABLE _m7f_ids TO authenticated;

SELECT no_plan();

INSERT INTO public.sales_orders (id, customer_id, status, created_by) VALUES
  ('00000000-0000-0000-0000-0000000f0101', '00000000-0000-0000-0000-0000000000fe', 'draft',
   '00000000-0000-0000-0000-0000000000f1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.sales_order_items (id, sales_order_id, item_name, quantity, material_spec) VALUES
  ('00000000-0000-0000-0000-0000000f0102', '00000000-0000-0000-0000-0000000f0101', 'M7 Flow Plate', 15, 'SS304')
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f2', true);
UPDATE public.sales_orders SET status = 'confirmed' WHERE id = '00000000-0000-0000-0000-0000000f0101';
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

ALTER TABLE public.engineering_jobs DISABLE TRIGGER trg_eng_jobs_validate_transition;
ALTER TABLE public.material_statuses DISABLE TRIGGER trg_material_statuses_validate_transition;
UPDATE public.engineering_jobs SET status = 'approved'
  WHERE sales_order_item_id = '00000000-0000-0000-0000-0000000f0102';
UPDATE public.material_statuses SET status = 'material_ready'
  WHERE engineering_job_id IN (
    SELECT id FROM public.engineering_jobs
    WHERE sales_order_item_id = '00000000-0000-0000-0000-0000000f0102');
ALTER TABLE public.engineering_jobs ENABLE TRIGGER trg_eng_jobs_validate_transition;
ALTER TABLE public.material_statuses ENABLE TRIGGER trg_material_statuses_validate_transition;

INSERT INTO public.production_batches (engineering_job_id, quantity, routing)
SELECT id, 15, '[{"process":"laser_cutting","sequence_order":1},{"process":"assembly","sequence_order":2}]'::jsonb
FROM public.engineering_jobs
WHERE sales_order_item_id = '00000000-0000-0000-0000-0000000f0102'
LIMIT 1;

INSERT INTO _m7f_ids
SELECT 'batch', b.id FROM public.production_batches b
JOIN public.engineering_jobs ej ON ej.id = b.engineering_job_id
WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0102';

INSERT INTO _m7f_ids
SELECT 'step1', s.id FROM public.production_batch_steps s
WHERE s.production_batch_id = (SELECT val FROM _m7f_ids WHERE key = 'batch')
  AND s.sequence_order = 1;

INSERT INTO _m7f_ids
SELECT 'step2', s.id FROM public.production_batch_steps s
WHERE s.production_batch_id = (SELECT val FROM _m7f_ids WHERE key = 'batch')
  AND s.sequence_order = 2;

-- ============================================================
-- Section 1: run both batch steps through completion, final step QC pass
-- ============================================================

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f3', true);
UPDATE public.production_batch_steps
SET status = 'running', operator_id = '00000000-0000-0000-0000-0000000000f9'
WHERE id = (SELECT val FROM _m7f_ids WHERE key = 'step1');
UPDATE public.production_batch_steps
SET status = 'completed'
WHERE id = (SELECT val FROM _m7f_ids WHERE key = 'step1');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

INSERT INTO _m7f_ids
SELECT 'qc_step1', id FROM public.qc_inspections
WHERE production_batch_step_id = (SELECT val FROM _m7f_ids WHERE key = 'step1')
ORDER BY created_at DESC
LIMIT 1
ON CONFLICT (key) DO UPDATE SET val = EXCLUDED.val;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f4', true);
UPDATE public.qc_inspections
SET status = 'inspection'
WHERE id = (SELECT val FROM _m7f_ids WHERE key = 'qc_step1');
UPDATE public.qc_inspections
SET status = 'pass', qty_total = 15, qty_ok = 15
WHERE id = (SELECT val FROM _m7f_ids WHERE key = 'qc_step1');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f3', true);
UPDATE public.production_batch_steps
SET status = 'running', operator_id = '00000000-0000-0000-0000-0000000000f9'
WHERE id = (SELECT val FROM _m7f_ids WHERE key = 'step2');
UPDATE public.production_batch_steps
SET status = 'completed'
WHERE id = (SELECT val FROM _m7f_ids WHERE key = 'step2');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

INSERT INTO _m7f_ids
SELECT 'qc_step2', id FROM public.qc_inspections
WHERE production_batch_step_id = (SELECT val FROM _m7f_ids WHERE key = 'step2')
ORDER BY created_at DESC
LIMIT 1
ON CONFLICT (key) DO UPDATE SET val = EXCLUDED.val;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f4', true);
UPDATE public.qc_inspections
SET status = 'inspection'
WHERE id = (SELECT val FROM _m7f_ids WHERE key = 'qc_step2');
SELECT lives_ok(
  format($$UPDATE public.qc_inspections SET status = 'pass', qty_total = 15, qty_ok = 15 WHERE id = %L$$,
    (SELECT val FROM _m7f_ids WHERE key = 'qc_step2')),
  'final batch step QC inspection can pass'
);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

-- ============================================================
-- Section 2: create delivery draft, attach the final-step QC-passed item
-- ============================================================

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f5', true);
SELECT lives_ok(
  $$INSERT INTO public.deliveries (sales_order_id) VALUES ('00000000-0000-0000-0000-0000000f0101')$$,
  'delivery draft can be created for the sales order'
);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

INSERT INTO _m7f_ids
SELECT 'delivery', id FROM public.deliveries
WHERE sales_order_id = '00000000-0000-0000-0000-0000000f0101'
ORDER BY created_at DESC
LIMIT 1
ON CONFLICT (key) DO UPDATE SET val = EXCLUDED.val;

SELECT is(
  (SELECT status::text FROM public.deliveries WHERE id = (SELECT val FROM _m7f_ids WHERE key = 'delivery')),
  'draft',
  'new delivery starts in draft status'
);

UPDATE public.deliveries
SET planned_ship_date = DATE '2026-08-21', planned_delivery_date = DATE '2026-08-22'
WHERE id = (SELECT val FROM _m7f_ids WHERE key = 'delivery');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f5', true);
SELECT lives_ok(
  format($$INSERT INTO public.delivery_items (delivery_id, qc_inspection_id, quantity)
          VALUES (%L, %L, 15)$$,
    (SELECT val FROM _m7f_ids WHERE key = 'delivery'),
    (SELECT val FROM _m7f_ids WHERE key = 'qc_step2')),
  'final-step QC-passed item can be attached to the delivery draft'
);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

-- ============================================================
-- Section 3: draft -> prepared -> shipped -> delivered
-- ============================================================

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f5', true);
SELECT lives_ok(
  format($$UPDATE public.deliveries SET status = 'prepared' WHERE id = %L$$,
    (SELECT val FROM _m7f_ids WHERE key = 'delivery')),
  'delivery transitions draft -> prepared'
);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SELECT is(
  (SELECT status::text FROM public.deliveries WHERE id = (SELECT val FROM _m7f_ids WHERE key = 'delivery')),
  'prepared',
  'delivery status is prepared'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f5', true);
SELECT lives_ok(
  format($$UPDATE public.deliveries SET status = 'shipped' WHERE id = %L$$,
    (SELECT val FROM _m7f_ids WHERE key = 'delivery')),
  'delivery transitions prepared -> shipped'
);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SELECT is(
  (SELECT status::text FROM public.sales_orders WHERE id = '00000000-0000-0000-0000-0000000f0101'),
  'confirmed',
  'sales order stays confirmed while delivery is only shipped'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f5', true);
SELECT lives_ok(
  format($$UPDATE public.deliveries SET status = 'delivered' WHERE id = %L$$,
    (SELECT val FROM _m7f_ids WHERE key = 'delivery')),
  'delivery transitions shipped -> delivered'
);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SELECT is(
  (SELECT status::text FROM public.deliveries WHERE id = (SELECT val FROM _m7f_ids WHERE key = 'delivery')),
  'delivered',
  'delivery status is delivered'
);

-- ============================================================
-- Section 3b: direct/manual confirmed -> completed update is rejected when
-- delivered quantity does not cover the sales_order_item quantity yet
-- (Codex re-review: guard against bypassing the delivery flow).
-- ============================================================

INSERT INTO public.sales_orders (id, customer_id, status, created_by) VALUES
  ('00000000-0000-0000-0000-0000000f0201', '00000000-0000-0000-0000-0000000000fe', 'confirmed',
   '00000000-0000-0000-0000-0000000000f1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.sales_order_items (id, sales_order_id, item_name, quantity, material_spec) VALUES
  ('00000000-0000-0000-0000-0000000f0202', '00000000-0000-0000-0000-0000000f0201', 'M7 Bypass Guard Plate', 15, 'SS304')
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000f2', true);
SELECT throws_ok(
  $$UPDATE public.sales_orders SET status = 'completed' WHERE id = '00000000-0000-0000-0000-0000000f0201'$$,
  'P0001',
  'Sales Order belum bisa completed: delivered quantity belum menutupi quantity order',
  'direct confirmed -> completed update is rejected when nothing has been delivered'
);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SELECT is(
  (SELECT status::text FROM public.sales_orders WHERE id = '00000000-0000-0000-0000-0000000f0201'),
  'confirmed',
  'sales order stays confirmed after the rejected direct-completion attempt'
);

-- ============================================================
-- Section 4: sales order auto-completes once the delivered quantity
-- covers the full sales_order_item quantity (M7 checkpoint outcome)
-- ============================================================

SELECT is(
  (SELECT status::text FROM public.sales_orders WHERE id = '00000000-0000-0000-0000-0000000f0101'),
  'completed',
  'sales order auto-completes once the delivery is delivered'
);

SELECT * FROM finish();
ROLLBACK;
