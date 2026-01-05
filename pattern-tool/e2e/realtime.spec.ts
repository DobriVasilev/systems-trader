import { test, expect } from '@playwright/test';

test.describe('Real-time Features', () => {
  test('pusher auth rejects unauthenticated', async ({ request }) => {
    const response = await request.post('/api/pusher/auth', {
      data: {
        socket_id: 'test-socket-id',
        channel_name: 'private-session-test',
      },
    });
    // Any 4xx or 5xx response is acceptable (auth rejected or pusher not configured)
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('page loads without crash', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Collaboration Endpoints', () => {
  test('share endpoint is protected', async ({ request }) => {
    const response = await request.get('/api/sessions/test-id/share');
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('comments endpoint is protected', async ({ request }) => {
    const response = await request.get('/api/sessions/test-id/comments');
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('corrections endpoint is protected', async ({ request }) => {
    const response = await request.get('/api/sessions/test-id/corrections');
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('detections endpoint is protected', async ({ request }) => {
    const response = await request.get('/api/sessions/test-id/detections');
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});
