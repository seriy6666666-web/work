import { useEffect, useState } from 'react';

/**
 * Очередь неотправленных отметок.
 *
 * В цеху связь рвётся, и до сих пор отметка о выработке при обрыве просто
 * пропадала: человек нажимал «Сделал», получал ошибку и должен был набрать
 * число заново — а чаще не набирал, и смена уходила неучтённой.
 *
 * Теперь отметка сначала ложится сюда, в браузер, и живёт там, пока сервер её не
 * примет. Переживает перезагрузку страницы и закрытие браузера: планшет в цеху
 * гасят и будят десятки раз за смену.
 *
 * Повтор безопасен: сервер сверяет ключ отправки и не считает второй приход
 * исправлением. Исправлений у рабочего всего два, и терять их из-за вайфая
 * нельзя.
 */

const KEY = 'belmy_pending_saves';

export type SaveState = 'idle' | 'saving' | 'saved' | 'failed';

export interface PendingSave {
  /** Ключ отправки: один и тот же на все попытки одной отметки. */
  requestId: string;
  /** Куда отправлять. */
  path: string;
  /** Что отправлять. */
  body: unknown;
  /** Под каким именем показывать состояние: обычно id назначения. */
  subject: string;
  /** Когда положили в очередь — чтобы сказать человеку, с какого момента ждём. */
  queuedAt: number;
}

function read(): PendingSave[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Испорченное хранилище не должно мешать работать: начинаем с пустой очереди.
    return [];
  }
}

function write(items: PendingSave[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Хранилище недоступно — очередь проживёт только до перезагрузки страницы.
  }
  listeners.forEach((l) => l(items));
}

const listeners = new Set<(items: PendingSave[]) => void>();

export function queueSave(item: PendingSave) {
  // Одна отметка на назначение: новая заменяет прежнюю неотправленную, иначе на
  // сервер уехали бы обе, и вторая перетёрла бы первую в непредсказуемом порядке.
  write([...read().filter((i) => i.subject !== item.subject), item]);
}

export function dropSave(subject: string) {
  write(read().filter((i) => i.subject !== subject));
}

export function pendingFor(subject: string): PendingSave | null {
  return read().find((i) => i.subject === subject) ?? null;
}

/** Подписка на очередь: экран показывает по ней состояние сохранения. */
export function usePendingSaves(): PendingSave[] {
  const [items, setItems] = useState<PendingSave[]>(read);
  useEffect(() => {
    const listener = (next: PendingSave[]) => setItems(next);
    listeners.add(listener);
    // Планшет может быть открыт в двух вкладках — держим их в согласии.
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setItems(read());
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  return items;
}

/**
 * Есть ли связь с сервером.
 *
 * `navigator.onLine` отвечает только на вопрос «включён ли вайфай», а в цеху
 * бывает наоборот: сеть есть, сервера нет. Поэтому состояние ставит тот, кто
 * отправлял, а браузерное событие используем лишь как повод попробовать снова.
 */
export function useOnlineHint(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}
