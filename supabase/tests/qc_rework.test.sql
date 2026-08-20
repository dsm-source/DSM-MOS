-- M6.1 + M6.2: pgTAP — QC per-step + RPC trigger_rework
-- Verifikasi PRD §7 rule #2 (qc_inspections hanya untuk step completed) dan
-- rule #3 (rework HANYA lewat RPC formal "Trigger Rework", role qc/admin).
-- Run via: supabase test db

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

BEGIN;

-- ============================================================
-- Section 0: Setup
-- ============================================================

INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-0000-0000-0000000000c1', 'tap-qc-sales@test.local',      'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c2', 'tap-qc-admin@test.local',      'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c3', 'tap-qc-production@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c4', 'tap-qc-qc@test.local',         'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role) VALUES
  ('00000000-0000-0000-0000-0000000000c1', 'sales'),
  ('00000000-0000-0000-0000-0000000000c2', 'admin'),
  ('00000000-0000-0000-0000-0000000000c3', 'production'),
  ('00000000-0000-0000-0000-0000000000c4', 'qc')
ON CONFLICT DO NOTHING;

INSERT INTO public.operators (id, name, employee_number, is_active) VALUES
  ('00000000-0000-0000-0000-0000000000c9', 'Operator QC Test', 'EMP-QC1', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.customers (id, code, name) VALUES
  ('00000000-0000-0000-0000-0000000000ce', 'M6-CUST', 'PT M6 Test')
ON CONFLICT (id) DO NOTHING;

CREATE TEMP TABLE _m6_results (key text PRIMARY KEY, val boolean);
GRANT ALL ON TABLE _m6_results TO authenticated;

CREATE TEMP TABLE _m6_ids (key text PRIMARY KEY, val uuid);
GRANT ALL ON TABLE _m6_ids TO authenticated;

SELECT no_plan();

-- ============================================================
-- Section 1: Gate insert — qc_inspections hanya untuk step completed
-- SO/item: ...c0101 / ...c0102
-- ============================================================

INSERT INTO public.sales_orders (id, customer_id, status, created_by) VALUES
  ('00000000-0000-0000-0000-0000000c0101', '00000000-0000-0000-0000-0000000000ce', 'draft',
   '00000000-0000-0000-0000-0000000000c1')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.sales_order_items (id, sales_order_id, item_name, quantity, material_spec) VALUES
  ('00000000-0000-0000-0000-0000000c0102', '00000000-0000-0000-0000-0000000c0101', 'QC Plate 1', 50, 'SS304')
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', true);
UPDATE public.sales_orders SET status = 'confirmed' WHERE id = '00000000-0000-0000-0000-0000000c0101';
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

ALTER TABLE public.engineering_jobs  DISABLE TRIGGER trg_eng_jobs_validate_transition;
ALTER TABLE public.material_statuses DISABLE TRIGGER trg_material_statuses_validate_transition;
UPDATE public.engineering_jobs  SET status = 'approved'
  WHERE sales_order_item_id = '00000000-0000-0000-0000-0000000c0102';
UPDATE public.material_statuses SET status = 'material_ready'
  WHERE engineering_job_id IN (
    SELECT id FROM public.engineering_jobs
    WHERE sales_order_item_id = '00000000-0000-0000-0000-0000000c0102');
ALTER TABLE public.engineering_jobs  ENABLE TRIGGER trg_eng_jobs_validate_transition;
ALTER TABLE public.material_statuses ENABLE TRIGGER trg_material_statuses_validate_transition;

INSERT INTO public.production_batches (engineering_job_id, quantity, routing)
SELECT id, 50, '[{"process":"laser_cutting","sequence_order":1}]'::jsonb
FROM public.engineering_jobs
 WHERE sales_order_item_id = '00000000-0000-0000-0000-0000000c0102' LIMIT 1;

INSERT INTO _m6_ids
SELECT 'step1_c01', s.id FROM public.production_batch_steps s
  JOIN public.production_batches b ON b.id = s.production_batch_id
  JOIN public.engineering_jobs ej ON ej.id = b.engineering_job_id
  WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000c0102' AND s.sequence_order = 1;

-- Admin (punya hak insert RLS) coba insert QC selagi step masih 'waiting' -> DITOLAK
DELETE FROM _m6_results;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', true);

DO $$
DECLARE
  v_step uuid;
  ok boolean := false;
BEGIN
  SELECT val INTO v_step FROM _m6_ids WHERE key = 'step1_c01';
  BEGIN
    INSERT INTO public.qc_inspections (production_batch_step_id, status) VALUES (v_step, 'waiting');
  EXCEPTION WHEN OTHERS THEN
    ok := position('belum selesai' in SQLERRM) > 0;
  END;
  INSERT INTO _m6_results VALUES ('insert_rejected_step_not_completed', ok);
END $$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SELECT is(val, true, 'qc_inspections INSERT DITOLAK untuk step yang belum completed (pesan: belum selesai)')
  FROM _m6_results WHERE key = 'insert_rejected_step_not_completed';

-- Jalankan step ke completed, verifikasi auto-enqueue membuat SATU baris QC
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c3', true);
UPDATE public.production_batch_steps SET status = 'running', operator_id = '00000000-0000-0000-0000-0000000000c9'
  WHERE id = (SELECT val FROM _m6_ids WHERE key = 'step1_c01');
UPDATE public.production_batch_steps SET status = 'completed'
  WHERE id = (SELECT val FROM _m6_ids WHERE key = 'step1_c01');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SELECT is(
  (SELECT count(*)::int FROM public.qc_inspections WHERE production_batch_step_id = (SELECT val FROM _m6_ids WHERE key = 'step1_c01')),
  1,
  'step completed -> auto-enqueue tepat SATU baris qc_inspections (production_batch_steps_auto_enqueue_qc)'
);

SELECT is(
  (SELECT status::text FROM public.qc_inspections WHERE production_batch_step_id = (SELECT val FROM _m6_ids WHERE key = 'step1_c01')),
  'waiting',
  'baris qc_inspections auto-enqueue berstatus waiting'
);

INSERT INTO _m6_ids
SELECT 'qc1_c01', id FROM public.qc_inspections
  WHERE production_batch_step_id = (SELECT val FROM _m6_ids WHERE key = 'step1_c01');

-- Sekarang step sudah completed, tapi baris qc_inspections auto-enqueue
-- (qc1_c01) masih 'waiting' (aktif): admin coba INSERT baris QC tambahan
-- untuk step yang sama -> DITOLAK oleh uq_qc_inspections_active_step (hanya
-- SATU baris aktif per step per cycle, PRD §6.2)
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', true);

SELECT throws_ok(
  format($$INSERT INTO public.qc_inspections (production_batch_step_id, status) VALUES (%L, 'waiting')$$,
    (SELECT val FROM _m6_ids WHERE key = 'step1_c01')),
  '23505',
  NULL,
  'qc/admin DITOLAK INSERT qc_inspections kedua untuk step yang masih punya baris QC aktif (uq_qc_inspections_active_step)'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

-- sales TIDAK BISA insert QC (RLS)
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c1', true);

SELECT throws_ok(
  format($$INSERT INTO public.qc_inspections (production_batch_step_id, status) VALUES (%L, 'waiting')$$,
    (SELECT val FROM _m6_ids WHERE key = 'step1_c01')),
  '42501',
  NULL,
  'sales DITOLAK INSERT qc_inspections (RLS qc_insert_qc_admin)'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

-- ============================================================
-- Section 2: Direct update production_batch_steps.status = 'rework' DITOLAK
-- tanpa lewat RPC trigger_rework (PRD §7 rule #3 / M6.2)
-- ============================================================

DELETE FROM _m6_results;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c3', true);

DO $$
DECLARE
  v_step uuid;
  ok boolean := false;
BEGIN
  SELECT val INTO v_step FROM _m6_ids WHERE key = 'step1_c01';
  BEGIN
    UPDATE public.production_batch_steps SET status = 'rework' WHERE id = v_step;
  EXCEPTION WHEN OTHERS THEN
    ok := position('RPC Trigger Rework' in SQLERRM) > 0;
  END;
  INSERT INTO _m6_results VALUES ('direct_rework_rejected', ok);
END $$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SELECT is(val, true, 'completed -> rework via UPDATE langsung DITOLAK (harus lewat RPC Trigger Rework)')
  FROM _m6_results WHERE key = 'direct_rework_rejected';

SELECT is(
  (SELECT status::text FROM public.production_batch_steps WHERE id = (SELECT val FROM _m6_ids WHERE key = 'step1_c01')),
  'completed',
  'step tetap completed setelah percobaan direct-update rework ditolak'
);

-- Admin juga tidak bisa bypass (gate ada di trigger, bukan role-based)
DELETE FROM _m6_results;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', true);

DO $$
DECLARE
  v_step uuid;
  ok boolean := false;
BEGIN
  SELECT val INTO v_step FROM _m6_ids WHERE key = 'step1_c01';
  BEGIN
    UPDATE public.production_batch_steps SET status = 'rework' WHERE id = v_step;
  EXCEPTION WHEN OTHERS THEN
    ok := position('RPC Trigger Rework' in SQLERRM) > 0;
  END;
  INSERT INTO _m6_results VALUES ('direct_rework_rejected_admin', ok);
END $$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SELECT is(val, true, 'admin juga DITOLAK direct-update ke rework (gate trigger, bukan RLS role)')
  FROM _m6_results WHERE key = 'direct_rework_rejected_admin';

-- ============================================================
-- Section 3: RPC trigger_rework — happy path (role qc)
-- Pakai baris qc1_c01 (waiting) dari Section 1: bawa ke reject dulu.
-- ============================================================

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c4', true);
UPDATE public.qc_inspections SET status = 'inspection'
  WHERE id = (SELECT val FROM _m6_ids WHERE key = 'qc1_c01');
UPDATE public.qc_inspections SET status = 'reject', qty_reject = 5
  WHERE id = (SELECT val FROM _m6_ids WHERE key = 'qc1_c01');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c4', true);

SELECT lives_ok(
  format($$SELECT public.trigger_rework(%L)$$, (SELECT val FROM _m6_ids WHERE key = 'qc1_c01')),
  'role qc BISA memanggil trigger_rework() untuk inspeksi reject pada step completed'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SELECT is(
  (SELECT status::text FROM public.qc_inspections WHERE id = (SELECT val FROM _m6_ids WHERE key = 'qc1_c01')),
  'rework',
  'trigger_rework() mengubah qc_inspections.status jadi rework'
);

SELECT ok(
  (SELECT rework_triggered_at IS NOT NULL FROM public.qc_inspections WHERE id = (SELECT val FROM _m6_ids WHERE key = 'qc1_c01')),
  'trigger_rework() mengisi rework_triggered_at'
);

SELECT is(
  (SELECT status::text FROM public.production_batch_steps WHERE id = (SELECT val FROM _m6_ids WHERE key = 'step1_c01')),
  'rework',
  'trigger_rework() mengubah production_batch_steps.status jadi rework'
);

SELECT ok(
  (SELECT completed_at IS NULL FROM public.production_batch_steps WHERE id = (SELECT val FROM _m6_ids WHERE key = 'step1_c01')),
  'trigger_rework() mengosongkan completed_at step (lewat trigger validate_transition completed->rework)'
);

-- ============================================================
-- Section 4: RPC trigger_rework — forbidden untuk non-qc/admin, dan untuk
-- inspeksi yang belum berstatus reject
-- SO/item: ...c0401 / ...c0402 (fixture terpisah)
-- ============================================================

INSERT INTO public.sales_orders (id, customer_id, status, created_by) VALUES
  ('00000000-0000-0000-0000-0000000c0401', '00000000-0000-0000-0000-0000000000ce', 'draft',
   '00000000-0000-0000-0000-0000000000c1')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.sales_order_items (id, sales_order_id, item_name, quantity, material_spec) VALUES
  ('00000000-0000-0000-0000-0000000c0402', '00000000-0000-0000-0000-0000000c0401', 'QC Plate 4', 30, 'SS304')
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', true);
UPDATE public.sales_orders SET status = 'confirmed' WHERE id = '00000000-0000-0000-0000-0000000c0401';
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

ALTER TABLE public.engineering_jobs  DISABLE TRIGGER trg_eng_jobs_validate_transition;
ALTER TABLE public.material_statuses DISABLE TRIGGER trg_material_statuses_validate_transition;
UPDATE public.engineering_jobs  SET status = 'approved'
  WHERE sales_order_item_id = '00000000-0000-0000-0000-0000000c0402';
UPDATE public.material_statuses SET status = 'material_ready'
  WHERE engineering_job_id IN (
    SELECT id FROM public.engineering_jobs
    WHERE sales_order_item_id = '00000000-0000-0000-0000-0000000c0402');
ALTER TABLE public.engineering_jobs  ENABLE TRIGGER trg_eng_jobs_validate_transition;
ALTER TABLE public.material_statuses ENABLE TRIGGER trg_material_statuses_validate_transition;

INSERT INTO public.production_batches (engineering_job_id, quantity, routing)
SELECT id, 30, '[{"process":"laser_cutting","sequence_order":1}]'::jsonb
FROM public.engineering_jobs
 WHERE sales_order_item_id = '00000000-0000-0000-0000-0000000c0402' LIMIT 1;

INSERT INTO _m6_ids
SELECT 'step_c04', s.id FROM public.production_batch_steps s
  JOIN public.production_batches b ON b.id = s.production_batch_id
  JOIN public.engineering_jobs ej ON ej.id = b.engineering_job_id
  WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000c0402' AND s.sequence_order = 1;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c3', true);
UPDATE public.production_batch_steps SET status = 'running', operator_id = '00000000-0000-0000-0000-0000000000c9'
  WHERE id = (SELECT val FROM _m6_ids WHERE key = 'step_c04');
UPDATE public.production_batch_steps SET status = 'completed'
  WHERE id = (SELECT val FROM _m6_ids WHERE key = 'step_c04');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

INSERT INTO _m6_ids
SELECT 'qc_c04', id FROM public.qc_inspections
  WHERE production_batch_step_id = (SELECT val FROM _m6_ids WHERE key = 'step_c04');

-- Baris masih 'waiting' (belum reject): production (bukan qc/admin) coba trigger_rework -> forbidden (role check duluan)
DELETE FROM _m6_results;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c3', true);

DO $$
DECLARE
  v_qc uuid;
  ok boolean := false;
BEGIN
  SELECT val INTO v_qc FROM _m6_ids WHERE key = 'qc_c04';
  BEGIN
    PERFORM public.trigger_rework(v_qc);
  EXCEPTION WHEN OTHERS THEN
    ok := (SQLSTATE = '42501');
  END;
  INSERT INTO _m6_results VALUES ('trigger_rework_forbidden_role', ok);
END $$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SELECT is(val, true, 'trigger_rework() DITOLAK untuk role production (bukan qc/admin), ERRCODE 42501')
  FROM _m6_results WHERE key = 'trigger_rework_forbidden_role';

-- Baris masih 'waiting': qc coba trigger_rework sebelum reject -> ditolak (bukan status reject)
DELETE FROM _m6_results;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c4', true);

DO $$
DECLARE
  v_qc uuid;
  ok boolean := false;
BEGIN
  SELECT val INTO v_qc FROM _m6_ids WHERE key = 'qc_c04';
  BEGIN
    PERFORM public.trigger_rework(v_qc);
  EXCEPTION WHEN OTHERS THEN
    ok := position('bukan berstatus Ditolak' in SQLERRM) > 0;
  END;
  INSERT INTO _m6_results VALUES ('trigger_rework_rejected_not_reject_status', ok);
END $$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SELECT is(val, true, 'trigger_rework() DITOLAK kalau inspeksi belum berstatus reject')
  FROM _m6_results WHERE key = 'trigger_rework_rejected_not_reject_status';

SELECT is(
  (SELECT status::text FROM public.production_batch_steps WHERE id = (SELECT val FROM _m6_ids WHERE key = 'step_c04')),
  'completed',
  'step c04 tetap completed setelah dua percobaan trigger_rework yang ditolak'
);

-- ============================================================
-- Section 5: PRD §7 rule #2 — tahapan berikutnya tidak boleh mulai sebelum
-- tahapan sebelumnya QC pass (bukan cuma completed)
-- SO/item: ...c0501 / ...c0502, routing 2 tahapan (laser_cutting, bending)
-- ============================================================

INSERT INTO public.sales_orders (id, customer_id, status, created_by) VALUES
  ('00000000-0000-0000-0000-0000000c0501', '00000000-0000-0000-0000-0000000000ce', 'draft',
   '00000000-0000-0000-0000-0000000000c1')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.sales_order_items (id, sales_order_id, item_name, quantity, material_spec) VALUES
  ('00000000-0000-0000-0000-0000000c0502', '00000000-0000-0000-0000-0000000c0501', 'QC Plate 5', 20, 'SS304')
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c2', true);
UPDATE public.sales_orders SET status = 'confirmed' WHERE id = '00000000-0000-0000-0000-0000000c0501';
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

ALTER TABLE public.engineering_jobs  DISABLE TRIGGER trg_eng_jobs_validate_transition;
ALTER TABLE public.material_statuses DISABLE TRIGGER trg_material_statuses_validate_transition;
UPDATE public.engineering_jobs  SET status = 'approved'
  WHERE sales_order_item_id = '00000000-0000-0000-0000-0000000c0502';
UPDATE public.material_statuses SET status = 'material_ready'
  WHERE engineering_job_id IN (
    SELECT id FROM public.engineering_jobs
    WHERE sales_order_item_id = '00000000-0000-0000-0000-0000000c0502');
ALTER TABLE public.engineering_jobs  ENABLE TRIGGER trg_eng_jobs_validate_transition;
ALTER TABLE public.material_statuses ENABLE TRIGGER trg_material_statuses_validate_transition;

INSERT INTO public.production_batches (engineering_job_id, quantity, routing)
SELECT id, 20, '[{"process":"laser_cutting","sequence_order":1},{"process":"bending","sequence_order":2}]'::jsonb
FROM public.engineering_jobs
 WHERE sales_order_item_id = '00000000-0000-0000-0000-0000000c0502' LIMIT 1;

INSERT INTO _m6_ids
SELECT 'step1_c05', s.id FROM public.production_batch_steps s
  JOIN public.production_batches b ON b.id = s.production_batch_id
  JOIN public.engineering_jobs ej ON ej.id = b.engineering_job_id
  WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000c0502' AND s.sequence_order = 1;
INSERT INTO _m6_ids
SELECT 'step2_c05', s.id FROM public.production_batch_steps s
  JOIN public.production_batches b ON b.id = s.production_batch_id
  JOIN public.engineering_jobs ej ON ej.id = b.engineering_job_id
  WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000c0502' AND s.sequence_order = 2;

-- Selesaikan tahapan 1 (auto-enqueue QC row 'waiting' untuk step1)
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c3', true);
UPDATE public.production_batch_steps SET status = 'running', operator_id = '00000000-0000-0000-0000-0000000000c9'
  WHERE id = (SELECT val FROM _m6_ids WHERE key = 'step1_c05');
UPDATE public.production_batch_steps SET status = 'completed'
  WHERE id = (SELECT val FROM _m6_ids WHERE key = 'step1_c05');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

INSERT INTO _m6_ids
SELECT 'qc1_c05', id FROM public.qc_inspections
  WHERE production_batch_step_id = (SELECT val FROM _m6_ids WHERE key = 'step1_c05');

-- Tahapan 1 completed tapi QC masih 'waiting' (belum pass): mulai tahapan 2 -> DITOLAK
DELETE FROM _m6_results;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c3', true);

DO $$
DECLARE
  v_step uuid;
  ok boolean := false;
BEGIN
  SELECT val INTO v_step FROM _m6_ids WHERE key = 'step2_c05';
  BEGIN
    UPDATE public.production_batch_steps SET status = 'running', operator_id = '00000000-0000-0000-0000-0000000000c9'
      WHERE id = v_step;
  EXCEPTION WHEN OTHERS THEN
    ok := position('menunggu QC pass' in SQLERRM) > 0;
  END;
  INSERT INTO _m6_results VALUES ('next_step_rejected_qc_not_pass', ok);
END $$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SELECT is(val, true, 'tahapan berikutnya DITOLAK mulai selagi QC tahapan sebelumnya belum pass (pesan: menunggu QC pass)')
  FROM _m6_results WHERE key = 'next_step_rejected_qc_not_pass';

SELECT is(
  (SELECT status::text FROM public.production_batch_steps WHERE id = (SELECT val FROM _m6_ids WHERE key = 'step2_c05')),
  'waiting',
  'tahapan 2 tetap waiting setelah percobaan mulai ditolak (QC tahapan 1 belum pass)'
);

-- Luluskan QC tahapan 1, lalu tahapan 2 BOLEH mulai
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c4', true);
UPDATE public.qc_inspections SET status = 'inspection'
  WHERE id = (SELECT val FROM _m6_ids WHERE key = 'qc1_c05');
UPDATE public.qc_inspections SET status = 'pass', qty_ok = 20
  WHERE id = (SELECT val FROM _m6_ids WHERE key = 'qc1_c05');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c3', true);

SELECT lives_ok(
  format($$UPDATE public.production_batch_steps SET status = 'running', operator_id = '00000000-0000-0000-0000-0000000000c9' WHERE id = %L$$,
    (SELECT val FROM _m6_ids WHERE key = 'step2_c05')),
  'tahapan berikutnya BOLEH mulai setelah QC tahapan sebelumnya pass'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

-- ============================================================
-- Section 6: qc_inspections reject -> rework via UPDATE langsung DITOLAK
-- tanpa lewat RPC trigger_rework, walau oleh role qc (PRD §7 rule #3)
-- Pakai qc_c04 (masih 'waiting' dari Section 4): bawa ke reject dulu.
-- ============================================================

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c4', true);
UPDATE public.qc_inspections SET status = 'inspection'
  WHERE id = (SELECT val FROM _m6_ids WHERE key = 'qc_c04');
UPDATE public.qc_inspections SET status = 'reject', qty_reject = 3
  WHERE id = (SELECT val FROM _m6_ids WHERE key = 'qc_c04');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

DELETE FROM _m6_results;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c4', true);

DO $$
DECLARE
  v_qc uuid;
  ok boolean := false;
BEGIN
  SELECT val INTO v_qc FROM _m6_ids WHERE key = 'qc_c04';
  BEGIN
    UPDATE public.qc_inspections SET status = 'rework' WHERE id = v_qc;
  EXCEPTION WHEN OTHERS THEN
    ok := position('RPC Trigger Rework' in SQLERRM) > 0;
  END;
  INSERT INTO _m6_results VALUES ('direct_qc_rework_rejected', ok);
END $$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SELECT is(val, true, 'qc_inspections reject -> rework via UPDATE langsung DITOLAK meski oleh role qc (harus lewat RPC Trigger Rework)')
  FROM _m6_results WHERE key = 'direct_qc_rework_rejected';

SELECT is(
  (SELECT status::text FROM public.qc_inspections WHERE id = (SELECT val FROM _m6_ids WHERE key = 'qc_c04')),
  'reject',
  'qc_inspections tetap reject setelah percobaan direct-update rework ditolak'
);

-- RPC trigger_rework tetap berfungsi normal untuk baris yang sama (jalur sah)
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000c4', true);

SELECT lives_ok(
  format($$SELECT public.trigger_rework(%L)$$, (SELECT val FROM _m6_ids WHERE key = 'qc_c04')),
  'RPC trigger_rework() tetap berhasil untuk baris yang sama setelah direct-update ditolak'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SELECT is(
  (SELECT status::text FROM public.qc_inspections WHERE id = (SELECT val FROM _m6_ids WHERE key = 'qc_c04')),
  'rework',
  'qc_inspections berhasil rework lewat RPC trigger_rework()'
);

-- Section 7 (delivery_items_validate() smoke test untuk gate "hanya tahapan
-- terakhir batch" lewat join path baru) SENGAJA TIDAK ditambahkan di sini:
-- public.deliveries_set_defaults() (migration M7 20260722065755) adalah bug
-- pra-existing di luar scope M6 — fungsi trigger tsb TIDAK SECURITY DEFINER
-- sehingga jalan dengan privilege pemanggil (authenticated), padahal
-- public.generate_do_number() yang dipanggilnya sudah di-REVOKE dari
-- authenticated tanpa pernah di-GRANT balik. Akibatnya SEMUA INSERT INTO
-- deliveries oleh role manapun (bukan cuma qc/M6) gagal dengan "permission
-- denied for function generate_do_number", sehingga delivery_items_validate()
-- (yang jalan di trigger delivery_items, bukan deliveries) tidak bisa dites
-- end-to-end lewat INSERT deliveries biasa. Dilaporkan ke Hermes sebagai
-- temuan out-of-scope untuk M7, bukan diperbaiki di sini.

SELECT * FROM finish();
ROLLBACK;
