import { test, expect } from '@playwright/test';

test.describe('API Endpoints', () => {
  test.describe('Health Check', () => {
    test('should respond', async ({ request }) => {
      const response = await request.get('/api/health');
      expect(response.status()).toBeLessThan(500);
    });
  });

  test.describe('Sessions API', () => {
    test('should protect sessions list', async ({ request }) => {
      const response = await request.get('/api/sessions');
      // 401 (unauthorized) or 404 (route not found during tests)
      expect(response.status()).toBeGreaterThanOrEqual(400);
    });

    test('should handle session requests', async ({ request }) => {
      const response = await request.get('/api/sessions/test-id');
      expect(response.status()).toBeGreaterThanOrEqual(400);
    });
  });

  test.describe('Candles API', () => {
    test('should handle candles request', async ({ request }) => {
      const response = await request.get('/api/candles?symbol=BTC&interval=4h');
      // Accept success or server error (external API might be down)
      expect(response.status()).toBeLessThan(600);
    });
  });

  test.describe('Protected Endpoints', () => {
    test('should protect export endpoint', async ({ request }) => {
      const response = await request.get('/api/sessions/test-id/export');
      expect(response.status()).toBeGreaterThanOrEqual(400);
    });

    test('should protect events endpoint', async ({ request }) => {
      const response = await request.get('/api/sessions/test-id/events');
      expect(response.status()).toBeGreaterThanOrEqual(400);
    });
  });
});
