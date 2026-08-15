
CREATE TABLE public.engineering_job_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engineering_job_id uuid NOT NULL REFERENCES public.engineering_jobs(id) ON DELETE CASCADE,
  field_changed text NOT NULL,
  from_value text,
  to_value text,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ejh_job ON public.engineering_job_history(engineering_job_id, changed_at DESC);
CREATE INDEX idx_ejh_changed_by ON public.engineering_job_history(changed_by);

GRANT SELECT ON public.engineering_job_history TO authenticated;
GRANT ALL ON public.engineering_job_history TO service_role;

ALTER TABLE public.engineering_job_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read engineering job history"
  ON public.engineering_job_history FOR SELECT
  TO authenticated
  USING (true);

-- Trigger function
CREATE OR REPLACE FUNCTION public.engineering_jobs_log_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.engineering_job_history (engineering_job_id, field_changed, from_value, to_value, changed_by)
    VALUES (NEW.id, 'created', NULL, NEW.status::text, v_actor);
    IF NEW.assigned_to IS NOT NULL THEN
      INSERT INTO public.engineering_job_history (engineering_job_id, field_changed, from_value, to_value, changed_by)
      VALUES (NEW.id, 'assigned_to', NULL, NEW.assigned_to::text, v_actor);
    END IF;
    IF NEW.target_completion_date IS NOT NULL THEN
      INSERT INTO public.engineering_job_history (engineering_job_id, field_changed, from_value, to_value, changed_by)
      VALUES (NEW.id, 'target_completion_date', NULL, NEW.target_completion_date::text, v_actor);
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.engineering_job_history (engineering_job_id, field_changed, from_value, to_value, changed_by)
    VALUES (NEW.id, 'status', OLD.status::text, NEW.status::text, v_actor);
  END IF;
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    INSERT INTO public.engineering_job_history (engineering_job_id, field_changed, from_value, to_value, changed_by)
    VALUES (NEW.id, 'assigned_to', OLD.assigned_to::text, NEW.assigned_to::text, v_actor);
  END IF;
  IF NEW.progress_percent IS DISTINCT FROM OLD.progress_percent THEN
    INSERT INTO public.engineering_job_history (engineering_job_id, field_changed, from_value, to_value, changed_by)
    VALUES (NEW.id, 'progress_percent', OLD.progress_percent::text, NEW.progress_percent::text, v_actor);
  END IF;
  IF NEW.target_completion_date IS DISTINCT FROM OLD.target_completion_date THEN
    INSERT INTO public.engineering_job_history (engineering_job_id, field_changed, from_value, to_value, changed_by)
    VALUES (NEW.id, 'target_completion_date', OLD.target_completion_date::text, NEW.target_completion_date::text, v_actor);
  END IF;
  IF NEW.drawing_url IS DISTINCT FROM OLD.drawing_url THEN
    INSERT INTO public.engineering_job_history (engineering_job_id, field_changed, from_value, to_value, changed_by)
    VALUES (NEW.id, 'drawing_url', OLD.drawing_url, NEW.drawing_url, v_actor);
  END IF;
  IF NEW.notes IS DISTINCT FROM OLD.notes THEN
    INSERT INTO public.engineering_job_history (engineering_job_id, field_changed, from_value, to_value, changed_by)
    VALUES (NEW.id, 'notes', OLD.notes, NEW.notes, v_actor);
  END IF;
  IF NEW.approved_by IS DISTINCT FROM OLD.approved_by THEN
    INSERT INTO public.engineering_job_history (engineering_job_id, field_changed, from_value, to_value, changed_by)
    VALUES (NEW.id, 'approved_by', OLD.approved_by::text, NEW.approved_by::text, v_actor);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_engineering_jobs_log_history
AFTER INSERT OR UPDATE ON public.engineering_jobs
FOR EACH ROW EXECUTE FUNCTION public.engineering_jobs_log_history();
