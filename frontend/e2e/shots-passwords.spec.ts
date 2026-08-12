import { test, type APIRequestContext } from '@playwright/test';
import { login, rowAction } from './helpers';

/** Скриншоты экранов с паролями (вручную: npx playwright test e2e/shots-passwords.spec.ts). */

const API = 'http://localhost:3000';
const DIR = 'test-results/shots-passwords';

async function adminToken(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API}/auth/login`, {
    data: { username: 'admin', password: 'password123' },
  });
  return (await res.json()).accessToken;
}

test('скриншоты паролей', async ({ page, request }) => {
  await page.setViewportSize({ width: 1440, height: 900 });

  await login(page, 'admin');
  await page.getByRole('link', { name: 'Пользователи' }).click();
  await rowAction(page.getByRole('row', { name: /worker/ }).first(), 'Сменить пароль');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${DIR}/users-password.png`, fullPage: true });

  const token = await adminToken(request);
  const users = await (
    await request.get(`${API}/users`, { headers: { Authorization: `Bearer ${token}` } })
  ).json();
  for (const u of users.filter((x: { username: string }) => x.username.startsWith('testov.'))) {
    await request.delete(`${API}/users/${u.id}`, { headers: { Authorization: `Bearer ${token}` } });
  }

  await page.getByRole('button', { name: /Выйти/ }).click();
  await login(page, 'planner');
  await page.getByRole('link', { name: 'Импорт' }).click();
  await page.locator('input[type="file"]').first().setInputFiles('e2e/fixtures/test-competency.xlsx');
  await page.getByRole('button', { name: /Проверить|Загрузить/ }).first().click();
  await page.getByRole('button', { name: 'Импортировать' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${DIR}/import-credentials.png`, fullPage: true });

  const users2 = await (
    await request.get(`${API}/users`, { headers: { Authorization: `Bearer ${token}` } })
  ).json();
  for (const u of users2.filter((x: { username: string }) => x.username.startsWith('testov.'))) {
    await request.delete(`${API}/users/${u.id}`, { headers: { Authorization: `Bearer ${token}` } });
  }
});
