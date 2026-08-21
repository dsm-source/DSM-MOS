-- M8.4: pgTAP — audit_logs tidak punya policy INSERT untuk role aplikasi
-- Verifikasi: audit_logs hanya bisa ditulis lewat trigger SECURITY DEFINER
-- log_audit() (service_role/bypass RLS), bukan lewat INSERT langsung oleh
-- role authenticated manapun (termasuk admin). SELECT tetap admin-only.
-- Run via: supabase test db supabase/tests/audit_logs.test.sql

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

BEGIN;

-- ============================================================
-- Section 0: Setup
-- ============================================================

INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-0000-0000-0000000a8401', 'tap-al-admin@test.local', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000a8402', 'tap-al-sales@test.local', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role) VALUES
  ('00000000-0000-0000-0000-0000000a8401', 'admin'),
  ('00000000-0000-0000-0000-0000000a8402', 'sales')
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE _m8_results (key text PRIMARY KEY, val boolean);
GRANT ALL ON TABLE _m8_results TO authenticated;

-- Baris audit_logs kontrol untuk membedakan SELECT admin vs non-admin,
-- ditulis via service_role (jalur sah, meniru trigger SECURITY DEFINER).
INSERT INTO public.audit_logs (table_name, record_id, action, changed_by)
VALUES ('sales_orders', '00000000-0000-0000-0000-0000000a8401', 'insert', '00000000-0000-0000-0000-0000000a8401');

SELECT no_plan();

-- ============================================================
-- Section 1: tidak ada policy INSERT/UPDATE/DELETE pada audit_logs
-- ============================================================

SELECT is(
  (SELECT count(*)::int FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'audit_logs' AND cmd = 'INSERT'),
  0,
  'audit_logs: tidak ada RLS policy untuk INSERT'
);

SELECT is(
  (SELECT count(*)::int FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'audit_logs' AND cmd = 'UPDATE'),
  0,
  'audit_logs: tidak ada RLS policy untuk UPDATE'
);

SELECT is(
  (SELECT count(*)::int FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'audit_logs' AND cmd = 'DELETE'),
  0,
  'audit_logs: tidak ada RLS policy untuk DELETE'
);

SELECT is(
  (SELECT count(*)::int FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'audit_logs' AND cmd = 'SELECT'),
  1,
  'audit_logs: tepat SATU RLS policy untuk SELECT (admin-only)'
);

-- ============================================================
-- Section 2: insert langsung ke audit_logs oleh role authenticated DITOLAK
-- (baik admin maupun non-admin -- tidak ada GRANT INSERT ke authenticated)
-- ============================================================

DELETE FROM _m8_results;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000a8402', true);

DO $$
DECLARE
  ok boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.audit_logs (table_name, record_id, action, changed_by)
    VALUES ('sales_orders', '00000000-0000-0000-0000-0000000a8402', 'insert',
            '00000000-0000-0000-0000-0000000a8402');
  EXCEPTION WHEN insufficient_privilege THEN
    ok := true;
  END;
  INSERT INTO _m8_results VALUES ('sales_insert_denied', ok);
END $$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SELECT is(val, true, 'non-admin (sales) DITOLAK INSERT langsung ke audit_logs (permission denied)')
  FROM _m8_results WHERE key = 'sales_insert_denied';

DELETE FROM _m8_results;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000a8401', true);

DO $$
DECLARE
  ok boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.audit_logs (table_name, record_id, action, changed_by)
    VALUES ('sales_orders', '00000000-0000-0000-0000-0000000a8401', 'insert',
            '00000000-0000-0000-0000-0000000a8401');
  EXCEPTION WHEN insufficient_privilege THEN
    ok := true;
  END;
  INSERT INTO _m8_results VALUES ('admin_insert_denied', ok);
END $$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SELECT is(val, true, 'admin JUGA DITOLAK INSERT langsung ke audit_logs (bukan lewat trigger log_audit)')
  FROM _m8_results WHERE key = 'admin_insert_denied';

SELECT is(
  (SELECT count(*)::int FROM public.audit_logs
    WHERE changed_by IN ('00000000-0000-0000-0000-0000000a8401', '00000000-0000-0000-0000-0000000a8402')
      AND record_id IN ('00000000-0000-0000-0000-0000000a8402')),
  0,
  'tidak ada baris audit_logs tersimpan dari percobaan INSERT langsung yang ditolak'
);

-- ============================================================
-- Section 3: SELECT audit_logs -- admin allowed, non-admin denied (RLS)
-- ============================================================

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000a8401', true);

SELECT ok(
  (SELECT count(*)::int FROM public.audit_logs
    WHERE record_id = '00000000-0000-0000-0000-0000000a8401') = 1,
  'admin BISA SELECT baris audit_logs (RLS policy admin-only)'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000a8402', true);

SELECT is(
  (SELECT count(*)::int FROM public.audit_logs
    WHERE record_id = '00000000-0000-0000-0000-0000000a8401'),
  0,
  'non-admin (sales) DITOLAK SELECT audit_logs -- RLS menyaring jadi 0 baris'
);

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SELECT * FROM finish();
ROLLBACK;
