import { computeProductProgress } from './product-progress';

const today = new Date('2026-08-19T00:00:00Z');
const due = new Date('2026-09-01T00:00:00Z');

function op(quantity: number, done: number, assigned = done > 0, perUnit = 1) {
  return {
    quantity,
    perUnit,
    dailyQuantity: null,
    dueDate: null,
    assignments: assigned ? [{ completionRecords: [{ doneQuantity: done }] }] : [],
  };
}

describe('computeProductProgress', () => {
  it('ни техкарты, ни заказов — черновик', () => {
    expect(computeProductProgress([], 0, today).state).toBe('draft');
  });

  it('техкарты нет, но заказы есть — не черновик: работа идёт', () => {
    const r = computeProductProgress(
      [{ quantity: 10, dueDate: due, status: 'IN_PROGRESS', operations: [op(10, 0, false)] }],
      0,
      today,
    );
    expect(r.state).not.toBe('draft');
    expect(r.operationsUnassigned).toBe(1);
  });

  it('техкарта есть, заказов нет — не начат', () => {
    expect(computeProductProgress([], 3, today).state).toBe('notStarted');
  });

  it('считает план и операции по состояниям', () => {
    const r = computeProductProgress(
      [{ quantity: 100, dueDate: due, status: 'IN_PROGRESS', operations: [op(100, 100), op(100, 40), op(100, 0, false)] }],
      3,
      today,
    );
    expect(r.planUnits).toBe(100);
    expect(r.operationsDone).toBe(1);
    expect(r.operationsInWork).toBe(1);
    expect(r.operationsUnassigned).toBe(1);
    expect(r.state).toBe('inWork');
  });

  it('готовых изделий — по самому отстающему шагу, а не по сумме', () => {
    // Первая операция закрыта целиком, вторая наполовину: готовых изделий 50.
    const r = computeProductProgress(
      [{ quantity: 100, dueDate: due, status: 'IN_PROGRESS', operations: [op(100, 100), op(100, 50)] }],
      2,
      today,
    );
    expect(r.doneUnits).toBe(50);
  });

  it('учитывает коэффициент на изделие: 200 проводов — это 100 батарей', () => {
    const r = computeProductProgress(
      [{ quantity: 100, dueDate: due, status: 'IN_PROGRESS', operations: [op(200, 200, true, 2)] }],
      1,
      today,
    );
    expect(r.doneUnits).toBe(100);
  });

  it('просроченная операция делает проект рискующим', () => {
    const late = {
      quantity: 100,
      perUnit: 1,
      dailyQuantity: 10,
      dueDate: new Date('2026-08-17T00:00:00Z'),
      assignments: [{ completionRecords: [{ doneQuantity: 10 }] }],
    };
    const r = computeProductProgress(
      [{ quantity: 100, dueDate: due, status: 'IN_PROGRESS', operations: [late] }],
      1,
      today,
    );
    expect(r.atRisk).toBe(true);
    expect(r.state).toBe('atRisk');
  });

  it('риск перебивает «не начат»: к проекту не приступали, но срок горит', () => {
    const late = {
      quantity: 100,
      perUnit: 1,
      dailyQuantity: 10,
      dueDate: new Date('2026-08-17T00:00:00Z'),
      assignments: [],
    };
    const r = computeProductProgress(
      [{ quantity: 100, dueDate: due, status: 'CREATED', operations: [late] }],
      1,
      today,
    );
    expect(r.doneUnits).toBe(0);
    expect(r.state).toBe('atRisk');
  });

  it('срок берётся ближайший среди незакрытых заказов', () => {
    const r = computeProductProgress(
      [
        { quantity: 10, dueDate: new Date('2026-09-10T00:00:00Z'), status: 'IN_PROGRESS', operations: [op(10, 1)] },
        { quantity: 10, dueDate: new Date('2026-08-25T00:00:00Z'), status: 'IN_PROGRESS', operations: [op(10, 1)] },
        { quantity: 10, dueDate: new Date('2026-08-01T00:00:00Z'), status: 'DONE', operations: [op(10, 10)] },
      ],
      2,
      today,
    );
    expect(r.dueDate).toBe('2026-08-25');
  });
});
