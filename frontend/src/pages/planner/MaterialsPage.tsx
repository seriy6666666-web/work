import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api, ApiError, type Material, type MaterialStock, type Platform, type Product } from '../../api/client';
import { PlannerLayout } from './PlannerLayout';
import { Badge } from '../../components/Badge';
import { useToast } from '../../components/ToastProvider';
import { useConfirm } from '../../components/ConfirmProvider';
import { SkeletonCards } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { Select } from '../../components/Select';
import { COLORS, RADIUS, SHADOW } from '../../theme';

function isLow(s: MaterialStock): boolean {
  return s.quantity <= s.lowStockThreshold;
}

function fmt(n: number): string {
  return Number(n.toFixed(3)).toString();
}

export function MaterialsPage() {
  const { token } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [stocks, setStocks] = useState<MaterialStock[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [projects, setProjects] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // catalog form
  const [matName, setMatName] = useState('');
  const [matUnit, setMatUnit] = useState('');

  // stock form
  const [stockForm, setStockForm] = useState({ materialId: '', platformId: '', projectId: '', quantity: '', threshold: '' });
  const [adjustInputs, setAdjustInputs] = useState<Record<string, string>>({});

  async function refresh() {
    if (!token) return;
    setLoading(true);
    try {
      const [mats, sts, plats, projs] = await Promise.all([
        api.listMaterials(token),
        api.listMaterialStocks(token),
        api.listPlatforms(token),
        api.listProducts(token),
      ]);
      setMaterials(mats);
      setStocks(sts);
      setPlatforms(plats);
      setProjects(projs);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось загрузить материалы');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleCreateMaterial(e: FormEvent) {
    e.preventDefault();
    if (!token || !matName.trim() || !matUnit.trim()) return;
    try {
      await api.createMaterial(token, { name: matName.trim(), unit: matUnit.trim() });
      setMatName('');
      setMatUnit('');
      toast.success('Материал добавлен в каталог');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось добавить материал');
    }
  }

  async function handleDeleteMaterial(m: Material) {
    if (!token) return;
    const ok = await confirm({
      title: 'Удаление материала',
      message: `Удалить «${m.name}» из каталога вместе со всеми остатками?`,
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteMaterial(token, m.id);
      toast.success('Материал удалён');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось удалить материал');
    }
  }

  async function handleUpsertStock(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    // Раньше обязательность держалась на нативных required у <select>; у своего
    // компонента их нет, поэтому говорим прямо, а не выходим молча.
    if (!stockForm.materialId || !stockForm.platformId || !stockForm.projectId) {
      toast.error('Выберите материал, площадку и проект');
      return;
    }
    try {
      await api.upsertMaterialStock(token, {
        materialId: stockForm.materialId,
        platformId: stockForm.platformId,
        projectId: stockForm.projectId,
        quantity: stockForm.quantity ? Number(stockForm.quantity) : 0,
        lowStockThreshold: stockForm.threshold ? Number(stockForm.threshold) : 0,
      });
      setStockForm({ materialId: '', platformId: '', projectId: '', quantity: '', threshold: '' });
      toast.success('Остаток задан');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось задать остаток');
    }
  }

  async function handleAdjust(s: MaterialStock, sign: 1 | -1) {
    if (!token) return;
    const raw = adjustInputs[s.id];
    const amount = raw ? Number(raw) : NaN;
    if (!amount || amount <= 0) {
      toast.error('Укажите количество');
      return;
    }
    try {
      const updated = await api.adjustMaterialStock(token, s.id, sign * amount);
      setAdjustInputs((prev) => ({ ...prev, [s.id]: '' }));
      setStocks((prev) => prev.map((it) => (it.id === s.id ? updated : it)));
      if (isLow(updated)) toast.toast(`Низкий остаток: ${fmt(updated.quantity)} ${updated.material.unit}`, 'info');
      else toast.success('Остаток обновлён');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось изменить остаток');
    }
  }

  async function handleDeleteStock(s: MaterialStock) {
    if (!token) return;
    try {
      await api.deleteMaterialStock(token, s.id);
      toast.success('Остаток удалён');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось удалить остаток');
    }
  }

  const lowCount = stocks.filter(isLow).length;

  return (
    <PlannerLayout title="Материалы (склад)" breadcrumb="Планирование">
      <p style={styles.hint}>
        Остатки хранятся в разрезе <b>площадка × проект</b> — видно, где и под какой проект чего не
        хватает. При выполнении операций материалы списываются автоматически по техкарте.
      </p>

      {/* Каталог */}
      <div style={styles.card}>
        <p style={styles.blockTitle}>Каталог материалов</p>
        <form onSubmit={handleCreateMaterial} style={styles.row}>
          <input style={styles.input} placeholder="Название (например «Припой»)" value={matName} onChange={(e) => setMatName(e.target.value)} />
          <input style={{ ...styles.input, maxWidth: '120px' }} placeholder="Ед. (кг)" value={matUnit} onChange={(e) => setMatUnit(e.target.value)} />
          <button style={styles.button} type="submit" disabled={!matName.trim() || !matUnit.trim()}>Добавить</button>
        </form>
        {materials.length > 0 && (
          <div style={styles.chips}>
            {materials.map((m) => (
              <span key={m.id} style={styles.chip}>
                {m.name} <span style={styles.muted}>({m.unit})</span>
                <button style={styles.chipX} onClick={() => handleDeleteMaterial(m)} title="Удалить">×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Остатки по разрезам */}
      <div style={styles.stockHeader}>
        <p style={styles.blockTitle}>Остатки по площадкам и проектам</p>
        {lowCount > 0 && <Badge variant="danger">Ниже порога: {lowCount}</Badge>}
      </div>

      <form onSubmit={handleUpsertStock} style={styles.row}>
        <Select
          width="200px"
          ariaLabel="Материал"
          placeholder="Материал"
          value={stockForm.materialId}
          onChange={(materialId) => setStockForm({ ...stockForm, materialId })}
          options={materials.map((m) => ({ value: m.id, label: m.name }))}
        />
        <Select
          width="180px"
          ariaLabel="Площадка"
          placeholder="Площадка"
          value={stockForm.platformId}
          onChange={(platformId) => setStockForm({ ...stockForm, platformId })}
          options={platforms.map((p) => ({ value: p.id, label: p.name }))}
        />
        <Select
          width="180px"
          ariaLabel="Проект"
          placeholder="Проект"
          value={stockForm.projectId}
          onChange={(projectId) => setStockForm({ ...stockForm, projectId })}
          options={projects.map((p) => ({ value: p.id, label: p.name }))}
        />
        <input style={{ ...styles.input, maxWidth: '110px' }} type="number" step="any" placeholder="Остаток" value={stockForm.quantity} onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })} />
        <input style={{ ...styles.input, maxWidth: '100px' }} type="number" step="any" placeholder="Порог" value={stockForm.threshold} onChange={(e) => setStockForm({ ...stockForm, threshold: e.target.value })} />
        <button style={styles.button} type="submit">Задать</button>
      </form>

      {loading ? (
        <SkeletonCards count={3} />
      ) : stocks.length === 0 ? (
        <EmptyState icon="layers" title="Остатков пока нет" hint="Задайте остаток материала на площадке под проект в форме выше." />
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Материал</th>
                <th style={styles.th}>Площадка</th>
                <th style={styles.th}>Проект</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Остаток</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Порог</th>
                <th style={styles.th}>Приход / расход</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {stocks.map((s) => {
                const low = isLow(s);
                return (
                  <tr key={s.id} style={low ? styles.rowLow : undefined}>
                    <td style={styles.td}>{s.material.name}</td>
                    <td style={styles.td}>{s.platform.name}</td>
                    <td style={styles.td}>{s.project.name}</td>
                    <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700, ...(low ? { color: COLORS.error } : {}) }}>
                      {fmt(s.quantity)} {s.material.unit}
                      {low && <> <Badge variant="danger">мало</Badge></>}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', color: COLORS.mutedText }}>{fmt(s.lowStockThreshold)}</td>
                    <td style={styles.td}>
                      <div style={styles.adjustCell}>
                        <input
                          style={styles.adjustInput}
                          type="number"
                          step="any"
                          min="0"
                          placeholder="кол-во"
                          value={adjustInputs[s.id] ?? ''}
                          onChange={(e) => setAdjustInputs((prev) => ({ ...prev, [s.id]: e.target.value }))}
                        />
                        <button style={styles.plus} onClick={() => handleAdjust(s, 1)}>+</button>
                        <button style={styles.minus} onClick={() => handleAdjust(s, -1)}>−</button>
                      </div>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      <button style={styles.linkDanger} onClick={() => handleDeleteStock(s)}>Удалить</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PlannerLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  hint: { color: COLORS.mutedText, fontSize: '14px', marginTop: 0 },
  card: {
    background: COLORS.white,
    border: `1px solid ${COLORS.lightGreenBg}`,
    borderRadius: RADIUS.md,
    boxShadow: SHADOW.card,
    padding: '16px',
    marginBottom: '20px',
  },
  blockTitle: { margin: '0 0 12px', fontSize: '15px', fontWeight: 700, color: COLORS.darkText },
  stockHeader: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' },
  row: { display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' },
  input: {
    flex: 1,
    minWidth: '140px',
    padding: '10px 12px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.lightGrayBg,
    fontSize: '15px',
  },
  button: {
    padding: '10px 18px',
    borderRadius: RADIUS.sm,
    border: 'none',
    background: COLORS.accent,
    color: COLORS.white,
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  chips: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '14px',
    padding: '4px 10px',
    borderRadius: RADIUS.pill,
    background: COLORS.lightGrayBg,
  },
  chipX: { border: 'none', background: 'none', color: COLORS.error, cursor: 'pointer', fontSize: '16px', lineHeight: 1 },
  muted: { color: COLORS.mutedText },
  tableWrap: {
    background: COLORS.white,
    border: `1px solid ${COLORS.lightGreenBg}`,
    borderRadius: RADIUS.md,
    boxShadow: SHADOW.card,
    padding: '8px 12px',
    overflowX: 'auto',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
  th: { textAlign: 'left', padding: '10px 8px', color: COLORS.mutedText, fontWeight: 600, fontSize: '13px', borderBottom: `1px solid ${COLORS.lightGreenBg}`, whiteSpace: 'nowrap' },
  td: { padding: '8px', borderBottom: `1px solid ${COLORS.lightGrayBg}`, whiteSpace: 'nowrap' },
  rowLow: { background: COLORS.errorBg },
  adjustCell: { display: 'flex', gap: '6px', alignItems: 'center' },
  adjustInput: {
    width: '80px',
    padding: '6px 8px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.lightGrayBg,
    fontSize: '13px',
  },
  plus: { padding: '6px 12px', borderRadius: RADIUS.sm, border: 'none', background: COLORS.accent, color: COLORS.white, fontWeight: 700, cursor: 'pointer' },
  minus: { padding: '6px 12px', borderRadius: RADIUS.sm, border: `1px solid ${COLORS.lightGreenBg}`, background: COLORS.white, color: COLORS.darkText, fontWeight: 700, cursor: 'pointer' },
  linkDanger: { border: 'none', background: 'none', color: COLORS.error, cursor: 'pointer', fontSize: '13px' },
};
