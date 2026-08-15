-- Phase M0: Foundation

-- 1. Create operators table
CREATE TABLE IF NOT EXISTS public.operators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  employee_number text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexing
CREATE INDEX IF NOT EXISTS idx_operators_name ON public.operators(name);
CREATE INDEX IF NOT EXISTS idx_operators_is_active ON public.operators(is_active);

-- Setup updated_at trigger
DROP TRIGGER IF EXISTS trg_operators_updated_at ON public.operators;
CREATE TRIGGER trg_operators_updated_at
  BEFORE UPDATE ON public.operators
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operators TO authenticated;
GRANT ALL ON public.operators TO service_role;

-- RLS
ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;

CREATE POLICY operators_select_all ON public.operators
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY operators_write_ppic_admin ON public.operators
  FOR ALL TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY['production_planning','admin']::public.app_role[])
  )
  WITH CHECK (
    public.has_any_role(auth.uid(), ARRAY['production_planning','admin']::public.app_role[])
  );


-- 2. Viewer RLS Select Policy Fixes (9 Tables)
-- deliveries
DROP POLICY IF EXISTS deliveries_select_scoped ON public.deliveries;
CREATE POLICY deliveries_select_scoped ON public.deliveries
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','sales','delivery','production_planning','viewer']::public.app_role[]));

-- delivery_items
DROP POLICY IF EXISTS delivery_items_select_scoped ON public.delivery_items;
CREATE POLICY delivery_items_select_scoped ON public.delivery_items
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','sales','delivery','production_planning','viewer']::public.app_role[]));

-- engineering_jobs
DROP POLICY IF EXISTS eng_jobs_select_scoped ON public.engineering_jobs;
CREATE POLICY eng_jobs_select_scoped ON public.engineering_jobs
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','engineering','sales','production_planning','material','production','qc','viewer']::public.app_role[]));

-- engineering_job_history
DROP POLICY IF EXISTS eng_job_history_select_scoped ON public.engineering_job_history;
CREATE POLICY eng_job_history_select_scoped ON public.engineering_job_history
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','engineering','sales','production_planning','material','production','qc','viewer']::public.app_role[]));

-- material_statuses
DROP POLICY IF EXISTS material_statuses_select_scoped ON public.material_statuses;
CREATE POLICY material_statuses_select_scoped ON public.material_statuses
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','material','engineering','production_planning','production','sales','viewer']::public.app_role[]));

-- production_batches
DROP POLICY IF EXISTS production_batches_select_scoped ON public.production_batches;
CREATE POLICY production_batches_select_scoped ON public.production_batches
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','production','production_planning','qc','engineering','material','sales','delivery','viewer']::public.app_role[]));

-- production_batch_steps
DROP POLICY IF EXISTS pbs_select_scoped ON public.production_batch_steps;
CREATE POLICY pbs_select_scoped ON public.production_batch_steps
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','production','production_planning','qc','engineering','material','sales','delivery','viewer']::public.app_role[]));

-- qc_inspections
DROP POLICY IF EXISTS qc_select_scoped ON public.qc_inspections;
CREATE POLICY qc_select_scoped ON public.qc_inspections
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','qc','production','production_planning','delivery','sales','engineering','viewer']::public.app_role[]));

-- sales_order_status_history
DROP POLICY IF EXISTS sosh_select_scoped ON public.sales_order_status_history;
CREATE POLICY sosh_select_scoped ON public.sales_order_status_history
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','sales','engineering','material','production_planning','production','qc','delivery','viewer']::public.app_role[]));


-- 3. Fix get_engineering_workload access (remove restriction, open to all authenticated roles)
CREATE OR REPLACE FUNCTION public.get_engineering_workload()
RETURNS TABLE (
  assigned_to uuid,
  assignee_email text,
  total_jobs bigint,
  draft_count bigint,
  in_progress_count bigint,
  review_count bigint,
  approved_count bigint,
  avg_progress numeric,
  overdue_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
BEGIN
  -- Restriction removed (open to all authenticated roles who can invoke it)
  RETURN QUERY
  SELECT
    ej.assigned_to,
    u.email::text AS assignee_email,
    count(*)::bigint AS total_jobs,
    count(*) FILTER (WHERE ej.status='draft')::bigint,
    count(*) FILTER (WHERE ej.status='in_progress')::bigint,
    count(*) FILTER (WHERE ej.status='review')::bigint,
    count(*) FILTER (WHERE ej.status='approved')::bigint,
    round(avg(ej.progress_percent)::numeric, 1),
    count(*) FILTER (
      WHERE ej.target_completion_date IS NOT NULL
        AND ej.target_completion_date < current_date
        AND ej.status <> 'approved'
    )::bigint
  FROM public.engineering_jobs ej
  LEFT JOIN auth.users u ON u.id = ej.assigned_to
  WHERE ej.assigned_to IS NOT NULL
  GROUP BY ej.assigned_to, u.email;
END;
$$;

REVOKE ALL ON FUNCTION public.get_engineering_workload() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_engineering_workload() TO authenticated;
