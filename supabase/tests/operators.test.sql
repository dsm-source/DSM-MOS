-- M4.3: pgTAP — Operators CRUD RLS + integrity matrix
-- Owner decision:
-- - /operators UI khusus admin + production_planning
-- - employee_number/NPK unique jika diisi
-- - UI tidak hard-delete; active/inactive menjaga histori. DB FK tetap mencegah delete saat sudah referenced.

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

BEGIN;

-- Helper untuk assertion denied yang memang throw (INSERT WITH CHECK, constraint, RPC).
CREATE OR REPLACE FUNCTION public._tap_catches(q text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  EXECUTE q;
  RETURN false;
EXCEPTION WHEN OTHERS THEN
  RETURN true;
END;
$$;

-- Seed users (idempotent across test files)
INSERT INTO auth.users (id, email, raw_user_meta_data, aud, role, instance_id)
VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'op-sales@test.local',     '{}'::jsonb, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000a2', 'op-admin@test.local',     '{}'::jsonb, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000a3', 'op-eng@test.local',       '{}'::jsonb, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000a4', 'op-material@test.local',  '{}'::jsonb, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000a5', 'op-production@test.local','{}'::jsonb, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000a6', 'op-pp@test.local',        '{}'::jsonb, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000a7', 'op-qc@test.local',        '{}'::jsonb, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000a8', 'op-delivery@test.local',  '{}'::jsonb, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000a9', 'op-viewer@test.local',    '{}'::jsonb, 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'sales'),
  ('00000000-0000-0000-0000-0000000000a2', 'admin'),
  ('00000000-0000-0000-0000-0000000000a3', 'engineering'),
  ('00000000-0000-0000-0000-0000000000a4', 'material'),
  ('00000000-0000-0000-0000-0000000000a5', 'production'),
  ('00000000-0000-0000-0000-0000000000a6', 'production_planning'),
  ('00000000-0000-0000-0000-0000000000a7', 'qc'),
  ('00000000-0000-0000-0000-0000000000a8', 'delivery'),
  ('00000000-0000-0000-0000-0000000000a9', 'viewer')
ON CONFLICT DO NOTHING;

SELECT no_plan();

DELETE FROM public.operators WHERE name LIKE 'TEST_OP_%' OR employee_number LIKE 'TAP-%';

-- ===== Section 1: SELECT matrix (9 authenticated app roles can read operator names for downstream production UI) =====
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok('SELECT count(*) FROM public.operators', 'sales boleh SELECT operators');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok('SELECT count(*) FROM public.operators', 'admin boleh SELECT operators');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a3', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok('SELECT count(*) FROM public.operators', 'engineering boleh SELECT operators');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a4', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok('SELECT count(*) FROM public.operators', 'material boleh SELECT operators');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a5', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok('SELECT count(*) FROM public.operators', 'production boleh SELECT operators');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a6', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok('SELECT count(*) FROM public.operators', 'production_planning boleh SELECT operators');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a7', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok('SELECT count(*) FROM public.operators', 'qc boleh SELECT operators');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a8', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok('SELECT count(*) FROM public.operators', 'delivery boleh SELECT operators');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a9', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok('SELECT count(*) FROM public.operators', 'viewer boleh SELECT operators');

-- ===== Section 2: INSERT allow only admin + production_planning =====
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok($$INSERT INTO public.operators (name, employee_number) VALUES ('TEST_OP_ADMIN_CREATE', 'TAP-ADMIN')$$, 'admin boleh INSERT operators');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a6', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok($$INSERT INTO public.operators (name, employee_number) VALUES ('TEST_OP_PP_CREATE', 'TAP-PP')$$, 'production_planning boleh INSERT operators');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
SET LOCAL ROLE authenticated;
SELECT is(public._tap_catches($$INSERT INTO public.operators (name, employee_number) VALUES ('TEST_OP_BLOCKED_SALES', 'TAP-SALES')$$), true, 'sales DITOLAK INSERT operators');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a3', true);
SET LOCAL ROLE authenticated;
SELECT is(public._tap_catches($$INSERT INTO public.operators (name, employee_number) VALUES ('TEST_OP_BLOCKED_ENG', 'TAP-ENG')$$), true, 'engineering DITOLAK INSERT operators');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a4', true);
SET LOCAL ROLE authenticated;
SELECT is(public._tap_catches($$INSERT INTO public.operators (name, employee_number) VALUES ('TEST_OP_BLOCKED_MATERIAL', 'TAP-MATERIAL')$$), true, 'material DITOLAK INSERT operators');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a5', true);
SET LOCAL ROLE authenticated;
SELECT is(public._tap_catches($$INSERT INTO public.operators (name, employee_number) VALUES ('TEST_OP_BLOCKED_PROD', 'TAP-PROD')$$), true, 'production DITOLAK INSERT operators');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a7', true);
SET LOCAL ROLE authenticated;
SELECT is(public._tap_catches($$INSERT INTO public.operators (name, employee_number) VALUES ('TEST_OP_BLOCKED_QC', 'TAP-QC')$$), true, 'qc DITOLAK INSERT operators');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a8', true);
SET LOCAL ROLE authenticated;
SELECT is(public._tap_catches($$INSERT INTO public.operators (name, employee_number) VALUES ('TEST_OP_BLOCKED_DELIVERY', 'TAP-DELIVERY')$$), true, 'delivery DITOLAK INSERT operators');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a9', true);
SET LOCAL ROLE authenticated;
SELECT is(public._tap_catches($$INSERT INTO public.operators (name, employee_number) VALUES ('TEST_OP_BLOCKED_VIEWER', 'TAP-VIEWER')$$), true, 'viewer DITOLAK INSERT operators');

-- ===== Section 3: DB integrity constraints =====
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
SET LOCAL ROLE authenticated;
SELECT is(public._tap_catches($$INSERT INTO public.operators (name, employee_number) VALUES ('TEST_OP_DUP_NPK', 'TAP-ADMIN')$$), true, 'employee_number/NPK wajib unique jika diisi');
SELECT is(public._tap_catches($$INSERT INTO public.operators (name, employee_number) VALUES ('   ', 'TAP-BLANK')$$), true, 'operator name tidak boleh kosong/whitespace');

-- ===== Section 4: UPDATE allow admin + production_planning =====
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok($$UPDATE public.operators SET name = 'TEST_OP_ADMIN_UPDATED' WHERE employee_number = 'TAP-ADMIN'$$, 'admin boleh UPDATE operators');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a6', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok($$UPDATE public.operators SET is_active = false WHERE employee_number = 'TAP-PP'$$, 'production_planning boleh UPDATE operators');

-- Denied UPDATE: RLS USING hides rows, so verify data remains unchanged after attempted update.
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
SET LOCAL ROLE authenticated;
UPDATE public.operators SET is_active = true WHERE employee_number = 'TAP-PP';
RESET ROLE;
SELECT is((SELECT is_active FROM public.operators WHERE employee_number = 'TAP-PP'), false, 'sales DITOLAK UPDATE operators');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a3', true);
SET LOCAL ROLE authenticated;
UPDATE public.operators SET is_active = true WHERE employee_number = 'TAP-PP';
RESET ROLE;
SELECT is((SELECT is_active FROM public.operators WHERE employee_number = 'TAP-PP'), false, 'engineering DITOLAK UPDATE operators');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a4', true);
SET LOCAL ROLE authenticated;
UPDATE public.operators SET is_active = true WHERE employee_number = 'TAP-PP';
RESET ROLE;
SELECT is((SELECT is_active FROM public.operators WHERE employee_number = 'TAP-PP'), false, 'material DITOLAK UPDATE operators');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a5', true);
SET LOCAL ROLE authenticated;
UPDATE public.operators SET is_active = true WHERE employee_number = 'TAP-PP';
RESET ROLE;
SELECT is((SELECT is_active FROM public.operators WHERE employee_number = 'TAP-PP'), false, 'production DITOLAK UPDATE operators');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a7', true);
SET LOCAL ROLE authenticated;
UPDATE public.operators SET is_active = true WHERE employee_number = 'TAP-PP';
RESET ROLE;
SELECT is((SELECT is_active FROM public.operators WHERE employee_number = 'TAP-PP'), false, 'qc DITOLAK UPDATE operators');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a8', true);
SET LOCAL ROLE authenticated;
UPDATE public.operators SET is_active = true WHERE employee_number = 'TAP-PP';
RESET ROLE;
SELECT is((SELECT is_active FROM public.operators WHERE employee_number = 'TAP-PP'), false, 'delivery DITOLAK UPDATE operators');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a9', true);
SET LOCAL ROLE authenticated;
UPDATE public.operators SET is_active = true WHERE employee_number = 'TAP-PP';
RESET ROLE;
SELECT is((SELECT is_active FROM public.operators WHERE employee_number = 'TAP-PP'), false, 'viewer DITOLAK UPDATE operators');

-- ===== Section 5: DELETE policy, but UI uses active/inactive =====
-- Direct table DELETE is closed for all authenticated users. Admin-only RPC can hard-delete
-- unreferenced mistakes; referenced operators are blocked by RPC guard.
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
SET LOCAL ROLE authenticated;
INSERT INTO public.operators (name, employee_number) VALUES ('TEST_OP_ADMIN_DELETE', 'TAP-ADMIN-DEL');
DELETE FROM public.operators WHERE employee_number = 'TAP-ADMIN-DEL';
RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.operators WHERE employee_number = 'TAP-ADMIN-DEL'), 1, 'admin direct DELETE operators ditutup');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok($$SELECT public.hard_delete_operator((SELECT id FROM public.operators WHERE employee_number = 'TAP-ADMIN-DEL'))$$, 'admin RPC hard-delete boleh untuk unreferenced operator');
RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.operators WHERE employee_number = 'TAP-ADMIN-DEL'), 0, 'admin RPC hard-delete menghapus unreferenced operator');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a6', true);
SET LOCAL ROLE authenticated;
INSERT INTO public.operators (name, employee_number) VALUES ('TEST_OP_PP_DELETE', 'TAP-PP-DEL');
DELETE FROM public.operators WHERE employee_number = 'TAP-PP-DEL';
RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.operators WHERE employee_number = 'TAP-PP-DEL'), 1, 'production_planning direct DELETE operators ditutup');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a6', true);
SET LOCAL ROLE authenticated;
SELECT is(public._tap_catches($$SELECT public.hard_delete_operator((SELECT id FROM public.operators WHERE employee_number = 'TAP-PP-DEL'))$$), true, 'production_planning DITOLAK RPC hard-delete operators');
RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.operators WHERE employee_number = 'TAP-PP-DEL'), 1, 'production_planning RPC hard-delete tidak menghapus operator');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
SET LOCAL ROLE authenticated;
INSERT INTO public.operators (name, employee_number) VALUES ('TEST_OP_DELETE_DENY', 'TAP-DEL-DENY');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
SET LOCAL ROLE authenticated;
DELETE FROM public.operators WHERE employee_number = 'TAP-DEL-DENY';
RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.operators WHERE employee_number = 'TAP-DEL-DENY'), 1, 'sales DITOLAK DELETE operators');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a3', true);
SET LOCAL ROLE authenticated;
DELETE FROM public.operators WHERE employee_number = 'TAP-DEL-DENY';
RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.operators WHERE employee_number = 'TAP-DEL-DENY'), 1, 'engineering DITOLAK DELETE operators');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a4', true);
SET LOCAL ROLE authenticated;
DELETE FROM public.operators WHERE employee_number = 'TAP-DEL-DENY';
RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.operators WHERE employee_number = 'TAP-DEL-DENY'), 1, 'material DITOLAK DELETE operators');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a5', true);
SET LOCAL ROLE authenticated;
DELETE FROM public.operators WHERE employee_number = 'TAP-DEL-DENY';
RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.operators WHERE employee_number = 'TAP-DEL-DENY'), 1, 'production DITOLAK DELETE operators');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a7', true);
SET LOCAL ROLE authenticated;
DELETE FROM public.operators WHERE employee_number = 'TAP-DEL-DENY';
RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.operators WHERE employee_number = 'TAP-DEL-DENY'), 1, 'qc DITOLAK DELETE operators');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a8', true);
SET LOCAL ROLE authenticated;
DELETE FROM public.operators WHERE employee_number = 'TAP-DEL-DENY';
RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.operators WHERE employee_number = 'TAP-DEL-DENY'), 1, 'delivery DITOLAK DELETE operators');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a9', true);
SET LOCAL ROLE authenticated;
DELETE FROM public.operators WHERE employee_number = 'TAP-DEL-DENY';
RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.operators WHERE employee_number = 'TAP-DEL-DENY'), 1, 'viewer DITOLAK DELETE operators');

-- Referenced operator: RPC admin harus menolak agar histori step tetap menyimpan operator.
RESET ROLE;
INSERT INTO public.operators (id, name, employee_number, is_active) VALUES
  ('00000000-0000-0000-0000-00000000f0f1', 'TEST_OP_REFERENCED', 'TAP-REF', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.customers (id, code, name) VALUES
  ('00000000-0000-0000-0000-00000000f0c1', 'OP-CUST', 'PT Operator Test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.sales_orders (id, customer_id, status, created_by) VALUES
  ('00000000-0000-0000-0000-00000000f0b1',
   '00000000-0000-0000-0000-00000000f0c1', 'draft',
   '00000000-0000-0000-0000-0000000000a1')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.sales_order_items (id, sales_order_id, item_name, quantity, material_spec) VALUES
  ('00000000-0000-0000-0000-00000000f0d1',
   '00000000-0000-0000-0000-00000000f0b1', 'Operator Ref Item', 1, 'SS400')
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
UPDATE public.sales_orders SET status = 'confirmed'
  WHERE id = '00000000-0000-0000-0000-00000000f0b1';
RESET ROLE;

ALTER TABLE public.engineering_jobs  DISABLE TRIGGER trg_eng_jobs_validate_transition;
ALTER TABLE public.material_statuses DISABLE TRIGGER trg_material_statuses_validate_transition;
UPDATE public.engineering_jobs SET status = 'approved'
  WHERE sales_order_item_id = '00000000-0000-0000-0000-00000000f0d1';
UPDATE public.material_statuses SET status = 'material_ready'
  WHERE engineering_job_id IN (
    SELECT id FROM public.engineering_jobs
    WHERE sales_order_item_id = '00000000-0000-0000-0000-00000000f0d1');
ALTER TABLE public.engineering_jobs  ENABLE TRIGGER trg_eng_jobs_validate_transition;
ALTER TABLE public.material_statuses ENABLE TRIGGER trg_material_statuses_validate_transition;

INSERT INTO public.production_batches (engineering_job_id, quantity)
SELECT id, 1 FROM public.engineering_jobs
WHERE sales_order_item_id = '00000000-0000-0000-0000-00000000f0d1'
LIMIT 1;

UPDATE public.production_batch_steps
SET operator_id = '00000000-0000-0000-0000-00000000f0f1'
WHERE production_batch_id IN (
  SELECT pb.id FROM public.production_batches pb
  JOIN public.engineering_jobs ej ON ej.id = pb.engineering_job_id
  WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-00000000f0d1'
)
AND sequence_order = 1;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
SET LOCAL ROLE authenticated;
SELECT is(public._tap_catches($$SELECT public.hard_delete_operator('00000000-0000-0000-0000-00000000f0f1'::uuid)$$), true, 'admin RPC hard-delete DITOLAK untuk referenced operator');
RESET ROLE;
SELECT is((SELECT count(*)::int FROM public.operators WHERE employee_number = 'TAP-REF'), 1, 'referenced operator tetap tersimpan untuk histori');

SELECT * FROM finish();

ROLLBACK;
