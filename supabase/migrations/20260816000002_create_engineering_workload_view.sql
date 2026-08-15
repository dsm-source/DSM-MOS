-- v_engineering_workload: aggregated per-assignee view for cross-division transparency (PRD §6.3, §11 #6)
-- Wraps the existing SECURITY DEFINER get_engineering_workload() function so the view itself can stay
-- security_invoker=true (authenticated users have no direct SELECT grant on auth.users).
CREATE OR REPLACE VIEW public.v_engineering_workload
WITH (security_invoker = true) AS
SELECT * FROM public.get_engineering_workload();

GRANT SELECT ON public.v_engineering_workload TO authenticated;
