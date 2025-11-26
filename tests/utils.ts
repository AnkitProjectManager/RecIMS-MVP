import { expect, Page } from '@playwright/test';

export const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@recims.com';
export const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'admin123';

export async function loginAsAdmin(page: Page) {
  await page.goto('/Login');
  await page.getByLabel('Email').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/Dashboard', { timeout: 60_000 });
  await expect(page).toHaveURL(/\/Dashboard$/);
}

export async function navigateToTenantConsole(page: Page) {
  const tenantConsoleLink = page.getByRole('link', { name: /tenant console/i }).first();
  await expect(tenantConsoleLink).toBeVisible();
  await tenantConsoleLink.click();
  await page.waitForURL('**/TenantConsole', { timeout: 30_000 });
}

export async function logout(page: Page) {
  const logoutButton = page.getByRole('button', { name: /logout/i });
  await expect(logoutButton).toBeVisible();
  await logoutButton.click();
  await page.waitForURL('**/Login', { timeout: 30_000 });
  await expect(page).toHaveURL(/\/Login$/);
}
