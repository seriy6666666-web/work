import { useEffect, useRef, useState, type FormEvent } from 'react';
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
import { useTableControls, SortSelect, SearchInput, type SortChoice } from '../../components/TableControls';
import { EmptyState } from '../../components/EmptyState';
import { Select } from '../../components/Select';
import { Button, Input, LinkButton, Hint, Muted, ToggleCreateButton } from '../../components/ui';

interface OpForm {
  operationTypeId: string;
  siteId: string;
  secondarySiteId: string;
}

const EMPTY_OP: OpForm = { operationTypeId: '', siteId: '', secondarySiteId: '' };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU');
}

/**
 * Порядок проектов. Алфавит — чтобы найти знакомое название, дата — чтобы
 * увидеть, что заводили последним: планировщик работает и так, и так.
 */
const SORT_CHOICES: SortChoice[] = [
  { key: 'name', dir: 'asc', label: 'по алфавиту' },
  { key: 'name', dir: 'desc', label: 'по алфавиту, наоборот' },
  { key: 'created', dir: 'desc', label: 'сначала новые' },
  { key: 'created', dir: 'asc', label: 'сначала старые' },
  { key: 'operations', dir: 'desc', label: 'больше операций сверху' },
];

/** Фильтры над списком — как в макете, со счётчиками. */
const FILTERS: { key: 'all' | 'filled' | 'empty'; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'filled', label: 'С техкартой' },
  { key: 'empty', label: 'Пустые' },
];

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
  /** Открытый проект. Раскрытие внутри списка заменено отдельным видом: у верхних
   * проектов техкарта на пятнадцать операций отодвигала все остальные вниз. */
  const [openId, setOpenId] = useState<string | null>(null);
  const listScrollRef = useRef(0);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const [createOpen, setCreateOpen] = useState(false);

  const controls = useTableControls(products, {
    searchText: (p) => `${p.name} ${p.operations.map((o) => o.operationType.name).join(' ')}`,
    sortAccessors: {
      name: (p) => p.name,
      created: (p) => p.createdAt,
      operations: (p) => p.operations.length,
    },
    defaultSortKey: 'name',
    storageKey: 'planner-products',
  });

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

  const openProduct = openId ? (products.find((p) => p.id === openId) ?? null) : null;

  /**
   * Счётчики у фильтров считаем по всем проектам, а не по отфильтрованным: иначе
   * «Риск 2» пропадал бы, стоило выбрать другой фильтр, и понять, есть ли вообще
   * риск, было бы нельзя.
   */
  const counts = {
    all: controls.result.length,
    filled: products.filter((p) => p.operations.length > 0).length,
    empty: products.filter((p) => p.operations.length === 0).length,
  };
  const visible = controls.result.filter((p) => {
    if (filter === 'all') return true;
    if (filter === 'filled') return p.operations.length > 0;
    return p.operations.length === 0;
  });

  function openProject(id: string) {
    // Возврат должен вернуть список туда, где его оставили: планировщик идёт
    // сверху вниз, и прокрутка к началу заставляла бы искать место заново.
    listScrollRef.current = window.scrollY;
    setOpenId(id);
    window.scrollTo({ top: 0 });
  }

  function closeProject() {
    setOpenId(null);
    requestAnimationFrame(() => window.scrollTo({ top: listScrollRef.current }));
  }

  /**
   * Плитка проекта.
   *
   * Проект — шаблон: техкарта, из которой собирают заказ. Ни количества, ни
   * срока, ни выработки у него нет, поэтому здесь нет ни кольца процента, ни
   * полосы выполнения — эти числа принадлежат заказу. Показываем состав: где
   * производится, на каком участке и из скольких операций собран.
   */
  function renderTile(p: Product) {
    const archived = p.status === 'ARCHIVED';
    const site = p.operations[0]?.site.name;
    const empty = p.operations.length === 0;
    return (
      <button key={p.id} style={styles.tile} onClick={() => openProject(p.id)}>
        <div style={styles.tileTop}>
          <div style={styles.tileMain}>
            <div style={styles.tileTitle}>
              <strong style={styles.tileName}>{p.name}</strong>
              {archived ? (
                <Badge variant="muted">Архив</Badge>
              ) : empty ? (
                <Badge variant="muted">Техкарта пуста</Badge>
              ) : null}
            </div>
            <div style={styles.tileMeta}>
              {p.platforms.map((pl) => pl.name).join(', ') || 'площадка не выбрана'}
              {site ? ` · ${site}` : ''}
              {' · от '}
              {formatDate(p.createdAt)}
            </div>
          </div>
          <div style={styles.tileNumbers}>
            <div style={styles.tileDone}>{p.operations.length}</div>
            <div style={styles.tilePlan}>операций</div>
          </div>
        </div>
      </button>
    );
  }

  /** Открытый проект: техкарта во всю ширину и всё, что с ней делают. */
  function renderProject(p: Product) {
    const form = opForms[p.id] ?? EMPTY_OP;
    const archived = p.status === 'ARCHIVED';
    const platformIds = new Set(p.platforms.map((pl) => pl.id));
    return (
      <>
        <button style={styles.back} onClick={closeProject}>
          ← Все проекты
        </button>

        <div style={styles.projectHead}>
          <div style={styles.titleRow}>
            <div>
              <div style={styles.tileTitle}>
                <strong style={styles.projectName}>{p.name}</strong>
                {archived && <Badge variant="muted">Архив</Badge>}
              </div>
              <div style={styles.tileMeta}>
                {p.operations.length} операций · от {formatDate(p.createdAt)}
              </div>
            </div>
          </div>
          <div style={styles.headerActions}>
            <LinkButton onClick={() => handleArchive(p)}>
              {archived ? 'Восстановить' : 'В архив'}
            </LinkButton>
            <LinkButton danger onClick={() => handleDeleteProduct(p)}>
              Удалить
            </LinkButton>
          </div>
        </div>

        <div style={styles.platformsRow}>
          <span style={styles.blockLabel}>Площадки:</span>
          {platforms.length === 0 ? (
            <Muted>
              нет площадок — <Link to="/admin/platforms">добавьте в администрировании</Link>
            </Muted>
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

        <span style={styles.blockLabel}>Технологическая карта</span>
        {p.operations.length === 0 ? (
          <EmptyState
            icon="box"
            title="Техкарта не заполнена"
            hint="Пока в ней нет операций, проект нельзя отдать в распределение."
          />
        ) : (
          <ol style={styles.opList}>
            {p.operations.map((op, i) => {
              const mf = opMatForms[op.id] ?? { materialId: '', qty: '' };
              return (
                <li key={op.id} style={styles.opBlock}>
                  <div style={styles.opItem}>
                    <span style={styles.opNum}>{i + 1}</span>
                    <span style={styles.opName}>
                      {op.operationType.name}
                      <span style={styles.opSkill}>
                        {' · '}
                        {op.site.name}
                        {op.operationType.skill
                          ? ` · навык: ${op.operationType.skill.name}`
                          : ' · особый навык не требуется'}
                      </span>
                      {op.secondarySite && (
                        <>
                          {' '}
                          <Badge variant="shared">+ {op.secondarySite.name}</Badge>
                        </>
                      )}
                    </span>
                    <LinkButton danger onClick={() => handleDeleteOp(op.id)}>
                      Удалить
                    </LinkButton>
                  </div>
                  <div style={styles.matRow}>
                    <span style={styles.matLabel}>Материалы/шт:</span>
                    {op.materials.length === 0 && <Muted>не заданы</Muted>}
                    {op.materials.map((m) => (
                      <span key={m.id} style={styles.matChip}>
                        {m.material.name} — {m.quantityPerUnit} {m.material.unit}
                        <button
                          style={styles.chipX}
                          onClick={() => handleRemoveOpMaterial(m.id)}
                          title="Убрать"
                        >
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
                      options={materials.map((mat) => ({ value: mat.id, label: mat.name, hint: mat.unit }))}
                    />
                    <Input
                      style={{ maxWidth: '110px' }}
                      type="number"
                      step="any"
                      min="0"
                      placeholder="на 1 шт"
                      value={mf.qty}
                      onChange={(e) =>
                        setOpMatForms((prev) => ({ ...prev, [op.id]: { ...mf, qty: e.target.value } }))
                      }
                    />
                    <Button variant="ghost" onClick={() => handleAddOpMaterial(op.id)}>
                      + расход
                    </Button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <form onSubmit={(e) => handleAddOp(e, p.id)} style={styles.opForm}>
          <Select
            width="220px"
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
            width="180px"
            ariaLabel="Участок"
            placeholder="Участок"
            value={form.siteId}
            onChange={(siteId) => setOpForms((prev) => ({ ...prev, [p.id]: { ...form, siteId } }))}
            options={sites.map((s) => ({ value: s.id, label: s.name }))}
          />
          <Select
            width="210px"
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
              ...sites.filter((s) => s.id !== form.siteId).map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
          <Button type="submit">+ Операция</Button>
        </form>
      </>
    );
  }

  return (
    <PlannerLayout title="Проекты" breadcrumb="Планирование">
      {openProduct ? (
        renderProject(openProduct)
      ) : (
        <>
          <Hint>
            Проект — готовый шаблон изделия с техкартой (операции по участкам). При создании заказа
            «из проекта» операции подставляются автоматически. Площадки — где проект производится.
          </Hint>

          <div style={styles.toolbar}>
            <SearchInput
              value={controls.query}
              onChange={controls.setQuery}
              placeholder="Проект, операция"
            />
            <div style={styles.filters}>
              {/*
                Фильтры по составу, а не по ходу работ: у шаблона хода работ нет.
              */}
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
            <div style={styles.toolbarRight}>
              <SortSelect
                choices={SORT_CHOICES}
                sortKey={controls.sortKey}
                dir={controls.sortDir}
                onSelect={controls.setSort}
              />
              <ToggleCreateButton
                open={createOpen}
                label="+ Проект"
                onClick={() => setCreateOpen((v) => !v)}
              />
            </div>
          </div>

          {createOpen && (
            <form onSubmit={handleCreate} style={styles.createForm}>
              <Input
                style={{ flex: 1, minWidth: '240px' }}
                placeholder="Название проекта (например «АКБ 24В 100Ач»)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
              <Button type="submit" disabled={creating || !newName.trim()}>
                Добавить
              </Button>
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                Отмена
              </Button>
            </form>
          )}

          <label style={styles.archivedToggle}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Показывать архивные
          </label>

          {operationTypes.length === 0 && (
            <Hint>
              Справочник операций пуст. <Link to="/planner/operations">Заведите операции</Link>, чтобы
              собирать из них техкарту изделия.
            </Hint>
          )}

          {loading ? (
            <SkeletonCards count={4} />
          ) : products.length === 0 ? (
            <EmptyState
              icon="box"
              title="Проектов пока нет"
              hint="Добавьте первый проект кнопкой «+ Проект»."
            />
          ) : visible.length === 0 ? (
            <EmptyState icon="search" title="Ничего не найдено" hint="Измените поиск или фильтр." />
          ) : (
            <div style={styles.tiles}>{visible.map((p) => renderTile(p))}</div>
          )}
        </>
      )}
    </PlannerLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  /* --- Панель над списком --- */
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flexWrap: 'wrap',
    marginBottom: '14px',
  },
  toolbarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginLeft: 'auto',
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
  filterCount: {
    color: 'var(--tx3)',
    fontSize: '13px',
  },
  createForm: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    marginBottom: '14px',
  },
  archivedToggle: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
    color: 'var(--tx2)',
    marginBottom: '18px',
  },

  /* --- Плитки --- */
  tiles: {
    display: 'grid',
    // Две колонки на компьютере и планшете, одна на телефоне — порог задан
    // самой сеткой, поэтому поворот не меняет вид скачком.
    gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))',
    gap: '14px',
  },
  tile: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '16px 18px',
    borderRadius: '14px',
    border: '1px solid var(--line)',
    background: 'var(--surf)',
    boxShadow: 'var(--sh1)',
    cursor: 'pointer',
    font: 'inherit',
    color: 'var(--tx)',
  },
  tileTop: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '14px',
  },
  tileMain: {
    flex: 1,
    minWidth: 0,
  },
  tileTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
  },
  tileName: {
    fontSize: '19px',
    fontWeight: 600,
  },
  projectName: {
    fontSize: '21px',
    fontWeight: 600,
  },
  tileMeta: {
    marginTop: '4px',
    color: 'var(--tx2)',
    fontSize: '13px',
  },
  tileDue: {
    marginTop: '4px',
    color: 'var(--tx2)',
    fontSize: '13px',
  },
  tileDueRisk: {
    color: 'var(--err)',
    fontWeight: 600,
  },
  tileNumbers: {
    textAlign: 'right',
    whiteSpace: 'nowrap',
  },
  tileDone: {
    fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
    fontSize: '24px',
    fontWeight: 600,
    // Числа в столбце не должны «плясать» от разной ширины цифр.
    fontVariantNumeric: 'tabular-nums',
  },
  tilePlan: {
    color: 'var(--tx3)',
    fontSize: '12px',
    fontVariantNumeric: 'tabular-nums',
  },
  tileCounters: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    flexWrap: 'wrap',
    margin: '12px 0 8px',
    fontSize: '13px',
    color: 'var(--tx2)',
  },
  counter: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  },
  counterMuted: {
    color: 'var(--tx3)',
    marginLeft: 'auto',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '999px',
    display: 'inline-block',
  },
  segments: {
    display: 'flex',
    gap: '2px',
  },
  segment: {
    flex: 1,
    height: '8px',
    borderRadius: '999px',
  },

  /* --- Открытый проект --- */
  back: {
    border: 'none',
    background: 'none',
    color: 'var(--accd)',
    cursor: 'pointer',
    fontSize: '14px',
    padding: '4px 0',
    marginBottom: '10px',
  },
  projectHead: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap',
    marginBottom: '16px',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
  },
  headerActions: {
    display: 'flex',
    gap: '4px',
  },
  blockLabel: {
    display: 'block',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
    color: 'var(--tx3)',
    margin: '18px 0 8px',
  },
  platformsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flexWrap: 'wrap',
  },
  platformChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 12px',
    borderRadius: '999px',
    border: '1px solid var(--line)',
    background: 'var(--surf)',
    fontSize: '13px',
    cursor: 'pointer',
  },
  opList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  opBlock: {
    padding: '12px 14px',
    borderRadius: '12px',
    border: '1px solid var(--line2)',
    background: 'var(--surf2)',
  },
  opItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
  },
  opNum: {
    fontFamily: "'IBM Plex Mono', ui-monospace, monospace",
    color: 'var(--tx3)',
    fontSize: '13px',
    minWidth: '20px',
  },
  opName: {
    flex: 1,
    fontSize: '14px',
    lineHeight: 1.4,
  },
  opSkill: {
    color: 'var(--tx3)',
    fontSize: '13px',
  },
  matRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexWrap: 'wrap',
    margin: '8px 0 6px 30px',
    fontSize: '13px',
  },
  matLabel: {
    color: 'var(--tx3)',
    fontSize: '12px',
  },
  matChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 8px',
    borderRadius: '999px',
    background: 'var(--accsoft)',
    fontSize: '12px',
  },
  chipX: {
    border: 'none',
    background: 'none',
    color: 'var(--tx3)',
    cursor: 'pointer',
    fontSize: '14px',
    lineHeight: 1,
    padding: 0,
  },
  matForm: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginLeft: '30px',
  },
  opForm: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: '14px',
  },
};
