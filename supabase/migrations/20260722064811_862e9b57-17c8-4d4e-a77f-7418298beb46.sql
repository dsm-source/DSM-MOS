
-- 1. Enum
CREATE TYPE public.qc_status AS ENUM ('waiting','inspection','pass','reject','rework');

-- 2. Tabel qc_inspections
CREATE TABLE public.qc_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_batch_id uuid NOT NULL REFERENCES public.production_batches(id) ON DELETE CASCADE,
  status public.qc_status NOT NULL DEFAULT 'waiting',
  qty_ok numeric(18,4) NOT NULL DEFAULT 0 CHECK (qty_ok >= 0),
  qty_reject numeric(18,4) NOT NULL DEFAULT 0 CHECK (qty_reject >= 0),
  defect_notes text,
  photo_url text,
  inspector_id uuid REFERENCES auth.users(id),
  inspected_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_qc_inspections_batch ON public.qc_inspections(production_batch_id);
CREATE INDEX idx_qc_inspections_status ON public.qc_inspections(status);
CREATE INDEX idx_qc_inspections_created_at ON public.qc_inspections(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qc_inspections TO authenticated;
GRANT ALL ON public.qc_inspections TO service_role;

ALTER TABLE public.qc_inspections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qc_read_all_authenticated" ON public.qc_inspections
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "qc_insert_qc_admin" ON public.qc_inspections
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.has_role(auth.uid(),'qc'::public.app_role))
    OR (SELECT public.has_role(auth.uid(),'admin'::public.app_role))
  );

CREATE POLICY "qc_update_qc_admin" ON public.qc_inspections
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.has_role(auth.uid(),'qc'::public.app_role))
    OR (SELECT public.has_role(auth.uid(),'admin'::public.app_role))
  )
  WITH CHECK (
    (SELECT public.has_role(auth.uid(),'qc'::public.app_role))
    OR (SELECT public.has_role(auth.uid(),'admin'::public.app_role))
  );

CREATE POLICY "qc_delete_admin" ON public.qc_inspections
  FOR DELETE TO authenticated
  USING ((SELECT public.has_role(auth.uid(),'admin'::public.app_role)));

CREATE TRIGGER trg_qc_inspections_updated_at
  BEFORE UPDATE ON public.qc_inspections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Validasi transisi status
CREATE OR REPLACE FUNCTION public.qc_inspections_validate_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_allowed boolean := false;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  IF OLD.status = 'pass' THEN
    RAISE EXCEPTION 'Inspeksi sudah Lulus dan tidak bisa diubah';
  END IF;

  IF OLD.status = 'waiting' AND NEW.status = 'inspection' THEN v_allowed := true;
  ELSIF OLD.status = 'inspection' AND NEW.status IN ('pass','reject') THEN v_allowed := true;
  ELSIF OLD.status = 'reject' AND NEW.status = 'rework' THEN v_allowed := true;
  ELSIF OLD.status = 'rework' AND NEW.status = 'inspection' THEN v_allowed := true;
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Transisi status QC tidak diperbolehkan: % → %', OLD.status, NEW.status;
  END IF;

  IF NEW.status = 'inspection' AND NEW.inspector_id IS NULL THEN
    NEW.inspector_id := auth.uid();
  END IF;
  IF NEW.status IN ('pass','reject') AND NEW.inspected_at IS NULL THEN
    NEW.inspected_at := now();
  END IF;

  IF NEW.status IN ('pass','reject') THEN
    IF (NEW.qty_ok + NEW.qty_reject) <= 0 THEN
      RAISE EXCEPTION 'Isi jumlah OK dan/atau jumlah tolak terlebih dahulu';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.qc_inspections_validate_transition() FROM public, anon, authenticated;

CREATE TRIGGER trg_qc_inspections_validate_transition
  BEFORE UPDATE ON public.qc_inspections
  FOR EACH ROW EXECUTE FUNCTION public.qc_inspections_validate_transition();

-- 4. Auto-enqueue saat semua step batch selesai
CREATE OR REPLACE FUNCTION public.production_batch_steps_auto_enqueue_qc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pending int;
  v_touched int;
  v_existing_active int;
BEGIN
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_pending
    FROM public.production_batch_steps
   WHERE production_batch_id = NEW.production_batch_id
     AND status NOT IN ('completed','skipped');
  IF v_pending > 0 THEN RETURN NEW; END IF;

  SELECT count(*) INTO v_touched
    FROM public.production_batch_steps
   WHERE production_batch_id = NEW.production_batch_id
     AND status = 'completed';
  IF v_touched = 0 THEN RETURN NEW; END IF;

  SELECT count(*) INTO v_existing_active
    FROM public.qc_inspections
   WHERE production_batch_id = NEW.production_batch_id
     AND status IN ('waiting','inspection','reject','rework');
  IF v_existing_active > 0 THEN RETURN NEW; END IF;

  INSERT INTO public.qc_inspections (production_batch_id, status)
  VALUES (NEW.production_batch_id, 'waiting');

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.production_batch_steps_auto_enqueue_qc() FROM public, anon, authenticated;

CREATE TRIGGER trg_production_batch_steps_auto_enqueue_qc
  AFTER UPDATE ON public.production_batch_steps
  FOR EACH ROW EXECUTE FUNCTION public.production_batch_steps_auto_enqueue_qc();

-- 5. Notifikasi
CREATE OR REPLACE FUNCTION public.qc_inspections_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_batch_number text;
  v_so_id uuid;
  v_so_number text;
  v_title text;
  v_body text;
  v_status_label text;
BEGIN
  SELECT pb.batch_number, so.id, so.so_number
    INTO v_batch_number, v_so_id, v_so_number
  FROM public.production_batches pb
  JOIN public.engineering_jobs ej ON ej.id = pb.engineering_job_id
  JOIN public.sales_order_items soi ON soi.id = ej.sales_order_item_id
  JOIN public.sales_orders so ON so.id = soi.sales_order_id
  WHERE pb.id = NEW.production_batch_id;

  v_status_label := CASE NEW.status
    WHEN 'waiting' THEN 'Menunggu Inspeksi'
    WHEN 'inspection' THEN 'Sedang Diinspeksi'
    WHEN 'pass' THEN 'Lulus QC'
    WHEN 'reject' THEN 'Ditolak QC'
    WHEN 'rework' THEN 'Perlu Rework'
  END;

  IF TG_OP = 'INSERT' THEN
    v_title := 'QC: batch ' || COALESCE(v_batch_number,'?') || ' masuk antrian';
    v_body  := 'SO ' || COALESCE(v_so_number,'?') || ' siap diinspeksi.';
  ELSE
    IF NEW.status = OLD.status THEN RETURN NEW; END IF;
    v_title := 'QC ' || COALESCE(v_batch_number,'?') || ' → ' || v_status_label;
    v_body  := 'SO ' || COALESCE(v_so_number,'?') || ' status QC diperbarui.';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, body, link_path, metadata)
  SELECT DISTINCT ur.user_id,
                  'so_status_changed'::public.notification_type,
                  v_title,
                  v_body,
                  '/qc',
                  jsonb_build_object(
                    'qc_inspection_id', NEW.id,
                    'production_batch_id', NEW.production_batch_id,
                    'batch_number', v_batch_number,
                    'sales_order_id', v_so_id,
                    'so_number', v_so_number,
                    'status', NEW.status
                  )
  FROM public.user_roles ur
  WHERE ur.role IN ('qc'::public.app_role,'admin'::public.app_role)
    AND (v_actor IS NULL OR ur.user_id <> v_actor);

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.qc_inspections_notify() FROM public, anon, authenticated;

CREATE TRIGGER trg_qc_inspections_notify_insert
  AFTER INSERT ON public.qc_inspections
  FOR EACH ROW EXECUTE FUNCTION public.qc_inspections_notify();

CREATE TRIGGER trg_qc_inspections_notify_update
  AFTER UPDATE ON public.qc_inspections
  FOR EACH ROW EXECUTE FUNCTION public.qc_inspections_notify();

-- 6. Audit
CREATE TRIGGER trg_qc_inspections_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.qc_inspections
  FOR EACH ROW EXECUTE FUNCTION public.log_audit('status');

-- 7. Storage policies untuk bucket qc-photos
CREATE POLICY "qc_photos_read_authenticated" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'qc-photos');

CREATE POLICY "qc_photos_write_qc_admin" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'qc-photos'
    AND (
      (SELECT public.has_role(auth.uid(),'qc'::public.app_role))
      OR (SELECT public.has_role(auth.uid(),'admin'::public.app_role))
    )
  );

CREATE POLICY "qc_photos_update_qc_admin" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'qc-photos'
    AND (
      (SELECT public.has_role(auth.uid(),'qc'::public.app_role))
      OR (SELECT public.has_role(auth.uid(),'admin'::public.app_role))
    )
  );

CREATE POLICY "qc_photos_delete_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'qc-photos'
    AND (SELECT public.has_role(auth.uid(),'admin'::public.app_role))
  );
