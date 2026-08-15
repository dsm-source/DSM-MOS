
-- 1) Enum
DO $$ BEGIN
  CREATE TYPE public.delivery_status AS ENUM ('draft','prepared','shipped','delivered');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Sequence + generator for internal reference code
CREATE SEQUENCE IF NOT EXISTS public.delivery_number_seq;

CREATE OR REPLACE FUNCTION public.generate_do_number()
RETURNS text
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE v_next bigint;
BEGIN
  v_next := nextval('public.delivery_number_seq');
  RETURN 'DLV-' || to_char(now() AT TIME ZONE 'UTC', 'YYYY') || '-' || lpad(v_next::text, 6, '0');
END; $$;
REVOKE EXECUTE ON FUNCTION public.generate_do_number() FROM PUBLIC, anon, authenticated;

-- 3) Tables
CREATE TABLE IF NOT EXISTS public.deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  do_number text UNIQUE NOT NULL,
  sales_order_id uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE RESTRICT,
  status public.delivery_status NOT NULL DEFAULT 'draft',
  planned_ship_date date,
  planned_delivery_date date,
  prepared_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  driver_name text,
  vehicle_number text,
  received_by text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deliveries_dates_check CHECK (
    planned_delivery_date IS NULL
    OR planned_ship_date IS NULL
    OR planned_delivery_date >= planned_ship_date
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deliveries TO authenticated;
GRANT ALL ON public.deliveries TO service_role;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_deliveries_so ON public.deliveries(sales_order_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON public.deliveries(status);
CREATE INDEX IF NOT EXISTS idx_deliveries_planned_ship ON public.deliveries(planned_ship_date);
CREATE INDEX IF NOT EXISTS idx_deliveries_created_at ON public.deliveries(created_at DESC);

CREATE TABLE IF NOT EXISTS public.delivery_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id uuid NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  qc_inspection_id uuid NOT NULL REFERENCES public.qc_inspections(id) ON DELETE RESTRICT,
  quantity numeric(18,4) NOT NULL CHECK (quantity > 0),
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (delivery_id, qc_inspection_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.delivery_items TO authenticated;
GRANT ALL ON public.delivery_items TO service_role;
ALTER TABLE public.delivery_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_delivery_items_delivery ON public.delivery_items(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_items_qc ON public.delivery_items(qc_inspection_id);

-- 4) updated_at trigger
DROP TRIGGER IF EXISTS trg_deliveries_updated_at ON public.deliveries;
CREATE TRIGGER trg_deliveries_updated_at BEFORE UPDATE ON public.deliveries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_delivery_items_updated_at ON public.delivery_items;
CREATE TRIGGER trg_delivery_items_updated_at BEFORE UPDATE ON public.delivery_items
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5) Auto set do_number & created_by
CREATE OR REPLACE FUNCTION public.deliveries_set_defaults()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.do_number IS NULL OR NEW.do_number = '' THEN
    NEW.do_number := public.generate_do_number();
  END IF;
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.deliveries_set_defaults() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_deliveries_set_defaults ON public.deliveries;
CREATE TRIGGER trg_deliveries_set_defaults BEFORE INSERT ON public.deliveries
FOR EACH ROW EXECUTE FUNCTION public.deliveries_set_defaults();

-- 6) Validate transition + auto timestamps + auto-complete SO
CREATE OR REPLACE FUNCTION public.deliveries_validate_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_allowed boolean := false;
  v_item_count int;
  v_shipped_qty numeric;
  v_needed_qty numeric;
BEGIN
  IF NEW.status = OLD.status THEN RETURN NEW; END IF;

  IF OLD.status = 'delivered' THEN
    RAISE EXCEPTION 'Pengiriman sudah Terkirim dan tidak dapat diubah';
  END IF;

  IF OLD.status = 'draft' AND NEW.status = 'prepared' THEN v_allowed := true;
  ELSIF OLD.status = 'prepared' AND NEW.status = 'shipped' THEN v_allowed := true;
  ELSIF OLD.status = 'shipped' AND NEW.status = 'delivered' THEN v_allowed := true;
  ELSIF OLD.status = 'prepared' AND NEW.status = 'draft' THEN v_allowed := true;
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Transisi status pengiriman tidak diperbolehkan: % → %', OLD.status, NEW.status;
  END IF;

  IF NEW.status = 'prepared' THEN
    IF NEW.planned_ship_date IS NULL OR NEW.planned_delivery_date IS NULL THEN
      RAISE EXCEPTION 'Set jadwal pengiriman terlebih dahulu.';
    END IF;
    SELECT count(*) INTO v_item_count FROM public.delivery_items WHERE delivery_id = NEW.id;
    IF v_item_count = 0 THEN
      RAISE EXCEPTION 'Pengiriman belum memiliki item.';
    END IF;
    IF NEW.prepared_at IS NULL THEN NEW.prepared_at := now(); END IF;
  END IF;

  IF NEW.status = 'shipped' AND NEW.shipped_at IS NULL THEN NEW.shipped_at := now(); END IF;

  IF NEW.status = 'delivered' AND NEW.delivered_at IS NULL THEN NEW.delivered_at := now(); END IF;

  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.deliveries_validate_transition() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_deliveries_validate_transition ON public.deliveries;
CREATE TRIGGER trg_deliveries_validate_transition BEFORE UPDATE ON public.deliveries
FOR EACH ROW EXECUTE FUNCTION public.deliveries_validate_transition();

-- 7) After delivered: auto-complete SO when all shipped
CREATE OR REPLACE FUNCTION public.deliveries_after_delivered()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_so_id uuid;
  v_needed numeric;
  v_shipped numeric;
BEGIN
  IF NEW.status <> 'delivered' OR OLD.status = 'delivered' THEN
    RETURN NEW;
  END IF;

  v_so_id := NEW.sales_order_id;

  SELECT COALESCE(sum(quantity),0) INTO v_needed
  FROM public.sales_order_items WHERE sales_order_id = v_so_id;

  SELECT COALESCE(sum(di.quantity),0) INTO v_shipped
  FROM public.delivery_items di
  JOIN public.deliveries d ON d.id = di.delivery_id
  WHERE d.sales_order_id = v_so_id AND d.status = 'delivered';

  IF v_needed > 0 AND v_shipped >= v_needed THEN
    UPDATE public.sales_orders SET status = 'completed'
    WHERE id = v_so_id AND status NOT IN ('completed','cancelled');
  END IF;

  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.deliveries_after_delivered() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_deliveries_after_delivered ON public.deliveries;
CREATE TRIGGER trg_deliveries_after_delivered AFTER UPDATE ON public.deliveries
FOR EACH ROW EXECUTE FUNCTION public.deliveries_after_delivered();

-- 8) Validate delivery_items: QC must be pass AND belong to same SO AND parent not delivered
CREATE OR REPLACE FUNCTION public.delivery_items_validate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_qc_status public.qc_status;
  v_qc_so uuid;
  v_del_so uuid;
  v_del_status public.delivery_status;
BEGIN
  SELECT status INTO v_del_status FROM public.deliveries WHERE id = NEW.delivery_id;
  IF v_del_status IN ('shipped','delivered') THEN
    RAISE EXCEPTION 'Tidak bisa mengubah item pada pengiriman yang sudah dikirim.';
  END IF;

  SELECT qi.status,
         so.id
    INTO v_qc_status, v_qc_so
  FROM public.qc_inspections qi
  JOIN public.production_batches pb ON pb.id = qi.production_batch_id
  JOIN public.engineering_jobs ej ON ej.id = pb.engineering_job_id
  JOIN public.sales_order_items soi ON soi.id = ej.sales_order_item_id
  JOIN public.sales_orders so ON so.id = soi.sales_order_id
  WHERE qi.id = NEW.qc_inspection_id;

  IF v_qc_status IS NULL THEN
    RAISE EXCEPTION 'Inspeksi QC tidak ditemukan.';
  END IF;

  IF v_qc_status <> 'pass' THEN
    RAISE EXCEPTION 'Hanya item yang sudah Lulus QC yang bisa masuk pengiriman.';
  END IF;

  SELECT sales_order_id INTO v_del_so FROM public.deliveries WHERE id = NEW.delivery_id;
  IF v_qc_so <> v_del_so THEN
    RAISE EXCEPTION 'Item ini bukan milik Sales Order pengiriman terkait.';
  END IF;

  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.delivery_items_validate() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_delivery_items_validate ON public.delivery_items;
CREATE TRIGGER trg_delivery_items_validate BEFORE INSERT OR UPDATE ON public.delivery_items
FOR EACH ROW EXECUTE FUNCTION public.delivery_items_validate();

-- 9) RLS policies
DROP POLICY IF EXISTS "deliveries_select_all" ON public.deliveries;
CREATE POLICY "deliveries_select_all" ON public.deliveries FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "deliveries_insert_delivery_admin" ON public.deliveries;
CREATE POLICY "deliveries_insert_delivery_admin" ON public.deliveries FOR INSERT TO authenticated
WITH CHECK ((select public.has_role(auth.uid(),'delivery'::public.app_role)) OR (select public.has_role(auth.uid(),'admin'::public.app_role)));

DROP POLICY IF EXISTS "deliveries_update_delivery_admin" ON public.deliveries;
CREATE POLICY "deliveries_update_delivery_admin" ON public.deliveries FOR UPDATE TO authenticated
USING ((select public.has_role(auth.uid(),'delivery'::public.app_role)) OR (select public.has_role(auth.uid(),'admin'::public.app_role)))
WITH CHECK ((select public.has_role(auth.uid(),'delivery'::public.app_role)) OR (select public.has_role(auth.uid(),'admin'::public.app_role)));

DROP POLICY IF EXISTS "deliveries_delete_admin" ON public.deliveries;
CREATE POLICY "deliveries_delete_admin" ON public.deliveries FOR DELETE TO authenticated
USING ((select public.has_role(auth.uid(),'admin'::public.app_role)));

DROP POLICY IF EXISTS "delivery_items_select_all" ON public.delivery_items;
CREATE POLICY "delivery_items_select_all" ON public.delivery_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "delivery_items_insert_delivery_admin" ON public.delivery_items;
CREATE POLICY "delivery_items_insert_delivery_admin" ON public.delivery_items FOR INSERT TO authenticated
WITH CHECK ((select public.has_role(auth.uid(),'delivery'::public.app_role)) OR (select public.has_role(auth.uid(),'admin'::public.app_role)));

DROP POLICY IF EXISTS "delivery_items_update_delivery_admin" ON public.delivery_items;
CREATE POLICY "delivery_items_update_delivery_admin" ON public.delivery_items FOR UPDATE TO authenticated
USING ((select public.has_role(auth.uid(),'delivery'::public.app_role)) OR (select public.has_role(auth.uid(),'admin'::public.app_role)))
WITH CHECK ((select public.has_role(auth.uid(),'delivery'::public.app_role)) OR (select public.has_role(auth.uid(),'admin'::public.app_role)));

DROP POLICY IF EXISTS "delivery_items_delete_delivery_admin" ON public.delivery_items;
CREATE POLICY "delivery_items_delete_delivery_admin" ON public.delivery_items FOR DELETE TO authenticated
USING ((select public.has_role(auth.uid(),'delivery'::public.app_role)) OR (select public.has_role(auth.uid(),'admin'::public.app_role)));

-- 10) Audit log triggers
DROP TRIGGER IF EXISTS trg_deliveries_audit ON public.deliveries;
CREATE TRIGGER trg_deliveries_audit AFTER INSERT OR UPDATE OR DELETE ON public.deliveries
FOR EACH ROW EXECUTE FUNCTION public.log_audit('status');

DROP TRIGGER IF EXISTS trg_delivery_items_audit ON public.delivery_items;
CREATE TRIGGER trg_delivery_items_audit AFTER INSERT OR UPDATE OR DELETE ON public.delivery_items
FOR EACH ROW EXECUTE FUNCTION public.log_audit('');

-- 11) Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.deliveries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_items;
