import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept Supabase Auth calls to mock them
    await page.route('**/auth/v1/signup**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'test-user-id', email: 'test@example.com' },
          session: { access_token: 'fake-token', refresh_token: 'fake-refresh-token' },
        }),
      });
    });

    await page.route('**/auth/v1/token?grant_type=password', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: { id: 'test-user-id', email: 'test@example.com' },
          session: { access_token: 'fake-token', refresh_token: 'fake-refresh-token' },
        }),
      });
    });

    // Mock profile fetch
    await page.route('**/rest/v1/profiles?id=eq.test-user-id&select=*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{
          id: 'test-user-id',
          username: 'testuser',
          is_uploader: true,
          total_votes_received: 0
        }]),
      });
    });

    await page.goto('/login');
  });

  test('should allow a user to sign up and be redirected to profile', async ({ page }) => {
    // Switch to Sign Up
    await page.click('text=Don\'t have an account? Sign up');
    
    // Fill in sign up details
    await page.fill('input[name="username"]', 'testuser');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    
    // Submit
    await page.click('button[type="submit"]');
    
    // Verify redirection to profile (as per app/login/page.tsx logic)
    await expect(page).toHaveURL(/\/profile/);
  });

  test('should allow a user to log in and navigate to dashboard', async ({ page }) => {
    // Fill in login details
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    
    // Submit
    await page.click('button[type="submit"]');
    
    // Verify redirection to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('h1')).toContainText('Platform Dashboard');
  });
});
