import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type EngineerOption = { user_id: string; email: string | null };
export type UserEmail = { id: string; email: string | null };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertEngOrAdmin(context: { supabase: any; userId: string }) {
  const [{ data: isAdmin }, { data: isEng }] = await Promise.all([
    context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    }),
    context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "engineering",
    }),
  ]);
  if (isAdmin !== true && isEng !== true) throw new Error("Forbidden");
}

export const listEngineers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EngineerOption[]> => {
    await assertEngOrAdmin(context);
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");

    const { data: rolesRows, error: rolesErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "engineering");
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

export const getEngineerEmails = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z.object({ userIds: z.array(z.string().uuid()) }).parse(data),
  )
  .handler(async ({ data, context }): Promise<UserEmail[]> => {
    if (data.userIds.length === 0) return [];
    await assertEngOrAdmin(context);
    const { supabaseAdmin } =
      await import("@/integrations/supabase/client.server");
    const { data: usersData, error } = await supabaseAdmin.auth.admin.listUsers(
      {
        page: 1,
        perPage: 200,
      },
    );
    if (error) throw new Error(error.message);
    const wanted = new Set(data.userIds);
    return usersData.users
      .filter((u) => wanted.has(u.id))
      .map((u) => ({ id: u.id, email: u.email ?? null }));
  });
