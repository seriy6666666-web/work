import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api, ApiError, type Material } from '../../api/client';
import { ProductionHeadLayout } from './ProductionHeadLayout';
import { Badge } from '../../components/Badge';
import { useToast } from '../../components/ToastProvider';
import { SkeletonCards } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { COLORS, RADIUS, SHADOW } from '../../theme';

function isLow(m: Material): boolean {
  return m.quantity <= m.lowStockThreshold;
}

function fmt(n: number): string {
  return Number(n.toFixed(3)).toString();
}

export function MaterialsOverviewPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api
      .listMaterials(token)
      .then(setMaterials)
      .catch((err) =>
        toast.error(err instanceof ApiError ? err.message : 'Не удалось загрузить материалы'),
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const lowCount = useMemo(() => materials.filter(isLow).length, [materials]);

  return (
    <ProductionHeadLayout title="Материалы (склад)" breadcrumb="Производство">
      <p style={styles.hint}>Остатки материалов по складу. Управление ведёт планировщик.</p>

      {!loading && materials.length > 0 && (
        <div style={styles.summary}>
          <span>
            Позиций: <strong>{materials.length}</strong>
          </span>
          {lowCount > 0 ? (
            <Badge variant="danger">Ниже порога: {lowCount}</Badge>
          ) : (
            <Badge variant="accent">Все в норме</Badge>
          )}
        </div>
      )}

      {loading ? (
        <SkeletonCards count={3} />
      ) : materials.length === 0 ? (
        <EmptyState
          icon="layers"
          title="Материалов пока нет"
          hint="Планировщик ещё не завёл материалы на складе."
        />
      ) : (
        <div style={styles.card}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Материал</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Остаток</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Порог</th>
                <th style={styles.th}>Статус</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => {
                const low = isLow(m);
                return (
                  <tr key={m.id} style={low ? styles.rowLow : undefined}>
                    <td style={styles.td}>{m.name}</td>
                    <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600 }}>
                      {fmt(m.quantity)} {m.unit}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', color: COLORS.mutedText }}>
                      {fmt(m.lowStockThreshold)} {m.unit}
                    </td>
                    <td style={styles.td}>
                      {low ? (
                        <Badge variant="danger">Низкий остаток</Badge>
                      ) : (
                        <Badge variant="accent">В норме</Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </ProductionHeadLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  hint: { color: COLORS.mutedText, fontSize: '14px', marginTop: 0 },
  summary: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' },
  card: {
    padding: '8px 16px',
    background: COLORS.white,
    border: `1px solid ${COLORS.lightGreenBg}`,
    borderRadius: RADIUS.md,
    boxShadow: SHADOW.card,
    overflowX: 'auto',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
  th: {
    textAlign: 'left',
    padding: '10px',
    color: COLORS.mutedText,
    fontWeight: 600,
    borderBottom: `1px solid ${COLORS.lightGreenBg}`,
    fontSize: '13px',
  },
  td: { padding: '10px', borderBottom: `1px solid ${COLORS.lightGrayBg}` },
  rowLow: { background: COLORS.errorBg },
};
