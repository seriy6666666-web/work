import { expect, test, type APIRequestContext } from '@playwright/test';
import { login } from './helpers';

/** Обращения: пишет любой, читает только админ, ответ возвращается человеку. */

const API = 'http://localhost:3000';

async function tokenFor(request: APIRequestContext, username: string): Promise<string> {
  const res = await request.post(`${API}/auth/login`, {
    data: { username, password: 'password123' },
  });
  return (await res.json()).accessToken;
}

test('рабочий пишет о проблеме, админ отвечает', async ({ page, request }) => {
  const message = `Тест ${Date.now()}: не грузится список заданий`;

  await login(page, 'worker');
  await page.getByRole('button', { name: 'Сообщить' }).click();
  await expect(page.getByText('Что происходит?')).toBeVisible();
  await page.getByPlaceholder(/не могу отметить выполнение/).fill(message);
  await page.getByRole('button', { name: 'Отправить' }).click();
  await expect(page.getByText(/обращение отправлено/)).toBeVisible();

  // Админ видит его вместе с экраном, откуда написали.
  await page.getByRole('button', { name: /Выйти/ }).click();
  await login(page, 'admin');
  await page.getByRole('link', { name: 'Обращения' }).click();
  const card = page.locator('div').filter({ hasText: message }).last();
  await expect(card).toBeVisible();
  await expect(page.getByText('экран /worker/tasks').first()).toBeVisible();

  await page.getByPlaceholder('Ответить сотруднику').first().fill('Починили, обновите страницу');
  await page.getByRole('button', { name: 'Ответить' }).first().click();
  await expect(page.getByText(/Ответ отправлен/)).toBeVisible();

  // Автор получил уведомление.
  const token = await tokenFor(request, 'worker');
  const notifications = await (
    await request.get(`${API}/notifications`, { headers: { Authorization: `Bearer ${token}` } })
  ).json();
  expect(notifications.some((n: { type: string }) => n.type === 'FEEDBACK_REPLY')).toBeTruthy();
});

test('анонимное обращение не показывает автора', async ({ page }) => {
  const message = `Аноним ${Date.now()}: задания ставят задним числом`;

  await login(page, 'site_lead');
  await page.getByRole('button', { name: 'Сообщить' }).click();
  await page.getByRole('button', { name: 'Жалоба' }).click();
  await page.getByPlaceholder(/не могу отметить выполнение/).fill(message);
  await page.getByText('Анонимно — не сохранять, кто написал').click();
  await page.getByRole('button', { name: 'Отправить' }).click();
  await expect(page.getByText(/обращение отправлено/)).toBeVisible();

  await page.getByRole('button', { name: /Выйти/ }).click();
  await login(page, 'admin');
  await page.getByRole('link', { name: 'Обращения' }).click();
  const card = page.locator('div').filter({ hasText: message }).last();
  await expect(card.getByText('анонимно')).toBeVisible();
});

test('после ухода спрашиваем, как прошла смена', async ({ page, request }) => {
  // Отмечаем приход через API, чтобы дойти до кнопки «Уход».
  const token = await tokenFor(request, 'worker');
  // Смены нет — сервер отвечает пустым телом, .json() на нём падает.
  const shiftBody = await (
    await request.get(`${API}/attendance/today`, { headers: { Authorization: `Bearer ${token}` } })
  ).text();
  if (!shiftBody) {
    await request.post(`${API}/attendance/check-in`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  await login(page, 'worker');
  const checkOut = page.getByRole('button', { name: 'Отметить уход' });
  if (await checkOut.isVisible()) {
    await checkOut.click();
    await expect(page.getByText('Как прошла смена?')).toBeVisible();
    await page.getByRole('button', { name: 'Были заминки' }).click();
    await page.getByPlaceholder(/Что именно мешало/).fill('Полсмены ждал материалы');
    await page.getByRole('button', { name: 'Отправить' }).click();
    await expect(page.getByText('Спасибо, записали.')).toBeVisible();
  }
});
