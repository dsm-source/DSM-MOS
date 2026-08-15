
-- Trigger-only SECURITY DEFINER functions: revoke direct EXECUTE.
-- These are invoked by triggers under the table owner, not by clients via RPC.
REVOKE ALL ON FUNCTION public.sales_orders_notify_on_status_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sales_orders_create_engineering_jobs() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.engineering_jobs_log_history() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.production_batches_set_number() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.production_batches_create_steps() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.production_batch_steps_validate_transition() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.material_statuses_validate_transition() FROM PUBLIC, anon, authenticated;
