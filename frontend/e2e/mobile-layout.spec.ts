import { test, expect } from '@playwright/test';

/**
 * Проверка мобильной вёрстки: 375×812 — узкий телефон, худший реальный случай.
 * Смотрим не «красиво или нет», а то, что ломает работу: горизонтальную прокрутку
 * страницы и элементы, уехавшие за край экрана.
 */
const PHONE = { width: 375, height: 812 };

const ROUTES: [string, string, string][] = [
  ['worker', '/worker/tasks', 'Мои задания'],
  ['worker', '/my-work', 'Моя работа'],
  ['worker', '/handover', 'Пересменка'],
  ['worker', '/tasks', 'Задачи'],
  ['site_lead', '/site-lead/distribution', 'Распределение'],
  ['site_lead', '/site-lead/competency', 'Матрица компетенций'],
  ['site_lead', '/site-lead/absences', 'Отсутствия'],
  ['site_lead', '/site-lead/transfers', 'Переводы'],
  ['site_lead', '/site-lead/shifts', 'Планирование смен'],
  ['site_lead', '/site-lead/journal', 'Журнал смен'],
  ['site_lead', '/site-lead/equipment', 'Оборудование участка'],
  ['site_lead', '/site-lead/goals', 'Цели'],
  ['site_lead', '/site-lead/stats', 'Статистика участка'],
  ['planner', '/planner/orders', 'Заказы'],
  ['planner', '/planner/operations', 'Операции'],
  ['planner', '/planner/skills', 'Навыки'],
  ['planner', '/planner/products', 'Проекты'],
  ['planner', '/planner/materials', 'Материалы'],
  ['planner', '/planner/import', 'Импорт'],
  ['production_head', '/production-head/summary', 'Сводка участков'],
  ['production_head', '/production-head/equipment', 'Оборудование завода'],
  ['production_head', '/production-head/materials', 'Материалы завода'],
  ['production_head', '/production-head/trends', 'Тренды'],
  ['production_head', '/production-head/warnings', 'Предупреждения'],
  ['production_head', '/production-head/shift-leads', 'Старшие смен'],
  ['admin', '/admin/platforms', 'Площадки'],
  ['admin', '/admin/sites', 'Участки'],
  ['admin', '/admin/users', 'Пользователи'],
  ['admin', '/admin/import', 'Импорт сотрудников'],
  ['admin', '/admin/feedback', 'Обращения'],
  ['admin', '/admin/audit-log', 'Журнал действий'],
];

test('мобильная вёрстка: 375 точек', async ({ page }) => {
  test.setTimeout(600_000); // 31 экран под четырьмя ролями — в стандартные 30 с не влезает
  await page.setViewportSize(PHONE);
  const report: string[] = [];

  // Сначала открываем приложение: до этого страница about:blank, и относительный
  // fetch на /api из неё не уходит — первый экран в отчёт не попадал.
  await page.goto('/login');
  // Заставка помечается показанной только после просмотра, поэтому на каждой
  // навигации всплывала заново и закрывала собой экран. Ставим отметку сами.
  await page.evaluate(() => sessionStorage.setItem('belmy_intro_shown', '1'));

  for (const [role, route, label] of ROUTES) {
    const token = await page.evaluate(async (r) => {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: r, password: 'password123' }),
      });
      const j = await res.json();
      localStorage.setItem('belmy_token', j.accessToken);
      return j.accessToken as string;
    }, role).catch(() => null);
    if (!token) { await page.goto('/login'); continue; }

    await page.goto(route);
    await page.waitForTimeout(1200);

    const m = await page.evaluate(() => {
      const de = document.documentElement;
      const overflow = de.scrollWidth - window.innerWidth;
      const wide = [...document.querySelectorAll('*')].filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && r.right > window.innerWidth + 2;
      });
      const scrollers = [...document.querySelectorAll('*')].filter((e) => {
        const cs = getComputedStyle(e);
        return e.scrollWidth > e.clientWidth + 2 && ['auto', 'scroll'].includes(cs.overflowX);
      }).length;
      const small = [...document.querySelectorAll('button, a, input, [role=combobox]')].filter((e) => {
        const r = e.getBoundingClientRect();
        return r.height > 0 && r.height < 32;
      }).length;
      return { overflow, wide: wide.length, scrollers, small, tags: wide.slice(0, 3).map((e) => e.tagName + (e.className && typeof e.className === 'string' ? '' : '')) };
    });

    const bad = m.overflow > 2;
    report.push(
      `${bad ? '✗' : '✓'} ${label} (${route}) — прокрутка страницы ${m.overflow > 2 ? m.overflow + 'px' : 'нет'}` +
      `, за краем ${m.wide}, своих прокруток ${m.scrollers}, мелких кнопок ${m.small}`,
    );
    // Снимки нужны глазами: пережатую колонку числа не показывают.
    await page.screenshot({ path: `test-results/mobile/${label.replace(/[^\wа-яА-Я]+/g, '_')}.png` });
  }
  console.log('\n' + report.join('\n'));
  const broken = report.filter((r) => r.startsWith('✗'));
  console.log(`\nэкранов: ${report.length}, с горизонтальной прокруткой: ${broken.length}`);

  /**
   * Горизонтальная прокрутка всей страницы на телефоне — всегда поломка вёрстки:
   * человек листает вбок вместо того, чтобы работать. Широкие таблицы к этому не
   * относятся: они прокручиваются внутри своего блока, а страница стоит на месте.
   */
  expect(broken, 'Экраны с горизонтальной прокруткой: ' + broken.join('; ')).toHaveLength(0);
});
