import { deadlineState, isAlarming } from '../common/deadline';

/**
 * Сводка по проекту для плитки: сколько сделано, к какому сроку и что горит.
 *
 * Всё это уже лежало в базе, но до экрана планировщика не доходило: он видел
 * техкарту и не видел, как проект идёт. Никаких новых сущностей — только счёт по
 * заказам проекта.
 */
export interface ProductProgress {
  /** Сколько изделий заказано по всем незакрытым заказам проекта. */
  planUnits: number;
  /**
   * Сколько изделий готово. Считаем по самому отстающему шагу: изделие готово,
   * когда пройдены все операции, поэтому берём минимум, а не сумму.
   */
  doneUnits: number;
  /** Ближайший срок отгрузки среди заказов в работе; null — заказов нет. */
  dueDate: string | null;
  /** Операций всего в заказах проекта. */
  operationsTotal: number;
  /** Объём операции закрыт полностью. */
  operationsDone: number;
  /** Кто-то назначен или что-то уже сделано. */
  operationsInWork: number;
  /** Никого не назначили и ничего не сделано. */
  operationsUnassigned: number;
  /** Есть операция, которую уже не успеть, или срок прошёл. */
  atRisk: boolean;
  /**
   * Состояние проекта одним словом — то, что стоит меткой на плитке.
   *
   * `draft` — ни техкарты, ни заказов: отдавать в работу нечего.
   * `notStarted` — заказы есть, но не сделано ничего.
   * `atRisk` — что-то не успеваем.
   * `inWork` — идёт своим ходом.
   * `done` — всё закрыто.
   */
  state: 'draft' | 'notStarted' | 'inWork' | 'atRisk' | 'done';
}

interface OrderLike {
  quantity: number;
  dueDate: Date;
  status: string;
  operations: {
    quantity: number;
    perUnit: number;
    dailyQuantity: number | null;
    dueDate: Date | null;
    assignments: { completionRecords: { doneQuantity: number | null }[] }[];
  }[];
}

export function computeProductProgress(
  orders: OrderLike[],
  techCardSize: number,
  today: Date,
): ProductProgress {
  let planUnits = 0;
  let doneUnits = 0;
  let operationsTotal = 0;
  let operationsDone = 0;
  let operationsInWork = 0;
  let operationsUnassigned = 0;
  let atRisk = false;
  let due: Date | null = null;

  for (const order of orders) {
    planUnits += order.quantity;
    if (order.status !== 'DONE' && order.status !== 'SHIPPED') {
      if (!due || order.dueDate.getTime() < due.getTime()) due = order.dueDate;
    }

    const perOperationDone = order.operations.map((op) =>
      op.assignments.reduce(
        (sum, a) => sum + (a.completionRecords[0]?.doneQuantity ?? 0),
        0,
      ),
    );

    order.operations.forEach((op, i) => {
      operationsTotal += 1;
      const done = perOperationDone[i];
      const assigned = op.assignments.length > 0;
      if (done >= op.quantity && op.quantity > 0) operationsDone += 1;
      else if (assigned || done > 0) operationsInWork += 1;
      else operationsUnassigned += 1;

      if (
        isAlarming(
          deadlineState({
            dueDate: op.dueDate,
            orderDueDate: order.dueDate,
            quantity: op.quantity,
            done,
            dailyQuantity: op.dailyQuantity,
            today,
          }).level,
        )
      ) {
        atRisk = true;
      }
    });

    // Готовых изделий по заказу — по самому отстающему шагу, с учётом того, что
    // одна операция может давать несколько штук на изделие.
    const ready = order.operations.length
      ? Math.min(
          ...order.operations.map((op, i) =>
            Math.floor(perOperationDone[i] / Math.max(1, op.perUnit)),
          ),
        )
      : 0;
    doneUnits += Math.max(0, Math.min(ready, order.quantity));
  }

  // Черновик — только когда отдавать в работу действительно нечего: ни техкарты,
  // ни заказов. Проект с заказами живёт своей жизнью, даже если техкарту завели
  // не через шаблон, а прямо в заказе.
  // Порядок важен: риск перебивает «не начат». Проект, к которому не приступали,
  // но у которого горит срок, — это именно риск, и метка должна говорить об этом,
  // а не о том, что работа ещё не начиналась.
  const state: ProductProgress['state'] =
    techCardSize === 0 && orders.length === 0
      ? 'draft'
      : atRisk
        ? 'atRisk'
        : operationsTotal > 0 && operationsDone === operationsTotal
          ? 'done'
          : orders.length === 0 || (doneUnits === 0 && operationsInWork === 0 && operationsDone === 0)
            ? 'notStarted'
            : 'inWork';

  return {
    planUnits,
    doneUnits,
    dueDate: due ? due.toISOString().slice(0, 10) : null,
    operationsTotal,
    operationsDone,
    operationsInWork,
    operationsUnassigned,
    atRisk,
    state,
  };
}
