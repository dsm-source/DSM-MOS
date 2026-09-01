import { chromium } from "@playwright/test";

/**
 * Warm the Vite dev server's on-demand route compilation so the first real
 * test doesn't eat a multi-second compile mid-assertion.
 */
export default async function globalSetup() {
  const base = "http://127.0.0.1:8080";
  const routes = [
    "/auth",
    "/change-password",
    "/dashboard",
    "/admin",
    "/delivery",
    "/production",
  ];
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const r of routes) {
    await page
      .goto(base + r, { waitUntil: "domcontentloaded" })
      .catch(() => {});
  }
  await browser.close();
}
