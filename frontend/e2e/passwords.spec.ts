import { expect, test, type APIRequestContext } from '@playwright/test';
import { login, rowAction } from './helpers';

/** Пароли: админ задаёт их вручную, импорт выдаёт каждому свой + список для раздачи. */

const API = 'http://localhost:3000';

async function tokenFor(request: APIRequestContext, username: string): Promise<string> {
  const res = await request.post(`${API}/auth/login`, {
    data: { username, password: 'password123' },
  });
  return (await res.json()).accessToken;
}

test('админ задаёт новый пароль сотруднику, и вход работает', async ({ page, request }) => {
  await login(page, 'admin');
  await page.getByRole('link', { name: 'Пользователи' }).click();

  const row = page.getByRole('row', { name: /worker/ }).first();
  await rowAction(row, 'Сменить пароль');

  // Пароль подставляется сгенерированным — админу остаётся нажать «Сохранить».
  const input = page.locator('tr').filter({ hasText: 'Новый пароль для' }).locator('input');
  const generated = await input.inputValue();
  expect(generated).toMatch(/^belmy-\d{4}$/);

  await page.getByRole('button', { name: 'Сохранить' }).click();
  await expect(page.getByText(/Новый пароль для/).first()).toBeVisible();
  await expect(page.getByText(generated).first()).toBeVisible();

  // Пароль действительно сменился.
  const check = await request.post(`${API}/auth/login`, {
    data: { username: 'worker', password: generated },
  });
  expect(check.ok()).toBeTruthy();

  // Возвращаем демо-пароль, чтобы не ломать остальные сценарии.
  const adminToken = await tokenFor(request, 'admin');
  const users = await (
    await request.get(`${API}/users`, { headers: { Authorization: `Bearer ${adminToken}` } })
  ).json();
  const worker = users.find((u: { username: string }) => u.username === 'worker');
  await request.patch(`${API}/users/${worker.id}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { password: 'password123' },
  });
});

async function dropTestUsers(request: APIRequestContext) {
  const adminToken = await tokenFor(request, 'admin');
  const users = await (
    await request.get(`${API}/users`, { headers: { Authorization: `Bearer ${adminToken}` } })
  ).json();
  for (const u of users.filter((x: { username: string }) => x.username.startsWith('testov.'))) {
    await request.delete(`${API}/users/${u.id}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
  }
}

test('импорт показывает пароли для раздачи и отдаёт CSV', async ({ page, request }) => {
  // Импорт создаёт пароли только новым людям — начинаем с чистого листа.
  await dropTestUsers(request);
  // Сотрудников заводит администратор: по ТЗ учётные записи его зона, и пароли
  // должен видеть он. Раньше этот сценарий шёл под планировщиком.
  await login(page, 'admin');
  await page.getByRole('link', { name: 'Импорт сотрудников' }).click();

  await page.locator('input[type="file"]').first().setInputFiles('e2e/fixtures/test-competency.xlsx');
  await page.getByRole('button', { name: /Проверить|Загрузить/ }).first().click();
  await page.getByRole('button', { name: 'Импортировать' }).click();

  await expect(page.getByText('Пароли для раздачи')).toBeVisible();
  const rows = page.locator('table tbody tr').filter({ hasText: 'testov.' });
  await expect(rows).toHaveCount(3);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Скачать CSV' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^logins_\d{4}-\d{2}-\d{2}\.csv$/);
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(c as Buffer);
  const csv = Buffer.concat(chunks).toString('utf-8');
  expect(csv.startsWith('﻿')).toBeTruthy(); // BOM — иначе Excel ломает кириллицу
  expect(csv).toContain('ФИО,Логин,Пароль');
  expect(csv).toContain('testov.pervyy');

  // Уборка: тестовые сотрудники не должны остаться в базе.
  await dropTestUsers(request);
});

/**
 * Планировщик грузит ту же матрицу компетенций, но учётных записей не создаёт и
 * паролей не получает. Раньше он заводил людей десятками и видел их пароли на
 * экране, хотя ему закрыт даже список сотрудников (GET /users → 403).
 */
test('планировщик импортирует компетенции без создания людей и без паролей', async ({
  page,
  request,
}) => {
  await dropTestUsers(request);
  const adminToken = await tokenFor(request, 'admin');
  const countUsers = async () =>
    (
      await (await request.get(`${API}/users`, { headers: { Authorization: `Bearer ${adminToken}` } })).json()
    ).length;

  const before = await countUsers();

  await login(page, 'planner');
  await page.getByRole('link', { name: 'Импорт из Excel' }).click();
  await page.locator('input[type="file"]').first().setInputFiles('e2e/fixtures/test-competency.xlsx');
  await page.getByRole('button', { name: 'Проверить файл' }).first().click();
  await page.getByRole('button', { name: 'Импортировать' }).click();
  await expect(page.getByText('Загружено')).toBeVisible();

  // Паролей нет, вместо них — кого администратору надо завести.
  await expect(page.getByText('Пароли для раздачи')).toHaveCount(0);
  // .first(): подпись показателя матчится и сама, и вместе с обёрткой-значением.
  await expect(page.getByText('Нет в системе').first()).toBeVisible();

  expect(await countUsers()).toBe(before);
});
