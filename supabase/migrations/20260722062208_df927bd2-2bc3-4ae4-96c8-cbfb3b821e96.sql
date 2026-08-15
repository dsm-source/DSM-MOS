
-- ============ MATERIAL STATUS (dependency) ============
CREATE TYPE public.material_status AS ENUM ('waiting_material','partial_material','material_ready');

CREATE TABLE public.material_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engineering_job_id uuid NOT NULL UNIQUE REFERENCES public.engineering_jobs(id) ON DELETE CASCADE,
  status public.material_status NOT NULL DEFAULT 'waiting_material',
  notes text,
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_material_statuses_status ON public.material_statuses(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_statuses TO authenticated;
GRANT ALL ON public.material_statuses TO service_role;

ALTER TABLE public.material_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "material_statuses_select_all_auth" ON public.material_statuses
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "material_statuses_insert_material_admin" ON public.material_statuses
  FOR INSERT TO authenticated WITH CHECK (
    (SELECT public.has_role(auth.uid(),'material'::public.app_role))
    OR (SELECT public.has_role(auth.uid(),'admin'::public.app_role))
  );
CREATE POLICY "material_statuses_update_material_admin" ON public.material_statuses
  FOR UPDATE TO authenticated USING (
    (SELECT public.has_role(auth.uid(),'material'::public.app_role))
    OR (SELECT public.has_role(auth.uid(),'admin'::public.app_role))
  ) WITH CHECK (
    (SELECT public.has_role(auth.uid(),'material'::public.app_role))
    OR (SELECT public.has_role(auth.uid(),'admin'::public.app_role))
  );
CREATE POLICY "material_statuses_delete_material_admin" ON public.material_statuses
  FOR DELETE TO authenticated USING (
    (SELECT public.has_role(auth.uid(),'admin'::public.app_role))
  );

CREATE TRIGGER trg_material_statuses_updated_at
  BEFORE UPDATE ON public.material_statuses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Extend the existing engineering-job auto-create trigger to also create material row.
CREATE OR REPLACE FUNCTION public.sales_orders_create_engineering_jobs()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status IS DISTINCT FROM 'confirmed' THEN
    INSERT INTO public.engineering_jobs (sales_order_item_id, status, created_by)
    SELECT soi.id, 'draft'::public.engineering_status, auth.uid()
    FROM public.sales_order_items soi
    WHERE soi.sales_order_id = NEW.id
      AND NOT EXISTS (
        SELECT 1 FROM public.engineering_jobs ej WHERE ej.sales_order_item_id = soi.id
      );

    INSERT INTO public.material_statuses (engineering_job_id, status)
    SELECT ej.id, 'waiting_material'::public.material_status
    FROM public.engineering_jobs ej
    JOIN public.sales_order_items soi ON soi.id = ej.sales_order_item_id
    WHERE soi.sales_order_id = NEW.id
      AND NOT EXISTS (
        SELECT 1 FROM public.material_statuses ms WHERE ms.engineering_job_id = ej.id
      );
  END IF;
  RETURN NEW;
END;
$function$;

-- Backfill material_statuses rows for existing engineering_jobs
INSERT INTO public.material_statuses (engineering_job_id, status)
SELECT ej.id, 'waiting_material'::public.material_status
FROM public.engineering_jobs ej
WHERE NOT EXISTS (SELECT 1 FROM public.material_statuses ms WHERE ms.engineering_job_id = ej.id);

-- Validasi transisi material (semua arah antar 3 status diperbolehkan untuk koreksi gudang)
CREATE OR REPLACE FUNCTION public.material_statuses_validate_transition()
RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  IF NEW.status NOT IN ('waiting_material','partial_material','material_ready') THEN
    RAISE EXCEPTION 'Status material tidak valid';
  END IF;
  NEW.updated_by := auth.uid();
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_material_statuses_validate_transition
  BEFORE UPDATE ON public.material_statuses
  FOR EACH ROW EXECUTE FUNCTION public.material_statuses_validate_transition();

-- ============ PRODUCTION ============
CREATE TYPE public.production_process AS ENUM
  ('laser_cutting','bending','welding_grinding','powder_coating','assembly');

CREATE TYPE public.production_step_status AS ENUM
  ('waiting','running','paused','completed','skipped');

-- production_batches
CREATE TABLE public.production_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_number text NOT NULL UNIQUE,
  engineering_job_id uuid NOT NULL REFERENCES public.engineering_jobs(id) ON DELETE RESTRICT,
  quantity numeric(18,4) NOT NULL CHECK (quantity > 0),
  planned_start_date date,
  planned_completion_date date,
  estimated_delivery_date date,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (planned_completion_date IS NULL OR planned_start_date IS NULL
         OR planned_completion_date >= planned_start_date),
  CHECK (estimated_delivery_date IS NULL OR planned_completion_date IS NULL
         OR estimated_delivery_date >= planned_completion_date)
);
CREATE INDEX idx_production_batches_job ON public.production_batches(engineering_job_id);
CREATE INDEX idx_production_batches_planned_start ON public.production_batches(planned_start_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_batches TO authenticated;
GRANT ALL ON public.production_batches TO service_role;

ALTER TABLE public.production_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "production_batches_select_all_auth" ON public.production_batches
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "production_batches_insert_planning_admin" ON public.production_batches
  FOR INSERT TO authenticated WITH CHECK (
    (SELECT public.has_role(auth.uid(),'production_planning'::public.app_role))
    OR (SELECT public.has_role(auth.uid(),'admin'::public.app_role))
  );
CREATE POLICY "production_batches_update_planning_admin" ON public.production_batches
  FOR UPDATE TO authenticated USING (
    (SELECT public.has_role(auth.uid(),'production_planning'::public.app_role))
    OR (SELECT public.has_role(auth.uid(),'admin'::public.app_role))
  ) WITH CHECK (
    (SELECT public.has_role(auth.uid(),'production_planning'::public.app_role))
    OR (SELECT public.has_role(auth.uid(),'admin'::public.app_role))
  );
CREATE POLICY "production_batches_delete_admin" ON public.production_batches
  FOR DELETE TO authenticated USING (
    (SELECT public.has_role(auth.uid(),'admin'::public.app_role))
  );

CREATE TRIGGER trg_production_batches_updated_at
  BEFORE UPDATE ON public.production_batches
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- production_batch_steps
CREATE TABLE public.production_batch_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_batch_id uuid NOT NULL REFERENCES public.production_batches(id) ON DELETE CASCADE,
  process public.production_process NOT NULL,
  sequence_order smallint NOT NULL CHECK (sequence_order BETWEEN 1 AND 5),
  status public.production_step_status NOT NULL DEFAULT 'waiting',
  operator_id uuid REFERENCES auth.users(id),
  started_at timestamptz,
  paused_at timestamptz,
  completed_at timestamptz,
  qty_completed numeric(18,4) NOT NULL DEFAULT 0 CHECK (qty_completed >= 0),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (production_batch_id, process),
  UNIQUE (production_batch_id, sequence_order)
);
CREATE INDEX idx_pbs_batch ON public.production_batch_steps(production_batch_id);
CREATE INDEX idx_pbs_process_status ON public.production_batch_steps(process, status);
CREATE INDEX idx_pbs_status ON public.production_batch_steps(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_batch_steps TO authenticated;
GRANT ALL ON public.production_batch_steps TO service_role;

ALTER TABLE public.production_batch_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pbs_select_all_auth" ON public.production_batch_steps
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "pbs_insert_production_admin" ON public.production_batch_steps
  FOR INSERT TO authenticated WITH CHECK (
    (SELECT public.has_role(auth.uid(),'production'::public.app_role))
    OR (SELECT public.has_role(auth.uid(),'admin'::public.app_role))
  );
CREATE POLICY "pbs_update_production_admin" ON public.production_batch_steps
  FOR UPDATE TO authenticated USING (
    (SELECT public.has_role(auth.uid(),'production'::public.app_role))
    OR (SELECT public.has_role(auth.uid(),'admin'::public.app_role))
  ) WITH CHECK (
    (SELECT public.has_role(auth.uid(),'production'::public.app_role))
    OR (SELECT public.has_role(auth.uid(),'admin'::public.app_role))
  );
CREATE POLICY "pbs_delete_admin" ON public.production_batch_steps
  FOR DELETE TO authenticated USING (
    (SELECT public.has_role(auth.uid(),'admin'::public.app_role))
  );

CREATE TRIGGER trg_pbs_updated_at
  BEFORE UPDATE ON public.production_batch_steps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ==== Auto-generate batch_number ====
CREATE OR REPLACE FUNCTION public.production_batches_set_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE
  v_job_number text;
  v_seq int;
BEGIN
  IF NEW.batch_number IS NULL OR NEW.batch_number = '' THEN
    SELECT job_number INTO v_job_number FROM public.engineering_jobs WHERE id = NEW.engineering_job_id;
    IF v_job_number IS NULL THEN
      RAISE EXCEPTION 'Engineering job tidak ditemukan';
    END IF;
    SELECT COALESCE(count(*),0) + 1 INTO v_seq
      FROM public.production_batches WHERE engineering_job_id = NEW.engineering_job_id;
    NEW.batch_number := v_job_number || '-B' || v_seq::text;
  END IF;
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_production_batches_set_number
  BEFORE INSERT ON public.production_batches
  FOR EACH ROW EXECUTE FUNCTION public.production_batches_set_number();

-- ==== Auto-create 5 steps ====
CREATE OR REPLACE FUNCTION public.production_batches_create_steps()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  INSERT INTO public.production_batch_steps (production_batch_id, process, sequence_order, status)
  VALUES
    (NEW.id, 'laser_cutting'::public.production_process, 1, 'waiting'),
    (NEW.id, 'bending'::public.production_process, 2, 'waiting'),
    (NEW.id, 'welding_grinding'::public.production_process, 3, 'waiting'),
    (NEW.id, 'powder_coating'::public.production_process, 4, 'waiting'),
    (NEW.id, 'assembly'::public.production_process, 5, 'waiting');
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_production_batches_create_steps
  AFTER INSERT ON public.production_batches
  FOR EACH ROW EXECUTE FUNCTION public.production_batches_create_steps();

-- ==== Validasi transisi step + timestamp otomatis + prasyarat running ====
CREATE OR REPLACE FUNCTION public.production_batch_steps_validate_transition()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE
  v_prev record;
  v_eng_status public.engineering_status;
  v_mat_status public.material_status;
  v_prev_label text;
  v_allowed boolean := false;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  -- Transisi yang diizinkan
  IF OLD.status = 'waiting' AND NEW.status = 'running' THEN v_allowed := true;
  ELSIF OLD.status = 'waiting' AND NEW.status = 'skipped' THEN v_allowed := true;
  ELSIF OLD.status = 'running' AND NEW.status = 'paused' THEN v_allowed := true;
  ELSIF OLD.status = 'running' AND NEW.status = 'completed' THEN v_allowed := true;
  ELSIF OLD.status = 'paused' AND NEW.status = 'running' THEN v_allowed := true;
  ELSIF OLD.status = 'paused' AND NEW.status = 'completed' THEN v_allowed := true;
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Transisi status tahapan tidak diperbolehkan: % → %', OLD.status, NEW.status;
  END IF;

  -- Skip hanya bila belum pernah dimulai
  IF NEW.status = 'skipped' AND OLD.started_at IS NOT NULL THEN
    RAISE EXCEPTION 'Tahapan yang sudah dimulai tidak bisa dilewati';
  END IF;

  -- Cek prasyarat saat mulai berjalan (dari waiting)
  IF NEW.status = 'running' AND OLD.status = 'waiting' THEN
    SELECT * INTO v_prev
      FROM public.production_batch_steps
      WHERE production_batch_id = NEW.production_batch_id
        AND sequence_order < NEW.sequence_order
        AND status <> 'skipped'
      ORDER BY sequence_order DESC
      LIMIT 1;

    IF NOT FOUND THEN
      -- Ini tahapan aktif pertama
      SELECT ej.status, ms.status
        INTO v_eng_status, v_mat_status
      FROM public.production_batches pb
      JOIN public.engineering_jobs ej ON ej.id = pb.engineering_job_id
      LEFT JOIN public.material_statuses ms ON ms.engineering_job_id = ej.id
      WHERE pb.id = NEW.production_batch_id;

      IF v_eng_status IS DISTINCT FROM 'approved'::public.engineering_status THEN
        RAISE EXCEPTION 'Tidak bisa mulai: menunggu approval engineering';
      END IF;
      IF v_mat_status IS DISTINCT FROM 'material_ready'::public.material_status THEN
        RAISE EXCEPTION 'Tidak bisa mulai: menunggu material ready';
      END IF;
    ELSE
      IF v_prev.status <> 'completed' THEN
        v_prev_label := CASE v_prev.process
          WHEN 'laser_cutting' THEN 'Laser Cutting'
          WHEN 'bending' THEN 'Bending'
          WHEN 'welding_grinding' THEN 'Welding & Grinding'
          WHEN 'powder_coating' THEN 'Powder Coating'
          WHEN 'assembly' THEN 'Assembly'
        END;
        RAISE EXCEPTION 'Tidak bisa mulai: menunggu % selesai', v_prev_label;
      END IF;
    END IF;
  END IF;

  -- Timestamp otomatis
  IF NEW.status = 'running' AND OLD.status = 'waiting' AND NEW.started_at IS NULL THEN
    NEW.started_at := now();
  END IF;
  IF NEW.status = 'paused' AND NEW.paused_at IS NULL THEN
    NEW.paused_at := now();
  END IF;
  IF NEW.status = 'running' AND OLD.status = 'paused' THEN
    NEW.paused_at := NULL;
  END IF;
  IF NEW.status = 'completed' AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  END IF;

  -- Set operator ke actor bila belum di-set dan mulai running
  IF NEW.status = 'running' AND OLD.status = 'waiting' AND NEW.operator_id IS NULL THEN
    NEW.operator_id := auth.uid();
  END IF;

  RETURN NEW;
END; $$;

CREATE TRIGGER trg_pbs_validate_transition
  BEFORE UPDATE ON public.production_batch_steps
  FOR EACH ROW EXECUTE FUNCTION public.production_batch_steps_validate_transition();

-- ==== Realtime ====
ALTER PUBLICATION supabase_realtime ADD TABLE public.production_batches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.production_batch_steps;
ALTER PUBLICATION supabase_realtime ADD TABLE public.material_statuses;

ALTER TABLE public.production_batches REPLICA IDENTITY FULL;
ALTER TABLE public.production_batch_steps REPLICA IDENTITY FULL;
ALTER TABLE public.material_statuses REPLICA IDENTITY FULL;
