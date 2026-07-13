import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { api, ApiError, type Product, type Site, type Skill } from '../../api/client';
import { PlannerLayout } from './PlannerLayout';
import { Badge } from '../../components/Badge';
import { useToast } from '../../components/ToastProvider';
import { useConfirm } from '../../components/ConfirmProvider';
import { SkeletonCards } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { COLORS, RADIUS, SHADOW } from '../../theme';

interface OpForm {
  skillId: string;
  siteId: string;
  secondarySiteId: string;
}

const EMPTY_OP: OpForm = { skillId: '', siteId: '', secondarySiteId: '' };

export function ProductsPage() {
  const { token } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [products, setProducts] = useState<Product[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [opForms, setOpForms] = useState<Record<string, OpForm>>({});

  async function refresh() {
    if (!token) return;
    setLoading(true);
    try {
      const [productsData, skillsData, sitesData] = await Promise.all([
        api.listProducts(token),
        api.listSkills(token),
        api.listSites(token),
      ]);
      setProducts(productsData);
      setSkills(skillsData);
      setSites(sitesData);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось загрузить продукты');
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
    if (!token || !newName.trim()) return;
    setCreating(true);
    try {
      await api.createProduct(token, { name: newName.trim() });
      setNewName('');
      toast.success('Продукт создан');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось создать продукт');
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteProduct(p: Product) {
    if (!token) return;
    const ok = await confirm({
      title: 'Удаление продукта',
      message: `Удалить продукт «${p.name}» и его шаблон операций?`,
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteProduct(token, p.id);
      toast.success('Продукт удалён');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось удалить продукт');
    }
  }

  async function handleAddOp(e: FormEvent, productId: string) {
    e.preventDefault();
    if (!token) return;
    const form = opForms[productId] ?? EMPTY_OP;
    if (!form.skillId || !form.siteId) return;
    try {
      await api.addProductOperation(token, productId, {
        skillId: form.skillId,
        siteId: form.siteId,
        secondarySiteId: form.secondarySiteId || undefined,
      });
      setOpForms((prev) => ({ ...prev, [productId]: EMPTY_OP }));
      toast.success('Операция добавлена в шаблон');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось добавить операцию');
    }
  }

  async function handleDeleteOp(id: string) {
    if (!token) return;
    try {
      await api.deleteProductOperation(token, id);
      toast.success('Операция удалена');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось удалить операцию');
    }
  }

  return (
    <PlannerLayout title="Продукты (шаблоны операций)" breadcrumb="Планирование">
      <p style={styles.hint}>
        Задайте типовой набор операций для продукта — при создании заказа «из продукта» операции
        подставятся автоматически.
      </p>

      <form onSubmit={handleCreate} style={styles.createForm}>
        <input
          style={styles.input}
          placeholder="Название продукта (например «АКБ-1000»)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button style={styles.button} type="submit" disabled={creating || !newName.trim()}>
          Добавить продукт
        </button>
      </form>

      {skills.length === 0 && (
        <p style={styles.hint}>
          Справочник навыков пуст. <Link to="/planner/skills">Создайте навыки</Link>, чтобы добавлять
          операции в шаблон.
        </p>
      )}

      {loading ? (
        <SkeletonCards count={3} />
      ) : products.length === 0 ? (
        <EmptyState icon="box" title="Продуктов пока нет" hint="Добавьте первый продукт в форме выше." />
      ) : (
        products.map((p) => {
          const form = opForms[p.id] ?? EMPTY_OP;
          return (
            <div key={p.id} style={styles.card}>
              <div style={styles.cardHeader}>
                <strong>{p.name}</strong>
                <button style={styles.linkDanger} onClick={() => handleDeleteProduct(p)}>
                  Удалить продукт
                </button>
              </div>

              {p.operations.length === 0 ? (
                <p style={styles.muted}>Операции ещё не заданы.</p>
              ) : (
                <ol style={styles.opList}>
                  {p.operations.map((op) => (
                    <li key={op.id} style={styles.opItem}>
                      <span>
                        {op.skill.name} · {op.site.name}
                        {op.secondarySite && (
                          <>
                            {' '}
                            <Badge variant="shared">+ {op.secondarySite.name}</Badge>
                          </>
                        )}
                      </span>
                      <button style={styles.linkDanger} onClick={() => handleDeleteOp(op.id)}>
                        Удалить
                      </button>
                    </li>
                  ))}
                </ol>
              )}

              <form onSubmit={(e) => handleAddOp(e, p.id)} style={styles.opForm}>
                <select
                  style={styles.input}
                  value={form.skillId}
                  onChange={(e) => setOpForms((prev) => ({ ...prev, [p.id]: { ...form, skillId: e.target.value } }))}
                  required
                >
                  <option value="">Навык</option>
                  {skills.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <select
                  style={styles.input}
                  value={form.siteId}
                  onChange={(e) => setOpForms((prev) => ({ ...prev, [p.id]: { ...form, siteId: e.target.value } }))}
                  required
                >
                  <option value="">Участок</option>
                  {sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <select
                  style={styles.input}
                  value={form.secondarySiteId}
                  onChange={(e) =>
                    setOpForms((prev) => ({ ...prev, [p.id]: { ...form, secondarySiteId: e.target.value } }))
                  }
                >
                  <option value="">Второй участок (опц.)</option>
                  {sites
                    .filter((s) => s.id !== form.siteId)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
                <button style={styles.button} type="submit">
                  + Операция
                </button>
              </form>
            </div>
          );
        })
      )}
    </PlannerLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  hint: {
    color: COLORS.mutedText,
    fontSize: '14px',
    marginTop: 0,
  },
  createForm: {
    display: 'flex',
    gap: '12px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
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
  },
  muted: {
    color: COLORS.mutedText,
    fontSize: '13px',
  },
  opList: {
    margin: '0 0 12px',
    paddingLeft: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  opItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
    fontSize: '14px',
  },
  opForm: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  linkDanger: {
    border: 'none',
    background: 'none',
    color: COLORS.error,
    cursor: 'pointer',
    fontSize: '13px',
  },
};
