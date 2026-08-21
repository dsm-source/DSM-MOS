-- M7.4: Delivery — pgTAP gates
-- Run via: supabase test db supabase/tests/delivery.test.sql

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

BEGIN;

-- ============================================================
-- Section 0: Setup users, roles, fixtures
-- ============================================================

INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-0000-0000-0000000000d1', 'tap-deliv-sales@test.local',    'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d2', 'tap-deliv-admin@test.local',    'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d3', 'tap-deliv-production@test.local','authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d4', 'tap-deliv-qc@test.local',       'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d5', 'tap-deliv-delivery@test.local', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role) VALUES
  ('00000000-0000-0000-0000-0000000000d1', 'sales'),
  ('00000000-0000-0000-0000-0000000000d2', 'admin'),
  ('00000000-0000-0000-0000-0000000000d3', 'production'),
  ('00000000-0000-0000-0000-0000000000d4', 'qc'),
  ('00000000-0000-0000-0000-0000000000d5', 'delivery')
ON CONFLICT DO NOTHING;

INSERT INTO public.operators (id, name, employee_number, is_active) VALUES
  ('00000000-0000-0000-0000-0000000000d9', 'Operator Delivery Test', 'EMP-DLV-1', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.customers (id, code, name) VALUES
  ('00000000-0000-0000-0000-0000000000de', 'M7-CUST', 'PT M7 Test')
ON CONFLICT (id) DO NOTHING;

CREATE TEMP TABLE _m7_ids (key text PRIMARY KEY, val uuid);
GRANT ALL ON TABLE _m7_ids TO authenticated;

SELECT no_plan();

INSERT INTO public.sales_orders (id, customer_id, status, created_by) VALUES
  ('00000000-0000-0000-0000-0000000d0101', '00000000-0000-0000-0000-0000000000de', 'draft',
   '00000000-0000-0000-0000-0000000000d1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.sales_order_items (id, sales_order_id, item_name, quantity, material_spec) VALUES
  ('00000000-0000-0000-0000-0000000d0102', '00000000-0000-0000-0000-0000000d0101', 'Delivery Plate 1', 20, 'SS304')
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d2', true);
UPDATE public.sales_orders SET status = 'confirmed' WHERE id = '00000000-0000-0000-0000-0000000d0101';
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

ALTER TABLE public.engineering_jobs DISABLE TRIGGER trg_eng_jobs_validate_transition;
ALTER TABLE public.material_statuses DISABLE TRIGGER trg_material_statuses_validate_transition;
UPDATE public.engineering_jobs SET status = 'approved'
  WHERE sales_order_item_id = '00000000-0000-0000-0000-0000000d0102';
UPDATE public.material_statuses SET status = 'material_ready'
  WHERE engineering_job_id IN (
    SELECT id FROM public.engineering_jobs
    WHERE sales_order_item_id = '00000000-0000-0000-0000-0000000d0102');
ALTER TABLE public.engineering_jobs ENABLE TRIGGER trg_eng_jobs_validate_transition;
ALTER TABLE public.material_statuses ENABLE TRIGGER trg_material_statuses_validate_transition;

INSERT INTO public.production_batches (engineering_job_id, quantity, routing)
SELECT id, 20, '[{"process":"laser_cutting","sequence_order":1},{"process":"assembly","sequence_order":2}]'::jsonb
FROM public.engineering_jobs
WHERE sales_order_item_id = '00000000-0000-0000-0000-0000000d0102'
LIMIT 1;

INSERT INTO _m7_ids
SELECT 'batch', b.id FROM public.production_batches b
JOIN public.engineering_jobs ej ON ej.id = b.engineering_job_id
WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000d0102';

INSERT INTO _m7_ids
SELECT 'step1', s.id FROM public.production_batch_steps s
WHERE s.production_batch_id = (SELECT val FROM _m7_ids WHERE key = 'batch')
  AND s.sequence_order = 1;

INSERT INTO _m7_ids
SELECT 'step2', s.id FROM public.production_batch_steps s
WHERE s.production_batch_id = (SELECT val FROM _m7_ids WHERE key = 'batch')
  AND s.sequence_order = 2;

-- ============================================================
-- Section 1: INSERT deliveries works for role delivery/admin
-- This is RED first: currently fails if auto do_number path is broken.
-- ============================================================

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d5', true);
SELECT lives_ok(
  $$INSERT INTO public.deliveries (sales_order_id) VALUES ('00000000-0000-0000-0000-0000000d0101')$$,
  'role delivery can INSERT draft delivery with auto do_number'
);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

INSERT INTO _m7_ids
SELECT 'delivery', id FROM public.deliveries
WHERE sales_order_id = '00000000-0000-0000-0000-0000000d0101'
ORDER BY created_at DESC
LIMIT 1
ON CONFLICT (key) DO UPDATE SET val = EXCLUDED.val;

SELECT ok(
  (SELECT do_number LIKE 'DLV-%' FROM public.deliveries WHERE id = (SELECT val FROM _m7_ids WHERE key = 'delivery')),
  'delivery insert auto-generates do_number'
);

-- ============================================================
-- Section 1b: client-supplied do_number must never survive INSERT
-- (do_number is an internal reference code generated server-side only,
-- per PRD/SPEC — not client-settable).
-- ============================================================

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d5', true);
SELECT lives_ok(
  $$WITH ins AS (
      INSERT INTO public.deliveries (sales_order_id, do_number)
      VALUES ('00000000-0000-0000-0000-0000000d0101', 'DLV-HACKED-000001')
      RETURNING id
    )
    INSERT INTO _m7_ids (key, val)
    SELECT 'delivery_hacked', id FROM ins
    ON CONFLICT (key) DO UPDATE SET val = EXCLUDED.val$$,
  'role delivery can INSERT delivery even when do_number is supplied by client'
);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SELECT ok(
  (SELECT do_number <> 'DLV-HACKED-000001' FROM public.deliveries
    WHERE id = (SELECT val FROM _m7_ids WHERE key = 'delivery_hacked')),
  'client-supplied do_number is discarded and overwritten by generate_do_number()'
);

SELECT ok(
  (SELECT do_number LIKE 'DLV-%' FROM public.deliveries
    WHERE id = (SELECT val FROM _m7_ids WHERE key = 'delivery_hacked')),
  'do_number after client-supplied bypass attempt still follows generator format'
);

DELETE FROM public.deliveries
WHERE sales_order_id = '00000000-0000-0000-0000-0000000d0101'
  AND id <> (SELECT val FROM _m7_ids WHERE key = 'delivery');

-- ============================================================
-- Section 2: draft -> prepared needs both planned dates and at least one item
-- ============================================================

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d5', true);
SELECT throws_ok(
  format($$UPDATE public.deliveries SET status = 'prepared' WHERE id = %L$$,
    (SELECT val FROM _m7_ids WHERE key = 'delivery')),
  NULL,
  'Set jadwal pengiriman terlebih dahulu.',
  'delivery cannot leave draft without planned dates'
);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

UPDATE public.deliveries
SET planned_ship_date = DATE '2026-08-21', planned_delivery_date = DATE '2026-08-22'
WHERE id = (SELECT val FROM _m7_ids WHERE key = 'delivery');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d5', true);
SELECT throws_ok(
  format($$UPDATE public.deliveries SET status = 'prepared' WHERE id = %L$$,
    (SELECT val FROM _m7_ids WHERE key = 'delivery')),
  NULL,
  'Pengiriman belum memiliki item.',
  'delivery cannot leave draft without delivery items'
);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

-- ============================================================
-- Section 3: QC pass on non-final step is rejected; final step accepted
-- ============================================================

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d3', true);
UPDATE public.production_batch_steps
SET status = 'running', operator_id = '00000000-0000-0000-0000-0000000000d9'
WHERE id = (SELECT val FROM _m7_ids WHERE key = 'step1');
UPDATE public.production_batch_steps
SET status = 'completed'
WHERE id = (SELECT val FROM _m7_ids WHERE key = 'step1');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

INSERT INTO _m7_ids
SELECT 'qc_step1', id FROM public.qc_inspections
WHERE production_batch_step_id = (SELECT val FROM _m7_ids WHERE key = 'step1')
ORDER BY created_at DESC
LIMIT 1
ON CONFLICT (key) DO UPDATE SET val = EXCLUDED.val;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d4', true);
UPDATE public.qc_inspections
SET status = 'inspection'
WHERE id = (SELECT val FROM _m7_ids WHERE key = 'qc_step1');
UPDATE public.qc_inspections
SET status = 'pass', qty_total = 20, qty_ok = 20
WHERE id = (SELECT val FROM _m7_ids WHERE key = 'qc_step1');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d5', true);
SELECT throws_ok(
  format($$INSERT INTO public.delivery_items (delivery_id, qc_inspection_id, quantity)
          VALUES (%L, %L, 20)$$,
    (SELECT val FROM _m7_ids WHERE key = 'delivery'),
    (SELECT val FROM _m7_ids WHERE key = 'qc_step1')),
  NULL,
  'Hanya QC pass pada tahapan terakhir batch yang bisa masuk pengiriman.',
  'non-final step qc pass cannot be added to delivery'
);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d3', true);
UPDATE public.production_batch_steps
SET status = 'running', operator_id = '00000000-0000-0000-0000-0000000000d9'
WHERE id = (SELECT val FROM _m7_ids WHERE key = 'step2');
UPDATE public.production_batch_steps
SET status = 'completed'
WHERE id = (SELECT val FROM _m7_ids WHERE key = 'step2');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

INSERT INTO _m7_ids
SELECT 'qc_step2', id FROM public.qc_inspections
WHERE production_batch_step_id = (SELECT val FROM _m7_ids WHERE key = 'step2')
ORDER BY created_at DESC
LIMIT 1
ON CONFLICT (key) DO UPDATE SET val = EXCLUDED.val;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d4', true);
UPDATE public.qc_inspections
SET status = 'inspection'
WHERE id = (SELECT val FROM _m7_ids WHERE key = 'qc_step2');
UPDATE public.qc_inspections
SET status = 'pass', qty_total = 20, qty_ok = 20
WHERE id = (SELECT val FROM _m7_ids WHERE key = 'qc_step2');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d5', true);
SELECT lives_ok(
  format($$INSERT INTO public.delivery_items (delivery_id, qc_inspection_id, quantity)
          VALUES (%L, %L, 20)$$,
    (SELECT val FROM _m7_ids WHERE key = 'delivery'),
    (SELECT val FROM _m7_ids WHERE key = 'qc_step2')),
  'final step qc pass can be added to delivery'
);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SELECT is(
  (SELECT count(*)::int FROM public.delivery_items WHERE delivery_id = (SELECT val FROM _m7_ids WHERE key = 'delivery')),
  1,
  'delivery has exactly one accepted item after final-step pass insert'
);

-- ============================================================
-- Section 4: now prepared succeeds
-- ============================================================

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d5', true);
SELECT lives_ok(
  format($$UPDATE public.deliveries SET status = 'prepared' WHERE id = %L$$,
    (SELECT val FROM _m7_ids WHERE key = 'delivery')),
  'delivery can move draft -> prepared after dates and items are filled'
);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SELECT is(
  (SELECT status::text FROM public.deliveries WHERE id = (SELECT val FROM _m7_ids WHERE key = 'delivery')),
  'prepared',
  'delivery status becomes prepared after valid transition'
);

-- ============================================================
-- Section 5: prepared -> shipped -> delivered, then SO auto-completes
-- once all sales_order_items quantity has been shipped (Checkpoint M7:
-- batch -> delivery -> delivered -> SO completed).
-- ============================================================

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d5', true);
SELECT lives_ok(
  format($$UPDATE public.deliveries SET status = 'shipped' WHERE id = %L$$,
    (SELECT val FROM _m7_ids WHERE key = 'delivery')),
  'delivery can move prepared -> shipped'
);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SELECT ok(
  (SELECT shipped_at IS NOT NULL FROM public.deliveries WHERE id = (SELECT val FROM _m7_ids WHERE key = 'delivery')),
  'shipped_at is auto-stamped on shipped transition'
);

SELECT is(
  (SELECT status::text FROM public.sales_orders WHERE id = '00000000-0000-0000-0000-0000000d0101'),
  'confirmed',
  'SO stays confirmed while delivery is only shipped, not delivered yet'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d5', true);
SELECT lives_ok(
  format($$UPDATE public.deliveries SET status = 'delivered' WHERE id = %L$$,
    (SELECT val FROM _m7_ids WHERE key = 'delivery')),
  'delivery can move shipped -> delivered'
);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SELECT ok(
  (SELECT delivered_at IS NOT NULL FROM public.deliveries WHERE id = (SELECT val FROM _m7_ids WHERE key = 'delivery')),
  'delivered_at is auto-stamped on delivered transition'
);

SELECT is(
  (SELECT status::text FROM public.sales_orders WHERE id = '00000000-0000-0000-0000-0000000d0101'),
  'completed',
  'SO auto-completes once shipped delivery quantity covers full SO item quantity'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000d5', true);
SELECT throws_ok(
  format($$UPDATE public.deliveries SET status = 'prepared' WHERE id = %L$$,
    (SELECT val FROM _m7_ids WHERE key = 'delivery')),
  NULL,
  'Pengiriman sudah Terkirim dan tidak dapat diubah',
  'delivered delivery can never transition again'
);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SELECT * FROM finish();
ROLLBACK;
