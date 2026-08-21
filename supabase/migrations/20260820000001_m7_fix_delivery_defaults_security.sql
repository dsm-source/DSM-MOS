-- M7 fix: deliveries_set_defaults() must run with owner privileges.
-- Root cause: trigger called generate_do_number(), but EXECUTE on that function
-- is revoked from authenticated. Without SECURITY DEFINER, INSERT deliveries fails.
--
-- M7.4 Codex fix: do_number must always come from generate_do_number(), never
-- from the client. Previously a client-supplied non-empty do_number bypassed
-- the generator entirely, contradicting PRD/SPEC (do_number is an internal
-- reference code, not client-settable).

CREATE OR REPLACE FUNCTION public.deliveries_set_defaults()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.do_number := public.generate_do_number();
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END; $$;

REVOKE EXECUTE ON FUNCTION public.deliveries_set_defaults() FROM PUBLIC, anon, authenticated;
