-- 1. Enum
CREATE TYPE public.engineering_status AS ENUM ('draft','in_progress','review','approved');

-- 2. Sequence + generator
CREATE SEQUENCE IF NOT EXISTS public.engineering_job_number_seq;

CREATE OR REPLACE FUNCTION public.generate_job_number()
RETURNS text
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_next bigint;
BEGIN
  v_next := nextval('public.engineering_job_number_seq');
  RETURN 'ENG-' || to_char(now() AT TIME ZONE 'UTC', 'YYYY') || '-' || lpad(v_next::text, 6, '0');
END;
$$;

-- 3. Table
CREATE TABLE public.engineering_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number text NOT NULL UNIQUE,
  sales_order_item_id uuid NOT NULL UNIQUE REFERENCES public.sales_order_items(id) ON DELETE CASCADE,
  status public.engineering_status NOT NULL DEFAULT 'draft',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  progress_percent smallint NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  target_completion_date date,
  drawing_url text,
  notes text,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_eng_jobs_status ON public.engineering_jobs(status);
CREATE INDEX idx_eng_jobs_assigned_to ON public.engineering_jobs(assigned_to);
CREATE INDEX idx_eng_jobs_target ON public.engineering_jobs(target_completion_date);
CREATE INDEX idx_eng_jobs_so_item ON public.engineering_jobs(sales_order_item_id);
CREATE INDEX idx_eng_jobs_created_at ON public.engineering_jobs(created_at DESC);

-- 4. GRANT
GRANT SELECT, INSERT, UPDATE, DELETE ON public.engineering_jobs TO authenticated;
GRANT ALL ON public.engineering_jobs TO service_role;
GRANT USAGE ON SEQUENCE public.engineering_job_number_seq TO authenticated, service_role;

-- 5. RLS
ALTER TABLE public.engineering_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eng_jobs_select_all_auth" ON public.engineering_jobs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "eng_jobs_insert_eng_admin" ON public.engineering_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT public.has_role(auth.uid(),'engineering'::public.app_role))
    OR (SELECT public.has_role(auth.uid(),'admin'::public.app_role))
  );

CREATE POLICY "eng_jobs_update_eng_admin" ON public.engineering_jobs
  FOR UPDATE TO authenticated
  USING (
    (SELECT public.has_role(auth.uid(),'engineering'::public.app_role))
    OR (SELECT public.has_role(auth.uid(),'admin'::public.app_role))
  )
  WITH CHECK (
    (SELECT public.has_role(auth.uid(),'engineering'::public.app_role))
    OR (SELECT public.has_role(auth.uid(),'admin'::public.app_role))
  );

CREATE POLICY "eng_jobs_delete_eng_admin" ON public.engineering_jobs
  FOR DELETE TO authenticated
  USING (
    (SELECT public.has_role(auth.uid(),'engineering'::public.app_role))
    OR (SELECT public.has_role(auth.uid(),'admin'::public.app_role))
  );

-- 6. Triggers
CREATE OR REPLACE FUNCTION public.engineering_jobs_set_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.job_number IS NULL OR NEW.job_number = '' THEN
    NEW.job_number := public.generate_job_number();
  END IF;
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_eng_jobs_set_number
  BEFORE INSERT ON public.engineering_jobs
  FOR EACH ROW EXECUTE FUNCTION public.engineering_jobs_set_number();

CREATE TRIGGER trg_eng_jobs_updated_at
  BEFORE UPDATE ON public.engineering_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.engineering_jobs_validate_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_allowed boolean := false;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- Approved is terminal
  IF OLD.status = 'approved' THEN
    RAISE EXCEPTION 'Job sudah Approved dan tidak dapat diubah lagi';
  END IF;

  IF OLD.status = 'draft' AND NEW.status = 'in_progress' THEN
    v_allowed := true;
  ELSIF OLD.status = 'in_progress' AND NEW.status = 'review' THEN
    v_allowed := true;
  ELSIF OLD.status = 'review' AND NEW.status = 'approved' THEN
    v_allowed := true;
  ELSIF OLD.status = 'review' AND NEW.status = 'in_progress' THEN
    v_allowed := true; -- boleh mundur untuk revisi
  END IF;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Transisi status tidak diperbolehkan: % → %', OLD.status, NEW.status;
  END IF;

  -- Draft -> in_progress harus punya assigned_to & target
  IF NEW.status = 'in_progress' AND OLD.status = 'draft' THEN
    IF NEW.assigned_to IS NULL OR NEW.target_completion_date IS NULL THEN
      RAISE EXCEPTION 'Set penanggung jawab dan target penyelesaian terlebih dahulu.';
    END IF;
  END IF;

  -- Approved: force progress=100 dan catat approver
  IF NEW.status = 'approved' THEN
    NEW.progress_percent := 100;
    NEW.approved_by := COALESCE(NEW.approved_by, auth.uid());
    NEW.approved_at := COALESCE(NEW.approved_at, now());
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_eng_jobs_validate_transition
  BEFORE UPDATE ON public.engineering_jobs
  FOR EACH ROW EXECUTE FUNCTION public.engineering_jobs_validate_transition();

-- 7. Auto-create engineering_jobs when SO -> confirmed
CREATE OR REPLACE FUNCTION public.sales_orders_create_engineering_jobs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.status = 'confirmed' AND OLD.status IS DISTINCT FROM 'confirmed' THEN
    INSERT INTO public.engineering_jobs (sales_order_item_id, status, created_by)
    SELECT soi.id, 'draft'::public.engineering_status, auth.uid()
    FROM public.sales_order_items soi
    WHERE soi.sales_order_id = NEW.id
      AND NOT EXISTS (
        SELECT 1 FROM public.engineering_jobs ej WHERE ej.sales_order_item_id = soi.id
      );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_so_create_engineering_jobs
  AFTER UPDATE OF status ON public.sales_orders
  FOR EACH ROW EXECUTE FUNCTION public.sales_orders_create_engineering_jobs();

-- 8. Workload accessor (security definer, role-gated)
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
  IF NOT (
    public.has_role(auth.uid(),'engineering'::public.app_role)
    OR public.has_role(auth.uid(),'admin'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

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

-- 9. Helper untuk resolve nama engineer (dipakai UI untuk kartu & detail)
CREATE OR REPLACE FUNCTION public.get_engineer_emails(_user_ids uuid[])
RETURNS TABLE (id uuid, email text)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.email::text
  FROM auth.users u
  WHERE u.id = ANY(_user_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.get_engineer_emails(uuid[]) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_engineer_emails(uuid[]) TO authenticated;
