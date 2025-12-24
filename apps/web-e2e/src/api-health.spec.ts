import { test, expect } from '@playwright/test';

const API_URL = process.env.E2E_API_URL || 'http://localhost:3000';

test.describe('API Health Checks', () => {
  test('should have healthy API', async ({ request }) => {
    const response = await request.get(`${API_URL}/health`);

    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.status).toBe('ok');
  });

  test('should have OpenAPI documentation', async ({ request }) => {
    const response = await request.get(`${API_URL}/api`);

    expect(response.ok()).toBeTruthy();
  });

  test('should respond with correct CORS headers', async ({ request }) => {
    const response = await request.get(`${API_URL}/health`, {
      headers: {
        Origin: 'http://localhost:4200',
      },
    });

    expect(response.ok()).toBeTruthy();
  });
});

test.describe('API Response Times', () => {
  test('health endpoint should respond quickly', async ({ request }) => {
    const startTime = Date.now();
    await request.get(`${API_URL}/health`);
    const responseTime = Date.now() - startTime;

    // Health check should respond within 500ms
    expect(responseTime).toBeLessThan(500);
  });
});
