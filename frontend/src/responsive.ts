import { useEffect, useState } from 'react';

/**
 * Четыре порога раскладки — из макета.
 *
 * Раньше порог был один, 900 точек, и он решал сразу всё: и куда девать меню, и
 * сколько колонок. Из-за этого планшет, повёрнутый вертикально (768), получал
 * телефонный вид, а горизонтально (1024) — настольный: одно и то же устройство
 * после поворота выглядело другой программой. Планшет в цеху основной, поэтому
 * так нельзя.
 *
 * Теперь поворот меняет расстановку блоков, а не сам интерфейс: и на 768, и на
 * 1024 раскладка планшетная, в две колонки. Отличается только меню — на узком
 * оно уезжает в шторку.
 */
export type Breakpoint = 'phone' | 'tablet' | 'tabletWide' | 'desktop';

/** Границы взяты из макета: 375 / 768 / 1024 / 1280. */
const QUERIES: [Breakpoint, string][] = [
  ['phone', '(max-width: 767px)'],
  ['tablet', '(min-width: 768px) and (max-width: 1023px)'],
  ['tabletWide', '(min-width: 1024px) and (max-width: 1279px)'],
  ['desktop', '(min-width: 1280px)'],
];

function current(): Breakpoint {
  if (typeof window === 'undefined') return 'desktop';
  for (const [name, q] of QUERIES) {
    if (window.matchMedia(q).matches) return name;
  }
  return 'desktop';
}

/**
 * Медиазапросами это не решить: стили в проекте заданы прямо в коде, а не в
 * CSS-файлах, и `@media` к ним не применить. Поэтому спрашиваем ширину у
 * браузера и перестраиваем раскладку в React.
 */
export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(current);

  useEffect(() => {
    const mqs = QUERIES.map(([, q]) => window.matchMedia(q));
    const handler = () => setBp(current());
    mqs.forEach((mq) => mq.addEventListener('change', handler));
    return () => mqs.forEach((mq) => mq.removeEventListener('change', handler));
  }, []);

  return bp;
}

/**
 * Меню в шторке. Ниже 1024 развёрнутое боковое меню съедает слишком много
 * ширины — на планшете важнее содержимое.
 */
export function useDrawerMenu(): boolean {
  const bp = useBreakpoint();
  return bp === 'phone' || bp === 'tablet';
}

/**
 * Одна колонка. Только телефон: на планшете, даже вертикальном, две колонки
 * помещаются, и терять их из-за поворота нельзя.
 */
export function useIsPhone(): boolean {
  return useBreakpoint() === 'phone';
}
