
-- 1. Enum notification type
CREATE TYPE public.notification_type AS ENUM ('so_status_changed');

-- 2. Sales Order Assignments (Opsi A: per role per SO)
CREATE TABLE public.sales_order_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE (sales_order_id, role)
);

CREATE INDEX idx_soa_so ON public.sales_order_assignments(sales_order_id);
CREATE INDEX idx_soa_user ON public.sales_order_assignments(user_id);
CREATE INDEX idx_soa_role ON public.sales_order_assignments(role);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_order_assignments TO authenticated;
GRANT ALL ON public.sales_order_assignments TO service_role;

ALTER TABLE public.sales_order_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "soa_select_authenticated" ON public.sales_order_assignments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "soa_insert_sales_admin" ON public.sales_order_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.has_role(auth.uid(), 'sales'::public.app_role))
    OR (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
  );

CREATE POLICY "soa_update_sales_admin" ON public.sales_order_assignments
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.has_role(auth.uid(), 'sales'::public.app_role))
    OR (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
  );

CREATE POLICY "soa_delete_sales_admin" ON public.sales_order_assignments
  FOR DELETE TO authenticated
  USING (
    (SELECT public.has_role(auth.uid(), 'sales'::public.app_role))
    OR (SELECT public.has_role(auth.uid(), 'admin'::public.app_role))
  );

CREATE TRIGGER trg_soa_updated_at BEFORE UPDATE ON public.sales_order_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. Sales Order Status History
CREATE TABLE public.sales_order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  from_status public.sales_order_status,
  to_status public.sales_order_status NOT NULL,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_sosh_so ON public.sales_order_status_history(sales_order_id, changed_at DESC);

GRANT SELECT ON public.sales_order_status_history TO authenticated;
GRANT ALL ON public.sales_order_status_history TO service_role;

ALTER TABLE public.sales_order_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sosh_select_authenticated" ON public.sales_order_status_history
  FOR SELECT TO authenticated USING (true);
-- No insert/update/delete policies: only trigger (SECURITY DEFINER) writes.

-- 4. Notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.notification_type NOT NULL,
  title text NOT NULL,
  body text,
  link_path text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notif_user_unread ON public.notifications(user_id, read_at, created_at DESC);
CREATE INDEX idx_notif_user_created ON public.notifications(user_id, created_at DESC);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_select_own" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notif_update_own" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
-- No INSERT / DELETE policies: only trigger writes; user tidak menghapus.

-- 5. Trigger function: on SO status change → history + notifications
CREATE OR REPLACE FUNCTION public.sales_orders_notify_on_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_roles public.app_role[];
  v_title text;
  v_link text;
  v_status_label text;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- Audit history
  INSERT INTO public.sales_order_status_history (sales_order_id, from_status, to_status, changed_by)
  VALUES (NEW.id, OLD.status, NEW.status, v_actor);

  -- Roles to notify based on new status
  v_roles := CASE NEW.status
    WHEN 'confirmed'       THEN ARRAY['engineering','material','production_planning']::public.app_role[]
    WHEN 'engineering'     THEN ARRAY['engineering']::public.app_role[]
    WHEN 'production'      THEN ARRAY['production_planning','production']::public.app_role[]
    WHEN 'quality_control' THEN ARRAY['qc']::public.app_role[]
    WHEN 'delivery'        THEN ARRAY['delivery']::public.app_role[]
    WHEN 'completed'       THEN ARRAY[]::public.app_role[]
    WHEN 'cancelled'       THEN ARRAY['engineering','material','production_planning','production','qc','delivery']::public.app_role[]
    ELSE ARRAY[]::public.app_role[]
  END;

  v_status_label := replace(NEW.status::text, '_', ' ');
  v_title := 'SO ' || NEW.so_number || ' → ' || v_status_label;
  v_link  := '/sales-orders/' || NEW.id::text;

  -- Insert notifications for: assigned users of relevant roles + all admins + SO creator (sales).
  -- Exclude the actor. Deduplicate.
  INSERT INTO public.notifications (user_id, type, title, body, link_path, metadata)
  SELECT DISTINCT u.user_id,
                  'so_status_changed'::public.notification_type,
                  v_title,
                  'Status berubah dari ' || COALESCE(replace(OLD.status::text,'_',' '),'-')
                    || ' menjadi ' || v_status_label,
                  v_link,
                  jsonb_build_object(
                    'sales_order_id', NEW.id,
                    'so_number', NEW.so_number,
                    'from_status', OLD.status,
                    'to_status', NEW.status
                  )
  FROM (
    -- Assigned users for the relevant roles
    SELECT a.user_id
    FROM public.sales_order_assignments a
    WHERE a.sales_order_id = NEW.id
      AND a.role = ANY(v_roles)

    UNION

    -- All admins
    SELECT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role = 'admin'::public.app_role

    UNION

    -- Creator of the SO (sales)
    SELECT NEW.created_by WHERE NEW.created_by IS NOT NULL
  ) u
  WHERE u.user_id IS NOT NULL
    AND (v_actor IS NULL OR u.user_id <> v_actor);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sales_orders_notify_status
  AFTER UPDATE OF status ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.sales_orders_notify_on_status_change();

-- 6. Realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
