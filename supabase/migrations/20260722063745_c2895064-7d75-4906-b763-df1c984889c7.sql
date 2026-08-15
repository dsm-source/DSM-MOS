
-- ============ AUDIT LOGS ============
CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name text NOT NULL,
  record_id uuid,
  action text NOT NULL,
  old_status text,
  new_status text,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb
);

CREATE INDEX idx_audit_logs_table_record ON public.audit_logs (table_name, record_id);
CREATE INDEX idx_audit_logs_changed_at ON public.audit_logs (changed_at DESC);
CREATE INDEX idx_audit_logs_changed_by ON public.audit_logs (changed_by);

-- Only admins can read; no INSERT/UPDATE/DELETE policy at all (SECURITY DEFINER trigger bypasses RLS).
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit logs"
  ON public.audit_logs FOR SELECT
  TO authenticated
  USING ((SELECT public.has_role(auth.uid(), 'admin'::public.app_role)));

-- ============ AUDIT TRIGGER FUNCTION ============
CREATE OR REPLACE FUNCTION public.log_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_status_col text := TG_ARGV[0];
  v_old jsonb;
  v_new jsonb;
  v_record_id uuid;
  v_old_status text;
  v_new_status text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_record_id := (v_old->>'id')::uuid;
    IF v_status_col IS NOT NULL AND v_status_col <> '' THEN
      v_old_status := v_old->>v_status_col;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW);
    v_record_id := (v_new->>'id')::uuid;
    IF v_status_col IS NOT NULL AND v_status_col <> '' THEN
      v_new_status := v_new->>v_status_col;
    END IF;
  ELSE -- UPDATE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_record_id := (v_new->>'id')::uuid;
    IF v_status_col IS NOT NULL AND v_status_col <> '' THEN
      v_old_status := v_old->>v_status_col;
      v_new_status := v_new->>v_status_col;
      -- Only log when status actually changes to keep audit log clean.
      IF v_old_status IS NOT DISTINCT FROM v_new_status THEN
        RETURN NEW;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.audit_logs (table_name, record_id, action, old_status, new_status, changed_by, metadata)
  VALUES (
    TG_TABLE_NAME,
    v_record_id,
    TG_OP,
    v_old_status,
    v_new_status,
    auth.uid(),
    jsonb_build_object('old', v_old, 'new', v_new)
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.log_audit() FROM PUBLIC, anon, authenticated;

-- ============ ATTACH TRIGGERS ============
-- Tables with status column: only log when status changes on UPDATE, always on INSERT/DELETE.
CREATE TRIGGER trg_audit_sales_orders
  AFTER INSERT OR UPDATE OR DELETE ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.log_audit('status');

CREATE TRIGGER trg_audit_engineering_jobs
  AFTER INSERT OR UPDATE OR DELETE ON public.engineering_jobs
  FOR EACH ROW EXECUTE FUNCTION public.log_audit('status');

CREATE TRIGGER trg_audit_material_statuses
  AFTER INSERT OR UPDATE OR DELETE ON public.material_statuses
  FOR EACH ROW EXECUTE FUNCTION public.log_audit('status');

CREATE TRIGGER trg_audit_production_batch_steps
  AFTER INSERT OR UPDATE OR DELETE ON public.production_batch_steps
  FOR EACH ROW EXECUTE FUNCTION public.log_audit('status');

-- Tables without a status column: log INSERT/DELETE only (skip UPDATE spam).
CREATE TRIGGER trg_audit_customers_ins_del
  AFTER INSERT OR DELETE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.log_audit('');

CREATE TRIGGER trg_audit_sales_order_items_ins_del
  AFTER INSERT OR DELETE ON public.sales_order_items
  FOR EACH ROW EXECUTE FUNCTION public.log_audit('');

CREATE TRIGGER trg_audit_sales_order_assignments_ins_del
  AFTER INSERT OR DELETE ON public.sales_order_assignments
  FOR EACH ROW EXECUTE FUNCTION public.log_audit('');

CREATE TRIGGER trg_audit_production_batches_ins_del
  AFTER INSERT OR DELETE ON public.production_batches
  FOR EACH ROW EXECUTE FUNCTION public.log_audit('');

-- ============ DASHBOARD VIEWS ============
-- security_invoker=true → views run under the caller's privileges and respect the underlying RLS.

CREATE OR REPLACE VIEW public.v_dashboard_so_status
  WITH (security_invoker=true) AS
SELECT status::text AS status, count(*)::bigint AS count
FROM public.sales_orders
WHERE deleted_at IS NULL
GROUP BY status;

CREATE OR REPLACE VIEW public.v_dashboard_material_waiting
  WITH (security_invoker=true) AS
SELECT count(*)::bigint AS count
FROM public.material_statuses
WHERE status = 'waiting_material'::public.material_status;

CREATE OR REPLACE VIEW public.v_dashboard_production_running
  WITH (security_invoker=true) AS
SELECT count(*)::bigint AS count
FROM public.production_batch_steps
WHERE status = 'running'::public.production_step_status;

GRANT SELECT ON public.v_dashboard_so_status TO authenticated;
GRANT SELECT ON public.v_dashboard_material_waiting TO authenticated;
GRANT SELECT ON public.v_dashboard_production_running TO authenticated;
