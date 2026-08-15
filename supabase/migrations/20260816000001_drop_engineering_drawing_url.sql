-- PRD v3 §11 #12: Engineering tidak simpan drawing (dihapus)
-- Drop drawing_url from engineering_jobs and stop tracking it in job history.

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

ALTER TABLE public.engineering_jobs DROP COLUMN drawing_url;
