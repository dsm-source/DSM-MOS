import { test, expect } from "@playwright/test";
import { DEMO_ADMIN, gotoHydrated, login } from "./helpers/auth";
import { sql } from "./helpers/db";
import {
  prepareRunningProductionStep,
  type RunningBatch,
} from "./helpers/fixtures";

/**
 * BUG-6 regression: on the production Kanban a batch whose active step is
 * `running` is draggable; dragging it onto the next column opens the
 * "Selesaikan tahapan?" confirm panel, and confirming completes the step
 * through the same gated mutation as the action button. A batch whose active
 * step is only `waiting` has no drag handle at all.
 *
 * See tasks/fix-out-of-scope-post-bug2r4.md T3.
 */
test.describe("BUG-6 production Kanban drag", () => {
  let batch: RunningBatch;
  let handleName: string;

  test.beforeAll(() => {
    batch = prepareRunningProductionStep();
    handleName = `Seret batch ${batch.batchNumber} ke tahapan berikutnya`;
  });

  test("only the running batch renders a drag handle", async ({ page }) => {
    await login(page, DEMO_ADMIN.email, DEMO_ADMIN.password);
    await gotoHydrated(page, "/production");

    // exactly one handle on the whole board — our fixture's running batch
    const handles = page.getByRole("button", {
      name: /^Seret batch .* ke tahapan berikutnya$/,
    });
    await expect(handles).toHaveCount(1);
    await expect(handles.first()).toHaveAccessibleName(handleName);
  });

  test("drag onto the next column opens the confirm panel and completes the step", async ({
    page,
  }) => {
    await login(page, DEMO_ADMIN.email, DEMO_ADMIN.password);
    await gotoHydrated(page, "/production");

    const handle = page.getByRole("button", { name: handleName, exact: true });
    const nextColumn = page.getByRole("button", {
      name: /^Welding & Grinding \d+$/,
    });

    const h = await handle.boundingBox();
    const c = await nextColumn.boundingBox();
    if (!h || !c) throw new Error("missing bounding box");
    await handle.hover();
    await page.mouse.down();
    // clear the 6px PointerSensor activation constraint, then cross the board
    await page.mouse.move(h.x + h.width / 2 + 12, h.y + h.height / 2, {
      steps: 6,
    });
    await page.mouse.move(c.x + c.width / 2, c.y + 140, { steps: 25 });
    await page.mouse.up();

    // confirm panel appears on the dragged card
    await expect(page.getByText(/^Selesaikan .+\?$/)).toBeVisible();
    await page.getByRole("button", { name: "Ya", exact: true }).click();

    await expect(async () => {
      const status = sql(`
        select s.status from public.production_batch_steps s
        join public.production_batches pb on pb.id = s.production_batch_id
        join public.engineering_jobs ej on ej.id = pb.engineering_job_id
        join public.sales_order_items soi on soi.id = ej.sales_order_item_id
        join public.sales_orders so on so.id = soi.sales_order_id
        where so.so_number = '${batch.soNumber}' and s.sequence_order = 2
      `);
      expect(status).toBe("completed");
    }).toPass({ timeout: 10_000 });
  });
});
