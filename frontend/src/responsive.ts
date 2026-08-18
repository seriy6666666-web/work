import { useEffect, useState } from 'react';

/**
 * Граница «узкого экрана» — одна на всё приложение.
 *
 * 900 точек: ниже неё боковое меню уже сворачивается в кнопку, и раскладка в две
 * колонки перестаёт помещаться. Держим значение в одном месте, иначе экраны
 * начнут перестраиваться вразнобой: меню свернулось, а колонки ещё нет.
 */
export const MOBILE_QUERY = '(max-width: 900px)';

/**
 * Медиазапросами это не решить: стили в проекте заданы прямо в коде, а не в
 * CSS-файлах, и `@media` к ним не применить. Поэтому спрашиваем ширину у
 * браузера и перестраиваем раскладку в React.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return isMobile;
}
