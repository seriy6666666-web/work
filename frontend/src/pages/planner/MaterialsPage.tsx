import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api, ApiError, type Material } from '../../api/client';
import { PlannerLayout } from './PlannerLayout';
import { Badge } from '../../components/Badge';
import { useToast } from '../../components/ToastProvider';
import { useConfirm } from '../../components/ConfirmProvider';
import { SkeletonCards } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { COLORS, RADIUS, SHADOW } from '../../theme';

function isLow(m: Material): boolean {
  return m.quantity <= m.lowStockThreshold;
}

/** Trim trailing zeros so 5.0 renders as "5". */
function fmt(n: number): string {
  return Number(n.toFixed(3)).toString();
}

export function MaterialsPage() {
  const { token } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [quantity, setQuantity] = useState('');
  const [threshold, setThreshold] = useState('');
  const [creating, setCreating] = useState(false);

  const [adjustInputs, setAdjustInputs] = useState<Record<string, string>>({});

  async function refresh() {
    if (!token) return;
    setLoading(true);
    try {
      setMaterials(await api.listMaterials(token));
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

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!token || !name.trim() || !unit.trim()) return;
    setCreating(true);
    try {
      await api.createMaterial(token, {
        name: name.trim(),
        unit: unit.trim(),
        quantity: quantity ? Number(quantity) : 0,
        lowStockThreshold: threshold ? Number(threshold) : 0,
      });
      setName('');
      setUnit('');
      setQuantity('');
      setThreshold('');
      toast.success('Материал добавлен');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось добавить материал');
    } finally {
      setCreating(false);
    }
  }

  async function handleAdjust(m: Material, sign: 1 | -1) {
    if (!token) return;
    const raw = adjustInputs[m.id];
    const amount = raw ? Number(raw) : NaN;
    if (!amount || amount <= 0) {
      toast.error('Укажите количество для изменения');
      return;
    }
    try {
      const updated = await api.adjustMaterial(token, m.id, sign * amount);
      setAdjustInputs((prev) => ({ ...prev, [m.id]: '' }));
      setMaterials((prev) => prev.map((it) => (it.id === m.id ? updated : it)));
      if (isLow(updated)) {
        toast.toast(`Низкий остаток: ${fmt(updated.quantity)} ${updated.unit}`, 'info');
      } else {
        toast.success('Остаток обновлён');
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось изменить остаток');
    }
  }

  async function handleThreshold(m: Material, value: string) {
    if (!token) return;
    const parsed = Number(value);
    if (Number.isNaN(parsed) || parsed < 0) return;
    setMaterials((prev) => prev.map((it) => (it.id === m.id ? { ...it, lowStockThreshold: parsed } : it)));
    try {
      await api.updateMaterial(token, m.id, { lowStockThreshold: parsed });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось сохранить порог');
      await refresh();
    }
  }

  async function handleDelete(m: Material) {
    if (!token) return;
    const ok = await confirm({
      title: 'Удаление материала',
      message: `Удалить материал «${m.name}» со склада?`,
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

  const lowCount = materials.filter(isLow).length;

  return (
    <PlannerLayout title="Материалы (склад)" breadcrumb="Планирование">
      <p style={styles.hint}>
        Ведите остатки материалов и порог низкого запаса. При падении остатка до/ниже порога вы
        получите уведомление.
      </p>

      {!loading && lowCount > 0 && (
        <div style={styles.lowBanner}>
          <Badge variant="danger">Ниже порога: {lowCount}</Badge>
        </div>
      )}

      <form onSubmit={handleCreate} style={styles.createForm}>
        <input
          style={styles.input}
          placeholder="Материал (например «Литиевые ячейки»)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          style={{ ...styles.input, width: '90px' }}
          placeholder="Ед. (шт/кг)"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
        />
        <input
          style={{ ...styles.input, width: '120px' }}
          type="number"
          step="any"
          placeholder="Остаток"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
        <input
          style={{ ...styles.input, width: '120px' }}
          type="number"
          step="any"
          placeholder="Порог"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
        />
        <button style={styles.button} type="submit" disabled={creating || !name.trim() || !unit.trim()}>
          Добавить
        </button>
      </form>

      {loading ? (
        <SkeletonCards count={3} />
      ) : materials.length === 0 ? (
        <EmptyState
          icon="layers"
          title="Материалов пока нет"
          hint="Добавьте первый материал в форме выше."
        />
      ) : (
        <div style={styles.list}>
          {materials.map((m) => {
            const low = isLow(m);
            return (
              <div key={m.id} style={{ ...styles.card, ...(low ? styles.cardLow : null) }}>
                <div style={styles.cardMain}>
                  <div style={styles.nameRow}>
                    <strong>{m.name}</strong>
                    {low && <Badge variant="danger">Низкий остаток</Badge>}
                  </div>
                  <div style={styles.metaRow}>
                    <span style={styles.qty}>
                      {fmt(m.quantity)} <span style={styles.unit}>{m.unit}</span>
                    </span>
                    <label style={styles.thresholdLabel}>
                      Порог:
                      <input
                        style={styles.thresholdInput}
                        type="number"
                        step="any"
                        defaultValue={fmt(m.lowStockThreshold)}
                        onBlur={(e) => handleThreshold(m, e.target.value)}
                      />
                      <span style={styles.unit}>{m.unit}</span>
                    </label>
                  </div>
                </div>
                <div style={styles.actions}>
                  <input
                    style={styles.adjustInput}
                    type="number"
                    step="any"
                    min="0"
                    placeholder="Кол-во"
                    value={adjustInputs[m.id] ?? ''}
                    onChange={(e) => setAdjustInputs((prev) => ({ ...prev, [m.id]: e.target.value }))}
                  />
                  <button style={styles.plus} onClick={() => handleAdjust(m, 1)} title="Приход">
                    + приход
                  </button>
                  <button style={styles.minus} onClick={() => handleAdjust(m, -1)} title="Расход">
                    − расход
                  </button>
                  <button style={styles.linkDanger} onClick={() => handleDelete(m)}>
                    Удалить
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PlannerLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  hint: { color: COLORS.mutedText, fontSize: '14px', marginTop: 0 },
  lowBanner: { marginBottom: '14px' },
  createForm: { display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' },
  input: {
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
  list: { display: 'flex', flexDirection: 'column', gap: '12px' },
  card: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    padding: '16px',
    background: COLORS.white,
    border: `1px solid ${COLORS.lightGreenBg}`,
    borderRadius: RADIUS.md,
    boxShadow: SHADOW.card,
    flexWrap: 'wrap',
  },
  cardLow: { borderColor: COLORS.error, background: COLORS.errorBg },
  cardMain: { display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '220px', flex: 1 },
  nameRow: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  metaRow: { display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' },
  qty: { fontSize: '18px', fontWeight: 700, color: COLORS.darkText },
  unit: { fontSize: '13px', fontWeight: 400, color: COLORS.mutedText },
  thresholdLabel: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: COLORS.mutedText },
  thresholdInput: {
    width: '70px',
    padding: '4px 8px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.white,
    fontSize: '13px',
  },
  actions: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  adjustInput: {
    width: '90px',
    padding: '8px 10px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.lightGrayBg,
    fontSize: '14px',
  },
  plus: {
    padding: '8px 12px',
    borderRadius: RADIUS.sm,
    border: 'none',
    background: COLORS.accent,
    color: COLORS.white,
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  minus: {
    padding: '8px 12px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.white,
    color: COLORS.darkText,
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  linkDanger: { border: 'none', background: 'none', color: COLORS.error, cursor: 'pointer', fontSize: '13px' },
};
