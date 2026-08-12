import { test, expect } from '@playwright/test';
import { login, chooseOption } from './helpers';

/**
 * Компонент Select живёт в формах, где поле подписано через `<label>`. А `<button>` —
 * labelable-элемент, поэтому label пересылает ему активацию вторым кликом: список
 * открывался и тут же закрывался, а после выбора — открывался снова. Внешне это
 * выглядело как «выпадающий список не работает» и ломало бы все экраны с формами.
 * Тест держит именно этот случай: настоящие клики в форме, обёрнутой в label.
 */
test('список внутри label открывается, выбирает и закрывается', async ({ page }) => {
  await login(page, 'admin');
  await page.getByRole('link', { name: 'Пользователи' }).click();
  await page.getByRole('button', { name: '+ Добавить сотрудника' }).click();

  const site = page.getByRole('combobox', { name: 'Участок' });
  await expect(site).toHaveAttribute('aria-expanded', 'false');

  // Открывается с первого клика.
  await site.click();
  await expect(site).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByRole('option', { name: 'Сборка' })).toBeVisible();

  // Выбор закрывает список и подставляет значение — а не открывает его заново.
  await page.getByRole('option', { name: 'Сборка' }).click();
  await expect(site).toHaveAttribute('aria-expanded', 'false');
  await expect(site).toContainText('Сборка');
});

test('клавиатура: стрелки ведут по списку, Enter выбирает, Escape закрывает', async ({ page }) => {
  await login(page, 'admin');
  await page.getByRole('link', { name: 'Пользователи' }).click();
  await page.getByRole('button', { name: '+ Добавить сотрудника' }).click();

  const role = page.getByRole('combobox', { name: 'Роль' });
  await role.click();
  await expect(role).toHaveAttribute('aria-expanded', 'true');

  await page.keyboard.press('Escape');
  await expect(role).toHaveAttribute('aria-expanded', 'false');

  // Список открывается с клавиатуры и выбор применяется.
  await role.press('ArrowDown');
  await expect(role).toHaveAttribute('aria-expanded', 'true');
  await role.press('ArrowDown');
  await role.press('Enter');
  await expect(role).toHaveAttribute('aria-expanded', 'false');
});

test('роль с участком: без участка не сохраняем и говорим почему', async ({ page }) => {
  await login(page, 'admin');
  await page.getByRole('link', { name: 'Пользователи' }).click();
  await page.getByRole('button', { name: '+ Добавить сотрудника' }).click();

  const login_ = `e2e.sel.${Date.now()}`;
  await page.getByPlaceholder('Иванов Иван').fill('Селектов Тест');
  await page.getByPlaceholder('ivanov').fill(login_);
  await page.getByPlaceholder('belmy-7413').fill('belmy-1234');

  // Роль «Сотрудник» требует участка. Раньше за это отвечал native required,
  // у своего компонента его нет — проверка должна быть в коде страницы.
  await page.getByRole('button', { name: 'Добавить' }).click();
  await expect(page.getByText(/нужно выбрать участок/)).toBeVisible();

  // С участком сотрудник создаётся.
  await chooseOption(page.getByRole('combobox', { name: 'Участок' }), 'Сборка');
  await page.getByRole('button', { name: 'Добавить' }).click();
  await expect(page.getByText('Пользователь создан')).toBeVisible();

  // Убираем за собой, чтобы демо-база не обрастала тестовыми людьми.
  await page.getByPlaceholder(/Поиск по логину/).fill(login_);
  const row = page.getByRole('row', { name: new RegExp(login_) });
  await row.getByRole('button', { name: 'Ещё действия' }).click();
  await page.getByRole('button', { name: 'Удалить' }).click();
  await page.getByRole('button', { name: 'Удалить', exact: true }).last().click();
  await expect(page.getByText('Пользователь удалён')).toBeVisible();
});
