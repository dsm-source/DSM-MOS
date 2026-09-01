import { execFileSync } from "node:child_process";

/**
 * Run SQL against the local Supabase Postgres via `docker exec`. Test fixtures
 * only — local stack. Returns stdout (tab-separated, no headers).
 */
export function sql(query: string): string {
  const container = execFileSync("docker", ["ps", "--format", "{{.Names}}"])
    .toString()
    .split("\n")
    .find((n) => n.startsWith("supabase_db_"));
  if (!container) throw new Error("local supabase_db_* container not running");
  return execFileSync(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "-F",
      "\t",
      "-tAqc",
      query,
    ],
    { encoding: "utf8" },
  ).trim();
}
