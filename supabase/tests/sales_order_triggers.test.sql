-- M1.7 pgTAP: SO confirmed -> engineering_jobs + material_statuses auto-create;
-- SO status change -> sales_order_status_history + notifications; RLS matrix for sales_orders.

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

BEGIN;

SELECT plan(23);

-- ============================================================
-- Setup: users, roles, customer, sales order, items, assignments
-- ============================================================

INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'tap-creator@test.local',      'authenticated', 'authenticated'), -- sales, creates the SO
  ('00000000-0000-0000-0000-0000000000a2', 'tap-admin-actor@test.local',  'authenticated', 'authenticated'), -- admin, performs the status change
  ('00000000-0000-0000-0000-0000000000a3', 'tap-admin-other@test.local',  'authenticated', 'authenticated'), -- admin, passive (should be notified)
  ('00000000-0000-0000-0000-0000000000a4', 'tap-eng@test.local',          'authenticated', 'authenticated'), -- engineering, assigned
  ('00000000-0000-0000-0000-0000000000a5', 'tap-material@test.local',     'authenticated', 'authenticated'), -- material, assigned
  ('00000000-0000-0000-0000-0000000000a6', 'tap-pp@test.local',           'authenticated', 'authenticated'), -- production_planning, assigned
  ('00000000-0000-0000-0000-0000000000a7', 'tap-production@test.local',   'authenticated', 'authenticated'), -- production, RLS-only
  ('00000000-0000-0000-0000-0000000000a8', 'tap-qc@test.local',           'authenticated', 'authenticated'), -- qc, RLS-only
  ('00000000-0000-0000-0000-0000000000a9', 'tap-delivery@test.local',     'authenticated', 'authenticated'), -- delivery, RLS-only
  ('00000000-0000-0000-0000-0000000000aa', 'tap-viewer@test.local',       'authenticated', 'authenticated'), -- viewer, RLS-only
  ('00000000-0000-0000-0000-0000000000ab', 'tap-norole@test.local',       'authenticated', 'authenticated'); -- no role assigned, must be denied

INSERT INTO public.user_roles (user_id, role) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'sales'),
  ('00000000-0000-0000-0000-0000000000a2', 'admin'),
  ('00000000-0000-0000-0000-0000000000a3', 'admin'),
  ('00000000-0000-0000-0000-0000000000a4', 'engineering'),
  ('00000000-0000-0000-0000-0000000000a5', 'material'),
  ('00000000-0000-0000-0000-0000000000a6', 'production_planning'),
  ('00000000-0000-0000-0000-0000000000a7', 'production'),
  ('00000000-0000-0000-0000-0000000000a8', 'qc'),
  ('00000000-0000-0000-0000-0000000000a9', 'delivery'),
  ('00000000-0000-0000-0000-0000000000aa', 'viewer');

INSERT INTO public.customers (id, code, name)
VALUES ('00000000-0000-0000-0000-0000000000c1', 'TAP-CUST-01', 'PT Tap Test');

INSERT INTO public.sales_orders (id, customer_id, status, created_by)
VALUES (
  '00000000-0000-0000-0000-0000000000b1',
  '00000000-0000-0000-0000-0000000000c1',
  'draft',
  '00000000-0000-0000-0000-0000000000a1'
);

INSERT INTO public.sales_order_items (id, sales_order_id, item_name, quantity, material_spec)
VALUES
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000b1', 'Bracket A', 10, 'SS304 2mm'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000b1', 'Bracket B', 5,  'MS 3mm');

INSERT INTO public.sales_order_assignments (sales_order_id, role, user_id, created_by)
VALUES
  ('00000000-0000-0000-0000-0000000000b1', 'engineering',          '00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b1', 'material',             '00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b1', 'production_planning',  '00000000-0000-0000-0000-0000000000a6', '00000000-0000-0000-0000-0000000000a1');

-- ============================================================
-- Act: admin_actor confirms the SO (draft -> confirmed)
-- ============================================================

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);

UPDATE public.sales_orders SET status = 'confirmed' WHERE id = '00000000-0000-0000-0000-0000000000b1';

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

-- ============================================================
-- Assert: engineering_jobs + material_statuses auto-created
-- ============================================================

SELECT is(
  (SELECT count(*)::int FROM public.engineering_jobs ej
     JOIN public.sales_order_items soi ON soi.id = ej.sales_order_item_id
     WHERE soi.sales_order_id = '00000000-0000-0000-0000-0000000000b1'),
  2,
  'one engineering_job created per sales_order_item on SO confirmed'
);

SELECT is(
  (SELECT count(*)::int FROM public.material_statuses ms
     JOIN public.engineering_jobs ej ON ej.id = ms.engineering_job_id
     JOIN public.sales_order_items soi ON soi.id = ej.sales_order_item_id
     WHERE soi.sales_order_id = '00000000-0000-0000-0000-0000000000b1'),
  2,
  'one material_status created per engineering_job (1:1)'
);

SELECT ok(
  (SELECT bool_and(ej.job_number IS NOT NULL AND ej.job_number LIKE 'ENG-%')
     FROM public.engineering_jobs ej
     JOIN public.sales_order_items soi ON soi.id = ej.sales_order_item_id
     WHERE soi.sales_order_id = '00000000-0000-0000-0000-0000000000b1'),
  'job_number is auto-generated (non-null, ENG- prefix) for every engineering_job'
);

SELECT ok(
  (SELECT bool_and(soi.quantity IS NOT NULL AND soi.material_spec IS NOT NULL)
     FROM public.engineering_jobs ej
     JOIN public.sales_order_items soi ON soi.id = ej.sales_order_item_id
     WHERE soi.sales_order_id = '00000000-0000-0000-0000-0000000000b1'),
  'linked sales_order_item quantity/material_spec are not null for every engineering_job'
);

SELECT ok(
  (SELECT bool_and(ms.status = 'waiting_material')
     FROM public.material_statuses ms
     JOIN public.engineering_jobs ej ON ej.id = ms.engineering_job_id
     JOIN public.sales_order_items soi ON soi.id = ej.sales_order_item_id
     WHERE soi.sales_order_id = '00000000-0000-0000-0000-0000000000b1'),
  'material_statuses default to waiting_material'
);

-- ============================================================
-- Assert: sales_order_status_history logged
-- ============================================================

SELECT is(
  (SELECT count(*)::int FROM public.sales_order_status_history
     WHERE sales_order_id = '00000000-0000-0000-0000-0000000000b1'
       AND from_status = 'draft'
       AND to_status = 'confirmed'
       AND changed_by = '00000000-0000-0000-0000-0000000000a2'),
  1,
  'status history row logged for draft -> confirmed by the actor'
);

-- ============================================================
-- Assert: notifications sent to relevant roles + admin + creator, excluding actor
-- ============================================================

SELECT is(
  (SELECT count(*)::int FROM public.notifications
     WHERE type = 'so_status_changed'
       AND metadata->>'sales_order_id' = '00000000-0000-0000-0000-0000000000b1'),
  5,
  'exactly 5 notifications sent (creator + other admin + engineering/material/pp assignees)'
);

SELECT ok(
  EXISTS (SELECT 1 FROM public.notifications
    WHERE user_id = '00000000-0000-0000-0000-0000000000a1'
      AND type = 'so_status_changed'
      AND metadata->>'sales_order_id' = '00000000-0000-0000-0000-0000000000b1'),
  'SO creator (sales) received a notification'
);

SELECT ok(
  EXISTS (SELECT 1 FROM public.notifications
    WHERE user_id = '00000000-0000-0000-0000-0000000000a3'
      AND type = 'so_status_changed'
      AND metadata->>'sales_order_id' = '00000000-0000-0000-0000-0000000000b1'),
  'other admin (not the actor) received a notification'
);

SELECT ok(
  EXISTS (SELECT 1 FROM public.notifications
    WHERE user_id = '00000000-0000-0000-0000-0000000000a4'
      AND type = 'so_status_changed'
      AND metadata->>'sales_order_id' = '00000000-0000-0000-0000-0000000000b1'),
  'assigned engineering user received a notification'
);

SELECT ok(
  EXISTS (SELECT 1 FROM public.notifications
    WHERE user_id = '00000000-0000-0000-0000-0000000000a5'
      AND type = 'so_status_changed'
      AND metadata->>'sales_order_id' = '00000000-0000-0000-0000-0000000000b1'),
  'assigned material user received a notification'
);

SELECT ok(
  EXISTS (SELECT 1 FROM public.notifications
    WHERE user_id = '00000000-0000-0000-0000-0000000000a6'
      AND type = 'so_status_changed'
      AND metadata->>'sales_order_id' = '00000000-0000-0000-0000-0000000000b1'),
  'assigned production_planning user received a notification'
);

SELECT ok(
  NOT EXISTS (SELECT 1 FROM public.notifications
    WHERE user_id = '00000000-0000-0000-0000-0000000000a2'
      AND type = 'so_status_changed'
      AND metadata->>'sales_order_id' = '00000000-0000-0000-0000-0000000000b1'),
  'the actor who changed the status does not notify themselves'
);

-- ============================================================
-- Assert: RLS matrix for sales_orders SELECT (PRD §8: semua peran boleh SELECT)
-- ============================================================

SET LOCAL ROLE authenticated;

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
SELECT is((SELECT count(*)::int FROM public.sales_orders WHERE id = '00000000-0000-0000-0000-0000000000b1'), 1, 'admin can SELECT sales_orders');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
SELECT is((SELECT count(*)::int FROM public.sales_orders WHERE id = '00000000-0000-0000-0000-0000000000b1'), 1, 'sales can SELECT sales_orders');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a4', true);
SELECT is((SELECT count(*)::int FROM public.sales_orders WHERE id = '00000000-0000-0000-0000-0000000000b1'), 1, 'engineering can SELECT sales_orders');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a5', true);
SELECT is((SELECT count(*)::int FROM public.sales_orders WHERE id = '00000000-0000-0000-0000-0000000000b1'), 1, 'material can SELECT sales_orders');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a6', true);
SELECT is((SELECT count(*)::int FROM public.sales_orders WHERE id = '00000000-0000-0000-0000-0000000000b1'), 1, 'production_planning can SELECT sales_orders');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a7', true);
SELECT is((SELECT count(*)::int FROM public.sales_orders WHERE id = '00000000-0000-0000-0000-0000000000b1'), 1, 'production can SELECT sales_orders');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a8', true);
SELECT is((SELECT count(*)::int FROM public.sales_orders WHERE id = '00000000-0000-0000-0000-0000000000b1'), 1, 'qc can SELECT sales_orders');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a9', true);
SELECT is((SELECT count(*)::int FROM public.sales_orders WHERE id = '00000000-0000-0000-0000-0000000000b1'), 1, 'delivery can SELECT sales_orders');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000aa', true);
SELECT is((SELECT count(*)::int FROM public.sales_orders WHERE id = '00000000-0000-0000-0000-0000000000b1'), 1, 'viewer can SELECT sales_orders');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ab', true);
SELECT is((SELECT count(*)::int FROM public.sales_orders WHERE id = '00000000-0000-0000-0000-0000000000b1'), 0, 'user with no role is denied SELECT on sales_orders');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true);

SELECT * FROM finish();

ROLLBACK;
