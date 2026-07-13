import { test, expect } from '@playwright/test';
import { login } from './helpers';

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
  await page.getByRole('link', { name: 'Заказы' }).click();
  await page.getByPlaceholder(/Наименование/).fill(orderName);
  await page.getByPlaceholder('Количество').fill('100');
  await page.locator('input[type="date"]').fill('2026-12-31');
  await page.getByRole('button', { name: 'Создать' }).click();
  await expect(page.getByText('Заказ создан')).toBeVisible();

  // 3. Open the order and add an operation.
  await page.getByRole('row', { name: new RegExp(orderName) }).getByRole('link', { name: /Открыть/ }).click();
  await expect(page.getByRole('heading', { name: orderName })).toBeVisible();

  // Comboboxes on this page: [0] order status, [1] operation skill, [2] site, [3] second site.
  await page.getByRole('combobox').nth(1).selectOption({ label: skillName });
  await page.getByPlaceholder('Количество').fill('100');
  await page.getByRole('combobox').nth(2).selectOption({ index: 1 });
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
  await page.getByRole('row', { name: new RegExp(skillName) }).getByRole('button', { name: 'Удалить' }).click();
  await page.getByRole('button', { name: 'Удалить', exact: true }).last().click();
  await expect(page.getByText('Навык удалён')).toBeVisible();
});
