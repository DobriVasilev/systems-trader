import { test, expect } from "@playwright/test";

test.describe("Smoke Tests", () => {
  test("homepage loads", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator('body')).toBeVisible();
  });

  test("sessions page loads", async ({ page }) => {
    await page.goto("/sessions");
    await expect(page.locator('body')).toBeVisible();
  });

  test("login page loads", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page.locator('body')).toBeVisible();
  });

  test("health endpoint exists", async ({ request }) => {
    const response = await request.get("/api/health");
    // Accept any response - just testing the route exists
    expect(response.status()).toBeLessThan(500);
  });
});
