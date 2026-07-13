import { type Page, expect } from '@playwright/test';

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
