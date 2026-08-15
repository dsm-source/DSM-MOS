-- Fix engineering_jobs_validate_transition(): the OLD/NEW no-op status check ran
-- *before* the "approved is terminal" check, so an UPDATE that left status unchanged
-- (e.g. only changing progress_percent) on an already-approved job returned NEW
-- without ever reaching the terminal-status guard. PRD §7 rule#8: progress_percent
-- must stay locked at 100 once approved, and no field should be editable afterward.

CREATE OR REPLACE FUNCTION public.engineering_jobs_validate_transition()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_allowed boolean := false;
BEGIN
  -- Approved is terminal: check this first, before the no-op short-circuit below,
  -- so no field (including progress_percent) can be changed once approved.
  IF OLD.status = 'approved' THEN
    RAISE EXCEPTION 'Job sudah Approved dan tidak dapat diubah lagi';
  END IF;

  IF NEW.status = OLD.status THEN
    RETURN NEW;
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

DROP TRIGGER IF EXISTS trg_eng_jobs_validate_transition ON public.engineering_jobs;

CREATE TRIGGER trg_eng_jobs_validate_transition
  BEFORE UPDATE ON public.engineering_jobs
  FOR EACH ROW EXECUTE FUNCTION public.engineering_jobs_validate_transition();
