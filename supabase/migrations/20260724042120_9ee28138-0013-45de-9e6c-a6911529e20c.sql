CREATE OR REPLACE FUNCTION public.get_actor_emails(_user_ids uuid[])
RETURNS TABLE(id uuid, email text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.email::text
  FROM auth.users u
  WHERE u.id = ANY(_user_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.get_actor_emails(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_actor_emails(uuid[]) TO authenticated;