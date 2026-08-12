import { test, type APIRequestContext } from '@playwright/test';
import { login } from './helpers';

/** Скриншот архива (вручную: npx playwright test e2e/shots-archive.spec.ts). */

const API = 'http://localhost:3000';

async function adminToken(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API}/auth/login`, {
    data: { username: 'admin', password: 'password123' },
  });
  return (await res.json()).accessToken;
}

test('скриншот архива', async ({ page, request }) => {
  const token = await adminToken(request);
  const users = await (
    await request.get(`${API}/users`, { headers: { Authorization: `Bearer ${token}` } })
  ).json();
  const worker = users.find((u: { username: string }) => u.username === 'worker');
  await request.post(`${API}/users/${worker.id}/archive`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  await page.setViewportSize({ width: 1440, height: 900 });
  await login(page, 'admin');
  await page.getByRole('link', { name: 'Пользователи' }).click();
  await page.getByText('Показывать архив').click();
  await page.getByRole('row', { name: /worker/ }).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'test-results/shots-archive/users-archive.png' });

  await request.post(`${API}/users/${worker.id}/restore`, {
    headers: { Authorization: `Bearer ${token}` },
  });
});
