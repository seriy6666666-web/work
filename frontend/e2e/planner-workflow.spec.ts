import { test, expect, type APIRequestContext } from '@playwright/test';
import { login, rowAction, chooseOption } from './helpers';

const API = 'http://localhost:3000';

/**
 * Тест убирает за собой через интерфейс в самом конце. Если он падал раньше, в базе
 * оставались навык и заказ с префиксом E2E — их потом находили руками в демо-данных.
 * Здесь та же уборка, но через API и независимо от результата.
 *
 * Порядок важен: операции ссылаются и на заказ, и на навык, поэтому удаляются первыми.
 */
async function dropE2eData(request: APIRequestContext) {
  const token = (
    await (await request.post(`${API}/auth/login`, { data: { username: 'planner', password: 'password123' } })).json()
  ).accessToken;
  const auth = { Authorization: `Bearer ${token}` };

  const orders = await (await request.get(`${API}/orders`, { headers: auth })).json();
  for (const o of orders.filter((x: { name: string }) => x.name.startsWith('E2E-'))) {
    const detail = await (await request.get(`${API}/orders/${o.id}`, { headers: auth })).json();
    for (const op of detail.operations ?? []) {
      await request.delete(`${API}/operations/${op.id}`, { headers: auth });
    }
    await request.delete(`${API}/orders/${o.id}`, { headers: auth });
  }

  const skills = await (await request.get(`${API}/skills`, { headers: auth })).json();
  for (const s of skills.filter((x: { name: string }) => x.name.startsWith('E2E-'))) {
    await request.delete(`${API}/skills/${s.id}`, { headers: auth });
  }
}

test.afterEach(async ({ request }) => {
  await dropE2eData(request);
});

/**
 * Deep planner workflow: create a skill, create an order, add an operation to
 * it, then clean everything up. Exercises the order → operation lifecycle plus
 * toasts and the confirm modal end-to-end.
 */
test('planner: skill → order → operation → cleanup', async ({ page }) => {
  const stamp = Date.now();
  const skillName = `E2E-навык-${stamp}`;
  const orderName = `E2E-заказ-${stamp}`;

  await login(page, 'planner');
  await expect(page).toHaveURL(/\/planner\/orders/);

  // 1. Create a skill.
  await page.getByRole('link', { name: 'Навыки' }).click();
  await page.getByPlaceholder(/Название навыка/).fill(skillName);
  await page.getByRole('button', { name: 'Добавить' }).click();
  await expect(page.getByText('Навык создан')).toBeVisible();

  // 2. Create an order.
  // На странице две формы: обычный заказ и «из проекта (шаблон)» — берём первую.
  await page.getByRole('link', { name: 'Заказы' }).click();
  const orderForm = page.locator('form').first();
  await orderForm.getByPlaceholder(/Наименование/).fill(orderName);
  await orderForm.getByPlaceholder('Количество').fill('100');
  await orderForm.locator('input[type="date"]').fill('2026-12-31');
  await orderForm.getByRole('button', { name: 'Создать' }).click();
  await expect(page.getByText('Заказ создан')).toBeVisible();

  // 3. Open the order and add an operation.
  await page.getByRole('row', { name: new RegExp(orderName) }).getByRole('link', { name: /Открыть/ }).click();
  await expect(page.getByRole('heading', { name: orderName })).toBeVisible();

  // Поля выбора — компонент Select: selectOption работает только с нативным <select>,
  // поэтому открываем список и щёлкаем по строке. Ищем по подписи, а не по номеру:
  // позиционные индексы ломались от любой правки вёрстки.
  await chooseOption(page.getByRole('combobox', { name: 'Навык' }), skillName);
  await page.getByPlaceholder('Количество').fill('100');
  // exact: true — иначе «Участок» матчится и во «Второй участок» рядом.
  await chooseOption(page.getByRole('combobox', { name: 'Участок', exact: true }), 'Сборка');
  await page.getByRole('button', { name: 'Добавить' }).click();
  await expect(page.getByText('Операция добавлена')).toBeVisible();
  await expect(page.getByRole('cell', { name: skillName })).toBeVisible();

  // 4. Cleanup: delete operation, then the order, then the skill.
  await page.getByRole('button', { name: 'Удалить', exact: true }).first().click();
  await expect(page.getByText('Удаление операции')).toBeVisible();
  await page.getByRole('button', { name: 'Удалить', exact: true }).last().click();
  await expect(page.getByText('Операция удалена')).toBeVisible();

  await page.getByRole('button', { name: 'Удалить заказ' }).click();
  await expect(page.getByText('Удаление заказа')).toBeVisible();
  await page.getByRole('button', { name: 'Удалить', exact: true }).last().click();
  await expect(page).toHaveURL(/\/planner\/orders/);

  await page.getByRole('link', { name: 'Навыки' }).click();
  await page.getByPlaceholder('Поиск навыка...').fill(skillName);
  await rowAction(page.getByRole('row', { name: new RegExp(skillName) }), 'Удалить');
  await page.getByRole('button', { name: 'Удалить', exact: true }).last().click();
  await expect(page.getByText('Навык удалён')).toBeVisible();
});
