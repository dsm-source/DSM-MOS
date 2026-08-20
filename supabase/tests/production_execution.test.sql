-- M5.6: pgTAP — Production Execution trigger gate (validate_transition + rework)
-- Verifikasi gate PRD §7 rule #1 (engineering approved + material ready untuk
-- tahapan pertama; tahapan sebelumnya harus completed untuk tahapan berikutnya)
-- tidak bisa dilewati lewat manipulasi SQL/RPC langsung, dan enum 'rework'
-- (§7 rule #3, ditegakkan penuh oleh RPC di M6) sudah didukung trigger.
-- Run via: supabase test db

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

BEGIN;

-- ============================================================
-- Section 0: Setup (template dari production.test.sql)
-- ============================================================

INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'tap-pe-sales@test.local',      'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a2', 'tap-pe-admin@test.local',      'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a5', 'tap-pe-production@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a6', 'tap-pe-pp@test.local',         'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'sales'),
  ('00000000-0000-0000-0000-0000000000a2', 'admin'),
  ('00000000-0000-0000-0000-0000000000a5', 'production'),
  ('00000000-0000-0000-0000-0000000000a6', 'production_planning')
ON CONFLICT DO NOTHING;

INSERT INTO public.operators (id, name, employee_number, is_active) VALUES
  ('00000000-0000-0000-0000-000000000099', 'Operator Test', 'EMP-001', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.customers (id, code, name) VALUES
  ('00000000-0000-0000-0000-0000000000e1', 'M5-CUST', 'PT M5 Test')
ON CONFLICT (id) DO NOTHING;

-- Temp table for DO-block result capture
CREATE TEMP TABLE _m5_results (key text PRIMARY KEY, val boolean);
GRANT ALL ON TABLE _m5_results TO authenticated;

SELECT no_plan();

-- ============================================================
-- Section 1: Transisi valid (positive) — default routing 5 langkah
-- SO/item: ...f101 / ...f102, batch approved + material_ready
-- ============================================================

INSERT INTO public.sales_orders (id, customer_id, status, created_by) VALUES
  ('00000000-0000-0000-0000-0000000f0101', '00000000-0000-0000-0000-0000000000e1', 'draft',
   '00000000-0000-0000-0000-0000000000a1')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.sales_order_items (id, sales_order_id, item_name, quantity, material_spec) VALUES
  ('00000000-0000-0000-0000-0000000f0102', '00000000-0000-0000-0000-0000000f0101', 'Plate S1', 10, 'SS304')
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
UPDATE public.sales_orders SET status = 'confirmed' WHERE id = '00000000-0000-0000-0000-0000000f0101';
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

ALTER TABLE public.engineering_jobs  DISABLE TRIGGER trg_eng_jobs_validate_transition;
ALTER TABLE public.material_statuses DISABLE TRIGGER trg_material_statuses_validate_transition;
UPDATE public.engineering_jobs  SET status = 'approved'
  WHERE sales_order_item_id = '00000000-0000-0000-0000-0000000f0102';
UPDATE public.material_statuses SET status = 'material_ready'
  WHERE engineering_job_id IN (
    SELECT id FROM public.engineering_jobs
    WHERE sales_order_item_id = '00000000-0000-0000-0000-0000000f0102');
ALTER TABLE public.engineering_jobs  ENABLE TRIGGER trg_eng_jobs_validate_transition;
ALTER TABLE public.material_statuses ENABLE TRIGGER trg_material_statuses_validate_transition;

INSERT INTO public.production_batches (engineering_job_id, quantity)
SELECT id, 100 FROM public.engineering_jobs
 WHERE sales_order_item_id = '00000000-0000-0000-0000-0000000f0102' LIMIT 1;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a5', true);

SELECT lives_ok($$
  DO $inner$
  DECLARE v_count int;
  BEGIN
    UPDATE production_batch_steps SET status = 'running'
    WHERE id = (SELECT s.id FROM production_batch_steps s
                JOIN production_batches b ON b.id = s.production_batch_id
                JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
                WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0102' AND s.sequence_order = 1);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 1 THEN RAISE EXCEPTION 'UPDATE affected % rows, expected 1', v_count; END IF;
  END $inner$;
$$, 'waiting -> running (gate lolos: engineering approved + material ready)');

SELECT lives_ok($$
  DO $inner$
  DECLARE v_count int;
  BEGIN
    UPDATE production_batch_steps SET status = 'paused'
    WHERE id = (SELECT s.id FROM production_batch_steps s
                JOIN production_batches b ON b.id = s.production_batch_id
                JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
                WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0102' AND s.sequence_order = 1);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 1 THEN RAISE EXCEPTION 'UPDATE affected % rows, expected 1', v_count; END IF;
  END $inner$;
$$, 'running -> paused');

SELECT lives_ok($$
  DO $inner$
  DECLARE v_count int;
  BEGIN
    UPDATE production_batch_steps SET status = 'running'
    WHERE id = (SELECT s.id FROM production_batch_steps s
                JOIN production_batches b ON b.id = s.production_batch_id
                JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
                WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0102' AND s.sequence_order = 1);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 1 THEN RAISE EXCEPTION 'UPDATE affected % rows, expected 1', v_count; END IF;
  END $inner$;
$$, 'paused -> running');

SELECT lives_ok($$
  DO $inner$
  DECLARE v_count int;
  BEGIN
    UPDATE production_batch_steps SET status = 'completed'
    WHERE id = (SELECT s.id FROM production_batch_steps s
                JOIN production_batches b ON b.id = s.production_batch_id
                JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
                WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0102' AND s.sequence_order = 1);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 1 THEN RAISE EXCEPTION 'UPDATE affected % rows, expected 1', v_count; END IF;
  END $inner$;
$$, 'running -> completed');

-- M6: rework hanya lewat RPC trigger_rework (GUC app.allow_rework_transition).
-- Tes trigger transisi/timestamp di bawah men-set GUC manual untuk mensimulasikan
-- konteks RPC (RPC-nya sendiri diuji terpisah di qc_rework.test.sql).
SELECT lives_ok($$
  DO $inner$
  DECLARE v_count int;
  BEGIN
    PERFORM set_config('app.allow_rework_transition', 'true', true);
    UPDATE production_batch_steps SET status = 'rework'
    WHERE id = (SELECT s.id FROM production_batch_steps s
                JOIN production_batches b ON b.id = s.production_batch_id
                JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
                WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0102' AND s.sequence_order = 1);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    PERFORM set_config('app.allow_rework_transition', 'false', true);
    IF v_count <> 1 THEN RAISE EXCEPTION 'UPDATE affected % rows, expected 1', v_count; END IF;
  END $inner$;
$$, 'completed -> rework (M5 baru; via GUC, simulasi RPC)');

SELECT lives_ok($$
  DO $inner$
  DECLARE v_count int;
  BEGIN
    UPDATE production_batch_steps SET status = 'running', operator_id = '00000000-0000-0000-0000-000000000099'
    WHERE id = (SELECT s.id FROM production_batch_steps s
                JOIN production_batches b ON b.id = s.production_batch_id
                JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
                WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0102' AND s.sequence_order = 1);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 1 THEN RAISE EXCEPTION 'UPDATE affected % rows, expected 1', v_count; END IF;
  END $inner$;
$$, 'rework -> running dengan operator (M5 baru)');

SELECT lives_ok($$
  DO $inner$
  DECLARE v_count int;
  BEGIN
    UPDATE production_batch_steps SET status = 'paused'
    WHERE id = (SELECT s.id FROM production_batch_steps s
                JOIN production_batches b ON b.id = s.production_batch_id
                JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
                WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0102' AND s.sequence_order = 1);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 1 THEN RAISE EXCEPTION 'UPDATE affected % rows, expected 1', v_count; END IF;
  END $inner$;
$$, 'running -> paused (setup untuk paused -> rework)');

SELECT lives_ok($$
  DO $inner$
  DECLARE v_count int;
  BEGIN
    PERFORM set_config('app.allow_rework_transition', 'true', true);
    UPDATE production_batch_steps SET status = 'rework'
    WHERE id = (SELECT s.id FROM production_batch_steps s
                JOIN production_batches b ON b.id = s.production_batch_id
                JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
                WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0102' AND s.sequence_order = 1);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    PERFORM set_config('app.allow_rework_transition', 'false', true);
    IF v_count <> 1 THEN RAISE EXCEPTION 'UPDATE affected % rows, expected 1', v_count; END IF;
  END $inner$;
$$, 'paused -> rework (M5 baru; via GUC, simulasi RPC)');

SELECT lives_ok($$
  DO $inner$
  DECLARE v_count int;
  BEGIN
    UPDATE production_batch_steps SET status = 'running'
    WHERE id = (SELECT s.id FROM production_batch_steps s
                JOIN production_batches b ON b.id = s.production_batch_id
                JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
                WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0102' AND s.sequence_order = 1);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 1 THEN RAISE EXCEPTION 'UPDATE affected % rows, expected 1', v_count; END IF;
  END $inner$;
$$, 'rework -> running (setup untuk running -> rework)');

SELECT lives_ok($$
  DO $inner$
  DECLARE v_count int;
  BEGIN
    PERFORM set_config('app.allow_rework_transition', 'true', true);
    UPDATE production_batch_steps SET status = 'rework'
    WHERE id = (SELECT s.id FROM production_batch_steps s
                JOIN production_batches b ON b.id = s.production_batch_id
                JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
                WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0102' AND s.sequence_order = 1);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    PERFORM set_config('app.allow_rework_transition', 'false', true);
    IF v_count <> 1 THEN RAISE EXCEPTION 'UPDATE affected % rows, expected 1', v_count; END IF;
  END $inner$;
$$, 'running -> rework (M5 baru; via GUC, simulasi RPC)');

-- ---- Transisi valid tambahan (iterasi 2): waiting->skipped, rework->completed,
-- ---- rework->paused, paused->completed (belum ter-cover di atas) ----

SELECT lives_ok($$
  DO $inner$
  DECLARE v_count int;
  BEGIN
    UPDATE production_batch_steps SET status = 'skipped'
    WHERE id = (SELECT s.id FROM production_batch_steps s
                JOIN production_batches b ON b.id = s.production_batch_id
                JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
                WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0102' AND s.sequence_order = 2);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 1 THEN RAISE EXCEPTION 'UPDATE affected % rows, expected 1', v_count; END IF;
  END $inner$;
$$, 'waiting -> skipped (tahapan sequence 2, belum pernah dimulai) (M5 iterasi 2)');

SELECT lives_ok($$
  DO $inner$
  DECLARE v_count int;
  BEGIN
    UPDATE production_batch_steps SET status = 'completed'
    WHERE id = (SELECT s.id FROM production_batch_steps s
                JOIN production_batches b ON b.id = s.production_batch_id
                JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
                WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0102' AND s.sequence_order = 1);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 1 THEN RAISE EXCEPTION 'UPDATE affected % rows, expected 1', v_count; END IF;
  END $inner$;
$$, 'rework -> completed (M5 iterasi 2)');

SELECT lives_ok($$
  DO $inner$
  DECLARE v_count int;
  BEGIN
    PERFORM set_config('app.allow_rework_transition', 'true', true);
    UPDATE production_batch_steps SET status = 'rework'
    WHERE id = (SELECT s.id FROM production_batch_steps s
                JOIN production_batches b ON b.id = s.production_batch_id
                JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
                WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0102' AND s.sequence_order = 1);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    PERFORM set_config('app.allow_rework_transition', 'false', true);
    IF v_count <> 1 THEN RAISE EXCEPTION 'UPDATE affected % rows, expected 1', v_count; END IF;
  END $inner$;
$$, 'completed -> rework (setup untuk rework -> paused; via GUC)');

SELECT lives_ok($$
  DO $inner$
  DECLARE v_count int;
  BEGIN
    UPDATE production_batch_steps SET status = 'paused'
    WHERE id = (SELECT s.id FROM production_batch_steps s
                JOIN production_batches b ON b.id = s.production_batch_id
                JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
                WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0102' AND s.sequence_order = 1);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 1 THEN RAISE EXCEPTION 'UPDATE affected % rows, expected 1', v_count; END IF;
  END $inner$;
$$, 'rework -> paused (M5 iterasi 2)');

SELECT lives_ok($$
  DO $inner$
  DECLARE v_count int;
  BEGIN
    UPDATE production_batch_steps SET status = 'completed'
    WHERE id = (SELECT s.id FROM production_batch_steps s
                JOIN production_batches b ON b.id = s.production_batch_id
                JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
                WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0102' AND s.sequence_order = 1);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 1 THEN RAISE EXCEPTION 'UPDATE affected % rows, expected 1', v_count; END IF;
  END $inner$;
$$, 'paused -> completed (M5 iterasi 2)');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

-- ============================================================
-- Section 2: Transisi invalid (negative — bypass gate)
-- SO/item: ...f201 / ...f202, batch approved + material_ready
-- ============================================================

INSERT INTO public.sales_orders (id, customer_id, status, created_by) VALUES
  ('00000000-0000-0000-0000-0000000f0201', '00000000-0000-0000-0000-0000000000e1', 'draft',
   '00000000-0000-0000-0000-0000000000a1')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.sales_order_items (id, sales_order_id, item_name, quantity, material_spec) VALUES
  ('00000000-0000-0000-0000-0000000f0202', '00000000-0000-0000-0000-0000000f0201', 'Plate S2', 10, 'SS304')
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
UPDATE public.sales_orders SET status = 'confirmed' WHERE id = '00000000-0000-0000-0000-0000000f0201';
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

ALTER TABLE public.engineering_jobs  DISABLE TRIGGER trg_eng_jobs_validate_transition;
ALTER TABLE public.material_statuses DISABLE TRIGGER trg_material_statuses_validate_transition;
UPDATE public.engineering_jobs  SET status = 'approved'
  WHERE sales_order_item_id = '00000000-0000-0000-0000-0000000f0202';
UPDATE public.material_statuses SET status = 'material_ready'
  WHERE engineering_job_id IN (
    SELECT id FROM public.engineering_jobs
    WHERE sales_order_item_id = '00000000-0000-0000-0000-0000000f0202');
ALTER TABLE public.engineering_jobs  ENABLE TRIGGER trg_eng_jobs_validate_transition;
ALTER TABLE public.material_statuses ENABLE TRIGGER trg_material_statuses_validate_transition;

INSERT INTO public.production_batches (engineering_job_id, quantity)
SELECT id, 100 FROM public.engineering_jobs
 WHERE sales_order_item_id = '00000000-0000-0000-0000-0000000f0202' LIMIT 1;

DELETE FROM _m5_results;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a5', true);

DO $$
DECLARE
  v_step1 uuid;
  v_step2 uuid;
  v_step3 uuid;
  ok boolean;
BEGIN
  SELECT s.id INTO v_step1 FROM production_batch_steps s
    JOIN production_batches b ON b.id = s.production_batch_id
    JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
    WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0202' AND s.sequence_order = 1;
  SELECT s.id INTO v_step2 FROM production_batch_steps s
    JOIN production_batches b ON b.id = s.production_batch_id
    JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
    WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0202' AND s.sequence_order = 2;
  SELECT s.id INTO v_step3 FROM production_batch_steps s
    JOIN production_batches b ON b.id = s.production_batch_id
    JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
    WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0202' AND s.sequence_order = 3;

  -- running -> waiting
  UPDATE production_batch_steps SET status = 'running' WHERE id = v_step1;
  ok := false;
  BEGIN
    UPDATE production_batch_steps SET status = 'waiting' WHERE id = v_step1;
  EXCEPTION WHEN OTHERS THEN ok := true; END;
  INSERT INTO _m5_results VALUES ('running_to_waiting', ok);

  -- paused -> waiting
  UPDATE production_batch_steps SET status = 'paused' WHERE id = v_step1;
  ok := false;
  BEGIN
    UPDATE production_batch_steps SET status = 'waiting' WHERE id = v_step1;
  EXCEPTION WHEN OTHERS THEN ok := true; END;
  INSERT INTO _m5_results VALUES ('paused_to_waiting', ok);

  -- completed -> waiting, completed -> running (lompat balik tanpa lewat rework)
  UPDATE production_batch_steps SET status = 'running' WHERE id = v_step1;
  UPDATE production_batch_steps SET status = 'completed' WHERE id = v_step1;
  ok := false;
  BEGIN
    UPDATE production_batch_steps SET status = 'waiting' WHERE id = v_step1;
  EXCEPTION WHEN OTHERS THEN ok := true; END;
  INSERT INTO _m5_results VALUES ('completed_to_waiting', ok);

  ok := false;
  BEGIN
    UPDATE production_batch_steps SET status = 'running' WHERE id = v_step1;
  EXCEPTION WHEN OTHERS THEN ok := true; END;
  INSERT INTO _m5_results VALUES ('completed_to_running', ok);

  -- skipped -> running, skipped -> completed (step2 belum pernah start)
  UPDATE production_batch_steps SET status = 'skipped' WHERE id = v_step2;
  ok := false;
  BEGIN
    UPDATE production_batch_steps SET status = 'running' WHERE id = v_step2;
  EXCEPTION WHEN OTHERS THEN ok := true; END;
  INSERT INTO _m5_results VALUES ('skipped_to_running', ok);

  ok := false;
  BEGIN
    UPDATE production_batch_steps SET status = 'completed' WHERE id = v_step2;
  EXCEPTION WHEN OTHERS THEN ok := true; END;
  INSERT INTO _m5_results VALUES ('skipped_to_completed', ok);

  -- rework -> waiting, rework -> skipped
  PERFORM set_config('app.allow_rework_transition', 'true', true);
  UPDATE production_batch_steps SET status = 'rework' WHERE id = v_step1;
  PERFORM set_config('app.allow_rework_transition', 'false', true);
  ok := false;
  BEGIN
    UPDATE production_batch_steps SET status = 'waiting' WHERE id = v_step1;
  EXCEPTION WHEN OTHERS THEN ok := true; END;
  INSERT INTO _m5_results VALUES ('rework_to_waiting', ok);

  ok := false;
  BEGIN
    UPDATE production_batch_steps SET status = 'skipped' WHERE id = v_step1;
  EXCEPTION WHEN OTHERS THEN ok := true; END;
  INSERT INTO _m5_results VALUES ('rework_to_skipped', ok);

  -- waiting -> completed, waiting -> paused (step3 masih waiting, belum pernah disentuh)
  ok := false;
  BEGIN
    UPDATE production_batch_steps SET status = 'completed' WHERE id = v_step3;
  EXCEPTION WHEN OTHERS THEN ok := true; END;
  INSERT INTO _m5_results VALUES ('waiting_to_completed', ok);

  ok := false;
  BEGIN
    UPDATE production_batch_steps SET status = 'paused' WHERE id = v_step3;
  EXCEPTION WHEN OTHERS THEN ok := true; END;
  INSERT INTO _m5_results VALUES ('waiting_to_paused', ok);
END $$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SELECT is(val, true, 'running -> waiting DITOLAK (rollback tidak diizinkan)') FROM _m5_results WHERE key = 'running_to_waiting';
SELECT is(val, true, 'paused -> waiting DITOLAK') FROM _m5_results WHERE key = 'paused_to_waiting';
SELECT is(val, true, 'completed -> waiting DITOLAK') FROM _m5_results WHERE key = 'completed_to_waiting';
SELECT is(val, true, 'completed -> running DITOLAK (harus lewat rework)') FROM _m5_results WHERE key = 'completed_to_running';
SELECT is(val, true, 'skipped -> running DITOLAK (tahapan yang di-skip tidak bisa di-restart)') FROM _m5_results WHERE key = 'skipped_to_running';
SELECT is(val, true, 'skipped -> completed DITOLAK') FROM _m5_results WHERE key = 'skipped_to_completed';
SELECT is(val, true, 'rework -> waiting DITOLAK') FROM _m5_results WHERE key = 'rework_to_waiting';
SELECT is(val, true, 'rework -> skipped DITOLAK') FROM _m5_results WHERE key = 'rework_to_skipped';
SELECT is(val, true, 'waiting -> completed DITOLAK (langsung loncat tanpa running)') FROM _m5_results WHERE key = 'waiting_to_completed';
SELECT is(val, true, 'waiting -> paused DITOLAK (langsung paused tanpa running)') FROM _m5_results WHERE key = 'waiting_to_paused';

-- ============================================================
-- Section 3: Gate §7 rule #1 — tahapan pertama tanpa approval/material
-- SO/item: ...f301 / ...f302, engineering_jobs.status = in_progress (BUKAN approved)
-- ============================================================

INSERT INTO public.sales_orders (id, customer_id, status, created_by) VALUES
  ('00000000-0000-0000-0000-0000000f0301', '00000000-0000-0000-0000-0000000000e1', 'draft',
   '00000000-0000-0000-0000-0000000000a1')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.sales_order_items (id, sales_order_id, item_name, quantity, material_spec) VALUES
  ('00000000-0000-0000-0000-0000000f0302', '00000000-0000-0000-0000-0000000f0301', 'Plate S3', 10, 'SS304')
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
UPDATE public.sales_orders SET status = 'confirmed' WHERE id = '00000000-0000-0000-0000-0000000f0301';
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

ALTER TABLE public.engineering_jobs  DISABLE TRIGGER trg_eng_jobs_validate_transition;
UPDATE public.engineering_jobs SET status = 'in_progress'
  WHERE sales_order_item_id = '00000000-0000-0000-0000-0000000f0302';
ALTER TABLE public.engineering_jobs  ENABLE TRIGGER trg_eng_jobs_validate_transition;
-- material_statuses tetap default 'waiting_material'

INSERT INTO public.production_batches (engineering_job_id, quantity)
SELECT id, 100 FROM public.engineering_jobs
 WHERE sales_order_item_id = '00000000-0000-0000-0000-0000000f0302' LIMIT 1;

DELETE FROM _m5_results;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a5', true);

DO $$
DECLARE
  v_step1 uuid;
  v_msg text;
  ok boolean := false;
BEGIN
  SELECT s.id INTO v_step1 FROM production_batch_steps s
    JOIN production_batches b ON b.id = s.production_batch_id
    JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
    WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0302' AND s.sequence_order = 1;

  BEGIN
    UPDATE production_batch_steps SET status = 'running' WHERE id = v_step1;
  EXCEPTION WHEN OTHERS THEN
    ok := v_step1 IS NOT NULL AND position('menunggu approval engineering' in SQLERRM) > 0;
  END;
  INSERT INTO _m5_results VALUES ('gate_no_eng_approval', ok);
END $$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SELECT is(val, true, 'step pertama running DITOLAK saat engineering belum approved (pesan: menunggu approval engineering)')
  FROM _m5_results WHERE key = 'gate_no_eng_approval';

-- Restore engineering_jobs -> approved, material_statuses tetap waiting_material
ALTER TABLE public.engineering_jobs  DISABLE TRIGGER trg_eng_jobs_validate_transition;
UPDATE public.engineering_jobs SET status = 'approved'
  WHERE sales_order_item_id = '00000000-0000-0000-0000-0000000f0302';
ALTER TABLE public.engineering_jobs  ENABLE TRIGGER trg_eng_jobs_validate_transition;

DELETE FROM _m5_results;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a5', true);

DO $$
DECLARE
  v_step1 uuid;
  ok boolean := false;
BEGIN
  SELECT s.id INTO v_step1 FROM production_batch_steps s
    JOIN production_batches b ON b.id = s.production_batch_id
    JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
    WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0302' AND s.sequence_order = 1;

  BEGIN
    UPDATE production_batch_steps SET status = 'running' WHERE id = v_step1;
  EXCEPTION WHEN OTHERS THEN
    ok := position('menunggu material ready' in SQLERRM) > 0;
  END;
  INSERT INTO _m5_results VALUES ('gate_no_material', ok);
END $$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SELECT is(val, true, 'step pertama running DITOLAK saat material belum ready (pesan: menunggu material ready)')
  FROM _m5_results WHERE key = 'gate_no_material';

-- ============================================================
-- Section 4: Gate §7 rule #1 — tahapan berikutnya butuh step sebelumnya completed
-- SO/item: ...f401 / ...f402, routing custom 3 langkah:
--   laser_cutting(1), bending(2), welding_grinding(3)
-- ============================================================

INSERT INTO public.sales_orders (id, customer_id, status, created_by) VALUES
  ('00000000-0000-0000-0000-0000000f0401', '00000000-0000-0000-0000-0000000000e1', 'draft',
   '00000000-0000-0000-0000-0000000000a1')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.sales_order_items (id, sales_order_id, item_name, quantity, material_spec) VALUES
  ('00000000-0000-0000-0000-0000000f0402', '00000000-0000-0000-0000-0000000f0401', 'Plate S4', 10, 'SS304')
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
UPDATE public.sales_orders SET status = 'confirmed' WHERE id = '00000000-0000-0000-0000-0000000f0401';
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

ALTER TABLE public.engineering_jobs  DISABLE TRIGGER trg_eng_jobs_validate_transition;
ALTER TABLE public.material_statuses DISABLE TRIGGER trg_material_statuses_validate_transition;
UPDATE public.engineering_jobs  SET status = 'approved'
  WHERE sales_order_item_id = '00000000-0000-0000-0000-0000000f0402';
UPDATE public.material_statuses SET status = 'material_ready'
  WHERE engineering_job_id IN (
    SELECT id FROM public.engineering_jobs
    WHERE sales_order_item_id = '00000000-0000-0000-0000-0000000f0402');
ALTER TABLE public.engineering_jobs  ENABLE TRIGGER trg_eng_jobs_validate_transition;
ALTER TABLE public.material_statuses ENABLE TRIGGER trg_material_statuses_validate_transition;

INSERT INTO public.production_batches (engineering_job_id, quantity, routing)
SELECT id, 100,
  '[{"process":"laser_cutting","sequence_order":1},{"process":"bending","sequence_order":2},{"process":"welding_grinding","sequence_order":3}]'::jsonb
FROM public.engineering_jobs
 WHERE sales_order_item_id = '00000000-0000-0000-0000-0000000f0402' LIMIT 1;

SELECT is((SELECT count(*)::int FROM production_batch_steps s
           JOIN production_batches b ON b.id = s.production_batch_id
           JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
           WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0402'),
          3, 'routing custom 3 langkah untuk section 4/5');

DELETE FROM _m5_results;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a5', true);

DO $$
DECLARE
  v_bending uuid;
  ok boolean := false;
BEGIN
  SELECT s.id INTO v_bending FROM production_batch_steps s
    JOIN production_batches b ON b.id = s.production_batch_id
    JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
    WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0402' AND s.sequence_order = 2;

  BEGIN
    UPDATE production_batch_steps SET status = 'running' WHERE id = v_bending;
  EXCEPTION WHEN OTHERS THEN
    ok := position('menunggu Laser Cutting selesai' in SQLERRM) > 0;
  END;
  INSERT INTO _m5_results VALUES ('gate_seq_bending_before_laser', ok);
END $$;

SELECT is(val, true, 'bending (seq 2) running DITOLAK sebelum laser_cutting selesai (pesan: menunggu Laser Cutting selesai)')
  FROM _m5_results WHERE key = 'gate_seq_bending_before_laser';

SELECT lives_ok($$
  DO $inner$
  DECLARE v_count int;
  BEGIN
    UPDATE production_batch_steps SET status = 'running'
    WHERE id = (SELECT s.id FROM production_batch_steps s
                JOIN production_batches b ON b.id = s.production_batch_id
                JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
                WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0402' AND s.sequence_order = 1);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 1 THEN RAISE EXCEPTION 'UPDATE affected % rows, expected 1', v_count; END IF;
  END $inner$;
$$, 'laser_cutting waiting -> running');

SELECT lives_ok($$
  DO $inner$
  DECLARE v_count int;
  BEGIN
    UPDATE production_batch_steps SET status = 'completed'
    WHERE id = (SELECT s.id FROM production_batch_steps s
                JOIN production_batches b ON b.id = s.production_batch_id
                JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
                WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0402' AND s.sequence_order = 1);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 1 THEN RAISE EXCEPTION 'UPDATE affected % rows, expected 1', v_count; END IF;
  END $inner$;
$$, 'laser_cutting running -> completed');

-- M6 gate (PRD §7 rule #2): tahapan berikutnya baru boleh mulai setelah QC
-- tahapan sebelumnya pass. Auto-enqueue (M6.1) membuat baris qc_inspections
-- untuk laser_cutting begitu completed; luluskan di sini supaya section ini
-- (M5.6, fokus ke gate urutan/rework) tidak terblokir oleh gate M6.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
UPDATE public.qc_inspections SET status = 'inspection'
  WHERE production_batch_step_id = (
    SELECT s.id FROM public.production_batch_steps s
    JOIN public.production_batches b ON b.id = s.production_batch_id
    JOIN public.engineering_jobs ej ON ej.id = b.engineering_job_id
    WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0402' AND s.sequence_order = 1);
UPDATE public.qc_inspections SET status = 'pass', qty_ok = 10
  WHERE production_batch_step_id = (
    SELECT s.id FROM public.production_batch_steps s
    JOIN public.production_batches b ON b.id = s.production_batch_id
    JOIN public.engineering_jobs ej ON ej.id = b.engineering_job_id
    WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0402' AND s.sequence_order = 1);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SELECT lives_ok($$
  DO $inner$
  DECLARE v_count int;
  BEGIN
    UPDATE production_batch_steps SET status = 'running'
    WHERE id = (SELECT s.id FROM production_batch_steps s
                JOIN production_batches b ON b.id = s.production_batch_id
                JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
                WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0402' AND s.sequence_order = 2);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 1 THEN RAISE EXCEPTION 'UPDATE affected % rows, expected 1', v_count; END IF;
  END $inner$;
$$, 'bending waiting -> running setelah laser_cutting completed dan QC pass (gate lolos)');

DELETE FROM _m5_results;
DO $$
DECLARE
  v_welding uuid;
  ok boolean := false;
BEGIN
  SELECT s.id INTO v_welding FROM production_batch_steps s
    JOIN production_batches b ON b.id = s.production_batch_id
    JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
    WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0402' AND s.sequence_order = 3;

  BEGIN
    UPDATE production_batch_steps SET status = 'running' WHERE id = v_welding;
  EXCEPTION WHEN OTHERS THEN
    ok := position('menunggu Bending selesai' in SQLERRM) > 0;
  END;
  INSERT INTO _m5_results VALUES ('gate_seq_welding_before_bending', ok);
END $$;

SELECT is(val, true, 'welding (seq 3) running DITOLAK saat bending baru running (pesan: menunggu Bending selesai)')
  FROM _m5_results WHERE key = 'gate_seq_welding_before_bending';

-- ============================================================
-- Section 5: Gate §7 rule #1 — step sebelumnya 'rework' memblokir step berikutnya
-- Lanjutan batch section 4: laser_cutting completed, bending running -> rework
-- ============================================================

SELECT lives_ok($$
  DO $inner$
  DECLARE v_count int;
  BEGIN
    PERFORM set_config('app.allow_rework_transition', 'true', true);
    UPDATE production_batch_steps SET status = 'rework'
    WHERE id = (SELECT s.id FROM production_batch_steps s
                JOIN production_batches b ON b.id = s.production_batch_id
                JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
                WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0402' AND s.sequence_order = 2);
    GET DIAGNOSTICS v_count = ROW_COUNT;
    PERFORM set_config('app.allow_rework_transition', 'false', true);
    IF v_count <> 1 THEN RAISE EXCEPTION 'UPDATE affected % rows, expected 1', v_count; END IF;
  END $inner$;
$$, 'bending running -> rework (setup section 5; via GUC)');

DELETE FROM _m5_results;
DO $$
DECLARE
  v_welding uuid;
  ok boolean := false;
BEGIN
  SELECT s.id INTO v_welding FROM production_batch_steps s
    JOIN production_batches b ON b.id = s.production_batch_id
    JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
    WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0402' AND s.sequence_order = 3;

  BEGIN
    UPDATE production_batch_steps SET status = 'running' WHERE id = v_welding;
  EXCEPTION WHEN OTHERS THEN
    ok := position('rework' in SQLERRM) > 0 AND position('Bending' in SQLERRM) > 0;
  END;
  INSERT INTO _m5_results VALUES ('gate_prev_rework_blocks_next', ok);
END $$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SELECT is(val, true, 'welding (seq 3) running DITOLAK saat bending (seq 2) dalam rework (pesan mengandung "rework" dan "Bending")')
  FROM _m5_results WHERE key = 'gate_prev_rework_blocks_next';

-- ============================================================
-- Section 6: Timestamp auto-fill
-- SO/item: ...f601 / ...f602, default routing, approved + material_ready
-- ============================================================

INSERT INTO public.sales_orders (id, customer_id, status, created_by) VALUES
  ('00000000-0000-0000-0000-0000000f0601', '00000000-0000-0000-0000-0000000000e1', 'draft',
   '00000000-0000-0000-0000-0000000000a1')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.sales_order_items (id, sales_order_id, item_name, quantity, material_spec) VALUES
  ('00000000-0000-0000-0000-0000000f0602', '00000000-0000-0000-0000-0000000f0601', 'Plate S6', 10, 'SS304')
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
UPDATE public.sales_orders SET status = 'confirmed' WHERE id = '00000000-0000-0000-0000-0000000f0601';
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

ALTER TABLE public.engineering_jobs  DISABLE TRIGGER trg_eng_jobs_validate_transition;
ALTER TABLE public.material_statuses DISABLE TRIGGER trg_material_statuses_validate_transition;
UPDATE public.engineering_jobs  SET status = 'approved'
  WHERE sales_order_item_id = '00000000-0000-0000-0000-0000000f0602';
UPDATE public.material_statuses SET status = 'material_ready'
  WHERE engineering_job_id IN (
    SELECT id FROM public.engineering_jobs
    WHERE sales_order_item_id = '00000000-0000-0000-0000-0000000f0602');
ALTER TABLE public.engineering_jobs  ENABLE TRIGGER trg_eng_jobs_validate_transition;
ALTER TABLE public.material_statuses ENABLE TRIGGER trg_material_statuses_validate_transition;

INSERT INTO public.production_batches (engineering_job_id, quantity)
SELECT id, 100 FROM public.engineering_jobs
 WHERE sales_order_item_id = '00000000-0000-0000-0000-0000000f0602' LIMIT 1;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a5', true);

UPDATE production_batch_steps SET status = 'running'
WHERE id = (SELECT s.id FROM production_batch_steps s
            JOIN production_batches b ON b.id = s.production_batch_id
            JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
            WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0602' AND s.sequence_order = 1);

SELECT ok((SELECT started_at IS NOT NULL FROM production_batch_steps s
           JOIN production_batches b ON b.id = s.production_batch_id
           JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
           WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0602' AND s.sequence_order = 1),
          'waiting -> running mengisi started_at');

UPDATE production_batch_steps SET status = 'paused'
WHERE id = (SELECT s.id FROM production_batch_steps s
            JOIN production_batches b ON b.id = s.production_batch_id
            JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
            WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0602' AND s.sequence_order = 1);

SELECT ok((SELECT paused_at IS NOT NULL FROM production_batch_steps s
           JOIN production_batches b ON b.id = s.production_batch_id
           JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
           WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0602' AND s.sequence_order = 1),
          'running -> paused mengisi paused_at');

UPDATE production_batch_steps SET status = 'running'
WHERE id = (SELECT s.id FROM production_batch_steps s
            JOIN production_batches b ON b.id = s.production_batch_id
            JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
            WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0602' AND s.sequence_order = 1);

SELECT ok((SELECT paused_at IS NULL FROM production_batch_steps s
           JOIN production_batches b ON b.id = s.production_batch_id
           JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
           WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0602' AND s.sequence_order = 1),
          'paused -> running me-reset paused_at ke NULL');

UPDATE production_batch_steps SET status = 'completed'
WHERE id = (SELECT s.id FROM production_batch_steps s
            JOIN production_batches b ON b.id = s.production_batch_id
            JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
            WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0602' AND s.sequence_order = 1);

SELECT ok((SELECT completed_at IS NOT NULL FROM production_batch_steps s
           JOIN production_batches b ON b.id = s.production_batch_id
           JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
           WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0602' AND s.sequence_order = 1),
          'running -> completed mengisi completed_at');

SELECT set_config('app.allow_rework_transition', 'true', true);
UPDATE production_batch_steps SET status = 'rework'
WHERE id = (SELECT s.id FROM production_batch_steps s
            JOIN production_batches b ON b.id = s.production_batch_id
            JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
            WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0602' AND s.sequence_order = 1);
SELECT set_config('app.allow_rework_transition', 'false', true);

SELECT ok((SELECT completed_at IS NULL FROM production_batch_steps s
           JOIN production_batches b ON b.id = s.production_batch_id
           JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
           WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0602' AND s.sequence_order = 1),
          'completed -> rework me-NULL-kan completed_at');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

-- ============================================================
-- Section 7: ENUM value 'rework' ada di production_step_status
-- ============================================================

SELECT enum_has_labels('public'::name, 'production_step_status'::name,
  ARRAY['waiting','running','paused','completed','skipped','rework'],
  'production_step_status enum memuat semua nilai termasuk rework (M5)');

-- ============================================================
-- Section 8: Role check (RLS) untuk UPDATE production_batch_steps.status
-- SO/item: ...f801 / ...f802, default routing, approved + material_ready
-- ============================================================

INSERT INTO public.sales_orders (id, customer_id, status, created_by) VALUES
  ('00000000-0000-0000-0000-0000000f0801', '00000000-0000-0000-0000-0000000000e1', 'draft',
   '00000000-0000-0000-0000-0000000000a1')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.sales_order_items (id, sales_order_id, item_name, quantity, material_spec) VALUES
  ('00000000-0000-0000-0000-0000000f0802', '00000000-0000-0000-0000-0000000f0801', 'Plate S8', 10, 'SS304')
ON CONFLICT (id) DO NOTHING;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
UPDATE public.sales_orders SET status = 'confirmed' WHERE id = '00000000-0000-0000-0000-0000000f0801';
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

ALTER TABLE public.engineering_jobs  DISABLE TRIGGER trg_eng_jobs_validate_transition;
ALTER TABLE public.material_statuses DISABLE TRIGGER trg_material_statuses_validate_transition;
UPDATE public.engineering_jobs  SET status = 'approved'
  WHERE sales_order_item_id = '00000000-0000-0000-0000-0000000f0802';
UPDATE public.material_statuses SET status = 'material_ready'
  WHERE engineering_job_id IN (
    SELECT id FROM public.engineering_jobs
    WHERE sales_order_item_id = '00000000-0000-0000-0000-0000000f0802');
ALTER TABLE public.engineering_jobs  ENABLE TRIGGER trg_eng_jobs_validate_transition;
ALTER TABLE public.material_statuses ENABLE TRIGGER trg_material_statuses_validate_transition;

INSERT INTO public.production_batches (engineering_job_id, quantity)
SELECT id, 100 FROM public.engineering_jobs
 WHERE sales_order_item_id = '00000000-0000-0000-0000-0000000f0802' LIMIT 1;

-- production BISA update step.status
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a5', true);

SELECT lives_ok($$
  UPDATE production_batch_steps SET status = 'running'
  WHERE id = (SELECT s.id FROM production_batch_steps s
              JOIN production_batches b ON b.id = s.production_batch_id
              JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
              WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0802' AND s.sequence_order = 1)
$$, 'production BISA UPDATE production_batch_steps.status (RLS M4)');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

-- sales TIDAK BISA update step.status
-- RLS USING menyembunyikan baris dari sales, sehingga UPDATE cocok 0 baris dan
-- tidak melempar exception (pattern sama seperti operators.test.sql) — verifikasi
-- via status tetap tidak berubah, bukan exception capture.
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

UPDATE production_batch_steps SET status = 'paused'
WHERE id = (SELECT s.id FROM production_batch_steps s
            JOIN production_batches b ON b.id = s.production_batch_id
            JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
            WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0802' AND s.sequence_order = 1);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SELECT is((SELECT s.status::text FROM production_batch_steps s
           JOIN production_batches b ON b.id = s.production_batch_id
           JOIN engineering_jobs ej ON ej.id = b.engineering_job_id
           WHERE ej.sales_order_item_id = '00000000-0000-0000-0000-0000000f0802' AND s.sequence_order = 1),
          'running', 'sales DITOLAK UPDATE production_batch_steps.status (RLS M4) — status tetap tidak berubah');

SELECT * FROM finish();
ROLLBACK;
