import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('site lead sees the distribution board with stat cards', async ({ page }) => {
  await login(page, 'site_lead');
  await expect(page).toHaveURL(/\/site-lead\/distribution/);

  // Metric cards from the reference design (labels unique to the stats row).
  await expect(page.getByText('Выполнение плана')).toBeVisible();
  await expect(page.getByText('Операций в работе')).toBeVisible();
  await expect(page.getByText('Риск отставания')).toBeVisible();

  // Two-column layout headings.
  await expect(page.getByRole('heading', { name: 'Операции участка' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Сотрудники на смене' })).toBeVisible();
});

test('theme toggle switches to dark mode', async ({ page }) => {
  await login(page, 'site_lead');
  await page.getByRole('button', { name: 'Переключить тему' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});
