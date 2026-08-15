-- M4.1-M4.2: production_batches.routing + operator_id FK -> operators + routing-aware step trigger

-- ==== M4.1: routing column ====
ALTER TABLE public.production_batches
  ADD COLUMN IF NOT EXISTS routing jsonb NOT NULL DEFAULT
    '[{"process":"laser_cutting","sequence_order":1},{"process":"bending","sequence_order":2},{"process":"welding_grinding","sequence_order":3},{"process":"powder_coating","sequence_order":4},{"process":"assembly","sequence_order":5}]'::jsonb;

-- ==== M4.2: operator_id FK -> operators(id) ====
ALTER TABLE public.production_batch_steps
  DROP CONSTRAINT IF EXISTS production_batch_steps_operator_id_fkey;

ALTER TABLE public.production_batch_steps
  ADD CONSTRAINT production_batch_steps_operator_id_fkey
  FOREIGN KEY (operator_id) REFERENCES public.operators(id) ON DELETE SET NULL;

GRANT UPDATE (operator_id) ON public.production_batch_steps TO authenticated;

-- operator_id used to auto-fill with auth.uid() (a valid auth.users id) when a step
-- started running; now that the FK targets operators(id), auth.uid() is no longer a
-- valid value, so the operator must be selected explicitly (see M5.4).
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

  RETURN NEW;
END; $$;

-- ==== Auto-create steps sesuai routing (default 5 langkah standar bila kosong/invalid) ====
CREATE OR REPLACE FUNCTION public.production_batches_create_steps()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE
  v_routing jsonb := NEW.routing;
  v_item jsonb;
  v_valid boolean := true;
BEGIN
  IF v_routing IS NULL OR jsonb_typeof(v_routing) <> 'array' OR jsonb_array_length(v_routing) = 0 THEN
    v_valid := false;
  ELSE
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_routing) LOOP
      IF NOT (v_item ? 'process' AND v_item ? 'sequence_order')
        OR (v_item->>'process') NOT IN ('laser_cutting','bending','welding_grinding','powder_coating','assembly')
        OR (v_item->>'sequence_order') !~ '^[0-9]+$'
        OR (v_item->>'sequence_order')::int NOT BETWEEN 1 AND 5
      THEN
        v_valid := false;
        EXIT;
      END IF;
    END LOOP;
  END IF;

  IF NOT v_valid THEN
    v_routing := '[{"process":"laser_cutting","sequence_order":1},{"process":"bending","sequence_order":2},{"process":"welding_grinding","sequence_order":3},{"process":"powder_coating","sequence_order":4},{"process":"assembly","sequence_order":5}]'::jsonb;
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_routing) LOOP
    INSERT INTO public.production_batch_steps (production_batch_id, process, sequence_order, status)
    VALUES (
      NEW.id,
      (v_item->>'process')::public.production_process,
      (v_item->>'sequence_order')::smallint,
      'waiting'
    );
  END LOOP;

  RETURN NEW;
END; $$;
