import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import {
  api,
  ApiError,
  type OperationType,
  type OrderDetail,
  type OrderStatus,
  type Site,
} from '../../api/client';
import { ORDER_STATUSES, ORDER_STATUS_LABELS } from '../../constants/orderStatus';
import { PlannerLayout } from './PlannerLayout';
import { Badge } from '../../components/Badge';
import { useToast } from '../../components/ToastProvider';
import { useConfirm } from '../../components/ConfirmProvider';
import { Skeleton } from '../../components/Skeleton';
import { Select } from '../../components/Select';
import { COLORS, RADIUS } from '../../theme';
import { useTableControls, SortHeader } from '../../components/TableControls';
import { Table, Th, Td, Button, LinkButton, Input } from '../../components/ui';

function toDateInputValue(iso: string) {
  return iso.slice(0, 10);
}

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();

  const [order, setOrder] = useState<OrderDetail | null>(null);

  const controls = useTableControls(order?.operations ?? [], {
    searchText: (op) => op.operationType.name,
    sortAccessors: {
      operation: (op) => op.operationType.name,
      quantity: (op) => op.quantity,
      done: (op) => op.doneQuantity,
      daily: (op) => op.dailyQuantity,
      // Операции без своего срока уходят в конец: у них его просто нет.
      due: (op) => op.dueDate,
      perUnit: (op) => op.perUnit,
      site: (op) => op.site.name,
      secondary: (op) => op.secondarySite?.name ?? null,
    },
    defaultSortKey: 'operation',
    storageKey: 'planner-order-operations',
  });
  const [sites, setSites] = useState<Site[]>([]);
  const [operationTypes, setOperationTypes] = useState<OperationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);

  /**
   * Правка операции прямо в строке. Раньше поменять объём или участок было
   * нельзя вовсе: обработчик на сервере есть, метод в клиенте есть, а кнопки на
   * экране не было — оставалось удалить операцию и завести заново.
   */
  const [editingOpId, setEditingOpId] = useState<string | null>(null);
  const [editOp, setEditOp] = useState({ operationTypeId: '', quantity: '', dailyQuantity: '', dueDate: '', perUnit: '1', siteId: '', secondarySiteId: '' });
  const [savingOp, setSavingOp] = useState(false);

  const [orderForm, setOrderForm] = useState({
    name: '',
    quantity: '',
    dueDate: '',
    priority: '0',
    status: 'CREATED' as OrderStatus,
  });

  const [opForm, setOpForm] = useState({ operationTypeId: '', quantity: '', dailyQuantity: '', dueDate: '', siteId: '', secondarySiteId: '' });
  const [addingOp, setAddingOp] = useState(false);

  async function refresh() {
    if (!token || !id) return;
    setLoading(true);
    try {
      const [orderData, sitesData, operationTypesData] = await Promise.all([
        api.getOrder(token, id),
        api.listSites(token),
        api.listOperationTypes(token),
      ]);
      setOrder(orderData);
      setSites(sitesData);
      setOperationTypes(operationTypesData);
      setOrderForm({
        name: orderData.name,
        quantity: String(orderData.quantity),
        dueDate: toDateInputValue(orderData.dueDate),
        priority: String(orderData.priority),
        status: orderData.status,
      });
    } catch (err) {
      setNotFound(true);
      toast.error(err instanceof ApiError ? err.message : 'Не удалось загрузить заказ');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

  async function handleSaveOrder(e: FormEvent) {
    e.preventDefault();
    if (!token || !id) return;
    setSaving(true);
    try {
      await api.updateOrder(token, id, {
        name: orderForm.name.trim(),
        quantity: Number(orderForm.quantity),
        dueDate: orderForm.dueDate,
        priority: Number(orderForm.priority),
        status: orderForm.status,
      });
      toast.success('Заказ сохранён');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось сохранить заказ');
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!token || !id) return;
    const ok = await confirm({
      title: 'В архив',
      message:
        'Убрать заказ из работы? Он пропадёт с доски начальника участка, ' +
        'но останется в отчётах вместе со всей выработкой по нему.',
      confirmLabel: 'В архив',
    });
    if (!ok) return;
    try {
      await api.archiveOrder(token, id);
      toast.success('Заказ в архиве');
      navigate('/planner/orders');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось отправить в архив');
    }
  }

  async function handleDeleteOrder() {
    if (!token || !id) return;
    const ok = await confirm({
      title: 'Удаление заказа',
      message:
        'Удалить заказ вместе со всеми его операциями? ' +
        'Если по операциям уже отчитывались, удалить не получится — такой заказ отправляется в архив.',
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteOrder(token, id);
      toast.success('Заказ удалён');
      navigate('/planner/orders', { replace: true });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось удалить заказ');
    }
  }

  async function handleAddOperation(e: FormEvent) {
    e.preventDefault();
    if (!token || !id) return;
    // Проверок здесь не было вовсе: за обязательность полей отвечали нативные required
    // у <select>. У своего компонента их нет, поэтому проверяем сами, иначе уйдёт
    // запрос с пустыми полями и вернётся невнятная ошибка валидации с сервера.
    if (!opForm.operationTypeId || !opForm.siteId || !opForm.quantity) {
      toast.error('Выберите операцию, участок и укажите количество');
      return;
    }
    setAddingOp(true);
    try {
      await api.createOperation(token, id, {
        operationTypeId: opForm.operationTypeId,
        quantity: Number(opForm.quantity),
        dailyQuantity: opForm.dailyQuantity ? Number(opForm.dailyQuantity) : undefined,
        dueDate: opForm.dueDate || undefined,
        siteId: opForm.siteId,
        secondarySiteId: opForm.secondarySiteId || undefined,
      });
      setOpForm({ operationTypeId: '', quantity: '', dailyQuantity: '', dueDate: '', siteId: '', secondarySiteId: '' });
      toast.success('Операция добавлена');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось добавить операцию');
    } finally {
      setAddingOp(false);
    }
  }

  function startEditOperation(op: OrderDetail['operations'][number]) {
    setEditingOpId(op.id);
    setEditOp({
      operationTypeId: op.operationTypeId,
      quantity: String(op.quantity),
      dailyQuantity: op.dailyQuantity === null ? '' : String(op.dailyQuantity),
      dueDate: op.dueDate ? op.dueDate.slice(0, 10) : '',
      perUnit: String(op.perUnit),
      siteId: op.siteId,
      secondarySiteId: op.secondarySiteId ?? '',
    });
  }

  async function saveOperation(operationId: string) {
    if (!token) return;
    setSavingOp(true);
    try {
      await api.updateOperation(token, operationId, {
        operationTypeId: editOp.operationTypeId,
        quantity: Number(editOp.quantity),
        dailyQuantity: editOp.dailyQuantity ? Number(editOp.dailyQuantity) : undefined,
        // Пустое поле — «срок снять», поэтому null, а не undefined: undefined сервер
        // понимает как «не трогать», и убрать однажды поставленную дату было бы нельзя.
        dueDate: editOp.dueDate || null,
        perUnit: editOp.perUnit ? Number(editOp.perUnit) : undefined,
        siteId: editOp.siteId,
        // Пустая строка — «второго участка нет». undefined сервер трактует как
        // «не трогать», поэтому снять его этим способом было бы нельзя.
        secondarySiteId: editOp.secondarySiteId || undefined,
      });
      setEditingOpId(null);
      toast.success('Операция изменена');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось изменить операцию');
    } finally {
      setSavingOp(false);
    }
  }

  async function handleDeleteOperation(operationId: string) {
    if (!token) return;
    const ok = await confirm({
      title: 'Удаление операции',
      message: 'Удалить операцию?',
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteOperation(token, operationId);
      toast.success('Операция удалена');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось удалить операцию');
    }
  }

  if (loading) {
    return (
      <PlannerLayout title="Заказ" breadcrumb="Планирование · Заказы">
        <Skeleton height={200} />
      </PlannerLayout>
    );
  }

  if (!order || notFound) {
    return (
      <PlannerLayout title="Заказ" breadcrumb="Планирование · Заказы">
        <p style={styles.error}>Заказ не найден</p>
      </PlannerLayout>
    );
  }

  return (
    <PlannerLayout title={order.name} breadcrumb="Планирование · Заказы">
      <Link to="/planner/orders" style={styles.backLink}>
        ← Все заказы
      </Link>

      <form onSubmit={handleSaveOrder} style={styles.orderForm}>
        <label style={styles.label}>
          Наименование
          <Input style={{ background: COLORS.white }}
            value={orderForm.name}
            onChange={(e) => setOrderForm({ ...orderForm, name: e.target.value })}
            required
          />
        </label>
        <label style={styles.label}>
          Количество
          <Input style={{ background: COLORS.white }}
            type="number"
            min={1}
            value={orderForm.quantity}
            onChange={(e) => setOrderForm({ ...orderForm, quantity: e.target.value })}
            required
          />
        </label>
        <label style={styles.label}>
          Срок
          <Input style={{ background: COLORS.white }}
            type="date"
            value={orderForm.dueDate}
            onChange={(e) => setOrderForm({ ...orderForm, dueDate: e.target.value })}
            required
          />
        </label>
        <label style={styles.label}>
          Приоритет
          <Input style={{ background: COLORS.white }}
            type="number"
            value={orderForm.priority}
            onChange={(e) => setOrderForm({ ...orderForm, priority: e.target.value })}
          />
        </label>
        <label style={styles.label}>
          Статус
          <Select
            ariaLabel="Статус заказа"
            value={orderForm.status}
            onChange={(status) => setOrderForm({ ...orderForm, status: status as OrderStatus })}
            options={ORDER_STATUSES.map((s) => ({ value: s, label: ORDER_STATUS_LABELS[s] }))}
          />
        </label>
        <div style={styles.orderFormActions}>
          <Button type="submit" disabled={saving}>
            Сохранить
          </Button>
          <button style={styles.dangerButton} type="button" onClick={handleDeleteOrder}>
            Удалить заказ
          </button>
          {/*
            Архив — для заказов с выработкой: удалять их нельзя, иначе история
            производства пропадёт из отчётов задним числом.
          */}
          <LinkButton style={{ fontWeight: 600, padding: '4px 8px' }} type="button" onClick={handleArchive}>
            В архив
          </LinkButton>
        </div>
      </form>

      {/*
        Готовая продукция — по самому узкому шагу: изделие готово, когда пройдены
        все операции. Раньше планировщик этого не видел вовсе и планировал
        следующую партию вслепую.
      */}
      <div style={styles.readyBar}>
        Готово изделий: <strong>{order.readyUnits}</strong> из {order.quantity}
        <span style={styles.opSkill}>
          {' '}
          · считается по самой отстающей операции
        </span>
      </div>

      <h3 style={styles.subheading}>Операции</h3>

      {operationTypes.length === 0 && (
        <p style={styles.hint}>
          Справочник операций пуст. <Link to="/planner/operations">Заведите операции</Link>, чтобы добавлять их в заказ.
        </p>
      )}

      <form onSubmit={handleAddOperation} style={styles.createForm}>
        <Select
          width="200px"
          ariaLabel="Операция"
          placeholder="Выберите операцию"
          value={opForm.operationTypeId}
          onChange={(operationTypeId) => setOpForm({ ...opForm, operationTypeId })}
          options={operationTypes.map((o) => ({
            value: o.id,
            label: o.skill ? `${o.name} — навык: ${o.skill.name}` : o.name,
          }))}
        />
        <Input style={{ background: COLORS.white }}
          placeholder="Всего"
          type="number"
          min={1}
          value={opForm.quantity}
          onChange={(e) => setOpForm({ ...opForm, quantity: e.target.value })}
          required
        />
        {/* План на смену: начальник участка по нему понимает, сколько закрыть сегодня. */}
        <Input style={{ background: COLORS.white }}
          placeholder="В день"
          type="number"
          min={1}
          value={opForm.dailyQuantity}
          onChange={(e) => setOpForm({ ...opForm, dailyQuantity: e.target.value })}
        />
        {/* Дата сдачи участком — она же и есть дедлайн, который видит начальник участка. */}
        <Input style={{ background: COLORS.white }}
          type="date"
          aria-label="Сдать до"
          title="К какому дню участок должен сдать операцию"
          value={opForm.dueDate}
          onChange={(e) => setOpForm({ ...opForm, dueDate: e.target.value })}
        />
        <Select
          width="180px"
          ariaLabel="Участок"
          placeholder="Выберите участок"
          value={opForm.siteId}
          onChange={(siteId) => setOpForm({ ...opForm, siteId })}
          options={sites.map((site) => ({ value: site.id, label: site.name }))}
        />
        <Select
          width="260px"
          ariaLabel="Второй участок"
          placeholder="Второй участок (если операция разделяется)"
          value={opForm.secondarySiteId}
          onChange={(secondarySiteId) => setOpForm({ ...opForm, secondarySiteId })}
          // Разделяемая операция — случай необязательный, поэтому пустой вариант нужен
          // как выбор: раз выставленный второй участок должен сниматься.
          options={[
            { value: '', label: 'Без второго участка' },
            ...sites
              .filter((site) => site.id !== opForm.siteId)
              .map((site) => ({ value: site.id, label: site.name })),
          ]}
        />
        <Button type="submit" disabled={addingOp}>
          Добавить
        </Button>
      </form>

      <Table>
        <thead>
          <tr>
            <SortHeader label="Операция" sortKey="operation" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
            <SortHeader label="Всего" sortKey="quantity" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
            <SortHeader label="Сделано" sortKey="done" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
            <SortHeader label="В день" sortKey="daily" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
            <SortHeader label="Сдать" sortKey="due" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
            <SortHeader label="На изделие" sortKey="perUnit" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
            <SortHeader label="Участок" sortKey="site" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
            <SortHeader label="Второй участок" sortKey="secondary" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
            <Th></Th>
          </tr>
        </thead>
        <tbody>
          {controls.result.map((op) => {
            const editing = editingOpId === op.id;
            return (
              <tr key={op.id}>
                <Td>
                  {editing ? (
                    <Select
                      width="220px"
                      ariaLabel="Операция строки"
                      value={editOp.operationTypeId}
                      onChange={(operationTypeId) => setEditOp({ ...editOp, operationTypeId })}
                      options={operationTypes.map((o) => ({
                        value: o.id,
                        label: o.skill ? `${o.name} — навык: ${o.skill.name}` : o.name,
                      }))}
                    />
                  ) : (
                    <>
                      {op.operationType.name}
                      {op.operationType.skill && (
                        <div style={styles.opSkill}>навык: {op.operationType.skill.name}</div>
                      )}
                    </>
                  )}
                </Td>
                <Td>
                  {editing ? (
                    <input
                      style={styles.qtyInput}
                      type="number"
                      min={1}
                      value={editOp.quantity}
                      onChange={(e) => setEditOp({ ...editOp, quantity: e.target.value })}
                      aria-label="Всего"
                      autoFocus
                    />
                  ) : (
                    op.quantity
                  )}
                </Td>
                <Td>
                  <strong>{op.doneQuantity}</strong>
                  <div style={styles.opSkill}>
                    {op.quantity > 0 ? Math.round((op.doneQuantity / op.quantity) * 100) : 0}%
                  </div>
                </Td>
                <Td>
                  {editing ? (
                    <input
                      style={styles.qtyInput}
                      type="number"
                      min={1}
                      placeholder="—"
                      value={editOp.dailyQuantity}
                      onChange={(e) => setEditOp({ ...editOp, dailyQuantity: e.target.value })}
                      aria-label="В день"
                    />
                  ) : op.dailyQuantity === null ? (
                    <span style={styles.opSkill}>не задан</span>
                  ) : (
                    op.dailyQuantity
                  )}
                </Td>
                <Td>
                  {editing ? (
                    <input
                      style={styles.qtyInput}
                      type="date"
                      value={editOp.dueDate}
                      onChange={(e) => setEditOp({ ...editOp, dueDate: e.target.value })}
                      aria-label="Сдать до"
                    />
                  ) : op.dueDate === null ? (
                    <span style={styles.opSkill}>по заказу</span>
                  ) : (
                    new Date(op.dueDate).toLocaleDateString('ru-RU')
                  )}
                </Td>
                <Td>
                  {editing ? (
                    <input
                      style={styles.qtyInput}
                      type="number"
                      min={1}
                      value={editOp.perUnit}
                      onChange={(e) => setEditOp({ ...editOp, perUnit: e.target.value })}
                      aria-label="На изделие"
                    />
                  ) : (
                    op.perUnit
                  )}
                </Td>
                <Td>
                  {editing ? (
                    <Select
                      width="170px"
                      ariaLabel="Участок строки"
                      value={editOp.siteId}
                      onChange={(siteId) => setEditOp({ ...editOp, siteId })}
                      options={sites.map((st) => ({ value: st.id, label: st.name }))}
                    />
                  ) : (
                    op.site.name
                  )}
                </Td>
                <Td>
                  {editing ? (
                    <Select
                      width="170px"
                      ariaLabel="Второй участок строки"
                      placeholder="нет"
                      value={editOp.secondarySiteId}
                      onChange={(secondarySiteId) => setEditOp({ ...editOp, secondarySiteId })}
                      options={[
                        { value: '', label: 'нет' },
                        ...sites
                          .filter((st) => st.id !== editOp.siteId)
                          .map((st) => ({ value: st.id, label: st.name })),
                      ]}
                    />
                  ) : op.secondarySite ? (
                    <Badge variant="shared">{op.secondarySite.name}</Badge>
                  ) : (
                    '—'
                  )}
                </Td>
                <td style={{ ...styles.td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {editing ? (
                    <>
                      <button
                        style={styles.linkButton}
                        onClick={() => saveOperation(op.id)}
                        disabled={savingOp || !editOp.quantity || !editOp.operationTypeId || !editOp.siteId}
                      >
                        Сохранить
                      </button>
                      <LinkButton style={{ fontWeight: 600, padding: '4px 8px' }} onClick={() => setEditingOpId(null)}>
                        Отмена
                      </LinkButton>
                    </>
                  ) : (
                    <>
                      <LinkButton style={{ fontWeight: 600, padding: '4px 8px' }} onClick={() => startEditOperation(op)}>
                        Изменить
                      </LinkButton>
                      <LinkButton danger style={{ padding: '4px 8px' }} onClick={() => handleDeleteOperation(op.id)}>
                        Удалить
                      </LinkButton>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
          {order.operations.length === 0 && (
            <tr>
              <td style={styles.td} colSpan={5}>
                Операций пока нет
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </PlannerLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  opSkill: {
    color: COLORS.mutedText,
    fontSize: '13px',
    marginTop: '2px',
  },
  backLink: {
    color: COLORS.accentDark,
    fontSize: '14px',
    textDecoration: 'none',
  },
  subheading: {
    marginTop: '32px',
  },
  orderForm: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px',
    alignItems: 'flex-end',
    padding: '16px',
    background: COLORS.lightGrayBg,
    borderRadius: RADIUS.md,
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    fontSize: '13px',
    color: COLORS.mutedText,
  },
  orderFormActions: {
    display: 'flex',
    gap: '12px',
  },
  createForm: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    margin: '16px 0',
    alignItems: 'center',
  },
  dangerButton: {
    padding: '10px 20px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.error}`,
    background: 'transparent',
    color: COLORS.error,
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  td: {
    padding: '10px 8px',
    borderBottom: `1px solid ${COLORS.lightGreenBg}`,
  },
  readyBar: {
    padding: '12px 16px',
    marginBottom: '16px',
    borderRadius: RADIUS.sm,
    background: COLORS.lightGreenBg,
    fontSize: '15px',
  },
  linkButton: {
    border: 'none',
    background: 'none',
    color: COLORS.accentDark,
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 600,
    padding: '4px 8px',
  },
  qtyInput: {
    width: '90px',
    padding: '8px 10px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.lightGrayBg,
    fontSize: '15px',
  },
  error: {
    color: COLORS.error,
    fontSize: '13px',
  },
  hint: {
    color: COLORS.mutedText,
    fontSize: '13px',
  },
};
