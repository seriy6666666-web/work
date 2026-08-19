import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import {
  api,
  ApiError,
  type Material,
  type OperationType,
  type Platform,
  type Product,
  type Site,
} from '../../api/client';
import { PlannerLayout } from './PlannerLayout';
import { Badge } from '../../components/Badge';
import { useToast } from '../../components/ToastProvider';
import { useConfirm } from '../../components/ConfirmProvider';
import { SkeletonCards } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { Select } from '../../components/Select';
import { COLORS, RADIUS, SHADOW } from '../../theme';

interface OpForm {
  operationTypeId: string;
  siteId: string;
  secondarySiteId: string;
}

const EMPTY_OP: OpForm = { operationTypeId: '', siteId: '', secondarySiteId: '' };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU');
}

export function ProductsPage() {
  const { token } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [products, setProducts] = useState<Product[]>([]);
  const [operationTypes, setOperationTypes] = useState<OperationType[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  /**
   * Свёрнутые проекты. Раньше все техкарты были развёрнуты разом: пять проектов
   * по 8–15 шагов, у каждого шага ещё блок материалов — чтобы дойти до
   * последнего, приходилось листать всю страницу.
   *
   * Свёрнутость держим в localStorage, а не в памяти: страница перезагружается
   * после каждого действия со списком, и иначе всё распахивалось бы заново.
   */
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(localStorage.getItem('belmy_collapsed_products') ?? '{}');
    } catch {
      return {};
    }
  });

  function toggleProduct(productId: string) {
    setCollapsed((prev) => {
      const next = { ...prev, [productId]: !prev[productId] };
      localStorage.setItem('belmy_collapsed_products', JSON.stringify(next));
      return next;
    });
  }

  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [opForms, setOpForms] = useState<Record<string, OpForm>>({});
  const [opMatForms, setOpMatForms] = useState<Record<string, { materialId: string; qty: string }>>({});

  async function refresh() {
    if (!token) return;
    setLoading(true);
    try {
      const [productsData, operationTypesData, sitesData, platformsData, materialsData] = await Promise.all([
        api.listProducts(token, showArchived),
        api.listOperationTypes(token),
        api.listSites(token),
        api.listPlatforms(token),
        api.listMaterials(token),
      ]);
      setProducts(productsData);
      setOperationTypes(operationTypesData);
      setSites(sitesData);
      setPlatforms(platformsData);
      setMaterials(materialsData);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось загрузить проекты');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, showArchived]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!token || !newName.trim()) return;
    setCreating(true);
    try {
      await api.createProduct(token, { name: newName.trim() });
      setNewName('');
      toast.success('Проект создан');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось создать проект');
    } finally {
      setCreating(false);
    }
  }

  async function handleArchive(p: Product) {
    if (!token) return;
    const archived = p.status !== 'ARCHIVED';
    try {
      await api.archiveProduct(token, p.id, archived);
      toast.success(archived ? 'Проект в архиве' : 'Проект восстановлен');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось изменить статус');
    }
  }

  async function handleTogglePlatform(p: Product, platformId: string) {
    if (!token) return;
    const current = new Set(p.platforms.map((pl) => pl.id));
    if (current.has(platformId)) current.delete(platformId);
    else current.add(platformId);
    try {
      await api.setProductPlatforms(token, p.id, [...current]);
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось изменить площадки');
    }
  }

  async function handleDeleteProduct(p: Product) {
    if (!token) return;
    const ok = await confirm({
      title: 'Удаление проекта',
      message: `Удалить проект «${p.name}» и его техкарту? История по проекту не сохранится — если нужно сохранить, лучше «В архив».`,
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteProduct(token, p.id);
      toast.success('Проект удалён');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось удалить проект');
    }
  }

  async function handleAddOp(e: FormEvent, productId: string) {
    e.preventDefault();
    if (!token) return;
    const form = opForms[productId] ?? EMPTY_OP;
    // Раньше на пустые поля ругался нативный required у <select>; у своего компонента
    // его нет, поэтому говорим прямо, а не выходим молча.
    if (!form.operationTypeId || !form.siteId) {
      toast.error('Выберите операцию и участок');
      return;
    }
    try {
      await api.addProductOperation(token, productId, {
        operationTypeId: form.operationTypeId,
        siteId: form.siteId,
        secondarySiteId: form.secondarySiteId || undefined,
      });
      setOpForms((prev) => ({ ...prev, [productId]: EMPTY_OP }));
      toast.success('Операция добавлена в техкарту');
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

  async function handleAddOpMaterial(opId: string) {
    if (!token) return;
    const f = opMatForms[opId];
    if (!f?.materialId || !f.qty || Number(f.qty) <= 0) {
      toast.error('Выберите материал и укажите расход');
      return;
    }
    try {
      await api.setOperationMaterial(token, opId, f.materialId, Number(f.qty));
      setOpMatForms((prev) => ({ ...prev, [opId]: { materialId: '', qty: '' } }));
      toast.success('Расход материала задан');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось задать расход');
    }
  }

  async function handleRemoveOpMaterial(id: string) {
    if (!token) return;
    try {
      await api.removeOperationMaterial(token, id);
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось удалить расход');
    }
  }

  return (
    <PlannerLayout title="Проекты" breadcrumb="Планирование">
      <p style={styles.hint}>
        Проект — готовый шаблон изделия с техкартой (операции по участкам). При создании заказа «из
        проекта» операции подставляются автоматически. Площадки — где проект производится.
      </p>

      <form onSubmit={handleCreate} style={styles.createForm}>
        <input
          style={styles.input}
          placeholder="Название проекта (например «АКБ 24В 100Ач»)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button style={styles.button} type="submit" disabled={creating || !newName.trim()}>
          Добавить проект
        </button>
      </form>

      <label style={styles.archivedToggle}>
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(e) => setShowArchived(e.target.checked)}
        />
        Показывать архивные
      </label>

      {operationTypes.length === 0 && (
        <p style={styles.hint}>
          Справочник операций пуст. <Link to="/planner/operations">Заведите операции</Link>, чтобы
          собирать из них техкарту изделия.
        </p>
      )}

      {loading ? (
        <SkeletonCards count={3} />
      ) : products.length === 0 ? (
        <EmptyState icon="box" title="Проектов пока нет" hint="Добавьте первый проект в форме выше." />
      ) : (
        products.map((p) => {
          const form = opForms[p.id] ?? EMPTY_OP;
          const archived = p.status === 'ARCHIVED';
          const platformIds = new Set(p.platforms.map((pl) => pl.id));
          const isCollapsed = Boolean(collapsed[p.id]);
          return (
            <div key={p.id} style={{ ...styles.card, ...(archived ? styles.cardArchived : null) }}>
              <div style={styles.cardHeader}>
                <div style={styles.titleRow}>
                  {/* Раскрывает техкарту. Сводка в заголовке — чтобы понять состав, не разворачивая. */}
                  <button
                    style={styles.caret}
                    onClick={() => toggleProduct(p.id)}
                    aria-label={isCollapsed ? 'Раскрыть техкарту' : 'Свернуть техкарту'}
                  >
                    {isCollapsed ? '▸' : '▾'}
                  </button>
                  <strong style={styles.clickableName} onClick={() => toggleProduct(p.id)}>
                    {p.name}
                  </strong>
                  <span style={styles.opsCount}>
                    {p.operations.length === 0 ? 'техкарта пуста' : `${p.operations.length} оп.`}
                  </span>
                  {archived ? <Badge variant="muted">Архив</Badge> : <Badge variant="accent">Активен</Badge>}
                  <span style={styles.date}>от {formatDate(p.createdAt)}</span>
                </div>
                <div style={styles.headerActions}>
                  <button style={styles.link} onClick={() => handleArchive(p)}>
                    {archived ? 'Восстановить' : 'В архив'}
                  </button>
                  <button style={styles.linkDanger} onClick={() => handleDeleteProduct(p)}>
                    Удалить
                  </button>
                </div>
              </div>

              {!isCollapsed && (
                <>
              {/* Площадки */}
              <div style={styles.platformsRow}>
                <span style={styles.blockLabel}>Площадки:</span>
                {platforms.length === 0 ? (
                  <span style={styles.muted}>
                    нет площадок — <Link to="/admin/platforms">добавьте в администрировании</Link>
                  </span>
                ) : (
                  platforms.map((pl) => (
                    <label key={pl.id} style={styles.platformChip}>
                      <input
                        type="checkbox"
                        checked={platformIds.has(pl.id)}
                        onChange={() => handleTogglePlatform(p, pl.id)}
                      />
                      {pl.name}
                    </label>
                  ))
                )}
              </div>

              {/* Техкарта */}
              <span style={styles.blockLabel}>Техкарта (операции):</span>
              {p.operations.length === 0 ? (
                <p style={styles.muted}>Операции ещё не заданы.</p>
              ) : (
                <ol style={styles.opList}>
                  {p.operations.map((op) => {
                    const mf = opMatForms[op.id] ?? { materialId: '', qty: '' };
                    return (
                      <li key={op.id} style={styles.opBlock}>
                        <div style={styles.opItem}>
                          <span>
                            {op.operationType.name} · {op.site.name}
                            {op.operationType.skill && (
                              <span style={styles.opSkill}> · навык: {op.operationType.skill.name}</span>
                            )}
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
                        </div>
                        {/* Расход материалов на 1 изделие */}
                        <div style={styles.matRow}>
                          <span style={styles.matLabel}>Материалы/шт:</span>
                          {op.materials.length === 0 && <span style={styles.muted}>не заданы</span>}
                          {op.materials.map((m) => (
                            <span key={m.id} style={styles.matChip}>
                              {m.material.name} — {m.quantityPerUnit} {m.material.unit}
                              <button style={styles.chipX} onClick={() => handleRemoveOpMaterial(m.id)} title="Убрать">
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                        <div style={styles.matForm}>
                          <Select
                            width="200px"
                            ariaLabel="Материал"
                            placeholder="Материал"
                            value={mf.materialId}
                            onChange={(materialId) =>
                              setOpMatForms((prev) => ({ ...prev, [op.id]: { ...mf, materialId } }))
                            }
                            options={materials.map((mat) => ({
                              value: mat.id,
                              label: mat.name,
                              hint: mat.unit,
                            }))}
                          />
                          <input
                            style={{ ...styles.matInput, maxWidth: '110px' }}
                            type="number"
                            step="any"
                            min="0"
                            placeholder="на 1 шт"
                            value={mf.qty}
                            onChange={(e) => setOpMatForms((prev) => ({ ...prev, [op.id]: { ...mf, qty: e.target.value } }))}
                          />
                          <button style={styles.smallBtn} onClick={() => handleAddOpMaterial(op.id)}>
                            + расход
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}

              <form onSubmit={(e) => handleAddOp(e, p.id)} style={styles.opForm}>
                <Select
                  width="190px"
                  ariaLabel="Операция"
                  placeholder="Операция"
                  value={form.operationTypeId}
                  onChange={(operationTypeId) =>
                    setOpForms((prev) => ({ ...prev, [p.id]: { ...form, operationTypeId } }))
                  }
                  options={operationTypes.map((o) => ({
                    value: o.id,
                    label: o.skill ? `${o.name} — навык: ${o.skill.name}` : o.name,
                  }))}
                />
                <Select
                  width="170px"
                  ariaLabel="Участок"
                  placeholder="Участок"
                  value={form.siteId}
                  onChange={(siteId) => setOpForms((prev) => ({ ...prev, [p.id]: { ...form, siteId } }))}
                  options={sites.map((s) => ({ value: s.id, label: s.name }))}
                />
                <Select
                  width="200px"
                  ariaLabel="Второй участок"
                  placeholder="Второй участок (опц.)"
                  value={form.secondarySiteId}
                  onChange={(secondarySiteId) =>
                    setOpForms((prev) => ({ ...prev, [p.id]: { ...form, secondarySiteId } }))
                  }
                  // Второй участок необязателен, поэтому пустой вариант нужен как выбор:
                  // раз выставленный, он должен сниматься.
                  options={[
                    { value: '', label: 'Без второго участка' },
                    ...sites
                      .filter((s) => s.id !== form.siteId)
                      .map((s) => ({ value: s.id, label: s.name })),
                  ]}
                />
                <button style={styles.button} type="submit">
                  + Операция
                </button>
              </form>
                </>
              )}
            </div>
          );
        })
      )}
    </PlannerLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  caret: {
    border: 'none',
    background: 'none',
    color: COLORS.mutedText,
    cursor: 'pointer',
    fontSize: '13px',
    padding: '0 2px',
  },
  clickableName: {
    cursor: 'pointer',
  },
  opsCount: {
    color: COLORS.mutedText,
    fontSize: '13px',
  },
  opSkill: {
    color: COLORS.mutedText,
    fontSize: '13px',
  },
  hint: { color: COLORS.mutedText, fontSize: '14px', marginTop: 0 },
  createForm: { display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' },
  archivedToggle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: COLORS.mutedText,
    marginBottom: '20px',
    cursor: 'pointer',
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
  cardArchived: { opacity: 0.7 },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
    gap: '10px',
    flexWrap: 'wrap',
  },
  titleRow: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  date: { fontSize: '13px', color: COLORS.mutedText },
  headerActions: { display: 'flex', gap: '14px' },
  blockLabel: { fontSize: '13px', fontWeight: 600, color: COLORS.mutedText },
  platformsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
    marginBottom: '12px',
  },
  platformChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '14px',
    padding: '4px 10px',
    borderRadius: RADIUS.pill,
    background: COLORS.lightGrayBg,
    cursor: 'pointer',
  },
  muted: { color: COLORS.mutedText, fontSize: '13px' },
  opList: {
    margin: '6px 0 12px',
    paddingLeft: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  opBlock: {
    listStyle: 'none',
    padding: '10px 12px',
    borderRadius: RADIUS.sm,
    background: COLORS.lightGrayBg,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  opItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '10px',
    fontSize: '14px',
  },
  matRow: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' },
  matLabel: { fontSize: '12px', fontWeight: 600, color: COLORS.mutedText },
  matChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    padding: '3px 8px',
    borderRadius: RADIUS.pill,
    background: COLORS.white,
    border: `1px solid ${COLORS.lightGreenBg}`,
  },
  chipX: { border: 'none', background: 'none', color: COLORS.error, cursor: 'pointer', fontSize: '15px', lineHeight: 1 },
  matForm: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  matInput: {
    padding: '7px 10px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.white,
    fontSize: '13px',
  },
  smallBtn: {
    padding: '7px 12px',
    borderRadius: RADIUS.sm,
    border: 'none',
    background: COLORS.accentDark,
    color: COLORS.white,
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  opForm: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' },
  link: {
    border: 'none',
    background: 'none',
    color: COLORS.accentDark,
    cursor: 'pointer',
    fontSize: '13px',
  },
  linkDanger: {
    border: 'none',
    background: 'none',
    color: COLORS.error,
    cursor: 'pointer',
    fontSize: '13px',
  },
};
