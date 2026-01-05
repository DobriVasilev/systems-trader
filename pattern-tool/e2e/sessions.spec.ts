import { test, expect } from '@playwright/test';

test.describe('Sessions', () => {
  test.describe('Sessions List Page', () => {
    test('should load sessions page', async ({ page }) => {
      await page.goto('/sessions');
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Create Session Page', () => {
    test('should load create session page', async ({ page }) => {
      await page.goto('/sessions/new');
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Session Detail Page', () => {
    test('should handle non-existent session', async ({ page }) => {
      await page.goto('/sessions/non-existent-id');
      await expect(page.locator('body')).toBeVisible();
    });
  });
});
