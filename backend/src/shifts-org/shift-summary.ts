/**
 * Сводка смены для пересменки.
 *
 * До сих пор передача дел была чистым полем ввода: что написать — дело
 * пишущего, и в конце тяжёлой смены туда попадало «всё норм». Принимающий
 * узнавал о незакрытой операции или вставшем станке уже от людей.
 *
 * Здесь собираем то, что система и так знает, чтобы человеку оставалось дописать
 * своё. Считаем только по фактам из базы — ничего не выдумываем: где данных нет,
 * так и говорим.
 */
export interface ShiftSummary {
  /** Сделано годных за день по участку. */
  producedGood: number;
  /** Брак за день. */
  defects: number;
  /** Операции на сегодня, где объём не закрыт. */
  openOperations: { name: string; done: number; total: number }[];
  /** Оборудование не в работе. */
  equipmentDown: { name: string; status: string }[];
  /** Сколько человек отметились на смене. */
  checkedIn: number;
  /** Всего людей на участке. */
  peopleTotal: number;
  /**
   * Материалы в дефиците. Пока в системе нет ни материалов, ни остатков, здесь
   * всегда пусто — и это честнее, чем не показывать раздел вовсе: принимающий
   * должен знать, что этого система не отслеживает.
   */
  materialsShort: { name: string; left: number; unit: string }[];
}

interface OperationLike {
  quantity: number;
  operationType: { name: string };
  assignments: { completionRecords: { doneQuantity: number | null; defectQuantity: number }[] }[];
}

export function buildShiftSummary(input: {
  operations: OperationLike[];
  equipment: { name: string; status: string }[];
  checkedIn: number;
  peopleTotal: number;
}): ShiftSummary {
  let producedGood = 0;
  let defects = 0;
  const openOperations: ShiftSummary['openOperations'] = [];

  for (const op of input.operations) {
    let done = 0;
    for (const a of op.assignments) {
      for (const r of a.completionRecords) {
        done += r.doneQuantity ?? 0;
        defects += r.defectQuantity;
      }
    }
    producedGood += done;
    // Незакрытой считаем операцию, по которой сегодня что-то делали или кого-то
    // ставили: операции, к которым не приступали вовсе, — это работа планировщика,
    // а не долг уходящей смены.
    if (op.assignments.length > 0 && done < op.quantity) {
      openOperations.push({ name: op.operationType.name, done, total: op.quantity });
    }
  }

  return {
    producedGood,
    defects,
    openOperations,
    equipmentDown: input.equipment.filter((e) => e.status !== 'OPERATIONAL'),
    checkedIn: input.checkedIn,
    peopleTotal: input.peopleTotal,
    materialsShort: [],
  };
}
