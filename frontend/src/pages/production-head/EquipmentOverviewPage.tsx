import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api, ApiError, type Equipment, type EquipmentStatus } from '../../api/client';
import { ProductionHeadLayout } from './ProductionHeadLayout';
import { Badge, type BadgeVariant } from '../../components/Badge';
import { useToast } from '../../components/ToastProvider';
import { SkeletonCards } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { COLORS, RADIUS, SHADOW } from '../../theme';
import { useSortState, sortWith, SortHeader } from '../../components/TableControls';

const STATUS_META: Record<EquipmentStatus, { label: string; variant: BadgeVariant }> = {
  OPERATIONAL: { label: 'В работе', variant: 'accent' },
  MAINTENANCE: { label: 'На обслуживании', variant: 'priority-medium' },
  BROKEN: { label: 'Поломка', variant: 'danger' },
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ru-RU');
}

interface SiteGroup {
  siteId: string;
  siteName: string;
  items: Equipment[];
  broken: number;
  maintenance: number;
}

/** Сломанное впереди: с ним надо что-то делать сегодня. */
const STATUS_SEVERITY: Record<string, number> = { BROKEN: 0, MAINTENANCE: 1, OPERATIONAL: 2 };

const ACCESSORS: Record<string, (i: { name: string; status: string; nextMaintenanceAt: string | null }) => string | number | null> = {
  name: (i) => i.name,
  status: (i) => STATUS_SEVERITY[String(i.status)] ?? 9,
  maintenance: (i) => i.nextMaintenanceAt,
};

export function EquipmentOverviewPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<Equipment[]>([]);

  // Порядок один на страницу, а применяется внутри каждого участка: общий список
  // сортировать нельзя, он бы перемешал участки между собой.
  const sort = useSortState({ defaultKey: 'name', storageKey: 'head-equipment' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api
      .listAllEquipment(token)
      .then(setItems)
      .catch((err) =>
        toast.error(err instanceof ApiError ? err.message : 'Не удалось загрузить оборудование'),
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const groups = useMemo<SiteGroup[]>(() => {
    const bySite = new Map<string, SiteGroup>();
    for (const item of items) {
      const siteId = item.site?.id ?? item.siteId;
      const siteName = item.site?.name ?? 'Без участка';
      let g = bySite.get(siteId);
      if (!g) {
        g = { siteId, siteName, items: [], broken: 0, maintenance: 0 };
        bySite.set(siteId, g);
      }
      g.items.push(item);
      if (item.status === 'BROKEN') g.broken++;
      if (item.status === 'MAINTENANCE') g.maintenance++;
    }
    return [...bySite.values()];
  }, [items]);

  const totals = useMemo(
    () => ({
      total: items.length,
      broken: items.filter((i) => i.status === 'BROKEN').length,
      maintenance: items.filter((i) => i.status === 'MAINTENANCE').length,
    }),
    [items],
  );

  return (
    <ProductionHeadLayout title="Оборудование" breadcrumb="Производство">
      <p style={styles.hint}>
        Состояние оборудования по всем участкам. Управление ведут начальники участков.
      </p>

      {!loading && items.length > 0 && (
        <div style={styles.summary}>
          <span>
            Всего: <strong>{totals.total}</strong>
          </span>
          {totals.maintenance > 0 && <Badge variant="priority-medium">На обслуживании: {totals.maintenance}</Badge>}
          {totals.broken > 0 && <Badge variant="danger">Поломки: {totals.broken}</Badge>}
          {totals.broken === 0 && totals.maintenance === 0 && (
            <Badge variant="accent">Всё в работе</Badge>
          )}
        </div>
      )}

      {loading ? (
        <SkeletonCards count={3} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="wrench"
          title="Оборудование не заведено"
          hint="Начальники участков ещё не добавили оборудование."
        />
      ) : (
        groups.map((g) => (
          <div key={g.siteId} style={styles.card}>
            <div style={styles.cardHeader}>
              <strong>{g.siteName}</strong>
              <div style={styles.headerBadges}>
                {g.maintenance > 0 && <Badge variant="priority-medium">Обслуживание: {g.maintenance}</Badge>}
                {g.broken > 0 && <Badge variant="danger">Поломки: {g.broken}</Badge>}
              </div>
            </div>
            <table style={styles.table}>
              <thead>
                <tr>
                  <SortHeader label="Оборудование" sortKey="name" activeKey={sort.sortKey} dir={sort.sortDir} onSort={(k) => sort.setSort(k, k === sort.sortKey && sort.sortDir === 'asc' ? 'desc' : 'asc')} />
                  <SortHeader label="Статус" sortKey="status" activeKey={sort.sortKey} dir={sort.sortDir} onSort={(k) => sort.setSort(k, k === sort.sortKey && sort.sortDir === 'asc' ? 'desc' : 'asc')} />
                  <SortHeader label="След. обслуживание" sortKey="maintenance" activeKey={sort.sortKey} dir={sort.sortDir} onSort={(k) => sort.setSort(k, k === sort.sortKey && sort.sortDir === 'asc' ? 'desc' : 'asc')} />
                </tr>
              </thead>
              <tbody>
                {sortWith(g.items, ACCESSORS[sort.sortKey] ?? ACCESSORS.name, sort.sortDir).map((item) => (
                  <tr key={item.id}>
                    <td style={styles.td}>{item.name}</td>
                    <td style={styles.td}>
                      <Badge variant={STATUS_META[item.status].variant}>
                        {STATUS_META[item.status].label}
                      </Badge>
                    </td>
                    <td style={styles.td}>{formatDate(item.nextMaintenanceAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}
    </ProductionHeadLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  hint: { color: COLORS.mutedText, fontSize: '14px', marginTop: 0 },
  summary: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' },
  card: {
    padding: '16px',
    background: COLORS.white,
    border: `1px solid ${COLORS.lightGreenBg}`,
    borderRadius: RADIUS.md,
    boxShadow: SHADOW.card,
    marginBottom: '16px',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
    flexWrap: 'wrap',
    gap: '8px',
  },
  headerBadges: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
  th: {
    textAlign: 'left',
    padding: '8px 10px',
    color: COLORS.mutedText,
    fontWeight: 600,
    borderBottom: `1px solid ${COLORS.lightGreenBg}`,
    fontSize: '13px',
  },
  td: { padding: '8px 10px', borderBottom: `1px solid ${COLORS.lightGrayBg}` },
};
