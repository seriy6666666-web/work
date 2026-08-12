import { type Locator, type Page, expect } from '@playwright/test';

/** Suppresses the intro splash so tests land directly on the app. */
export async function skipIntro(page: Page) {
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem('belmy_intro_shown', '1');
    } catch {
      /* ignore */
    }
  });
}

export async function login(page: Page, username: string, password = 'password123') {
  await skipIntro(page);
  await page.goto('/login');
  await page.getByLabel('Логин').fill(username);
  await page.getByLabel('Пароль').fill(password);
  await page.getByRole('button', { name: 'Войти' }).click();
}

export async function expectPath(page: Page, path: string) {
  await expect(page).toHaveURL(new RegExp(path.replace(/\//g, '\\/') + '$'));
}

/**
 * Выбор в компоненте Select. Нативный `selectOption` с ним не работает — там не
 * `<select>`, а кнопка со списком, — поэтому открываем и щёлкаем по строке.
 */
export async function chooseOption(trigger: Locator, name: string | RegExp) {
  await trigger.click();
  await trigger.page().getByRole('option', { name }).first().click();
}

/** Действие строки: первое видно сразу, остальные — под «•••». */
export async function rowAction(row: Locator, label: string) {
  const inline = row.getByRole('button', { name: label });
  if (await inline.count()) {
    await inline.first().click();
    return;
  }
  await row.getByRole('button', { name: 'Ещё действия' }).click();
  await row.page().getByRole('button', { name: label }).click();
}
