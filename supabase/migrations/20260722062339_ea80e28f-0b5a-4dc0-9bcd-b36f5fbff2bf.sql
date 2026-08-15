
REVOKE EXECUTE ON FUNCTION public.production_batches_set_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.production_batches_create_steps() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.production_batch_steps_validate_transition() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.material_statuses_validate_transition() FROM PUBLIC, anon, authenticated;
