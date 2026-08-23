import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AppRole } from "@/lib/roles.functions";

export type UserOption = { user_id: string; email: string | null };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertSalesOrAdmin(context: { supabase: any; userId: string }) {
  const [{ data: isAdmin }, { data: isSales }] = await Promise.all([
    context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    }),
    context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "sales",
    }),
  ]);
  if (isAdmin !== true && isSales !== true) throw new Error("Forbidden");
}

export const listUsersByRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { role: AppRole }) => data)
  .handler(async ({ data, context }): Promise<UserOption[]> => {
    await assertSalesOrAdmin(context);
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");

    const { data: rolesRows, error: rolesErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", data.role);
    if (rolesErr) throw new Error(rolesErr.message);

    const userIds = Array.from(
      new Set((rolesRows ?? []).map((r) => r.user_id)),
    );
    if (userIds.length === 0) return [];

    const { data: usersData, error: usersErr } =
      await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
    if (usersErr) throw new Error(usersErr.message);

    const emailById = new Map(
      usersData.users.map((u) => [u.id, u.email ?? null]),
    );
    return userIds
      .map((id) => ({ user_id: id, email: emailById.get(id) ?? null }))
      .sort((a, b) => (a.email ?? "").localeCompare(b.email ?? ""));
  });
