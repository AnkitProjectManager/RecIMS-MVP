import { test, expect, Page } from '@playwright/test';
import { loginAsAdmin, navigateToTenantConsole, logout } from './utils';

test.describe('Tenant Console', () => {
  test.beforeEach(async ({ page }: { page: Page }) => {
    await loginAsAdmin(page);
  });

  test.afterEach(async ({ page }: { page: Page }) => {
    const logoutButtonCount = await page.getByRole('button', { name: /logout/i }).count();
    if (logoutButtonCount > 0) {
      await logout(page);
    }
  });

  test('super admin can see seeded tenants after login', async ({ page }: { page: Page }) => {
    await navigateToTenantConsole(page);

    await expect(page.getByRole('heading', { name: 'Tenant Console' })).toBeVisible();
    await expect(page.getByText(/connecticut metals/i).first()).toBeVisible();
    await expect(page.getByText(/min-tech recycling/i).first()).toBeVisible();
  });

  test('logout from dashboard returns user to login screen', async ({ page }: { page: Page }) => {
    await expect(page).toHaveURL(/\/Dashboard$/);
    await logout(page);
    await expect(page.getByText('Sign in to RecIMS')).toBeVisible();
  });
});
