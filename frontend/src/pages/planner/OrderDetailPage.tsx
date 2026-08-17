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
  const [sites, setSites] = useState<Site[]>([]);
  const [operationTypes, setOperationTypes] = useState<OperationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);

  const [orderForm, setOrderForm] = useState({
    name: '',
    quantity: '',
    dueDate: '',
    priority: '0',
    status: 'CREATED' as OrderStatus,
  });

  const [opForm, setOpForm] = useState({ operationTypeId: '', quantity: '', siteId: '', secondarySiteId: '' });
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

  async function handleDeleteOrder() {
    if (!token || !id) return;
    const ok = await confirm({
      title: 'Удаление заказа',
      message: 'Удалить заказ? Это возможно только если у него нет операций.',
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
        siteId: opForm.siteId,
        secondarySiteId: opForm.secondarySiteId || undefined,
      });
      setOpForm({ operationTypeId: '', quantity: '', siteId: '', secondarySiteId: '' });
      toast.success('Операция добавлена');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось добавить операцию');
    } finally {
      setAddingOp(false);
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
          <input
            style={styles.input}
            value={orderForm.name}
            onChange={(e) => setOrderForm({ ...orderForm, name: e.target.value })}
            required
          />
        </label>
        <label style={styles.label}>
          Количество
          <input
            style={styles.input}
            type="number"
            min={1}
            value={orderForm.quantity}
            onChange={(e) => setOrderForm({ ...orderForm, quantity: e.target.value })}
            required
          />
        </label>
        <label style={styles.label}>
          Срок
          <input
            style={styles.input}
            type="date"
            value={orderForm.dueDate}
            onChange={(e) => setOrderForm({ ...orderForm, dueDate: e.target.value })}
            required
          />
        </label>
        <label style={styles.label}>
          Приоритет
          <input
            style={styles.input}
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
          <button style={styles.button} type="submit" disabled={saving}>
            Сохранить
          </button>
          <button style={styles.dangerButton} type="button" onClick={handleDeleteOrder}>
            Удалить заказ
          </button>
        </div>
      </form>

      <h3 style={styles.subheading}>Операции</h3>

      {operationTypes.length === 0 && (
        <p style={styles.hint}>
          Справочник операций пуст. <Link to="/planner/operations">Заведите операции</Link>, чтобы добавлять их в заказ.
        </p>
      )}

      <form onSubmit={handleAddOperation} style={styles.createForm}>
        <Select
          width="200px"
          ariaLabel="Навык"
          placeholder="Выберите навык"
          value={opForm.operationTypeId}
          onChange={(operationTypeId) => setOpForm({ ...opForm, operationTypeId })}
          options={operationTypes.map((o) => ({
            value: o.id,
            label: o.skill ? `${o.name} — навык: ${o.skill.name}` : o.name,
          }))}
        />
        <input
          style={styles.input}
          placeholder="Количество"
          type="number"
          min={1}
          value={opForm.quantity}
          onChange={(e) => setOpForm({ ...opForm, quantity: e.target.value })}
          required
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
        <button style={styles.button} type="submit" disabled={addingOp}>
          Добавить
        </button>
      </form>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Навык</th>
            <th style={styles.th}>Количество</th>
            <th style={styles.th}>Участок</th>
            <th style={styles.th}>Второй участок</th>
            <th style={styles.th}></th>
          </tr>
        </thead>
        <tbody>
          {order.operations.map((op) => (
            <tr key={op.id}>
              <td style={styles.td}>
                {op.operationType.name}
                {op.operationType.skill && (
                  <div style={styles.opSkill}>навык: {op.operationType.skill.name}</div>
                )}
              </td>
              <td style={styles.td}>{op.quantity}</td>
              <td style={styles.td}>{op.site.name}</td>
              <td style={styles.td}>
                {op.secondarySite ? <Badge variant="shared">{op.secondarySite.name}</Badge> : '—'}
              </td>
              <td style={{ ...styles.td, textAlign: 'right' }}>
                <button style={styles.linkButtonDanger} onClick={() => handleDeleteOperation(op.id)}>
                  Удалить
                </button>
              </td>
            </tr>
          ))}
          {order.operations.length === 0 && (
            <tr>
              <td style={styles.td} colSpan={5}>
                Операций пока нет
              </td>
            </tr>
          )}
        </tbody>
      </table>
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
  input: {
    padding: '10px 12px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.white,
    fontSize: '15px',
  },
  button: {
    padding: '10px 20px',
    borderRadius: RADIUS.sm,
    border: 'none',
    background: COLORS.accent,
    color: COLORS.white,
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
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
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '10px 8px',
    borderBottom: `2px solid ${COLORS.lightGreenBg}`,
    color: COLORS.mutedText,
    fontSize: '13px',
  },
  td: {
    padding: '10px 8px',
    borderBottom: `1px solid ${COLORS.lightGreenBg}`,
  },
  linkButtonDanger: {
    border: 'none',
    background: 'none',
    color: COLORS.error,
    cursor: 'pointer',
    fontSize: '14px',
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
