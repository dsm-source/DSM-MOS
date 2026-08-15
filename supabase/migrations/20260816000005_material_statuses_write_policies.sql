-- M3.4-fix: material_statuses write policies must be material + admin per PRD §8
-- ("material_statuses | write | material, admin"). The original M0 migration left
-- material_statuses_delete_material_admin scoped to admin only, despite its name.
-- INSERT/UPDATE were already material+admin; recreate all three to keep them in sync.
DROP POLICY IF EXISTS material_statuses_insert_material_admin ON public.material_statuses;
CREATE POLICY material_statuses_insert_material_admin ON public.material_statuses
  FOR INSERT TO authenticated WITH CHECK (
    (SELECT public.has_role(auth.uid(),'material'::public.app_role))
    OR (SELECT public.has_role(auth.uid(),'admin'::public.app_role))
  );

DROP POLICY IF EXISTS material_statuses_update_material_admin ON public.material_statuses;
CREATE POLICY material_statuses_update_material_admin ON public.material_statuses
  FOR UPDATE TO authenticated USING (
    (SELECT public.has_role(auth.uid(),'material'::public.app_role))
    OR (SELECT public.has_role(auth.uid(),'admin'::public.app_role))
  ) WITH CHECK (
    (SELECT public.has_role(auth.uid(),'material'::public.app_role))
    OR (SELECT public.has_role(auth.uid(),'admin'::public.app_role))
  );

DROP POLICY IF EXISTS material_statuses_delete_material_admin ON public.material_statuses;
CREATE POLICY material_statuses_delete_material_admin ON public.material_statuses
  FOR DELETE TO authenticated USING (
    (SELECT public.has_role(auth.uid(),'material'::public.app_role))
    OR (SELECT public.has_role(auth.uid(),'admin'::public.app_role))
  );
