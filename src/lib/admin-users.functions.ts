import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AppRole } from "@/lib/roles.functions";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("Forbidden");
}

export type UserWithRoles = {
  id: string;
  email: string | null;
  created_at: string;
  roles: AppRole[];
};

export const listUsersWithRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<UserWithRoles[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");

    const { data: usersData, error: usersErr } =
      await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
    if (usersErr) throw new Error(usersErr.message);

    const { data: rolesData, error: rolesErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    if (rolesErr) throw new Error(rolesErr.message);

    const rolesByUser = new Map<string, AppRole[]>();
    for (const r of rolesData ?? []) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role as AppRole);
      rolesByUser.set(r.user_id, arr);
    }

    return usersData.users.map((u) => ({
      id: u.id,
      email: u.email ?? null,
      created_at: u.created_at,
      roles: rolesByUser.get(u.id) ?? [],
    }));
  });

export type AuditLogEntry = {
  id: string;
  changed_at: string;
  table_name: string;
  action: string;
  old_status: string | null;
  new_status: string | null;
  changed_by: string | null;
};

export const listAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AuditLogEntry[]> => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("audit_logs")
      .select(
        "id, changed_at, table_name, action, old_status, new_status, changed_by",
      )
      .order("changed_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createUserManual = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { email: string; password: string; role: AppRole }) => data)
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    await assertAdmin(context);
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");

    const { data: created, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
        app_metadata: { must_change_password: true },
      });
    if (createErr) throw new Error(createErr.message);

    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: created.user.id, role: data.role });
    if (roleErr) {
      const { error: cleanupErr } = await supabaseAdmin.auth.admin.deleteUser(
        created.user.id,
      );
      if (cleanupErr) {
        throw new Error(
          `Gagal assign role (${roleErr.message}), dan gagal rollback user Auth yang baru dibuat (${cleanupErr.message}). User ${data.email} (id: ${created.user.id}) perlu dihapus manual.`,
        );
      }
      throw new Error(`Gagal assign role: ${roleErr.message}`);
    }

    return { id: created.user.id };
  });

export const assignRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { userId: string; role: AppRole }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (error && error.code !== "23505") throw new Error(error.message);
    return { ok: true };
  });

export const unassignRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { userId: string; role: AppRole }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId && data.role === "admin") {
      throw new Error("Tidak bisa mencabut peran admin diri sendiri");
    }
    const { error } = await context.supabase
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", data.role);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
