import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client for test fixture setup/teardown. Local stack only.
 * Config comes from the environment — `playwright.config.ts` loads `.env`,
 * which every `supabase start` fills with the fixed local demo values.
 */
const URL = process.env.SUPABASE_URL ?? "http://127.0.0.1:54321";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE_ROLE_KEY) {
  throw new Error(
    "SUPABASE_SERVICE_ROLE_KEY missing — run `supabase start` and keep .env",
  );
}

export const admin = createClient(URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Delete an auth user by email if it exists (idempotent cleanup). */
export async function deleteUserByEmail(email: string): Promise<void> {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const user = data.users.find((u) => u.email === email);
  if (user) await admin.auth.admin.deleteUser(user.id);
}

/**
 * Create a confirmed user with a single role, ready to log in (no forced
 * password change — unlike the /admin "Buat User" flow). Idempotent.
 */
export async function createUser(
  email: string,
  password: string,
  role: string,
): Promise<string> {
  await deleteUserByEmail(email);
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  const userId = data.user.id;
  const { error: rErr } = await admin
    .from("user_roles")
    .insert({ user_id: userId, role });
  if (rErr) throw rErr;
  return userId;
}
