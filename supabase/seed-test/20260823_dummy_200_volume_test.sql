-- DSM MOS local-only volume seed for ±200 sales orders.
-- Usage:
--   supabase db reset --local
--   supabase db query --local --file supabase/seed-test/20260823_dummy_200_volume_test.sql
--
-- All business rows are marked with DUMMY-TEST-/SEED200- so they can be
-- removed after the volume test. This file is intentionally separate from
-- production migrations.

BEGIN;

-- Deterministic local actors used by RLS-sensitive transition triggers.
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('20000000-0000-0000-0000-000000000001', 'dummy-200-sales@test.local', 'authenticated', 'authenticated'),
  ('20000000-0000-0000-0000-000000000002', 'dummy-200-admin@test.local', 'authenticated', 'authenticated'),
  ('20000000-0000-0000-0000-000000000003', 'dummy-200-engineering@test.local', 'authenticated', 'authenticated'),
  ('20000000-0000-0000-0000-000000000004', 'dummy-200-material@test.local', 'authenticated', 'authenticated'),
  ('20000000-0000-0000-0000-000000000005', 'dummy-200-production-planning@test.local', 'authenticated', 'authenticated'),
  ('20000000-0000-0000-0000-000000000006', 'dummy-200-production@test.local', 'authenticated', 'authenticated'),
  ('20000000-0000-0000-0000-000000000007', 'dummy-200-qc@test.local', 'authenticated', 'authenticated'),
  ('20000000-0000-0000-0000-000000000008', 'dummy-200-delivery@test.local', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role) VALUES
  ('20000000-0000-0000-0000-000000000001', 'sales'),
  ('20000000-0000-0000-0000-000000000002', 'admin'),
  ('20000000-0000-0000-0000-000000000003', 'engineering'),
  ('20000000-0000-0000-0000-000000000004', 'material'),
  ('20000000-0000-0000-0000-000000000005', 'production_planning'),
  ('20000000-0000-0000-0000-000000000006', 'production'),
  ('20000000-0000-0000-0000-000000000007', 'qc'),
  ('20000000-0000-0000-0000-000000000008', 'delivery')
ON CONFLICT DO NOTHING;

INSERT INTO public.operators (id, name, employee_number, is_active, created_by) VALUES
  ('20000000-0000-0000-0000-000000000101', 'DUMMY-TEST-Operator A', 'SEED200-OP-A', true, '20000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000102', 'DUMMY-TEST-Operator B', 'SEED200-OP-B', true, '20000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.customers (id, code, name, contact_person, phone, address, created_by)
SELECT
  ('20000000-0000-0000-0000-' || lpad(gs::text, 12, '0'))::uuid,
  'SEED200-C' || lpad(gs::text, 2, '0'),
  'DUMMY-TEST-Customer ' || lpad(gs::text, 2, '0'),
  'DUMMY-TEST-PIC',
  '0800-SEED200',
  'DUMMY-TEST local volume seed',
  '20000000-0000-0000-0000-000000000001'::uuid
FROM generate_series(1, 10) gs
ON CONFLICT (id) DO NOTHING;

CREATE TEMP TABLE _seed200_so (
  n int PRIMARY KEY,
  so_id uuid NOT NULL,
  item_id uuid NOT NULL,
  bucket text NOT NULL
) ON COMMIT DROP;
GRANT SELECT ON TABLE _seed200_so TO authenticated;

INSERT INTO _seed200_so (n, so_id, item_id, bucket)
SELECT
  gs,
  ('20000000-0000-0001-0000-' || lpad(gs::text, 12, '0'))::uuid,
  ('20000000-0000-0002-0000-' || lpad(gs::text, 12, '0'))::uuid,
  CASE
    WHEN gs <= 40 THEN 'draft'
    WHEN gs <= 60 THEN 'confirmed_only'
    WHEN gs <= 110 THEN 'production_active'
    WHEN gs <= 150 THEN 'qc_active'
    WHEN gs <= 180 THEN 'delivery_active'
    ELSE 'delivered'
  END
FROM generate_series(1, 200) gs;

INSERT INTO public.sales_orders (
  id, customer_id, order_date, due_date, status, notes, created_by, created_at, updated_at
)
SELECT
  so.so_id,
  ('20000000-0000-0000-0000-' || lpad((((so.n - 1) % 10) + 1)::text, 12, '0'))::uuid,
  current_date - ((so.n % 45) || ' days')::interval,
  current_date + (((so.n % 120) + 15) || ' days')::interval,
  'draft',
  'DUMMY-TEST-SEED200 sales order ' || so.n,
  '20000000-0000-0000-0000-000000000001'::uuid,
  now() - ((so.n % 120) || ' days')::interval,
  now() - ((so.n % 30) || ' days')::interval
FROM _seed200_so so
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.sales_order_items (
  id, sales_order_id, item_name, drawing_number, quantity, unit, material_spec, created_by
)
SELECT
  item_id,
  so_id,
  'DUMMY-TEST-Item ' || lpad(n::text, 3, '0'),
  'SEED200-DRW-' || lpad(n::text, 3, '0'),
  ((n % 9) + 2)::numeric,
  'pcs',
  CASE WHEN n % 2 = 0 THEN 'SS304 2mm' ELSE 'MS Plate 3mm' END,
  '20000000-0000-0000-0000-000000000001'::uuid
FROM _seed200_so
ON CONFLICT (id) DO NOTHING;

-- Confirm all non-draft orders through the same trigger that creates
-- engineering_jobs and material_statuses.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);
UPDATE public.sales_orders
SET status = 'confirmed'
WHERE id IN (SELECT so_id FROM _seed200_so WHERE bucket <> 'draft');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

-- Engineering transitions: real draft -> in_progress -> review -> approved.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000003', true);
UPDATE public.engineering_jobs ej
SET
  assigned_to = '20000000-0000-0000-0000-000000000003',
  target_completion_date = current_date + ((so.n % 20) || ' days')::interval,
  status = 'in_progress',
  progress_percent = 35,
  notes = 'DUMMY-TEST-SEED200 engineering started'
FROM _seed200_so so
WHERE ej.sales_order_item_id = so.item_id
  AND so.bucket <> 'draft';

UPDATE public.engineering_jobs ej
SET status = 'review', progress_percent = 90
FROM _seed200_so so
WHERE ej.sales_order_item_id = so.item_id
  AND so.bucket IN ('production_active','qc_active','delivery_active','delivered');

UPDATE public.engineering_jobs ej
SET status = 'approved'
FROM _seed200_so so
WHERE ej.sales_order_item_id = so.item_id
  AND so.bucket IN ('production_active','qc_active','delivery_active','delivered');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000004', true);
UPDATE public.material_statuses ms
SET status = 'material_ready', notes = 'DUMMY-TEST-SEED200 ready'
FROM public.engineering_jobs ej
JOIN _seed200_so so ON so.item_id = ej.sales_order_item_id
WHERE ms.engineering_job_id = ej.id
  AND so.bucket IN ('production_active','qc_active','delivery_active','delivered');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000005', true);
INSERT INTO public.production_batches (
  engineering_job_id, quantity, planned_start_date, planned_completion_date,
  estimated_delivery_date, notes, created_by
)
SELECT
  ej.id,
  soi.quantity,
  current_date - ((so.n % 20) || ' days')::interval,
  current_date + (((so.n % 40) + 5) || ' days')::interval,
  current_date + (((so.n % 80) + 15) || ' days')::interval,
  'DUMMY-TEST-SEED200 production batch',
  '20000000-0000-0000-0000-000000000005'::uuid
FROM _seed200_so so
JOIN public.sales_order_items soi ON soi.id = so.item_id
JOIN public.engineering_jobs ej ON ej.sales_order_item_id = soi.id
WHERE so.bucket IN ('production_active','qc_active','delivery_active','delivered');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

-- Production execution: complete all steps for QC/delivery buckets; keep
-- production_active orders partially running to exercise the Kanban.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000006', true);

UPDATE public.production_batch_steps s
SET
  status = 'running',
  operator_id = CASE WHEN so.n % 2 = 0 THEN '20000000-0000-0000-0000-000000000101'::uuid ELSE '20000000-0000-0000-0000-000000000102'::uuid END
FROM public.production_batches pb
JOIN public.engineering_jobs ej ON ej.id = pb.engineering_job_id
JOIN _seed200_so so ON so.item_id = ej.sales_order_item_id
WHERE s.production_batch_id = pb.id
  AND so.bucket = 'production_active'
  AND s.sequence_order = 1;

UPDATE public.production_batch_steps s
SET status = 'completed', qty_completed = pb.quantity
FROM public.production_batches pb
JOIN public.engineering_jobs ej ON ej.id = pb.engineering_job_id
JOIN _seed200_so so ON so.item_id = ej.sales_order_item_id
WHERE s.production_batch_id = pb.id
  AND so.bucket = 'production_active'
  AND s.sequence_order = 1;

DO $$
DECLARE
  r_batch record;
  r_step record;
BEGIN
  FOR r_batch IN
    SELECT pb.id AS batch_id, pb.quantity, so.bucket, so.n
    FROM public.production_batches pb
    JOIN public.engineering_jobs ej ON ej.id = pb.engineering_job_id
    JOIN _seed200_so so ON so.item_id = ej.sales_order_item_id
    WHERE so.bucket IN ('qc_active','delivery_active','delivered')
    ORDER BY pb.created_at, pb.id
  LOOP
    FOR r_step IN
      SELECT id, sequence_order
      FROM public.production_batch_steps
      WHERE production_batch_id = r_batch.batch_id
      ORDER BY sequence_order
    LOOP
      PERFORM set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000006', true);
      UPDATE public.production_batch_steps
      SET
        status = 'running',
        operator_id = CASE WHEN r_batch.n % 2 = 0 THEN '20000000-0000-0000-0000-000000000101'::uuid ELSE '20000000-0000-0000-0000-000000000102'::uuid END
      WHERE id = r_step.id;

      UPDATE public.production_batch_steps
      SET status = 'completed', qty_completed = r_batch.quantity
      WHERE id = r_step.id;

      -- The next production step is gated by QC pass on the previous step.
      -- For qc_active rows, leave the final step inspection active.
      PERFORM set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000007', true);
      UPDATE public.qc_inspections
      SET status = 'inspection'
      WHERE production_batch_step_id = r_step.id
        AND status = 'waiting';

      IF r_batch.bucket <> 'qc_active' OR r_step.sequence_order < 5 THEN
        UPDATE public.qc_inspections
        SET
          status = 'pass',
          qty_total = r_batch.quantity,
          qty_ok = r_batch.quantity,
          qty_reject = 0
        WHERE production_batch_step_id = r_step.id
          AND status = 'inspection';
      END IF;
    END LOOP;
  END LOOP;
END $$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

-- QC: keep 40 SO active in QC by varying the final-step inspection status.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000007', true);

UPDATE public.qc_inspections qi
SET status = 'reject', qty_total = pb.quantity, qty_ok = pb.quantity - 1, qty_reject = 1
FROM public.production_batch_steps s
JOIN public.production_batches pb ON pb.id = s.production_batch_id
JOIN public.engineering_jobs ej ON ej.id = pb.engineering_job_id
JOIN _seed200_so so ON so.item_id = ej.sales_order_item_id
WHERE qi.production_batch_step_id = s.id
  AND so.bucket = 'qc_active'
  AND s.sequence_order = 5
  AND qi.status = 'inspection'
  AND so.n % 4 = 0;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

-- Create 50 deliveries: 30 active, 20 delivered.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000008', true);

INSERT INTO public.deliveries (
  sales_order_id, planned_ship_date, planned_delivery_date,
  driver_name, vehicle_number, notes, created_by
)
SELECT
  so.so_id,
  current_date - ((so.n % 110) || ' days')::interval,
  current_date + (((so.n % 260) - 90) || ' days')::interval,
  'DUMMY-TEST-Driver',
  'SEED200-' || lpad(so.n::text, 3, '0'),
  'DUMMY-TEST-SEED200 delivery',
  '20000000-0000-0000-0000-000000000008'::uuid
FROM _seed200_so so
WHERE so.bucket IN ('delivery_active','delivered');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

INSERT INTO public.delivery_items (delivery_id, qc_inspection_id, quantity, created_by)
SELECT
  d.id,
  qi.id,
  pb.quantity,
  '20000000-0000-0000-0000-000000000008'::uuid
FROM public.deliveries d
JOIN _seed200_so so ON so.so_id = d.sales_order_id
JOIN public.sales_order_items soi ON soi.sales_order_id = so.so_id
JOIN public.engineering_jobs ej ON ej.sales_order_item_id = soi.id
JOIN public.production_batches pb ON pb.engineering_job_id = ej.id
JOIN public.production_batch_steps s ON s.production_batch_id = pb.id AND s.sequence_order = 5
JOIN public.qc_inspections qi ON qi.production_batch_step_id = s.id AND qi.status = 'pass'
WHERE so.bucket IN ('delivery_active','delivered');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000008', true);

UPDATE public.deliveries d
SET status = 'prepared'
FROM _seed200_so so
WHERE d.sales_order_id = so.so_id
  AND so.bucket IN ('delivery_active','delivered');

UPDATE public.deliveries d
SET status = 'shipped'
FROM _seed200_so so
WHERE d.sales_order_id = so.so_id
  AND (
    so.bucket = 'delivered'
    OR (so.bucket = 'delivery_active' AND so.n % 3 = 0)
  );

UPDATE public.deliveries d
SET status = 'delivered', received_by = 'DUMMY-TEST-Receiver'
FROM _seed200_so so
WHERE d.sales_order_id = so.so_id
  AND so.bucket = 'delivered';

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

COMMIT;
