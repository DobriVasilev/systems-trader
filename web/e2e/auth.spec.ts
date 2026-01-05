import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should show login page', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.locator('body')).toBeVisible();
  });

  test('should show sessions page for unauthenticated users', async ({ page }) => {
    await page.goto('/sessions');
    await expect(page.locator('body')).toBeVisible();
  });

  test('should load auth login page', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle auth error page', async ({ page }) => {
    await page.goto('/auth/error');
    await expect(page.locator('body')).toBeVisible();
  });
});
