
-- Helper: check any of a set of roles
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles public.app_role[])
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = ANY(_roles)
  )
$$;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, public.app_role[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_any_role(uuid, public.app_role[]) TO authenticated, service_role;

-- deliveries
DROP POLICY IF EXISTS deliveries_select_all ON public.deliveries;
CREATE POLICY deliveries_select_scoped ON public.deliveries
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','sales','delivery','production_planning']::public.app_role[]));

-- delivery_items
DROP POLICY IF EXISTS delivery_items_select_all ON public.delivery_items;
CREATE POLICY delivery_items_select_scoped ON public.delivery_items
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','sales','delivery','production_planning']::public.app_role[]));

-- engineering_jobs
DROP POLICY IF EXISTS eng_jobs_select_all_auth ON public.engineering_jobs;
CREATE POLICY eng_jobs_select_scoped ON public.engineering_jobs
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','engineering','sales','production_planning','material','production','qc']::public.app_role[]));

-- engineering_job_history
DROP POLICY IF EXISTS "Authenticated can read engineering job history" ON public.engineering_job_history;
CREATE POLICY eng_job_history_select_scoped ON public.engineering_job_history
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','engineering','sales','production_planning','material','production','qc']::public.app_role[]));

-- material_statuses
DROP POLICY IF EXISTS material_statuses_select_all_auth ON public.material_statuses;
CREATE POLICY material_statuses_select_scoped ON public.material_statuses
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','material','engineering','production_planning','production','sales']::public.app_role[]));

-- production_batches
DROP POLICY IF EXISTS production_batches_select_all_auth ON public.production_batches;
CREATE POLICY production_batches_select_scoped ON public.production_batches
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','production','production_planning','qc','engineering','material','sales','delivery']::public.app_role[]));

-- production_batch_steps
DROP POLICY IF EXISTS pbs_select_all_auth ON public.production_batch_steps;
CREATE POLICY pbs_select_scoped ON public.production_batch_steps
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','production','production_planning','qc','engineering','material','sales','delivery']::public.app_role[]));

-- qc_inspections
DROP POLICY IF EXISTS qc_read_all_authenticated ON public.qc_inspections;
CREATE POLICY qc_select_scoped ON public.qc_inspections
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','qc','production','production_planning','delivery','sales','engineering']::public.app_role[]));

-- sales_order_assignments
DROP POLICY IF EXISTS soa_select_authenticated ON public.sales_order_assignments;
CREATE POLICY soa_select_scoped ON public.sales_order_assignments
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_any_role(auth.uid(), ARRAY['admin','sales']::public.app_role[])
  );

-- sales_order_status_history
DROP POLICY IF EXISTS sosh_select_authenticated ON public.sales_order_status_history;
CREATE POLICY sosh_select_scoped ON public.sales_order_status_history
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','sales','engineering','material','production_planning','production','qc','delivery']::public.app_role[]));

-- Storage: engineering-drawings read scoped by role
DROP POLICY IF EXISTS eng_drawings_read_auth ON storage.objects;
CREATE POLICY eng_drawings_read_scoped ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'engineering-drawings'
    AND public.has_any_role(auth.uid(), ARRAY['admin','engineering','production_planning','production','sales','material','qc']::public.app_role[])
  );

-- Storage: qc-photos read scoped by role
DROP POLICY IF EXISTS qc_photos_read_authenticated ON storage.objects;
CREATE POLICY qc_photos_read_scoped ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'qc-photos'
    AND public.has_any_role(auth.uid(), ARRAY['admin','qc','production','production_planning','delivery','sales','engineering']::public.app_role[])
  );

-- Revoke execute on get_engineer_emails from authenticated; server function now uses admin listUsers.
REVOKE EXECUTE ON FUNCTION public.get_engineer_emails(uuid[]) FROM authenticated, PUBLIC;
