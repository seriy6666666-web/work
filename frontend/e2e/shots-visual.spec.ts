import { test } from '@playwright/test';
import { login } from './helpers';

/** Скриншоты после визуального прохода. */

const DIR = 'test-results/shots-visual';

test('форма создания и поиск по сотрудникам', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  await login(page, 'admin');
  await page.getByRole('link', { name: 'Пользователи' }).click();
  await page.getByRole('button', { name: '+ Добавить сотрудника' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${DIR}/create-form.png` });

  await page.getByRole('button', { name: /Выйти/ }).click();
  await login(page, 'site_lead');
  await page.getByRole('link', { name: 'Цели сотрудников' }).click();
  await page.getByPlaceholder('Найти сотрудника').click();
  await page.getByPlaceholder('Найти сотрудника').fill('пет');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${DIR}/search-people.png` });
});
