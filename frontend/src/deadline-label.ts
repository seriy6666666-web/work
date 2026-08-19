import type { DeadlineState } from './api/client';
import { COLORS } from './theme';

/**
 * Как срок выглядит на доске.
 *
 * Правило подписи одно: сначала дата сдачи, потом сколько осталось. Дата нужна,
 * чтобы начальник участка мог сверить её с планом, а остаток — чтобы понять, надо
 * ли что-то решать сегодня. Цвет говорит не «дата близко», а «не успеваем»: это
 * разные вещи, и путать их нельзя.
 */

/** Русские окончания: 1 день, 2 дня, 5 дней. */
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function days(n: number): string {
  return `${n} ${plural(n, 'день', 'дня', 'дней')}`;
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export interface DeadlineLook {
  /** Подпись целиком. */
  text: string;
  color: string;
  background: string | null;
  /** Требует решения сегодня — красное. */
  alarming: boolean;
}

export function deadlineLook(state: DeadlineState): DeadlineLook {
  const date = state.dueDate ? formatDate(state.dueDate) : null;
  const prefix = state.own ? `Сдать ${date}` : `Срок заказа: ${date}`;

  switch (state.level) {
    case 'done':
      return { text: 'Готово', color: COLORS.accentDark, background: COLORS.lightGreenBg, alarming: false };

    case 'overdue': {
      const late = Math.abs(state.daysLeft ?? 0);
      return {
        text: `${prefix} · просрочено на ${days(late)}`,
        color: COLORS.error,
        background: COLORS.errorBg,
        alarming: true,
      };
    }

    case 'late': {
      // «Не успеваете» — это вывод из плана на смену, а не из близости даты.
      const why =
        state.shiftsNeeded !== null
          ? `нужно смен: ${state.shiftsNeeded}, осталось ${days((state.daysLeft ?? 0) + 1)}`
          : 'сдавать сегодня';
      return {
        text: `${prefix} · не успеваете — ${why}`,
        color: COLORS.error,
        background: COLORS.errorBg,
        alarming: true,
      };
    }

    case 'tight':
      return {
        text: `${prefix} · впритык, осталось ${days((state.daysLeft ?? 0) + 1)}`,
        color: COLORS.warning,
        background: COLORS.warningBg,
        alarming: false,
      };

    case 'ok':
      return {
        text: `${prefix} · осталось ${days((state.daysLeft ?? 0) + 1)}`,
        color: COLORS.mutedText,
        background: null,
        alarming: false,
      };

    case 'none':
    default:
      return { text: 'Срок не задан', color: COLORS.mutedText, background: null, alarming: false };
  }
}

/** Порядок «кто хуже» — нужен, чтобы свёрнутый проект показывал худшее внутри себя. */
const SEVERITY: Record<DeadlineState['level'], number> = {
  overdue: 5,
  late: 4,
  tight: 3,
  ok: 2,
  none: 1,
  done: 0,
};

/**
 * Худшее состояние из списка.
 *
 * Без этого сворачивание проектов прячет ровно то, ради чего заведены цвета:
 * красная операция уезжает внутрь свёрнутой карточки, и начальник участка её не
 * видит.
 */
export function worstDeadline(states: DeadlineState[]): DeadlineState | null {
  if (states.length === 0) return null;
  return states.reduce((worst, s) => (SEVERITY[s.level] > SEVERITY[worst.level] ? s : worst));
}

/**
 * Короткая форма — для заголовка свёрнутого заказа.
 *
 * Полная подпись там не помещается и обрезается на середине слова: в заголовке
 * уже стоят название, счётчик операций и «без исполнителя». В свёрнутом виде от
 * срока нужно только одно — стоит ли разворачивать.
 */
export function deadlineShort(state: DeadlineState): string {
  const date = state.dueDate ? formatDate(state.dueDate).slice(0, 5) : '';
  switch (state.level) {
    case 'overdue':
      return `Просрочено на ${days(Math.abs(state.daysLeft ?? 0))}`;
    case 'late':
      return `Не успеваете к ${date}`;
    case 'tight':
      return `Впритык к ${date}`;
    default:
      return '';
  }
}
