-- DSM MOS local-only DEMO dataset: ~200 sales orders spanning every stage
-- of the pipeline (draft -> confirmed -> production -> QC -> delivery ->
-- delivered), with realistic-looking Indonesian manufacturing business data
-- so it presents well in a live demo.
--
-- Usage (LOCAL ONLY — never run against a remote project):
--   supabase db reset --local   (optional: start from a clean local DB)
--   docker exec -i supabase_db_jtzwawtfymljfqfrplib psql -v ON_ERROR_STOP=1 \
--     -U postgres -d postgres < supabase/seed-demo/20260823_demo_200_dataset.sql
--
-- Unlike supabase/seed-test/*, this dataset is meant to PERSIST across demo
-- sessions (not auto-cleaned after a test run). Every row uses a
-- deterministic UUID under the 40000000-* prefix, so it can be identified
-- and removed later if needed, e.g.:
--   DELETE FROM public.sales_orders WHERE id::text LIKE '40000000-0000-0001-%';
--   DELETE FROM public.customers    WHERE id::text LIKE '40000000-0000-0000-%';
--   (FK ON DELETE CASCADE/RESTRICT already cleans up items/jobs/batches/etc;
--    deliveries reference sales_orders ON DELETE RESTRICT, so delete
--    deliveries/delivery_items first if you ever need a full teardown.)

BEGIN;

-- Deterministic local actors used only to satisfy RLS-sensitive transition
-- triggers while seeding (not meant to be logged into during the demo).
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('40000000-0000-0000-0000-000000000001', 'demo-sales@dsm-mos.local', 'authenticated', 'authenticated'),
  ('40000000-0000-0000-0000-000000000002', 'demo-admin@dsm-mos.local', 'authenticated', 'authenticated'),
  ('40000000-0000-0000-0000-000000000003', 'demo-engineering@dsm-mos.local', 'authenticated', 'authenticated'),
  ('40000000-0000-0000-0000-000000000004', 'demo-material@dsm-mos.local', 'authenticated', 'authenticated'),
  ('40000000-0000-0000-0000-000000000005', 'demo-production-planning@dsm-mos.local', 'authenticated', 'authenticated'),
  ('40000000-0000-0000-0000-000000000006', 'demo-production@dsm-mos.local', 'authenticated', 'authenticated'),
  ('40000000-0000-0000-0000-000000000007', 'demo-qc@dsm-mos.local', 'authenticated', 'authenticated'),
  ('40000000-0000-0000-0000-000000000008', 'demo-delivery@dsm-mos.local', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role) VALUES
  ('40000000-0000-0000-0000-000000000001', 'sales'),
  ('40000000-0000-0000-0000-000000000002', 'admin'),
  ('40000000-0000-0000-0000-000000000003', 'engineering'),
  ('40000000-0000-0000-0000-000000000004', 'material'),
  ('40000000-0000-0000-0000-000000000005', 'production_planning'),
  ('40000000-0000-0000-0000-000000000006', 'production'),
  ('40000000-0000-0000-0000-000000000007', 'qc'),
  ('40000000-0000-0000-0000-000000000008', 'delivery')
ON CONFLICT DO NOTHING;

-- LOCAL DEMO ONLY: make demo-admin an actual login (email/password). Every SO
-- status transition below fires sales_orders_notify_on_status_change(), which
-- notifies all admins, so this account lands with a realistic backlog of unread
-- notifications — the bell / "Tandai semua dibaca" path is testable out of the
-- box. Credentials: demo-admin@dsm-mos.local / demo1234. Never run this file
-- against a remote project.
UPDATE auth.users SET
  instance_id       = '00000000-0000-0000-0000-000000000000',
  encrypted_password = COALESCE(encrypted_password,
                                extensions.crypt('demo1234', extensions.gen_salt('bf'))),
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  created_at         = COALESCE(created_at, now()),
  updated_at         = now(),
  raw_app_meta_data  = '{"provider":"email","providers":["email"]}'::jsonb,
  raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb),
  confirmation_token = '', recovery_token = '', email_change_token_new = '',
  email_change = '', email_change_token_current = '', phone_change = '',
  phone_change_token = '', reauthentication_token = ''
WHERE id = '40000000-0000-0000-0000-000000000002';

INSERT INTO auth.identities
  (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
VALUES
  ('40000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002',
   jsonb_build_object(
     'sub', '40000000-0000-0000-0000-000000000002',
     'email', 'demo-admin@dsm-mos.local',
     'email_verified', true),
   'email', now(), now(), now())
ON CONFLICT (provider, provider_id) DO NOTHING;

INSERT INTO public.operators (id, name, employee_number, is_active, created_by) VALUES
  ('40000000-0000-0000-0000-000000000101', 'Dedi Kurniawan', 'EMP-2024-014', true, '40000000-0000-0000-0000-000000000002'),
  ('40000000-0000-0000-0000-000000000102', 'Wahyu Saputra', 'EMP-2024-027', true, '40000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Customers: 10 realistic sheet-metal-fabrication clients
-- ============================================================
CREATE TEMP TABLE _demo200_customers (
  n int PRIMARY KEY,
  code text NOT NULL,
  name text NOT NULL,
  contact_person text NOT NULL,
  phone text NOT NULL,
  address text NOT NULL
) ON COMMIT DROP;

INSERT INTO _demo200_customers (n, code, name, contact_person, phone, address) VALUES
  (1,  'CUST-001', 'PT Cahaya Logam Sejahtera',   'Budi Santoso',    '0812-3456-7801', 'Jl. Industri Raya No. 12, Kawasan Industri Pulogadung, Jakarta Timur'),
  (2,  'CUST-002', 'PT Baja Nusantara Perkasa',    'Siti Rahayu',     '0813-2345-6702', 'Jl. Raya Serang KM 15, Cikupa, Tangerang'),
  (3,  'CUST-003', 'CV Mitra Teknik Presisi',      'Andi Wijaya',     '0821-4567-8903', 'Jl. Ahmad Yani No. 45, Bekasi Timur'),
  (4,  'CUST-004', 'PT Sumber Rejeki Metal',       'Dewi Anggraini',  '0852-1234-5604', 'Jl. Industri VI No. 8, Kawasan Industri MM2100, Cikarang'),
  (5,  'CUST-005', 'PT Industri Sinar Abadi',      'Rudi Hartono',    '0878-9012-3405', 'Jl. Rungkut Industri No. 22, Surabaya'),
  (6,  'CUST-006', 'CV Karya Logam Mandiri',       'Fitri Handayani', '0856-7890-1206', 'Jl. Gatot Subroto No. 101, Bandung'),
  (7,  'CUST-007', 'PT Anugerah Steel Works',      'Agus Setiawan',   '0813-5678-9007', 'Jl. Raya Narogong KM 8, Bekasi'),
  (8,  'CUST-008', 'PT Global Fabrikasi Indonesia','Maya Puspita',    '0822-3344-5508', 'Jl. Industri Selatan No. 3, Kawasan Industri Jababeka, Cikarang'),
  (9,  'CUST-009', 'CV Prima Konstruksi Baja',     'Hendra Gunawan',  '0821-6677-8809', 'Jl. Raya Bogor KM 30, Depok'),
  (10, 'CUST-010', 'PT Trimatra Enjiniring',       'Nur Aisyah',      '0813-9988-7710', 'Jl. Sudirman No. 55, Kawasan Industri Cikande, Serang');

INSERT INTO public.customers (id, code, name, contact_person, phone, address, created_by)
SELECT
  ('40000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  code, name, contact_person, phone, address,
  '40000000-0000-0000-0000-000000000001'::uuid
FROM _demo200_customers
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Item catalog: 12 recurring sheet-metal part types
-- ============================================================
CREATE TEMP TABLE _demo200_item_catalog (
  idx int PRIMARY KEY,
  item_name text NOT NULL,
  material_spec text NOT NULL
) ON COMMIT DROP;

INSERT INTO _demo200_item_catalog (idx, item_name, material_spec) VALUES
  (1,  'Bracket Support Panel',        'SS304 2mm'),
  (2,  'Cover Plate Mesin',            'MS Plate 3mm'),
  (3,  'Rangka Dudukan Motor',         'MS Plate 4mm'),
  (4,  'Panel Pintu Kabinet Listrik',  'SS304 1.5mm'),
  (5,  'Dudukan Mounting CNC',         'MS Plate 6mm'),
  (6,  'Plat Penutup Junction Box',    'SS316 1.2mm'),
  (7,  'Frame Konveyor Belt',          'MS Plate 3mm'),
  (8,  'Braket Penyangga Pipa',        'SS304 2mm'),
  (9,  'Casing Panel Kontrol',         'Aluminium 1.5mm'),
  (10, 'Rangka Rak Penyimpanan',       'MS Plate 2mm'),
  (11, 'Base Plate Pompa',             'MS Plate 8mm'),
  (12, 'Housing Gearbox',              'Aluminium 3mm');

-- ============================================================
-- 200 sales orders distributed across pipeline stages
-- ============================================================
CREATE TEMP TABLE _demo200_so (
  n int PRIMARY KEY,
  so_id uuid NOT NULL,
  item_id uuid NOT NULL,
  bucket text NOT NULL
) ON COMMIT DROP;
GRANT SELECT ON TABLE _demo200_so TO authenticated;

INSERT INTO _demo200_so (n, so_id, item_id, bucket)
SELECT
  gs,
  ('40000000-0000-0001-0000-' || lpad(gs::text, 12, '0'))::uuid,
  ('40000000-0000-0002-0000-' || lpad(gs::text, 12, '0'))::uuid,
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
  id, customer_id, order_date, due_date, status, created_by, created_at, updated_at
)
SELECT
  so.so_id,
  ('40000000-0000-0000-0000-' || lpad((((so.n - 1) % 10) + 1)::text, 12, '0'))::uuid,
  current_date - ((so.n % 45) || ' days')::interval,
  current_date + (((so.n % 120) + 15) || ' days')::interval,
  'draft',
  '40000000-0000-0000-0000-000000000001'::uuid,
  now() - ((so.n % 120) || ' days')::interval,
  now() - ((so.n % 30) || ' days')::interval
FROM _demo200_so so
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.sales_order_items (
  id, sales_order_id, item_name, drawing_number, quantity, unit, material_spec, created_by
)
SELECT
  so.item_id,
  so.so_id,
  ic.item_name,
  'DWG-' || lpad(so.n::text, 4, '0'),
  ((so.n % 9) + 2)::numeric,
  'pcs',
  ic.material_spec,
  '40000000-0000-0000-0000-000000000001'::uuid
FROM _demo200_so so
JOIN _demo200_item_catalog ic ON ic.idx = ((so.n - 1) % 12) + 1
ON CONFLICT (id) DO NOTHING;

-- Confirm all non-draft orders through the same trigger that creates
-- engineering_jobs and material_statuses.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000002', true);
UPDATE public.sales_orders
SET status = 'confirmed'
WHERE id IN (SELECT so_id FROM _demo200_so WHERE bucket <> 'draft');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

-- Engineering transitions: real draft -> in_progress -> review -> approved.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000003', true);
UPDATE public.engineering_jobs ej
SET
  assigned_to = '40000000-0000-0000-0000-000000000003',
  target_completion_date = current_date + ((so.n % 20) || ' days')::interval,
  status = 'in_progress',
  progress_percent = 35
FROM _demo200_so so
WHERE ej.sales_order_item_id = so.item_id
  AND so.bucket <> 'draft';

UPDATE public.engineering_jobs ej
SET status = 'review', progress_percent = 90
FROM _demo200_so so
WHERE ej.sales_order_item_id = so.item_id
  AND so.bucket IN ('production_active','qc_active','delivery_active','delivered');

UPDATE public.engineering_jobs ej
SET status = 'approved'
FROM _demo200_so so
WHERE ej.sales_order_item_id = so.item_id
  AND so.bucket IN ('production_active','qc_active','delivery_active','delivered');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000004', true);
UPDATE public.material_statuses ms
SET status = 'material_ready'
FROM public.engineering_jobs ej
JOIN _demo200_so so ON so.item_id = ej.sales_order_item_id
WHERE ms.engineering_job_id = ej.id
  AND so.bucket IN ('production_active','qc_active','delivery_active','delivered');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000005', true);
INSERT INTO public.production_batches (
  engineering_job_id, quantity, planned_start_date, planned_completion_date,
  estimated_delivery_date, created_by
)
SELECT
  ej.id,
  soi.quantity,
  current_date - ((so.n % 20) || ' days')::interval,
  current_date + (((so.n % 40) + 5) || ' days')::interval,
  current_date + (((so.n % 80) + 15) || ' days')::interval,
  '40000000-0000-0000-0000-000000000005'::uuid
FROM _demo200_so so
JOIN public.sales_order_items soi ON soi.id = so.item_id
JOIN public.engineering_jobs ej ON ej.sales_order_item_id = soi.id
WHERE so.bucket IN ('production_active','qc_active','delivery_active','delivered');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

-- Production execution: complete all steps for QC/delivery buckets; keep
-- production_active orders partially running to exercise the Kanban.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000006', true);

UPDATE public.production_batch_steps s
SET
  status = 'running',
  operator_id = CASE WHEN so.n % 2 = 0 THEN '40000000-0000-0000-0000-000000000101'::uuid ELSE '40000000-0000-0000-0000-000000000102'::uuid END
FROM public.production_batches pb
JOIN public.engineering_jobs ej ON ej.id = pb.engineering_job_id
JOIN _demo200_so so ON so.item_id = ej.sales_order_item_id
WHERE s.production_batch_id = pb.id
  AND so.bucket = 'production_active'
  AND s.sequence_order = 1;

UPDATE public.production_batch_steps s
SET status = 'completed', qty_completed = pb.quantity
FROM public.production_batches pb
JOIN public.engineering_jobs ej ON ej.id = pb.engineering_job_id
JOIN _demo200_so so ON so.item_id = ej.sales_order_item_id
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
    JOIN _demo200_so so ON so.item_id = ej.sales_order_item_id
    WHERE so.bucket IN ('qc_active','delivery_active','delivered')
    ORDER BY pb.created_at, pb.id
  LOOP
    FOR r_step IN
      SELECT id, sequence_order
      FROM public.production_batch_steps
      WHERE production_batch_id = r_batch.batch_id
      ORDER BY sequence_order
    LOOP
      PERFORM set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000006', true);
      UPDATE public.production_batch_steps
      SET
        status = 'running',
        operator_id = CASE WHEN r_batch.n % 2 = 0 THEN '40000000-0000-0000-0000-000000000101'::uuid ELSE '40000000-0000-0000-0000-000000000102'::uuid END
      WHERE id = r_step.id;

      UPDATE public.production_batch_steps
      SET status = 'completed', qty_completed = r_batch.quantity
      WHERE id = r_step.id;

      -- The next production step is gated by QC pass on the previous step.
      -- For qc_active rows, leave the final step inspection active.
      PERFORM set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000007', true);
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

-- QC: keep a slice of the qc_active orders showing a reject with a realistic
-- defect note, so the demo also shows the reject/rework path.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000007', true);

UPDATE public.qc_inspections qi
SET
  status = 'reject',
  qty_total = pb.quantity,
  qty_ok = pb.quantity - 1,
  qty_reject = 1,
  defect_notes = (ARRAY[
    'Toleransi dimensi melebihi batas',
    'Permukaan terdapat goresan',
    'Hasil pengelasan tidak rapi',
    'Warna coating tidak merata'
  ])[(((so.n / 4) % 4) + 1)]
FROM public.production_batch_steps s
JOIN public.production_batches pb ON pb.id = s.production_batch_id
JOIN public.engineering_jobs ej ON ej.id = pb.engineering_job_id
JOIN _demo200_so so ON so.item_id = ej.sales_order_item_id
WHERE qi.production_batch_step_id = s.id
  AND so.bucket = 'qc_active'
  AND s.sequence_order = 5
  AND qi.status = 'inspection'
  AND so.n % 4 = 0;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

-- Create 50 deliveries: 30 active, 20 delivered.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000008', true);

INSERT INTO public.deliveries (
  sales_order_id, planned_ship_date, planned_delivery_date,
  driver_name, vehicle_number, created_by
)
SELECT
  so.so_id,
  current_date - ((so.n % 110) || ' days')::interval,
  current_date + (((so.n % 260) - 90) || ' days')::interval,
  (ARRAY['Slamet Riyadi','Joko Susilo','Bambang Prakoso'])[((so.n % 3) + 1)],
  'B ' || lpad((1000 + so.n)::text, 4, '0') || ' ' || (ARRAY['ABC','XYZ','QRS','JKL'])[((so.n % 4) + 1)],
  '40000000-0000-0000-0000-000000000008'::uuid
FROM _demo200_so so
WHERE so.bucket IN ('delivery_active','delivered');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

INSERT INTO public.delivery_items (delivery_id, qc_inspection_id, quantity, created_by)
SELECT
  d.id,
  qi.id,
  pb.quantity,
  '40000000-0000-0000-0000-000000000008'::uuid
FROM public.deliveries d
JOIN _demo200_so so ON so.so_id = d.sales_order_id
JOIN public.sales_order_items soi ON soi.sales_order_id = so.so_id
JOIN public.engineering_jobs ej ON ej.sales_order_item_id = soi.id
JOIN public.production_batches pb ON pb.engineering_job_id = ej.id
JOIN public.production_batch_steps s ON s.production_batch_id = pb.id AND s.sequence_order = 5
JOIN public.qc_inspections qi ON qi.production_batch_step_id = s.id AND qi.status = 'pass'
WHERE so.bucket IN ('delivery_active','delivered');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000008', true);

UPDATE public.deliveries d
SET status = 'prepared'
FROM _demo200_so so
WHERE d.sales_order_id = so.so_id
  AND so.bucket IN ('delivery_active','delivered');

UPDATE public.deliveries d
SET status = 'shipped'
FROM _demo200_so so
WHERE d.sales_order_id = so.so_id
  AND (
    so.bucket = 'delivered'
    OR (so.bucket = 'delivery_active' AND so.n % 3 = 0)
  );

UPDATE public.deliveries d
SET
  status = 'delivered',
  received_by = (ARRAY['Bagian Gudang','Tim Penerima Barang','Pos Keamanan Gudang'])[((so.n % 3) + 1)]
FROM _demo200_so so
WHERE d.sales_order_id = so.so_id
  AND so.bucket = 'delivered';

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

COMMIT;
