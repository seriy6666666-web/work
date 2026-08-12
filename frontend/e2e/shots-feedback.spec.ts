import { test } from '@playwright/test';
import { login } from './helpers';

/** Скриншоты обращений (вручную: npx playwright test e2e/shots-feedback.spec.ts). */

const DIR = 'test-results/shots-feedback';

test('скриншоты обращений', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  await login(page, 'worker');
  await page.getByRole('button', { name: 'Сообщить' }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${DIR}/worker-report.png` });

  await page.getByRole('button', { name: '✕' }).click();
  await page.getByRole('button', { name: /Выйти/ }).click();
  await login(page, 'admin');
  await page.getByRole('link', { name: 'Обращения' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${DIR}/admin-feedback.png` });
});
