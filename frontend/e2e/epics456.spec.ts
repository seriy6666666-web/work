import { expect, test } from '@playwright/test';
import { login } from './helpers';

/** Эпики 4-6: иерархия, цели сотрудников, старший смены и пересменка. */

test('начальник участка ставит цель сотруднику', async ({ page }) => {
  await login(page, 'site_lead');
  await page.getByRole('link', { name: 'Цели сотрудников' }).click();
  await expect(page).toHaveURL(/\/site-lead\/goals$/);
  await expect(page.getByRole('heading', { name: 'Цели сотрудников' })).toBeVisible();

  const worker = page.locator('select').first();
  const option = worker.locator('option').nth(1);
  await worker.selectOption(await option.getAttribute('value'));
  await page.getByPlaceholder('План, шт').fill('90');
  await page.getByRole('button', { name: 'Задать цель' }).click();
  // Цель появилась в таблице ниже формы.
  await expect(page.getByRole('cell', { name: '90' }).first()).toBeVisible();
});

test('начальник производства назначает старшего смены', async ({ page }) => {
  await login(page, 'production_head');
  await page.getByRole('link', { name: 'Старшие смен' }).click();
  await expect(page).toHaveURL(/\/production-head\/shift-leads$/);
  await expect(page.getByRole('heading', { name: 'Старшие смен' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Назначить' })).toBeVisible();
});

test('пересменка открывается у обеих ролей', async ({ page }) => {
  await login(page, 'site_lead');
  await page.getByRole('link', { name: 'Пересменка' }).click();
  await expect(page).toHaveURL(/\/handover$/);
  await expect(page.getByRole('button', { name: 'Передать дела' })).toBeVisible();

  await page.getByRole('button', { name: /Выйти/ }).click();
  await login(page, 'production_head');
  await page.getByRole('link', { name: 'Пересменка' }).click();
  await expect(page).toHaveURL(/\/handover$/);
  // Начальник производства только читает сводку по всем участкам.
  await expect(page.getByRole('button', { name: 'Передать дела' })).toHaveCount(0);
});

test('админ видит и меняет руководителя сотрудника', async ({ page }) => {
  await login(page, 'admin');
  await page.getByRole('link', { name: 'Пользователи' }).click();
  await expect(page.getByRole('columnheader', { name: /Руководитель/ })).toBeVisible();
  await page.getByRole('button', { name: 'Редактировать' }).first().click();
  await expect(page.getByRole('option', { name: 'Без руководителя' }).first()).toBeAttached();
});

test('в статистике участка есть колонка причин', async ({ page }) => {
  await login(page, 'site_lead');
  await page.getByRole('link', { name: 'Статистика' }).click();
  await expect(page.getByRole('columnheader', { name: 'Причины невыполнения' })).toBeVisible();
});

test('рабочий-старший смены передаёт дела со своего экрана', async ({ page, request }) => {
  // Назначаем рабочего старшим смены через API, как это делает начальник производства.
  const auth = await request.post('http://localhost:3000/auth/login', {
    data: { username: 'production_head', password: 'password123' },
  });
  const headToken = (await auth.json()).accessToken;
  const adminAuth = await request.post('http://localhost:3000/auth/login', {
    data: { username: 'admin', password: 'password123' },
  });
  const adminToken = (await adminAuth.json()).accessToken;
  const usersRes = await request.get('http://localhost:3000/users', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const users = await usersRes.json();
  const worker = users.find((u: { username: string }) => u.username === 'worker');
  const today = new Date().toISOString().slice(0, 10);
  const created = await request.post('http://localhost:3000/shift-leads', {
    headers: { Authorization: `Bearer ${headToken}` },
    data: { siteId: worker.siteId, userId: worker.id, date: today, type: 'NIGHT' },
  });
  expect(created.ok()).toBeTruthy();

  await login(page, 'worker');
  await expect(page.getByText(/Пересменка — вы старший смены/)).toBeVisible();
  await page.getByText(/Пересменка — вы старший смены/).click();
  await page.getByPlaceholder(/Что передать следующей смене/).fill('Тест: линия 1 без клея');
  await page.getByRole('button', { name: 'Передать дела' }).click();
  await expect(page.getByText(/Тест: линия 1 без клея/)).toBeVisible();

  const lead = await (
    await request.get(`http://localhost:3000/shift-leads?from=${today}&to=${today}`, {
      headers: { Authorization: `Bearer ${headToken}` },
    })
  ).json();
  for (const l of lead) {
    await request.delete(`http://localhost:3000/shift-leads/${l.id}`, {
      headers: { Authorization: `Bearer ${headToken}` },
    });
  }
});
