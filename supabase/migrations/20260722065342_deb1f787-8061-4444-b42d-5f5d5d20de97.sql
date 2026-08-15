
-- 1) Add qty_total, photo_urls
ALTER TABLE public.qc_inspections
  ADD COLUMN IF NOT EXISTS qty_total numeric(18,4),
  ADD COLUMN IF NOT EXISTS photo_urls text[] NOT NULL DEFAULT '{}';

-- Backfill qty_total from batch quantity
UPDATE public.qc_inspections q
SET qty_total = pb.quantity
FROM public.production_batches pb
WHERE q.production_batch_id = pb.id AND q.qty_total IS NULL;

ALTER TABLE public.qc_inspections
  ALTER COLUMN qty_total SET NOT NULL,
  ALTER COLUMN qty_total SET DEFAULT 0;

-- Migrate legacy photo_url -> photo_urls
UPDATE public.qc_inspections
SET photo_urls = ARRAY[photo_url]
WHERE photo_url IS NOT NULL
  AND (photo_urls IS NULL OR array_length(photo_urls,1) IS NULL);

ALTER TABLE public.qc_inspections DROP COLUMN IF EXISTS photo_url;

-- Check constraint
ALTER TABLE public.qc_inspections DROP CONSTRAINT IF EXISTS qc_inspections_qty_check;
ALTER TABLE public.qc_inspections
  ADD CONSTRAINT qc_inspections_qty_check
  CHECK (qty_ok >= 0 AND qty_reject >= 0 AND qty_total >= 0 AND (qty_ok + qty_reject) <= qty_total);

-- 2) BEFORE INSERT trigger: enforce all steps completed/skipped
CREATE OR REPLACE FUNCTION public.qc_inspections_validate_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pending int;
  v_total_steps int;
  v_batch_qty numeric;
BEGIN
  SELECT count(*) INTO v_total_steps
  FROM public.production_batch_steps
  WHERE production_batch_id = NEW.production_batch_id;

  IF v_total_steps = 0 THEN
    RAISE EXCEPTION 'Batch produksi belum memiliki tahapan proses';
  END IF;

  SELECT count(*) INTO v_pending
  FROM public.production_batch_steps
  WHERE production_batch_id = NEW.production_batch_id
    AND status NOT IN ('completed','skipped');

  IF v_pending > 0 THEN
    RAISE EXCEPTION 'Batch belum siap diinspeksi: masih ada % tahapan produksi yang belum selesai/dilewati', v_pending;
  END IF;

  -- Default qty_total from batch if not provided or zero
  IF NEW.qty_total IS NULL OR NEW.qty_total = 0 THEN
    SELECT quantity INTO v_batch_qty FROM public.production_batches WHERE id = NEW.production_batch_id;
    NEW.qty_total := COALESCE(v_batch_qty, 0);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.qc_inspections_validate_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_qc_inspections_validate_insert ON public.qc_inspections;
CREATE TRIGGER trg_qc_inspections_validate_insert
BEFORE INSERT ON public.qc_inspections
FOR EACH ROW EXECUTE FUNCTION public.qc_inspections_validate_insert();
