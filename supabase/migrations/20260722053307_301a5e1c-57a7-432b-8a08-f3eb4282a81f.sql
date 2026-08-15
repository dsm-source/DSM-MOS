
-- Ubah generate_so_number jadi SECURITY INVOKER + batasi eksekusi
CREATE OR REPLACE FUNCTION public.generate_so_number()
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_next bigint;
BEGIN
  v_next := nextval('public.sales_order_number_seq');
  RETURN 'SO-' || to_char(now() AT TIME ZONE 'UTC', 'YYYY') || '-' || lpad(v_next::text, 6, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.generate_so_number() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_so_number() TO authenticated, service_role;

GRANT USAGE ON SEQUENCE public.sales_order_number_seq TO authenticated, service_role;
REVOKE ALL ON SEQUENCE public.sales_order_number_seq FROM PUBLIC, anon;
