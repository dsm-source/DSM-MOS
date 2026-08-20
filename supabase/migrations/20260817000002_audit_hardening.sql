-- Follow-up dari audit database (2026-08-16):
-- 1. get_actor_emails: tambah guard has_any_role, sebelumnya bisa dipanggil
--    authenticated mana pun tanpa role untuk resolve UUID -> email siapa saja.
-- 2. soa_update_sales_admin: tambah WITH CHECK, menyamakan pola dengan semua
--    policy UPDATE lain di project ini (satu-satunya yang belum punya).
-- 3. Index FK yang sering dipakai untuk filter (operator workload, qc inspector).

-- 1. Guard get_actor_emails: hanya user dengan role terdaftar (bukan sekadar
--    authenticated) yang boleh resolve email dari user_id.
CREATE OR REPLACE FUNCTION public.get_actor_emails(_user_ids uuid[])
RETURNS TABLE(id uuid, email text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.has_any_role(auth.uid(), ARRAY[
    'admin','sales','engineering','material','production_planning',
    'production','qc','delivery','viewer'
  ]::public.app_role[]) THEN
    RAISE EXCEPTION 'forbidden: role required' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT u.id, u.email::text
  FROM auth.users u
  WHERE u.id = ANY(_user_ids);
END;
$$;

-- 2. WITH CHECK yang hilang di sales_order_assignments UPDATE policy
ALTER POLICY soa_update_sales_admin ON public.sales_order_assignments
  WITH CHECK (
    public.has_role(auth.uid(), 'sales'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- 3. Index FK yang sering di-filter langsung (workload operator, antrian QC)
CREATE INDEX IF NOT EXISTS idx_production_batch_steps_operator_id
  ON public.production_batch_steps (operator_id);

CREATE INDEX IF NOT EXISTS idx_qc_inspections_inspector_id
  ON public.qc_inspections (inspector_id);
