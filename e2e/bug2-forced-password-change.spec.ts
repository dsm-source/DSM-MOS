import { test, expect } from "@playwright/test";
import { DEMO_ADMIN, gotoHydrated, login, logout } from "./helpers/auth";
import { deleteUserByEmail } from "./helpers/supabase-admin";

/**
 * BUG-2 / BUG-2R4 regression: a forced password change must complete cleanly —
 * no dead-token logout call, no 401 noise from notification queries, success
 * toast shown, and re-login must not loop back to /change-password.
 *
 * See tasks/codex-bug2-bug8-retest-report.md §9.
 */
test.describe("BUG-2 forced password change", () => {
  const email = `e2e-bug2-${Date.now()}@dsm-mos.local`;
  const tempPassword = "TempPass123";
  const newPassword = "NewPass456xyz";

  test.afterAll(async () => {
    await deleteUserByEmail(email);
  });

  test("completes with no logout/401 noise and no re-login loop", async ({
    page,
  }) => {
    // --- admin creates a viewer with a temporary password -------------------
    await login(page, DEMO_ADMIN.email, DEMO_ADMIN.password);
    await gotoHydrated(page, "/admin");
    await page.getByRole("button", { name: "Buat User Baru" }).click();
    await page.locator("#new-user-email").fill(email);
    await page.locator("#new-user-password").fill(tempPassword);
    await page.locator("#new-user-role").click();
    await page.getByRole("option", { name: "viewer" }).click();
    await page.getByRole("button", { name: "Buat User" }).click();
    await expect(page.getByText("User dibuat")).toBeVisible();
    await page.getByRole("button", { name: "Selesai" }).click();
    await logout(page);

    // --- viewer's first login is forced to /change-password ----------------
    await login(page, email, tempPassword, /\/change-password$/);
    await page.waitForLoadState("networkidle");

    // --- watch the network only from the moment we submit ------------------
    const offendingRequests: string[] = [];
    const unauthorizedResponses: string[] = [];
    let watching = false;
    page.on("request", (req) => {
      if (!watching) return;
      const url = req.url();
      if (
        url.includes("/auth/v1/logout") ||
        url.includes("/rest/v1/notifications")
      ) {
        offendingRequests.push(`${req.method()} ${url}`);
      }
    });
    page.on("response", (res) => {
      if (!watching) return;
      if (res.status() === 401 || res.status() === 403) {
        unauthorizedResponses.push(`${res.status()} ${res.url()}`);
      }
    });

    watching = true;
    await page.locator("#new-password").fill(newPassword);
    await page.locator("#confirm-password").fill(newPassword);
    await page.getByRole("button", { name: "Ganti kata sandi" }).click();

    // success toast (fires ~280ms before the hard reload)
    await expect(page.getByText("Kata sandi berhasil diganti")).toBeVisible();

    // hard reload lands on /auth with no persisted session
    await expect(page).toHaveURL(/\/auth$/);
    const tokenKeys = await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => /^sb-.*-auth-token$/.test(k)),
    );
    watching = false;

    expect(
      offendingRequests,
      "no logout / notifications calls after submit",
    ).toEqual([]);
    expect(unauthorizedResponses, "no 401/403 responses after submit").toEqual(
      [],
    );
    expect(tokenKeys, "auth token cleared from localStorage").toEqual([]);

    // --- re-login with the new password does not loop ---------------------
    await login(page, email, newPassword);
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});
