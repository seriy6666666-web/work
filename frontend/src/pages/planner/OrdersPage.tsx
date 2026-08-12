import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { api, ApiError, type Order, type Product } from '../../api/client';
import { ORDER_STATUS_LABELS } from '../../constants/orderStatus';
import { PlannerLayout } from './PlannerLayout';
import { Badge, type BadgeVariant } from '../../components/Badge';
import { useToast } from '../../components/ToastProvider';
import { SkeletonTable } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { useTableControls, SearchInput, SortHeader } from '../../components/TableControls';
import { Select } from '../../components/Select';
import { COLORS, RADIUS } from '../../theme';

const STATUS_BADGE: Record<Order['status'], BadgeVariant> = {
  CREATED: 'muted',
  IN_PROGRESS: 'shared',
  DONE: 'accent',
  SHIPPED: 'accent',
};

interface OrderFormState {
  name: string;
  quantity: string;
  dueDate: string;
  priority: string;
}

const EMPTY_FORM: OrderFormState = { name: '', quantity: '', dueDate: '', priority: '0' };

export function OrdersPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<OrderFormState>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  const [fromProduct, setFromProduct] = useState({ productId: '', platformId: '', quantity: '', dueDate: '' });
  const [creatingFromProduct, setCreatingFromProduct] = useState(false);

  async function refresh() {
    if (!token) return;
    setLoading(true);
    try {
      const [ordersData, productsData] = await Promise.all([api.listOrders(token), api.listProducts(token)]);
      setOrders(ordersData);
      setProducts(productsData);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось загрузить заказы');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateFromProduct(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    // Раньше обязательность держалась на нативных required у <select>; у своего
    // компонента их нет, поэтому говорим прямо, а не выходим молча.
    if (!fromProduct.productId || !fromProduct.platformId || !fromProduct.quantity || !fromProduct.dueDate) {
      toast.error('Выберите проект, площадку, количество и срок');
      return;
    }
    setCreatingFromProduct(true);
    try {
      await api.createOrderFromProduct(token, {
        productId: fromProduct.productId,
        platformId: fromProduct.platformId,
        quantity: Number(fromProduct.quantity),
        dueDate: fromProduct.dueDate,
      });
      setFromProduct({ productId: '', platformId: '', quantity: '', dueDate: '' });
      toast.success('Заказ создан из проекта — операции подставлены');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось создать заказ');
    } finally {
      setCreatingFromProduct(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setCreating(true);
    try {
      await api.createOrder(token, {
        name: form.name.trim(),
        quantity: Number(form.quantity),
        dueDate: form.dueDate,
        priority: form.priority ? Number(form.priority) : undefined,
      });
      setForm(EMPTY_FORM);
      toast.success('Заказ создан');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось создать заказ');
    } finally {
      setCreating(false);
    }
  }

  const controls = useTableControls(orders, {
    searchText: (o) => `${o.name} ${ORDER_STATUS_LABELS[o.status]}`,
    sortAccessors: {
      name: (o) => o.name,
      quantity: (o) => o.quantity,
      dueDate: (o) => o.dueDate,
      priority: (o) => o.priority,
      status: (o) => ORDER_STATUS_LABELS[o.status],
    },
    defaultSortKey: 'priority',
    defaultSortDir: 'desc',
  });

  return (
    <PlannerLayout title="Заказы" breadcrumb="Планирование">

      <form onSubmit={handleCreate} style={styles.createForm}>
        <input
          style={styles.input}
          placeholder="Наименование (например «1000 батарей»)"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <input
          style={styles.input}
          placeholder="Количество"
          type="number"
          min={1}
          value={form.quantity}
          onChange={(e) => setForm({ ...form, quantity: e.target.value })}
          required
        />
        <input
          style={styles.input}
          type="date"
          value={form.dueDate}
          onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
          required
        />
        <input
          style={styles.input}
          placeholder="Приоритет"
          type="number"
          value={form.priority}
          onChange={(e) => setForm({ ...form, priority: e.target.value })}
        />
        <button style={styles.button} type="submit" disabled={creating}>
          Создать
        </button>
      </form>

      {products.length > 0 && (
        <form onSubmit={handleCreateFromProduct} style={styles.createForm}>
          <Select
            width="240px"
            ariaLabel="Проект"
            placeholder="Из проекта (шаблон)..."
            value={fromProduct.productId}
            onChange={(productId) =>
              // Площадки у каждого проекта свои, поэтому при смене проекта ранее
              // выбранная площадка может к нему не относиться — сбрасываем.
              setFromProduct({ ...fromProduct, productId, platformId: '' })
            }
            options={products.map((p) => ({
              value: p.id,
              label: p.name,
              hint: `${p.operations.length} оп.`,
            }))}
          />
          <Select
            width="180px"
            ariaLabel="Площадка"
            placeholder="Площадка..."
            value={fromProduct.platformId}
            onChange={(platformId) => setFromProduct({ ...fromProduct, platformId })}
            options={(products.find((p) => p.id === fromProduct.productId)?.platforms ?? []).map(
              (pl) => ({ value: pl.id, label: pl.name }),
            )}
          />
          <input
            style={styles.input}
            placeholder="Количество"
            type="number"
            min={1}
            value={fromProduct.quantity}
            onChange={(e) => setFromProduct({ ...fromProduct, quantity: e.target.value })}
            required
          />
          <input
            style={styles.input}
            type="date"
            value={fromProduct.dueDate}
            onChange={(e) => setFromProduct({ ...fromProduct, dueDate: e.target.value })}
            required
          />
          <button style={styles.buttonSecondary} type="submit" disabled={creatingFromProduct}>
            Создать из проекта
          </button>
        </form>
      )}

      {!loading && orders.length > 0 && (
        <div style={styles.toolbar}>
          <SearchInput value={controls.query} onChange={controls.setQuery} placeholder="Поиск по наименованию, статусу..." />
        </div>
      )}

      {loading ? (
        <SkeletonTable rows={5} cols={7} />
      ) : orders.length === 0 ? (
        <EmptyState icon="box" title="Заказов пока нет" hint="Создайте первый заказ в форме выше." />
      ) : controls.result.length === 0 ? (
        <EmptyState icon="search" title="Ничего не найдено" hint="Измените поисковый запрос." />
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <SortHeader label="Наименование" sortKey="name" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
              <SortHeader label="Кол-во" sortKey="quantity" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
              <SortHeader label="Срок" sortKey="dueDate" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
              <SortHeader label="Приоритет" sortKey="priority" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
              <SortHeader label="Статус" sortKey="status" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
              <th style={styles.th}>Операции</th>
              <th style={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {controls.result.map((o) => (
              <tr key={o.id}>
                <td style={styles.td}>{o.name}</td>
                <td style={styles.td}>{o.quantity}</td>
                <td style={styles.td}>{new Date(o.dueDate).toLocaleDateString('ru-RU')}</td>
                <td style={styles.td}>{o.priority}</td>
                <td style={styles.td}>
                  <Badge variant={STATUS_BADGE[o.status]}>{ORDER_STATUS_LABELS[o.status]}</Badge>
                </td>
                <td style={styles.td}>
                  {o.operationsQuantity} / {o.quantity} ({o.operationsCount})
                </td>
                <td style={{ ...styles.td, textAlign: 'right' }}>
                  <Link to={`/planner/orders/${o.id}`} style={styles.linkButton}>
                    Открыть →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PlannerLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  toolbar: {
    marginBottom: '16px',
  },
  createForm: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    marginBottom: '24px',
    alignItems: 'center',
  },
  input: {
    padding: '10px 12px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.lightGrayBg,
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
  buttonSecondary: {
    padding: '10px 20px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.accent}`,
    background: 'transparent',
    color: COLORS.accentDark,
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
  linkButton: {
    color: COLORS.accentDark,
    fontSize: '14px',
    fontWeight: 600,
    textDecoration: 'none',
  },
};
