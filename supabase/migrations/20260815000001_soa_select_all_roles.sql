-- M1.1-fix: sales_order_assignments SELECT policy must cover all 9 roles per PRD §8
DROP POLICY IF EXISTS soa_select_scoped ON public.sales_order_assignments;
CREATE POLICY soa_select_all_roles ON public.sales_order_assignments
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','sales','engineering','material','production_planning','production','qc','delivery','viewer']::public.app_role[]));
