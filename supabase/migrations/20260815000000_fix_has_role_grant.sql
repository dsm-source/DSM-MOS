-- has_role() belum pernah diberi GRANT EXECUTE ke authenticated (berbeda dari
-- has_any_role() yang sudah benar di migration 20260723061827). Akibatnya RLS
-- policy user_roles (dan tabel lain yang memanggil has_role() di USING/WITH CHECK)
-- gagal dengan "permission denied for function has_role" untuk SEMUA user
-- authenticated, ditemukan saat verifikasi lokal pertama kali setelah signup.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
