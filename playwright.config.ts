import { defineConfig, devices } from "@playwright/test";

// Load local Supabase creds (URL + service-role key) from .env — filled by
// `supabase start`, gitignored. Node 20.12+ / 22+.
try {
  process.loadEnvFile(".env");
} catch {
  /* .env optional if the vars are already exported */
}

/**
 * E2E suite for the flows that keep getting retested by hand (BUG-2 / BUG-8 /
 * BUG-6). Runs against the LOCAL Supabase stack only.
 *
 * Prereqs (see e2e/README.md):
 *   1. `supabase start`
 *   2. `bun run test:e2e:reset`  (once, or whenever local data drifted)
 *   3. `bun run test:e2e`
 */
const PORT = 8080;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  // Generous: the Vite dev server compiles routes on first hit.
  timeout: 120_000,
  expect: { timeout: 15_000 },
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "bun run dev",
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
