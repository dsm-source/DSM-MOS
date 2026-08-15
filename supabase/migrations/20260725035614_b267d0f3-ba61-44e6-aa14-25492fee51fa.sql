
-- Tighten EXECUTE on trigger-only / anon-callable SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.material_statuses_log_history() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_any_role(uuid, public.app_role[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_actor_emails(uuid[]) FROM PUBLIC, anon;

-- Restrict delivery_items DELETE: only when parent delivery is still draft
DROP POLICY IF EXISTS delivery_items_delete_delivery_admin ON public.delivery_items;
CREATE POLICY delivery_items_delete_delivery_admin
  ON public.delivery_items
  FOR DELETE
  TO authenticated
  USING (
    ((SELECT public.has_role(auth.uid(), 'delivery'::public.app_role))
      OR (SELECT public.has_role(auth.uid(), 'admin'::public.app_role)))
    AND EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = delivery_items.delivery_id
        AND d.status = 'draft'::public.delivery_status
    )
  );

-- Also tighten INSERT/UPDATE to draft-only parent deliveries for consistency of ownership scoping
DROP POLICY IF EXISTS delivery_items_insert_delivery_admin ON public.delivery_items;
CREATE POLICY delivery_items_insert_delivery_admin
  ON public.delivery_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    ((SELECT public.has_role(auth.uid(), 'delivery'::public.app_role))
      OR (SELECT public.has_role(auth.uid(), 'admin'::public.app_role)))
    AND EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = delivery_items.delivery_id
        AND d.status = 'draft'::public.delivery_status
    )
  );

DROP POLICY IF EXISTS delivery_items_update_delivery_admin ON public.delivery_items;
CREATE POLICY delivery_items_update_delivery_admin
  ON public.delivery_items
  FOR UPDATE
  TO authenticated
  USING (
    ((SELECT public.has_role(auth.uid(), 'delivery'::public.app_role))
      OR (SELECT public.has_role(auth.uid(), 'admin'::public.app_role)))
    AND EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = delivery_items.delivery_id
        AND d.status = 'draft'::public.delivery_status
    )
  )
  WITH CHECK (
    ((SELECT public.has_role(auth.uid(), 'delivery'::public.app_role))
      OR (SELECT public.has_role(auth.uid(), 'admin'::public.app_role)))
    AND EXISTS (
      SELECT 1 FROM public.deliveries d
      WHERE d.id = delivery_items.delivery_id
        AND d.status = 'draft'::public.delivery_status
    )
  );
