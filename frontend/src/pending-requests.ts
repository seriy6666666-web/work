import { useEffect, useState } from 'react';

/**
 * Сколько запросов к серверу сейчас в пути.
 *
 * Нужно ради одного: показать знак загрузки, когда ответ идёт долго. Считаем в
 * одном месте, а не в каждом экране — иначе тридцать страниц пришлось бы учить
 * одному и тому же по отдельности, и половина всё равно бы забылась.
 */
let pending = 0;
const listeners = new Set<(n: number) => void>();

export function requestStarted() {
  pending += 1;
  listeners.forEach((l) => l(pending));
}

export function requestFinished() {
  pending = Math.max(0, pending - 1);
  listeners.forEach((l) => l(pending));
}

/**
 * Идёт ли долгий запрос.
 *
 * Порог обязателен: без него знак мелькал бы на каждом быстром переходе и
 * раздражал сильнее, чем сама задержка. Появляется, только если ответа нет
 * дольше указанного времени, и пропадает сразу, как только всё дошло.
 */
export function useSlowRequest(thresholdMs = 900): boolean {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    let timer: number | undefined;

    const listener = (n: number) => {
      if (n > 0) {
        // Уже ждём — второй таймер не заводим, иначе отсчёт начнётся заново с
        // каждым новым запросом и знак не покажется никогда.
        if (timer === undefined) {
          timer = window.setTimeout(() => setSlow(true), thresholdMs);
        }
      } else {
        if (timer !== undefined) {
          window.clearTimeout(timer);
          timer = undefined;
        }
        setSlow(false);
      }
    };

    listeners.add(listener);
    listener(pending);
    return () => {
      listeners.delete(listener);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [thresholdMs]);

  return slow;
}
