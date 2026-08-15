-- M4.3 follow-up: integritas data master operator
-- 1. UNIQUE constraint pada employee_number (NULL tetap banyak, sesuai Postgres UNIQUE semantics)
-- 2. CHECK constraint: name tidak boleh kosong/whitespace
-- 3. RPC hard_delete_operator: hanya boleh jika operator belum pernah dipakai di production_batch_steps
--    Tujuan: menjaga histori (default gunakan toggle is_active); admin punya escape hatch untuk record salah input

-- 1. Unique partial index: employee_number hanya unik saat non-null
CREATE UNIQUE INDEX IF NOT EXISTS uniq_operators_employee_number
  ON public.operators (employee_number)
  WHERE employee_number IS NOT NULL;

-- 1b. Replace legacy FOR ALL policy: direct INSERT/UPDATE boleh untuk
--     admin + production_planning, direct DELETE ditutup agar histori operator
--     tidak bisa hilang lewat table API. Hard-delete harus lewat RPC di bawah.
DROP POLICY IF EXISTS operators_write_ppic_admin ON public.operators;

CREATE POLICY operators_insert_ppic_admin ON public.operators
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['production_planning','admin']::public.app_role[])
  );

CREATE POLICY operators_update_ppic_admin ON public.operators
  FOR UPDATE TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['production_planning','admin']::public.app_role[])
  )
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['production_planning','admin']::public.app_role[])
  );

-- 2. CHECK constraint name tidak boleh whitespace-only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'operators_name_not_blank'
  ) THEN
    ALTER TABLE public.operators
      ADD CONSTRAINT operators_name_not_blank CHECK (length(btrim(name)) > 0);
  END IF;
END$$;

-- 3. RPC hard-delete: hanya jika belum di-referensi
--    Hak: admin only (production_planning tidak boleh hard-delete, hanya toggle)
--    Referensi dicek ke production_batch_steps.operator_id
CREATE OR REPLACE FUNCTION public.hard_delete_operator(p_operator_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_referenced_count integer;
BEGIN
  -- Hanya admin boleh eksekusi (defense-in-depth; RPC dipanggil dari UI admin-only)
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden: admin role required' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_referenced_count
  FROM public.production_batch_steps
  WHERE operator_id = p_operator_id;

  IF v_referenced_count > 0 THEN
    RAISE EXCEPTION 'operator is referenced by % production_batch_steps; toggle is_active instead', v_referenced_count
      USING ERRCODE = '23503';
  END IF;

  DELETE FROM public.operators WHERE id = p_operator_id;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.hard_delete_operator(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.hard_delete_operator(uuid) TO authenticated;
