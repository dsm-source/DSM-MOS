-- M4.3: pgTAP — Operators CRUD RLS matrix
-- SELECT: semua authenticated boleh baca
-- INSERT/UPDATE/DELETE: hanya production_planning + admin

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

BEGIN;

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

-- Clean any prior state so test is deterministic
DELETE FROM public.operators WHERE name IN ('TEST_OP_A', 'TEST_OP_B');

-- ===== Section 1: SELECT matrix (semua authenticated boleh baca) =====
-- production_planning
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a6', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  'SELECT count(*) FROM public.operators',
  'production_planning boleh SELECT operators'
);

-- sales
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  'SELECT count(*) FROM public.operators',
  'sales boleh SELECT operators'
);

-- viewer
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a9', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  'SELECT count(*) FROM public.operators',
  'viewer boleh SELECT operators'
);

-- ===== Section 2: INSERT allowed (admin + production_planning) =====
-- admin boleh INSERT
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$INSERT INTO public.operators (name) VALUES ('TEST_OP_A')$$,
  'admin boleh INSERT operators'
);

-- production_planning boleh INSERT
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a6', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$INSERT INTO public.operators (name) VALUES ('TEST_OP_B')$$,
  'production_planning boleh INSERT operators'
);

-- ===== Section 3: INSERT denied (3 peran non-ppic/admin) =====
-- Helper: DO block yang nangkap exception, simpan hasil ke session variable
-- sales ditolak
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    INSERT INTO public.operators (name) VALUES ('TEST_OP_BLOCKED_SALES');
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('op_test.caught', '1', true);
    RETURN;
  END;
  PERFORM set_config('op_test.caught', '0', true);
END$$;
RESET ROLE;
SELECT is(
  current_setting('op_test.caught')::int,
  1,
  'sales DITOLAK INSERT operators'
);

-- engineering ditolak
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a3', true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    INSERT INTO public.operators (name) VALUES ('TEST_OP_BLOCKED_ENG');
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('op_test.caught', '1', true);
    RETURN;
  END;
  PERFORM set_config('op_test.caught', '0', true);
END$$;
RESET ROLE;
SELECT is(
  current_setting('op_test.caught')::int,
  1,
  'engineering DITOLAK INSERT operators'
);

-- production ditolak
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a5', true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  BEGIN
    INSERT INTO public.operators (name) VALUES ('TEST_OP_BLOCKED_PROD');
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('op_test.caught', '1', true);
    RETURN;
  END;
  PERFORM set_config('op_test.caught', '0', true);
END$$;
RESET ROLE;
SELECT is(
  current_setting('op_test.caught')::int,
  1,
  'production DITOLAK INSERT operators'
);

-- ===== Section 4: UPDATE matrix =====
-- production_planning boleh UPDATE is_active
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a6', true);
SET LOCAL ROLE authenticated;
SELECT lives_ok(
  $$UPDATE public.operators SET is_active = false WHERE name = 'TEST_OP_A'$$,
  'production_planning boleh UPDATE operators'
);

-- sales ditolak UPDATE — RLS memblokir via USING clause (0 rows terlihat, no exception)
-- Verifikasi: UPDATE sales tidak mengubah is_active TEST_OP_A (masih false dari test 8)
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  -- UPDATE ini akan affect 0 rows karena USING clause false untuk sales
  UPDATE public.operators SET is_active = true WHERE name = 'TEST_OP_A';
  -- Cek apakah is_active masih false (RLS blok)
  IF EXISTS (SELECT 1 FROM public.operators WHERE name = 'TEST_OP_A' AND is_active = true) THEN
    PERFORM set_config('op_test.caught', '0', true); -- berubah = RLS tidak blok
  ELSE
    PERFORM set_config('op_test.caught', '1', true); -- tetap false = RLS blok
  END IF;
END$$;
RESET ROLE;
SELECT is(
  current_setting('op_test.caught')::int,
  1,
  'sales DITOLAK UPDATE operators (RLS blok via USING)'
);

-- ===== Cleanup =====
DELETE FROM public.operators WHERE name IN ('TEST_OP_A', 'TEST_OP_B');

SELECT * FROM finish();

ROLLBACK;
