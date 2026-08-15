
-- ============================================================
-- ENUM
-- ============================================================
CREATE TYPE public.sales_order_status AS ENUM (
  'draft','confirmed','engineering','production',
  'quality_control','delivery','completed','cancelled'
);

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  contact_person text,
  phone text,
  address text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  CONSTRAINT customers_code_len CHECK (char_length(code) BETWEEN 1 AND 32),
  CONSTRAINT customers_name_len CHECK (char_length(name) BETWEEN 1 AND 120)
);
CREATE INDEX idx_customers_name ON public.customers (name);
CREATE INDEX idx_customers_code ON public.customers (code);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Policies: semua peran login bisa SELECT
CREATE POLICY customers_select_any_role ON public.customers FOR SELECT TO authenticated
USING (
  (SELECT public.has_role(auth.uid(),'admin'))
  OR (SELECT public.has_role(auth.uid(),'sales'))
  OR (SELECT public.has_role(auth.uid(),'engineering'))
  OR (SELECT public.has_role(auth.uid(),'material'))
  OR (SELECT public.has_role(auth.uid(),'production_planning'))
  OR (SELECT public.has_role(auth.uid(),'production'))
  OR (SELECT public.has_role(auth.uid(),'qc'))
  OR (SELECT public.has_role(auth.uid(),'delivery'))
  OR (SELECT public.has_role(auth.uid(),'viewer'))
);

CREATE POLICY customers_insert_sales_admin ON public.customers FOR INSERT TO authenticated
WITH CHECK ((SELECT public.has_role(auth.uid(),'admin')) OR (SELECT public.has_role(auth.uid(),'sales')));

CREATE POLICY customers_update_sales_admin ON public.customers FOR UPDATE TO authenticated
USING ((SELECT public.has_role(auth.uid(),'admin')) OR (SELECT public.has_role(auth.uid(),'sales')))
WITH CHECK ((SELECT public.has_role(auth.uid(),'admin')) OR (SELECT public.has_role(auth.uid(),'sales')));

CREATE POLICY customers_delete_sales_admin ON public.customers FOR DELETE TO authenticated
USING ((SELECT public.has_role(auth.uid(),'admin')) OR (SELECT public.has_role(auth.uid(),'sales')));

-- ============================================================
-- SALES ORDER NUMBER SEQUENCE + GENERATOR
-- ============================================================
CREATE SEQUENCE public.sales_order_number_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_so_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_next bigint;
BEGIN
  v_next := nextval('public.sales_order_number_seq');
  RETURN 'SO-' || to_char(now() AT TIME ZONE 'UTC', 'YYYY') || '-' || lpad(v_next::text, 6, '0');
END;
$$;

-- ============================================================
-- SALES ORDERS
-- ============================================================
CREATE TABLE public.sales_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  so_number text NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  order_date date NOT NULL DEFAULT current_date,
  due_date date,
  status public.sales_order_status NOT NULL DEFAULT 'draft',
  notes text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  CONSTRAINT sales_orders_due_after_order CHECK (due_date IS NULL OR due_date >= order_date)
);
CREATE INDEX idx_sales_orders_status ON public.sales_orders (status);
CREATE INDEX idx_sales_orders_customer ON public.sales_orders (customer_id);
CREATE INDEX idx_sales_orders_created_at ON public.sales_orders (created_at DESC);
CREATE INDEX idx_sales_orders_so_number ON public.sales_orders (so_number);
CREATE INDEX idx_sales_orders_deleted_at ON public.sales_orders (deleted_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_orders TO authenticated;
GRANT ALL ON public.sales_orders TO service_role;
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_sales_orders_updated_at
  BEFORE UPDATE ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: auto-generate so_number bila kosong
CREATE OR REPLACE FUNCTION public.sales_orders_set_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.so_number IS NULL OR NEW.so_number = '' THEN
    NEW.so_number := public.generate_so_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sales_orders_set_number
  BEFORE INSERT ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.sales_orders_set_number();

-- Trigger: validasi transisi status
CREATE OR REPLACE FUNCTION public.sales_orders_validate_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_item_count int;
  v_allowed boolean := false;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- Terminal states tidak bisa berubah
  IF OLD.status IN ('completed','cancelled') THEN
    RAISE EXCEPTION 'Status % adalah status akhir dan tidak dapat diubah', OLD.status;
  END IF;

  -- Semua status non-terminal boleh dibatalkan
  IF NEW.status = 'cancelled' THEN
    v_allowed := true;
  ELSIF OLD.status = 'draft' AND NEW.status = 'confirmed' THEN
    v_allowed := true;
  ELSIF OLD.status = 'confirmed' AND NEW.status = 'engineering' THEN
    v_allowed := true;
  ELSIF OLD.status = 'engineering' AND NEW.status = 'production' THEN
    v_allowed := true;
  ELSIF OLD.status = 'production' AND NEW.status = 'quality_control' THEN
    v_allowed := true;
  ELSIF OLD.status = 'quality_control' AND NEW.status = 'delivery' THEN
    v_allowed := true;
  ELSIF OLD.status = 'delivery' AND NEW.status = 'completed' THEN
    v_allowed := true;
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Transisi status tidak diperbolehkan: % → %', OLD.status, NEW.status;
  END IF;

  -- Konfirmasi wajib punya item
  IF NEW.status = 'confirmed' THEN
    SELECT count(*) INTO v_item_count
      FROM public.sales_order_items WHERE sales_order_id = NEW.id;
    IF v_item_count = 0 THEN
      RAISE EXCEPTION 'Sales Order tidak bisa dikonfirmasi tanpa item';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger dipasang setelah tabel items dibuat (di bawah)

-- Policies
CREATE POLICY sales_orders_select_any_role ON public.sales_orders FOR SELECT TO authenticated
USING (
  deleted_at IS NULL AND (
    (SELECT public.has_role(auth.uid(),'admin'))
    OR (SELECT public.has_role(auth.uid(),'sales'))
    OR (SELECT public.has_role(auth.uid(),'engineering'))
    OR (SELECT public.has_role(auth.uid(),'material'))
    OR (SELECT public.has_role(auth.uid(),'production_planning'))
    OR (SELECT public.has_role(auth.uid(),'production'))
    OR (SELECT public.has_role(auth.uid(),'qc'))
    OR (SELECT public.has_role(auth.uid(),'delivery'))
    OR (SELECT public.has_role(auth.uid(),'viewer'))
  )
);

CREATE POLICY sales_orders_insert_sales_admin ON public.sales_orders FOR INSERT TO authenticated
WITH CHECK ((SELECT public.has_role(auth.uid(),'admin')) OR (SELECT public.has_role(auth.uid(),'sales')));

CREATE POLICY sales_orders_update_sales_admin ON public.sales_orders FOR UPDATE TO authenticated
USING ((SELECT public.has_role(auth.uid(),'admin')) OR (SELECT public.has_role(auth.uid(),'sales')))
WITH CHECK ((SELECT public.has_role(auth.uid(),'admin')) OR (SELECT public.has_role(auth.uid(),'sales')));

CREATE POLICY sales_orders_delete_sales_admin ON public.sales_orders FOR DELETE TO authenticated
USING ((SELECT public.has_role(auth.uid(),'admin')) OR (SELECT public.has_role(auth.uid(),'sales')));

-- ============================================================
-- SALES ORDER ITEMS
-- ============================================================
CREATE TABLE public.sales_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  drawing_number text,
  quantity numeric(18,4) NOT NULL,
  unit text NOT NULL DEFAULT 'pcs',
  material_spec text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  CONSTRAINT sales_order_items_qty_positive CHECK (quantity > 0),
  CONSTRAINT sales_order_items_item_name_len CHECK (char_length(item_name) BETWEEN 1 AND 200),
  CONSTRAINT sales_order_items_unit_len CHECK (char_length(unit) BETWEEN 1 AND 20)
);
CREATE INDEX idx_sales_order_items_so ON public.sales_order_items (sales_order_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_order_items TO authenticated;
GRANT ALL ON public.sales_order_items TO service_role;
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_sales_order_items_updated_at
  BEFORE UPDATE ON public.sales_order_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY sales_order_items_select_any_role ON public.sales_order_items FOR SELECT TO authenticated
USING (
  (SELECT public.has_role(auth.uid(),'admin'))
  OR (SELECT public.has_role(auth.uid(),'sales'))
  OR (SELECT public.has_role(auth.uid(),'engineering'))
  OR (SELECT public.has_role(auth.uid(),'material'))
  OR (SELECT public.has_role(auth.uid(),'production_planning'))
  OR (SELECT public.has_role(auth.uid(),'production'))
  OR (SELECT public.has_role(auth.uid(),'qc'))
  OR (SELECT public.has_role(auth.uid(),'delivery'))
  OR (SELECT public.has_role(auth.uid(),'viewer'))
);

CREATE POLICY sales_order_items_insert_sales_admin ON public.sales_order_items FOR INSERT TO authenticated
WITH CHECK ((SELECT public.has_role(auth.uid(),'admin')) OR (SELECT public.has_role(auth.uid(),'sales')));

CREATE POLICY sales_order_items_update_sales_admin ON public.sales_order_items FOR UPDATE TO authenticated
USING ((SELECT public.has_role(auth.uid(),'admin')) OR (SELECT public.has_role(auth.uid(),'sales')))
WITH CHECK ((SELECT public.has_role(auth.uid(),'admin')) OR (SELECT public.has_role(auth.uid(),'sales')));

CREATE POLICY sales_order_items_delete_sales_admin ON public.sales_order_items FOR DELETE TO authenticated
USING ((SELECT public.has_role(auth.uid(),'admin')) OR (SELECT public.has_role(auth.uid(),'sales')));

-- Sekarang tabel items sudah ada → pasang trigger transition
CREATE TRIGGER trg_sales_orders_validate_transition
  BEFORE UPDATE OF status ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.sales_orders_validate_transition();
