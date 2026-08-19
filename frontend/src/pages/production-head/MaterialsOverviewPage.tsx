import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api, ApiError, type MaterialStock } from '../../api/client';
import { ProductionHeadLayout } from './ProductionHeadLayout';
import { Badge } from '../../components/Badge';
import { useToast } from '../../components/ToastProvider';
import { SkeletonCards } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { COLORS, RADIUS, SHADOW } from '../../theme';
import { useSortState, sortWith, SortHeader } from '../../components/TableControls';
import { Table, Td } from '../../components/ui';

function isLow(s: MaterialStock): boolean {
  return s.quantity <= s.lowStockThreshold;
}

function fmt(n: number): string {
  return Number(n.toFixed(3)).toString();
}

interface PlatformGroup {
  platformId: string;
  platformName: string;
  rows: MaterialStock[];
  low: number;
}

const ACCESSORS: Record<string, (s: { material: { name: string }; project: { name: string }; quantity: number; lowStockThreshold: number }) => string | number | null> = {
  material: (s) => s.material.name,
  project: (s) => s.project.name,
  quantity: (s) => s.quantity,
  threshold: (s) => s.lowStockThreshold,
  // «Не хватает» — это остаток относительно порога, а не сам остаток: 5 из 10
  // тревожнее, чем 50 из 500.
  shortage: (s) => (s.lowStockThreshold > 0 ? s.quantity / s.lowStockThreshold : Number.MAX_SAFE_INTEGER),
};

export function MaterialsOverviewPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [stocks, setStocks] = useState<MaterialStock[]>([]);

  // Один выбор на страницу, применяется внутри каждой площадки.
  const sort = useSortState({ defaultKey: 'material', storageKey: 'head-materials' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api
      .listMaterialStocks(token)
      .then(setStocks)
      .catch((err) =>
        toast.error(err instanceof ApiError ? err.message : 'Не удалось загрузить материалы'),
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const lowCount = useMemo(() => stocks.filter(isLow).length, [stocks]);

  const groups = useMemo<PlatformGroup[]>(() => {
    const byPlatform = new Map<string, PlatformGroup>();
    for (const s of stocks) {
      let g = byPlatform.get(s.platform.id);
      if (!g) {
        g = { platformId: s.platform.id, platformName: s.platform.name, rows: [], low: 0 };
        byPlatform.set(s.platform.id, g);
      }
      g.rows.push(s);
      if (isLow(s)) g.low++;
    }
    return [...byPlatform.values()];
  }, [stocks]);

  return (
    <ProductionHeadLayout title="Материалы (склад)" breadcrumb="Производство">
      <p style={styles.hint}>
        Остатки по площадкам и проектам. Управление ведёт планировщик. Материалы списываются
        автоматически при выполнении операций.
      </p>

      {!loading && stocks.length > 0 && (
        <div style={styles.summary}>
          <span>
            Позиций: <strong>{stocks.length}</strong>
          </span>
          {lowCount > 0 ? <Badge variant="danger">Ниже порога: {lowCount}</Badge> : <Badge variant="accent">Все в норме</Badge>}
        </div>
      )}

      {loading ? (
        <SkeletonCards count={3} />
      ) : stocks.length === 0 ? (
        <EmptyState icon="layers" title="Остатков пока нет" hint="Планировщик ещё не задал остатки материалов." />
      ) : (
        groups.map((g) => (
          <div key={g.platformId} style={styles.card}>
            <div style={styles.cardHeader}>
              <strong>{g.platformName}</strong>
              {g.low > 0 && <Badge variant="danger">Не хватает: {g.low}</Badge>}
            </div>
            <Table style={{ fontSize: '14px' }}>
              <thead>
                <tr>
                  <SortHeader label="Материал" sortKey="material" activeKey={sort.sortKey} dir={sort.sortDir} onSort={(k) => sort.setSort(k, k === sort.sortKey && sort.sortDir === 'asc' ? 'desc' : 'asc')} />
                  <SortHeader label="Проект" sortKey="project" activeKey={sort.sortKey} dir={sort.sortDir} onSort={(k) => sort.setSort(k, k === sort.sortKey && sort.sortDir === 'asc' ? 'desc' : 'asc')} />
                  <SortHeader label="Остаток" sortKey="quantity" activeKey={sort.sortKey} dir={sort.sortDir} onSort={(k) => sort.setSort(k, k === sort.sortKey && sort.sortDir === 'asc' ? 'desc' : 'asc')} />
                  <SortHeader label="Порог" sortKey="threshold" activeKey={sort.sortKey} dir={sort.sortDir} onSort={(k) => sort.setSort(k, k === sort.sortKey && sort.sortDir === 'asc' ? 'desc' : 'asc')} />
                  <SortHeader label="Статус" sortKey="shortage" activeKey={sort.sortKey} dir={sort.sortDir} onSort={(k) => sort.setSort(k, k === sort.sortKey && sort.sortDir === 'asc' ? 'desc' : 'asc')} />
                </tr>
              </thead>
              <tbody>
                {sortWith(g.rows, ACCESSORS[sort.sortKey] ?? ACCESSORS.material, sort.sortDir).map((s) => {
                  const low = isLow(s);
                  return (
                    <tr key={s.id} style={low ? styles.rowLow : undefined}>
                      <Td style={{ padding: '8px 10px', borderBottom: `1px solid ${COLORS.lightGrayBg}` }}>{s.material.name}</Td>
                      <Td style={{ padding: '8px 10px', borderBottom: `1px solid ${COLORS.lightGrayBg}` }}>{s.project.name}</Td>
                      <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600, ...(low ? { color: COLORS.error } : {}) }}>
                        {fmt(s.quantity)} {s.material.unit}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', color: COLORS.mutedText }}>{fmt(s.lowStockThreshold)}</td>
                      <Td style={{ padding: '8px 10px', borderBottom: `1px solid ${COLORS.lightGrayBg}` }}>
                        {low ? <Badge variant="danger">Не хватает</Badge> : <Badge variant="accent">В норме</Badge>}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
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
    overflowX: 'auto',
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '8px', flexWrap: 'wrap' },
  td: { padding: '8px 10px', borderBottom: `1px solid ${COLORS.lightGrayBg}` },
  rowLow: { background: COLORS.errorBg },
};
