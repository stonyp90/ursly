import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should redirect unauthenticated users to login', async ({ page }) => {
    await page.goto('/dashboard');

    // Should be redirected to login page or show login prompt
    await page
      .waitForURL(/login|auth|keycloak/i, { timeout: 10000 })
      .catch(() => {
        // If no redirect, check for login button
      });

    const loginButton = page.getByRole('button', {
      name: /sign in|login|log in/i,
    });
    const isVisible = await loginButton.isVisible().catch(() => false);

    // Either redirected or showing login button
    expect(page.url().match(/login|auth|keycloak/i) || isVisible).toBeTruthy();
  });

  test('should protect API routes', async ({ page, request }) => {
    // Test that protected API routes require authentication
    const response = await request.get('/api/agents');

    expect([401, 403]).toContain(response.status());
  });

  test('should handle session expiry gracefully', async ({ page }) => {
    await page.goto('/');

    // Simulate expired session by clearing storage
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Refresh the page
    await page.reload();

    // Should redirect to login or show auth prompt
    const loginButton = page.getByRole('button', {
      name: /sign in|login|log in/i,
    });
    await expect(loginButton).toBeVisible({ timeout: 10000 });
  });
});
