import { test } from '@playwright/test';
import { login } from './helpers';

/** Скриншоты новых экранов эпиков 4-6 (запускать вручную: npx playwright test e2e/shots456.spec.ts). */

const DIR = 'test-results/shots456';

test('скриншоты', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  await login(page, 'site_lead');
  await page.getByRole('link', { name: 'Цели сотрудников' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${DIR}/goals.png`, fullPage: true });

  await page.getByRole('link', { name: 'Статистика' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${DIR}/stats-reasons.png`, fullPage: true });

  await page.getByRole('link', { name: 'Пересменка' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${DIR}/handover.png`, fullPage: true });

  await page.getByRole('button', { name: /Выйти/ }).click();
  await login(page, 'production_head');
  await page.getByRole('link', { name: 'Старшие смен' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${DIR}/shift-leads.png`, fullPage: true });

  await page.getByRole('button', { name: /Выйти/ }).click();
  await login(page, 'admin');
  await page.getByRole('link', { name: 'Пользователи' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${DIR}/users-manager.png`, fullPage: true });
});
