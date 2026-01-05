import { test, expect } from '@playwright/test';

test.describe('UI Components', () => {
  test.describe('Page Loading', () => {
    test('should load home page', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('body')).toBeVisible();
    });

    test('should load sessions page', async ({ page }) => {
      await page.goto('/sessions');
      await expect(page.locator('body')).toBeVisible();
    });

    test('should load login page', async ({ page }) => {
      await page.goto('/auth/login');
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on desktop viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto('/');
      await expect(page.locator('body')).toBeVisible();
    });

    test('should work on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/');
      await expect(page.locator('body')).toBeVisible();
    });

    test('should work on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/');
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Page Structure', () => {
    test('should have visible content', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await expect(page.locator('body')).toBeVisible();
    });
  });
});
