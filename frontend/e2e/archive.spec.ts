import { expect, test, type APIRequestContext } from '@playwright/test';
import { login, rowAction, chooseOption } from './helpers';

/** Архив сотрудника: увольнение без потери истории. */

const API = 'http://localhost:3000';

async function adminToken(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API}/auth/login`, {
    data: { username: 'admin', password: 'password123' },
  });
  return (await res.json()).accessToken;
}

async function restoreWorker(request: APIRequestContext) {
  const token = await adminToken(request);
  const users = await (
    await request.get(`${API}/users?withArchived=true`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).json();
  const worker = users.find((u: { username: string }) => u.username === 'worker');
  if (worker?.archivedAt) {
    await request.post(`${API}/users/${worker.id}/restore`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}

/**
 * Тест архивирует демо-сотрудника `worker` и возвращает его через интерфейс. Если он
 * падал на середине, `worker` оставался в архиве — а архивным вход закрыт, поэтому
 * следом падали вообще все тесты, включая простой логин. Наступали на это.
 * Возврат в afterEach срабатывает независимо от результата.
 */
test.afterEach(async ({ request }) => {
  await restoreWorker(request);
});

test('админ отправляет сотрудника в архив и возвращает обратно', async ({ page, request }) => {
  await restoreWorker(request);

  await login(page, 'admin');
  await page.getByRole('link', { name: 'Пользователи' }).click();

  const row = page.getByRole('row', { name: /worker/ }).first();
  await expect(row).toBeVisible();
  await rowAction(row, 'В архив');
  await page.getByRole('button', { name: 'В архив' }).last().click(); // подтверждение

  // Из обычного списка человек пропал.
  await expect(page.getByRole('row', { name: /worker/ })).toHaveCount(0);

  // Вход закрыт.
  const denied = await request.post(`${API}/auth/login`, {
    data: { username: 'worker', password: 'password123' },
  });
  expect(denied.status()).toBe(401);
  expect(JSON.stringify(await denied.json())).toContain('архив');

  // Виден только под галочкой «Показывать архив» и помечен.
  await page.getByText('Показывать архив').click();
  const archived = page.getByRole('row', { name: /worker/ }).first();
  await expect(archived).toBeVisible();
  await expect(archived.getByText('в архиве')).toBeVisible();

  await rowAction(archived, 'Вернуть в работу');
  await expect(page.getByText(/снова в работе/)).toBeVisible();

  const allowed = await request.post(`${API}/auth/login`, {
    data: { username: 'worker', password: 'password123' },
  });
  expect(allowed.ok()).toBeTruthy();
});

test('начальник производства видит сотрудников участка в выборе старшего смены', async ({ page }) => {
  await login(page, 'production_head');
  await page.getByRole('link', { name: 'Старшие смен' }).click();

  // До выбора участка список людей заблокирован и об этом сказано прямо.
  const people = page.getByPlaceholder('Сначала выберите участок');
  await expect(people).toBeDisabled();

  // «Сборка» — единственный демо-участок с сотрудниками.
  await chooseOption(page.getByRole('combobox', { name: 'Участок' }), 'Сборка');

  /**
   * Раньше список людей приходил из админского эндпоинта и всегда был пустым.
   * Проверяем именно это — что кандидаты есть.
   *
   * Прошлая версия теста брала `locator('select').nth(1)` и попадала в выпадающий
   * список типа смены, а не людей: там всегда две опции, поэтому проверка
   * «опций не ровно одна» проходила независимо от того, работает ли выбор людей.
   */
  const search = page.getByPlaceholder('Найти сотрудника');
  await expect(search).toBeEnabled();
  await search.click();
  await expect(page.getByRole('button', { name: /Тестовый|Иванов|Петров|Сидоров/ }).first()).toBeVisible();
});
