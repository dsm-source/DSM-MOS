-- RLS policies untuk bucket engineering-drawings
CREATE POLICY "eng_drawings_read_auth" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'engineering-drawings');

CREATE POLICY "eng_drawings_insert_eng_admin" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'engineering-drawings'
    AND (
      public.has_role(auth.uid(),'engineering'::public.app_role)
      OR public.has_role(auth.uid(),'admin'::public.app_role)
    )
  );

CREATE POLICY "eng_drawings_update_eng_admin" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'engineering-drawings'
    AND (
      public.has_role(auth.uid(),'engineering'::public.app_role)
      OR public.has_role(auth.uid(),'admin'::public.app_role)
    )
  );

CREATE POLICY "eng_drawings_delete_eng_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'engineering-drawings'
    AND (
      public.has_role(auth.uid(),'engineering'::public.app_role)
      OR public.has_role(auth.uid(),'admin'::public.app_role)
    )
  );
