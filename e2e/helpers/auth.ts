import { expect, type Page } from "@playwright/test";

/** Seeded demo admin — provisioned with a password by the demo seed. */
export const DEMO_ADMIN = {
  email: "demo-admin@dsm-mos.local",
  password: "demo1234",
};

/**
 * Navigate and wait for the SSR'd page to hydrate. Without this, clicks that
 * land before React attaches its handlers fall through to a native form submit.
 */
export async function gotoHydrated(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  // Best-effort quiet point; pages that keep polling never go fully idle.
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
}

/** Sign in through the real /auth form and wait for the landing route. */
export async function login(
  page: Page,
  email: string,
  password: string,
  expectPath: string | RegExp = "/dashboard",
): Promise<void> {
  const target =
    typeof expectPath === "string" ? new RegExp(`${expectPath}$`) : expectPath;
  await gotoHydrated(page, "/auth");
  // Retry the whole fill+submit: a click that lands before React hydrates
  // falls through to a native form submit and does nothing.
  await expect(async () => {
    await page.locator("#signin-email").fill(email);
    await page.locator("#signin-password").fill(password);
    await page.getByRole("button", { name: "Masuk" }).click();
    await expect(page).toHaveURL(target, { timeout: 5000 });
  }).toPass({ timeout: 30_000 });
}

/** Sign out via the account menu and confirm the dialog. */
export async function logout(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Menu akun" }).click();
  await page.getByRole("menuitem", { name: "Keluar" }).click();
  await page.getByRole("button", { name: "Keluar" }).click();
  await expect(page).toHaveURL(/\/auth$/);
}
