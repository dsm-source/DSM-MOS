-- M3.4-fix: material_statuses SELECT policy must cover all 9 roles per PRD §8/§9
-- ("material_statuses | semua peran | material, admin"). The M0 foundation
-- migration scoped SELECT to 7 roles, omitting qc and delivery.
DROP POLICY IF EXISTS material_statuses_select_scoped ON public.material_statuses;
CREATE POLICY material_statuses_select_scoped ON public.material_statuses
  FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','material','engineering','production_planning','production','sales','qc','delivery','viewer']::public.app_role[]));
