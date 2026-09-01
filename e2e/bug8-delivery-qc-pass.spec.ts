import { test, expect } from "@playwright/test";
import { gotoHydrated, login } from "./helpers/auth";
import { createUser, deleteUserByEmail } from "./helpers/supabase-admin";
import { sql } from "./helpers/db";
import {
  prepareQcPassSalesOrder,
  deleteDeliveriesForSo,
  type QcPassSalesOrder,
} from "./helpers/fixtures";

/**
 * BUG-8 regression: the `delivery` role must be able to see QC-pass candidates
 * (needs SELECT on engineering_jobs, added in migration M8) and run a delivery
 * from draft all the way to delivered.
 *
 * See tasks/codex-bug2-bug8-retest-report.md §4.
 */
test.describe("BUG-8 delivery QC-pass eligibility", () => {
  const email = `e2e-delivery-${Date.now()}@dsm-mos.local`;
  const password = "DeliveryPass123";
  let so: QcPassSalesOrder;

  test.beforeAll(async () => {
    await createUser(email, password, "delivery");
    so = prepareQcPassSalesOrder();
  });

  test.afterAll(async () => {
    if (so) deleteDeliveriesForSo(so.soId);
    await deleteUserByEmail(email);
  });

  test("delivery role: QC candidate visible, draft -> delivered", async ({
    page,
  }) => {
    await login(page, email, password);

    // --- create a delivery plan from the QC-passed SO --------------------
    await gotoHydrated(page, "/delivery");
    await page.getByRole("button", { name: "Rencana Baru" }).click();
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: new RegExp(so.soNumber) }).click();
    await page.locator("#ship").fill("2026-09-10");
    await page.locator("#deliv").fill("2026-09-12");
    await page.locator("#driver").fill("E2E Driver");
    await page.locator("#veh").fill("B 1234 E2E");
    await page.locator("#notes").fill("e2e BUG-8");
    await page.getByRole("button", { name: "Buat Rencana" }).click();

    await expect(page).toHaveURL(/\/delivery\/[0-9a-f-]+$/);
    await page.waitForLoadState("networkidle");

    // --- QC-pass candidate must be offered (not the empty state) --------
    await page.getByRole("combobox").click();
    await expect(
      page.getByText("Tidak ada hasil QC lulus yang tersedia."),
    ).toHaveCount(0);
    const option = page.getByRole("option", { name: /· OK / });
    await expect(option).toHaveCount(1);
    await option.click();

    await page.locator('input[type="number"]').fill("3");
    await page.getByRole("button", { name: "Tambah" }).click();

    // item landed in the DB against the right QC inspection
    await expect(async () => {
      const n = sql(
        `select count(*) from public.delivery_items di
         join public.deliveries d on d.id = di.delivery_id
         where d.sales_order_id = '${so.soId}'
           and di.qc_inspection_id = '${so.qcInspectionId}'`,
      );
      expect(n).toBe("1");
    }).toPass({ timeout: 10_000 });

    // --- draft -> prepared -> shipped -> delivered ----------------------
    const deliveryStatus = () =>
      sql(
        `select status from public.deliveries where sales_order_id = '${so.soId}'`,
      );

    for (const [button, expected] of [
      ["→ Disiapkan", "prepared"],
      ["→ Dikirim", "shipped"],
      ["→ Terkirim", "delivered"],
    ] as const) {
      await page.getByRole("button", { name: button, exact: true }).click();
      await expect(async () => {
        expect(deliveryStatus()).toBe(expected);
      }).toPass({ timeout: 10_000 });
    }
  });
});
