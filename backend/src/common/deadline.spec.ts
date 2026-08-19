import { deadlineState, isAlarming } from './deadline';

const today = new Date('2026-08-19T00:00:00Z');
const orderDue = new Date('2026-09-01T00:00:00Z');
const base = { orderDueDate: orderDue, quantity: 100, done: 0, dailyQuantity: null, today };

describe('deadlineState', () => {
  it('закрытый объём — «готово», сколько бы дней ни осталось', () => {
    const r = deadlineState({ ...base, dueDate: new Date('2026-08-01T00:00:00Z'), done: 100 });
    expect(r.level).toBe('done');
  });

  it('без своего срока берёт срок заказа и помечает это', () => {
    const r = deadlineState({ ...base, dueDate: null });
    expect(r.own).toBe(false);
    expect(r.dueDate).toBe('2026-09-01');
  });

  it('срок прошёл, работа не закрыта — просрочено', () => {
    const r = deadlineState({ ...base, dueDate: new Date('2026-08-17T00:00:00Z') });
    expect(r.level).toBe('overdue');
    expect(r.daysLeft).toBe(-2);
  });

  it('план на смену задан: смен нужно больше, чем есть — не успеваем', () => {
    // 100 шт по 20 за смену — пять смен; до срока сегодня и завтра, то есть две.
    const r = deadlineState({ ...base, dueDate: new Date('2026-08-20T00:00:00Z'), dailyQuantity: 20 });
    expect(r.shiftsNeeded).toBe(5);
    expect(r.level).toBe('late');
  });

  it('смен ровно столько, сколько осталось — впритык', () => {
    // 40 шт по 20 за смену — две смены; сегодня и завтра — тоже две.
    const r = deadlineState({ ...base, quantity: 40, dueDate: new Date('2026-08-20T00:00:00Z'), dailyQuantity: 20 });
    expect(r.level).toBe('tight');
  });

  it('смен хватает с запасом — спокойно', () => {
    const r = deadlineState({ ...base, quantity: 40, dueDate: new Date('2026-08-25T00:00:00Z'), dailyQuantity: 20 });
    expect(r.level).toBe('ok');
  });

  it('учитывает уже сделанное: остаток закрывается одной сменой', () => {
    const r = deadlineState({ ...base, done: 85, dueDate: new Date('2026-08-19T00:00:00Z'), dailyQuantity: 20 });
    expect(r.shiftsNeeded).toBe(1);
    expect(r.level).toBe('tight');
  });

  it('без плана на смену судит только по близости даты', () => {
    expect(deadlineState({ ...base, dueDate: new Date('2026-08-19T00:00:00Z') }).level).toBe('late');
    expect(deadlineState({ ...base, dueDate: new Date('2026-08-21T00:00:00Z') }).level).toBe('tight');
    expect(deadlineState({ ...base, dueDate: new Date('2026-08-27T00:00:00Z') }).level).toBe('ok');
  });

  it('красным горит и «не успеваем», и «просрочено»', () => {
    expect(isAlarming('late')).toBe(true);
    expect(isAlarming('overdue')).toBe(true);
    expect(isAlarming('tight')).toBe(false);
    expect(isAlarming('ok')).toBe(false);
  });
});
