
CREATE TABLE public.material_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_status_id uuid NOT NULL REFERENCES public.material_statuses(id) ON DELETE CASCADE,
  engineering_job_id uuid NOT NULL REFERENCES public.engineering_jobs(id) ON DELETE CASCADE,
  from_status public.material_status,
  to_status public.material_status NOT NULL,
  notes text,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_msh_engineering_job ON public.material_status_history(engineering_job_id, changed_at DESC);
CREATE INDEX idx_msh_material_status ON public.material_status_history(material_status_id, changed_at DESC);

GRANT SELECT ON public.material_status_history TO authenticated;
GRANT ALL ON public.material_status_history TO service_role;

ALTER TABLE public.material_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY material_status_history_select_scoped
  ON public.material_status_history
  FOR SELECT
  TO authenticated
  USING (
    public.has_any_role(auth.uid(), ARRAY[
      'admin'::public.app_role,
      'engineering'::public.app_role,
      'sales'::public.app_role,
      'material'::public.app_role,
      'production_planning'::public.app_role,
      'production'::public.app_role,
      'qc'::public.app_role
    ])
  );

CREATE OR REPLACE FUNCTION public.material_statuses_log_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.material_status_history
      (material_status_id, engineering_job_id, from_status, to_status, notes, changed_by)
    VALUES
      (NEW.id, NEW.engineering_job_id, NULL, NEW.status, NEW.notes, COALESCE(NEW.updated_by, v_actor));
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.material_status_history
      (material_status_id, engineering_job_id, from_status, to_status, notes, changed_by)
    VALUES
      (NEW.id, NEW.engineering_job_id, OLD.status, NEW.status, NEW.notes, COALESCE(NEW.updated_by, v_actor));
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_material_statuses_log_history
AFTER INSERT OR UPDATE ON public.material_statuses
FOR EACH ROW EXECUTE FUNCTION public.material_statuses_log_history();

-- Backfill baris awal untuk material_statuses yang sudah ada
INSERT INTO public.material_status_history (material_status_id, engineering_job_id, from_status, to_status, notes, changed_by, changed_at)
SELECT ms.id, ms.engineering_job_id, NULL, ms.status, ms.notes, ms.updated_by, ms.created_at
FROM public.material_statuses ms
WHERE NOT EXISTS (
  SELECT 1 FROM public.material_status_history h WHERE h.material_status_id = ms.id
);
