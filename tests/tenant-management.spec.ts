import { test, expect } from '@playwright/test';
import { loginAsAdmin, navigateToTenantConsole, logout } from './utils';

test.describe('Tenant management workflows', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test.afterEach(async ({ page }) => {
    const logoutButtonCount = await page.getByRole('button', { name: /logout/i }).count();
    if (logoutButtonCount > 0) {
      await logout(page);
    }
  });

  test('super admin can create and update a tenant', async ({ page }) => {
  await navigateToTenantConsole(page);

  const createTenantLink = page.getByRole('link', { name: /create tenant/i });
  await expect(createTenantLink).toBeVisible();
  await createTenantLink.click();

  await page.waitForURL('**/CreateTenant', { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Create New Tenant' })).toBeVisible();

  const timestamp = Date.now();
  const slug = `qatenant${timestamp}`;
  const tenantName = `QA Tenant ${timestamp}`;
  const tenantDisplayName = `${tenantName} Display`;
  const updatedDisplayName = `${tenantDisplayName} Updated`;

  await page.getByPlaceholder('Acme Logistics Inc.', { exact: true }).fill(tenantName);
  await page.getByPlaceholder('Acme Logistics', { exact: true }).fill(tenantDisplayName);
  await page.getByPlaceholder('acme', { exact: true }).first().fill(slug);
  await page.getByPlaceholder('acme', { exact: true }).nth(1).fill(slug);

    await page.getByRole('button', { name: /create tenant/i }).click();

    await Promise.race([
      page.waitForURL('**/ViewTenant?id=*', { timeout: 60_000 }).catch(() => null),
      page.waitForURL('**/Login', { timeout: 60_000 }).catch(() => null),
    ]);

    const expectedTenantName = tenantName.toUpperCase();

    if (page.url().includes('/Login')) {
      await loginAsAdmin(page);
    }

    if (!page.url().includes('/ViewTenant')) {
      await navigateToTenantConsole(page);
      const searchInput = page.getByPlaceholder('Search by name, code, or subdomain...');
      await searchInput.fill(slug);
      await expect(page.getByRole('cell', { name: expectedTenantName })).toBeVisible();
      await page.getByRole('button', { name: 'View Details' }).first().click();
      await page.waitForURL('**/ViewTenant', { timeout: 60_000 });
    }

    await expect(page.getByRole('heading', { name: expectedTenantName })).toBeVisible();
    await expect(page.getByText(tenantDisplayName)).toBeVisible();

    const editTenantLink = page.getByRole('link', { name: /^Edit$/ }).first();
    await expect(editTenantLink).toBeVisible();
    await editTenantLink.click();

    await page.waitForURL('**/EditTenant', { timeout: 60_000 });
    await expect(page.getByRole('heading', { name: /edit tenant/i })).toBeVisible();

    await page.getByPlaceholder('Acme Logistics', { exact: true }).fill(updatedDisplayName);

    await page.getByRole('button', { name: /save changes/i }).click();

    await page.waitForURL('**/ViewTenant', { timeout: 60_000 });
    await expect(page.getByText(updatedDisplayName)).toBeVisible();

    await navigateToTenantConsole(page);
    await page.getByPlaceholder('Search by name, code, or subdomain...').fill(slug);

    await expect(page.getByRole('cell', { name: expectedTenantName })).toBeVisible();
  });
});
