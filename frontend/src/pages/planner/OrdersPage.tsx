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
import { useTableControls, SearchInput, SortSelect, type SortChoice } from '../../components/TableControls';
import { Select } from '../../components/Select';
import { COLORS, RADIUS } from '../../theme';
import { Button, Input, Panel } from '../../components/ui';
import { ProgressRing } from '../../components/ProgressRing';


const STATUS_BADGE: Record<Order['status'], BadgeVariant> = {
  CREATED: 'muted',
  IN_PROGRESS: 'shared',
  DONE: 'accent',
  SHIPPED: 'accent',
  ARCHIVED: 'muted',
};

interface OrderFormState {
  name: string;
  quantity: string;
  dueDate: string;
  priority: string;
}

const EMPTY_FORM: OrderFormState = { name: '', quantity: '', dueDate: '', priority: '0' };

/** Порядок в списке заказов. Выбор запоминается. */
const SORT_CHOICES: SortChoice[] = [
  { key: 'dueDate', dir: 'asc', label: 'сначала срочные' },
  { key: 'name', dir: 'asc', label: 'по алфавиту' },
  { key: 'quantity', dir: 'desc', label: 'больше по количеству' },
  { key: 'priority', dir: 'desc', label: 'сначала приоритетные' },
];

/** Фильтры над списком заказов — со счётчиками, как в макете. */
const FILTERS: { key: 'all' | 'inWork' | 'waiting' | 'closed'; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'inWork', label: 'В работе' },
  { key: 'waiting', label: 'Ждут' },
  { key: 'closed', label: 'Закрыты' },
];

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

  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const [createOpen, setCreateOpen] = useState(false);

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

  /**
   * Счётчики считаем по всем заказам, а не по отфильтрованным: иначе «Ждут 2»
   * пропадало бы, стоило выбрать другой фильтр, и понять, есть ли вообще
   * незапущенные, было бы нельзя.
   */
  const counts = {
    all: orders.length,
    inWork: orders.filter((o) => o.status === 'IN_PROGRESS').length,
    waiting: orders.filter((o) => o.status === 'CREATED').length,
    closed: orders.filter((o) => o.status === 'DONE' || o.status === 'SHIPPED').length,
  };
  const visible = controls.result.filter((o) => {
    if (filter === 'all') return true;
    if (filter === 'inWork') return o.status === 'IN_PROGRESS';
    if (filter === 'waiting') return o.status === 'CREATED';
    return o.status === 'DONE' || o.status === 'SHIPPED';
  });

  return (
    <PlannerLayout title="Заказы" breadcrumb="Планирование">

      {/*
        Панель над списком. Формы создания раньше стояли открытыми и занимали весь
        верх экрана — семь полей, которые нужны раз в неделю, отодвигали список,
        ради которого сюда заходят каждый день.
      */}
      <div style={styles.toolbar}>
        <SearchInput
          value={controls.query}
          onChange={controls.setQuery}
          placeholder="Заказ, проект, статус"
        />
        <div style={styles.filters}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              style={{ ...styles.filter, ...(filter === f.key ? styles.filterActive : null) }}
              onClick={() => setFilter(f.key)}
            >
              {f.label} <span style={styles.filterCount}>{counts[f.key]}</span>
            </button>
          ))}
        </div>
        <Button style={{ marginLeft: 'auto' }} onClick={() => setCreateOpen((v) => !v)}>
          + Заказ
        </Button>
      </div>

      <div style={styles.sortRow}>
        <SortSelect
          choices={SORT_CHOICES}
          sortKey={controls.sortKey}
          dir={controls.sortDir}
          onSelect={controls.setSort}
        />
      </div>

      {createOpen && (
        <Panel style={{ padding: '16px', marginBottom: '14px' }}>
      <form onSubmit={handleCreate} style={styles.createForm}>
        <Input
          placeholder="Наименование (например «1000 батарей»)"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <Input
          placeholder="Количество"
          type="number"
          min={1}
          value={form.quantity}
          onChange={(e) => setForm({ ...form, quantity: e.target.value })}
          required
        />
        <Input
          type="date"
          value={form.dueDate}
          onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
          required
        />
        <Input
          placeholder="Приоритет"
          type="number"
          value={form.priority}
          onChange={(e) => setForm({ ...form, priority: e.target.value })}
        />
        <Button type="submit" disabled={creating}>
          Создать
        </Button>
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
          <Input
            placeholder="Количество"
            type="number"
            min={1}
            value={fromProduct.quantity}
            onChange={(e) => setFromProduct({ ...fromProduct, quantity: e.target.value })}
            required
          />
          <Input
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
        </Panel>
      )}


      {loading ? (
        <SkeletonTable rows={5} cols={7} />
      ) : orders.length === 0 ? (
        <EmptyState icon="box" title="Заказов пока нет" hint="Создайте первый заказ в форме выше." />
      ) : controls.result.length === 0 ? (
        <EmptyState icon="search" title="Ничего не найдено" hint="Измените поисковый запрос." />
      ) : (
        <Panel style={{ padding: 0 }}>
          <div style={styles.panelHead}>
            <span style={styles.panelTitle}>Заказы</span>
            <span style={styles.panelCount}>{visible.length} из {orders.length}</span>
          </div>
          {visible.map((o) => {
            // Срок красным, когда он прошёл, а заказ не закрыт: за этим сюда и приходят.
            const overdue =
              o.status !== 'DONE' && o.status !== 'SHIPPED' && new Date(o.dueDate) < new Date();
            const ready = o.quantity > 0 ? Math.round((o.readyUnits / o.quantity) * 100) : 0;
            const g = o.progress;
            return (
              <Link key={o.id} to={`/planner/orders/${o.id}`} style={styles.row}>
                {/*
                  Кольцо и полоса стоят здесь, а не у проекта: проект — шаблон, у
                  него нет ни количества, ни срока, ни выработки. Работа идёт по
                  заказу, и его состояние должно читаться с одного взгляда.
                */}
                <ProgressRing
                  ratio={o.quantity > 0 ? o.readyUnits / o.quantity : 0}
                  size={46}
                  color={g.atRisk ? COLORS.error : COLORS.accent}
                />
                <div style={styles.rowMain}>
                  <div style={styles.rowName}>{o.name}</div>
                  <div style={styles.rowSub}>
                    {o.readyUnits} из {o.quantity} шт
                    {o.priority > 0 ? ` · приоритет ${o.priority}` : ''}
                  </div>
                  <div style={styles.counters}>
                    <span style={styles.counter}>
                      <i style={{ ...styles.dot, background: 'var(--acc)' }} />
                      готово {g.operationsDone}
                    </span>
                    <span style={styles.counter}>
                      <i style={{ ...styles.dot, background: 'var(--info)' }} />в работе{' '}
                      {g.operationsInWork}
                    </span>
                    <span style={styles.counter}>
                      <i style={{ ...styles.dot, background: 'var(--queue)' }} />
                      без исполнителя {g.operationsUnassigned}
                    </span>
                  </div>
                  {/*
                    По одному отрезку на операцию: видно, из скольких шагов набран
                    процент. Пять закрытых из пятнадцати и пять из шести дают разную
                    картину, а процент у них может совпасть.
                  */}
                  <div style={styles.segments}>
                    {Array.from({ length: o.operationsCount }, (_, i) => (
                      <span
                        key={i}
                        style={{
                          ...styles.segment,
                          background:
                            i < g.operationsDone
                              ? 'var(--acc)'
                              : i < g.operationsDone + g.operationsInWork
                                ? 'var(--info)'
                                : 'var(--queue)',
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div style={styles.rowStat}>
                  <div style={styles.statLabel}>срок</div>
                  <div style={{ ...styles.statValue, ...(overdue || g.atRisk ? styles.statBad : null) }}>
                    {new Date(o.dueDate).toLocaleDateString('ru-RU')}
                  </div>
                </div>
                <div style={styles.rowStat}>
                  <div style={styles.statLabel}>готово</div>
                  <div style={{ ...styles.statValue, ...(ready === 0 ? styles.statMuted : null) }}>
                    {ready}%
                  </div>
                </div>
                <Badge variant={g.atRisk ? 'danger' : STATUS_BADGE[o.status]}>
                  {g.atRisk ? 'Риск срыва' : ORDER_STATUS_LABELS[o.status]}
                </Badge>
              </Link>
            );
          })}
        </Panel>
      )}
    </PlannerLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    marginBottom: '10px',
  },
  sortRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginBottom: '14px',
  },
  filters: {
    display: 'flex',
    gap: '6px',
    flexWrap: 'wrap',
  },
  filter: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    minHeight: '40px',
    borderRadius: '999px',
    border: '1px solid var(--line)',
    background: 'var(--surf)',
    color: 'var(--tx2)',
    fontSize: '14px',
    cursor: 'pointer',
  },
  filterActive: {
    background: 'var(--accsoft)',
    borderColor: 'var(--acc)',
    color: 'var(--accd)',
    fontWeight: 600,
  },
  filterCount: { color: 'var(--tx3)', fontSize: '13px' },
  panelHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 18px',
    borderBottom: '1px solid var(--line2)',
  },
  panelTitle: {
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: 'var(--tx3)',
  },
  panelCount: { fontSize: '13px', color: 'var(--tx3)' },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '18px',
    padding: '14px 18px',
    borderBottom: '1px solid var(--line2)',
    textDecoration: 'none',
    color: 'var(--tx)',
  },
  rowMain: { flex: 1, minWidth: 0 },
  counters: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    marginTop: '6px',
    fontSize: '12px',
    color: 'var(--tx2)',
  },
  counter: { display: 'inline-flex', alignItems: 'center', gap: '5px' },
  dot: { width: '7px', height: '7px', borderRadius: '999px', display: 'inline-block' },
  segments: { display: 'flex', gap: '2px', marginTop: '7px' },
  segment: { flex: 1, height: '7px', borderRadius: '999px' },
  rowName: { fontSize: '15px', fontWeight: 600 },
  rowSub: { marginTop: '3px', fontSize: '13px', color: 'var(--tx2)' },
  rowStat: { textAlign: 'right', whiteSpace: 'nowrap', minWidth: '92px' },
  statLabel: { fontSize: '11px', color: 'var(--tx3)' },
  statValue: {
    fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
    fontVariantNumeric: 'tabular-nums',
    fontSize: '15px',
    fontWeight: 600,
  },
  statBad: { color: 'var(--err)' },
  statMuted: { color: 'var(--tx3)', fontWeight: 400 },
  createForm: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    marginBottom: '24px',
    alignItems: 'center',
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
  linkButton: {
    color: COLORS.accentDark,
    fontSize: '14px',
    fontWeight: 600,
    textDecoration: 'none',
  },
};
