import { test, expect } from '@playwright/test';
import { login } from './helpers';

const ROLE_HOME: { username: string; path: string; heading: string }[] = [
  { username: 'admin', path: '/admin/sites', heading: 'Участки' },
  { username: 'planner', path: '/planner/orders', heading: 'Заказы' },
  { username: 'site_lead', path: '/site-lead/distribution', heading: 'Распределение операций' },
  { username: 'production_head', path: '/production-head/summary', heading: 'Сводка участков' },
  { username: 'worker', path: '/worker/tasks', heading: 'Мои задания' },
];

for (const role of ROLE_HOME) {
  test(`${role.username} logs in and lands on ${role.path}`, async ({ page }) => {
    await login(page, role.username);
    await expect(page).toHaveURL(new RegExp(role.path.replace(/\//g, '\\/')));
    await expect(page.getByRole('heading', { name: role.heading })).toBeVisible();
  });
}

test('wrong password shows an error toast', async ({ page }) => {
  await login(page, 'admin', 'wrongpass');
  await expect(page.getByText(/Неверн|не удалось войти|Invalid/i)).toBeVisible();
});
