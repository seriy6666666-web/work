import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('admin can create a site (toast) and delete it (confirm modal)', async ({ page }) => {
  await login(page, 'admin');
  await expect(page).toHaveURL(/\/admin\/sites/);

  const name = `E2E-${Date.now()}`;

  // Create
  await page.getByPlaceholder(/Название участка/).fill(name);
  await page.getByRole('button', { name: 'Добавить' }).click();

  // Success toast
  await expect(page.getByText('Участок создан')).toBeVisible();
  await expect(page.getByRole('cell', { name })).toBeVisible();

  // Search narrows the table
  await page.getByPlaceholder('Поиск участка...').fill(name);
  await expect(page.getByRole('cell', { name })).toBeVisible();

  // Delete via confirm modal
  const row = page.getByRole('row', { name: new RegExp(name) });
  await row.getByRole('button', { name: 'Удалить' }).click();

  const dialog = page.getByText('Удаление участка');
  await expect(dialog).toBeVisible();
  await page.getByRole('button', { name: 'Удалить', exact: true }).last().click();

  await expect(page.getByText('Участок удалён')).toBeVisible();
});
