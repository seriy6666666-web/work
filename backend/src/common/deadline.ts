/**
 * Насколько горит операция.
 *
 * Считаем не «близко ли дата», а «успеваем ли»: остаток объёма делим на план на
 * смену и сравниваем с числом дней до срока. Начальник участка узнаёт о провале
 * за неделю, а не в последний день, когда сделать уже ничего нельзя.
 *
 * Где план на смену не задан, считать нечего — остаётся простой отсчёт дней.
 */
export type DeadlineLevel =
  /** Объём закрыт. */
  | 'done'
  /** Срока нет ни у операции, ни у заказа. */
  | 'none'
  /** Успеваем с запасом. */
  | 'ok'
  /** Смен нужно ровно столько, сколько осталось дней. */
  | 'tight'
  /** Смен нужно больше, чем осталось дней. */
  | 'late'
  /** Срок прошёл, работа не закрыта. */
  | 'overdue';

export interface DeadlineState {
  level: DeadlineLevel;
  /** Дата, к которой сдавать. */
  dueDate: string | null;
  /** Срок взят у операции, а не у заказа. */
  own: boolean;
  /** Дней до срока: 0 — сегодня, отрицательное — просрочено. */
  daysLeft: number | null;
  /** Сколько смен нужно на остаток. null — план на смену не задан. */
  shiftsNeeded: number | null;
}

function dayNumber(value: Date): number {
  return Math.floor(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()) / 86400000);
}

export function deadlineState(input: {
  dueDate: Date | null;
  orderDueDate: Date;
  quantity: number;
  done: number;
  dailyQuantity: number | null;
  today: Date;
}): DeadlineState {
  const own = input.dueDate !== null;
  const due = input.dueDate ?? input.orderDueDate;
  const dueIso = due.toISOString().slice(0, 10);
  const remaining = Math.max(0, input.quantity - input.done);

  if (remaining === 0) {
    return { level: 'done', dueDate: dueIso, own, daysLeft: null, shiftsNeeded: 0 };
  }

  const daysLeft = dayNumber(due) - dayNumber(input.today);
  if (daysLeft < 0) {
    return { level: 'overdue', dueDate: dueIso, own, daysLeft, shiftsNeeded: null };
  }

  // Сегодняшняя смена ещё в запасе, поэтому дней в работе на одну больше числа
  // оставшихся суток: срок «завтра» — это две смены, сегодняшняя и завтрашняя.
  const shiftsAvailable = daysLeft + 1;
  const shiftsNeeded =
    input.dailyQuantity && input.dailyQuantity > 0
      ? Math.ceil(remaining / input.dailyQuantity)
      : null;

  if (shiftsNeeded === null) {
    // Без плана на смену судить о том, успеваем ли, нечем — остаётся близость даты.
    const level: DeadlineLevel = daysLeft === 0 ? 'late' : daysLeft <= 2 ? 'tight' : 'ok';
    return { level, dueDate: dueIso, own, daysLeft, shiftsNeeded: null };
  }

  const level: DeadlineLevel =
    shiftsNeeded > shiftsAvailable ? 'late' : shiftsNeeded === shiftsAvailable ? 'tight' : 'ok';
  return { level, dueDate: dueIso, own, daysLeft, shiftsNeeded };
}

/** Красным горит и «не успеваем», и «уже просрочено» — оба требуют решения сегодня. */
export function isAlarming(level: DeadlineLevel): boolean {
  return level === 'late' || level === 'overdue';
}
