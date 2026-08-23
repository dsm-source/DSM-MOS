import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);

    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => r.role as AppRole);
  });

export const claimFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("claim_first_admin");
    if (error) throw new Error(error.message);
    return { claimed: data === true };
  });

export const changePasswordAndClearFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { password: string }) => data)
  .handler(async ({ data, context }) => {
    if (data.password.length < 8) {
      throw new Error("Kata sandi minimal 8 karakter");
    }
    // Password update and must_change_password=false are done together in
    // this one handler so the flag can only be cleared as a side effect of
    // an actual password change — never on its own.
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(
      context.userId,
      { password: data.password },
    );
    if (pwErr) throw new Error(pwErr.message);

    const { error: flagErr } = await supabaseAdmin.auth.admin.updateUserById(
      context.userId,
      { app_metadata: { must_change_password: false } },
    );
    if (flagErr) throw new Error(flagErr.message);

    return { ok: true };
  });

export const isRolesTableEmpty = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Menggunakan has_role: jika tabel kosong, tak ada admin — tapi kita perlu
    // cek eksplisit apakah tabel kosong. RLS: authenticated hanya lihat baris
    // sendiri, jadi count via client tidak akurat. Pakai admin client.
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const { count, error } = await supabaseAdmin
      .from("user_roles")
      .select("id", { count: "exact", head: true });
    if (error) throw new Error(error.message);
    return { empty: (count ?? 0) === 0 };
  });
