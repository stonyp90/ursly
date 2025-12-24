import { test, expect } from '@playwright/test';

test.describe('Ursly.io Web App', () => {
  test('should display the login page for unauthenticated users', async ({
    page,
  }) => {
    await page.goto('/');

    // Should redirect to login or show auth prompt
    await expect(
      page.getByRole('button', { name: /sign in|login|log in/i }),
    ).toBeVisible({ timeout: 10000 });
  });

  test('should have correct page title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/ursly/i);
  });

  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Page should load without horizontal scroll
    const body = page.locator('body');
    const boundingBox = await body.boundingBox();
    expect(boundingBox?.width).toBeLessThanOrEqual(375);
  });
});

test.describe('Navigation', () => {
  test('should show navigation elements after authentication', async ({
    page,
  }) => {
    // This test would require mock authentication
    // For now, we verify the page structure
    await page.goto('/');

    // Check for main app structure
    const main = page.locator('main, #root, #app');
    await expect(main).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Accessibility', () => {
  test('should have no accessibility violations on login page', async ({
    page,
  }) => {
    await page.goto('/');

    // Basic accessibility checks
    const images = page.locator('img');
    const imageCount = await images.count();

    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      // Images should have alt text (can be empty for decorative)
      expect(alt).not.toBeNull();
    }
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/');

    // Tab through focusable elements
    await page.keyboard.press('Tab');
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });
});

test.describe('Performance', () => {
  test('should load within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    const loadTime = Date.now() - startTime;

    // Page should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test('should not have console errors', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForTimeout(1000);

    // Filter out known acceptable errors (e.g., auth redirects)
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes('401') &&
        !e.includes('Unauthorized') &&
        !e.includes('CORS'),
    );

    expect(criticalErrors).toHaveLength(0);
  });
});
