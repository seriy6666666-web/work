import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api, ApiError, type OperationType, type Skill } from '../../api/client';
import { PlannerLayout } from './PlannerLayout';
import { RowActions } from '../../components/RowActions';
import { Badge } from '../../components/Badge';
import { Select } from '../../components/Select';
import { useToast } from '../../components/ToastProvider';
import { useConfirm } from '../../components/ConfirmProvider';
import { SkeletonTable } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { useTableControls, SearchInput, SortSelect, type SortChoice } from '../../components/TableControls';
import { COLORS, RADIUS } from '../../theme';
import { Button, LinkButton, Input } from '../../components/ui';
import { ListCard } from '../../components/ListCard';

/** Значение «навык не требуется» в выпадающем списке. Пустая строка = не выбрано. */
const NO_SKILL = 'none';

/** Порядок в справочнике операций. Выбор запоминается. */
const SORT_CHOICES: SortChoice[] = [
  { key: 'name', dir: 'asc', label: 'по алфавиту' },
  { key: 'usage', dir: 'desc', label: 'сначала используемые' },
  { key: 'norm', dir: 'asc', label: 'сначала без нормы' },
  { key: 'skill', dir: 'asc', label: 'по навыку' },
];

export function OperationTypesPage() {
  const { token } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState<OperationType[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState('');
  const [newNorm, setNewNorm] = useState('');
  const [newSkillId, setNewSkillId] = useState(NO_SKILL);
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingNorm, setEditingNorm] = useState('');
  const [editingSkillId, setEditingSkillId] = useState(NO_SKILL);

  async function refresh() {
    if (!token) return;
    setLoading(true);
    try {
      const [list, skillList] = await Promise.all([
        api.listOperationTypes(token, showArchived),
        api.listSkills(token),
      ]);
      setItems(list);
      setSkills(skillList);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось загрузить операции');
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
      await api.createOperationType(token, {
        name: newName.trim(),
        norm: newNorm.trim() ? Number(newNorm) : undefined,
        skillId: newSkillId === NO_SKILL ? undefined : newSkillId,
      });
      setNewName('');
      setNewNorm('');
      setNewSkillId(NO_SKILL);
      toast.success('Операция добавлена');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось добавить операцию');
    } finally {
      setCreating(false);
    }
  }

  function startEdit(item: OperationType) {
    setEditingId(item.id);
    setEditingName(item.name);
    setEditingNorm(item.norm === null ? '' : String(item.norm));
    setEditingSkillId(item.skillId ?? NO_SKILL);
  }

  async function saveEdit(id: string) {
    if (!token || !editingName.trim()) return;
    try {
      await api.updateOperationType(token, id, {
        name: editingName.trim(),
        norm: editingNorm.trim() ? Number(editingNorm) : null,
        skillId: editingSkillId === NO_SKILL ? null : editingSkillId,
      });
      setEditingId(null);
      toast.success('Сохранено');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось сохранить операцию');
    }
  }

  async function handleArchive(item: OperationType) {
    if (!token) return;
    const ok = await confirm({
      title: 'В архив',
      message:
        `Убрать «${item.name}» из выбора? Операция останется в заказах и отчётах, ` +
        'но при сборке новых техкарт предлагаться не будет.',
      confirmLabel: 'В архив',
    });
    if (!ok) return;
    try {
      await api.archiveOperationType(token, item.id);
      toast.success('Операция в архиве');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось отправить в архив');
    }
  }

  async function handleRestore(item: OperationType) {
    if (!token) return;
    try {
      await api.restoreOperationType(token, item.id);
      toast.success('Операция вернулась в работу');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось вернуть операцию');
    }
  }

  async function handleDelete(item: OperationType) {
    if (!token) return;
    const ok = await confirm({
      title: 'Удаление операции',
      message: `Удалить «${item.name}» полностью?`,
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteOperationType(token, item.id);
      toast.success('Операция удалена');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось удалить операцию');
    }
  }

  const controls = useTableControls(items, {
    searchText: (o) => `${o.name} ${o.skill?.name ?? ''}`,
    sortAccessors: {
      name: (o) => o.name,
      // «Навык не требуется» — это не пустое значение, а осознанный выбор, но
      // сортировать его не по чему: ставим в конец.
      skill: (o) => o.skill?.name ?? null,
      norm: (o) => o.norm,
      usage: (o) => (o.usedInOrders ?? 0) + (o.usedInProducts ?? 0),
    },
    defaultSortKey: 'name',
    storageKey: 'planner-operation-types',
  });

  const skillOptions = [
    { value: NO_SKILL, label: 'Навык не требуется' },
    ...skills.map((s) => ({ value: s.id, label: s.name })),
  ];

  return (
    <PlannerLayout title="Операции" breadcrumb="Планирование">
      <p style={styles.hint}>
        Операция — это что делают на производстве: «Пайка шин», «Сортировка ячеек»,
        «Установка ячеек в холдер». Навык — что человек умеет, и нужен он не всегда:
        часть операций умеют все, для них оставьте «навык не требуется».
        Норма выработки задаётся здесь же, у операции: у одного навыка разные операции
        идут с разной скоростью.
      </p>

      <form onSubmit={handleCreate} style={styles.createForm}>
        <Input style={{ flex: 1, minWidth: '220px' }}
          placeholder="Название операции (например «Пайка шин»)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <div style={styles.skillPicker}>
          <Select value={newSkillId} onChange={setNewSkillId} options={skillOptions} />
        </div>
        <input
          style={styles.normInput}
          type="number"
          min="1"
          placeholder="Норма/смена"
          value={newNorm}
          onChange={(e) => setNewNorm(e.target.value)}
        />
        <Button type="submit" disabled={creating || !newName.trim()}>
          Добавить
        </Button>
      </form>

      {!loading && (
        <div style={styles.toolbar}>
          <SearchInput
            value={controls.query}
            onChange={controls.setQuery}
            placeholder="Поиск операции..."
          />
          <SortSelect
            choices={SORT_CHOICES}
            sortKey={controls.sortKey}
            dir={controls.sortDir}
            onSelect={controls.setSort}
          />
          <label style={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Показывать архивные
          </label>
        </div>
      )}

      {loading ? (
        <SkeletonTable rows={5} cols={4} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="list"
          title="Операций пока нет"
          hint="Добавьте первую операцию в форме выше или загрузите их из файла норм."
        />
      ) : controls.result.length === 0 ? (
        <EmptyState icon="search" title="Ничего не найдено" hint="Измените поисковый запрос." />
      ) : (
        <div style={styles.list}>
          {controls.result.map((item) => {
            const editing = editingId === item.id;
            const used = (item.usedInOrders ?? 0) + (item.usedInProducts ?? 0);
            return (
              <ListCard
                key={item.id}
                accent={item.archivedAt ? 'var(--line)' : undefined}
                title={
                  editing ? (
                    <Input
                      style={{ width: '100%', minWidth: '240px' }}
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      autoFocus
                    />
                  ) : (
                    item.name
                  )
                }
                badge={item.archivedAt ? <Badge variant="muted">в архиве</Badge> : undefined}
                subtitle={
                  editing ? (
                    <div style={styles.editRow}>
                      <Select value={editingSkillId} onChange={setEditingSkillId} options={skillOptions} />
                      <Input
                        style={{ maxWidth: '120px' }}
                        type="number"
                        min="1"
                        placeholder="норма"
                        value={editingNorm}
                        onChange={(e) => setEditingNorm(e.target.value)}
                      />
                    </div>
                  ) : (
                    <>
                      {item.skill ? `навык: ${item.skill.name}` : 'особый навык не требуется'}
                      {' · '}
                      {used === 0
                        ? 'нигде не используется'
                        : `заказов: ${item.usedInOrders ?? 0} · изделий: ${item.usedInProducts ?? 0}`}
                    </>
                  )
                }
                stats={
                  editing
                    ? []
                    : [
                        {
                          label: 'норма/смена',
                          // Прочерк с подписью, а не пустое место: норма не
                          // заполнена ни у одной операции, и это надо видеть.
                          value: item.norm === null ? '—' : item.norm,
                          muted: item.norm === null,
                        },
                      ]
                }
                actions={
                  editing ? (
                    <>
                      <LinkButton onClick={() => saveEdit(item.id)}>Сохранить</LinkButton>
                      <LinkButton onClick={() => setEditingId(null)}>Отмена</LinkButton>
                    </>
                  ) : item.archivedAt ? (
                    <RowActions
                      primary={{ label: 'Вернуть', onClick: () => handleRestore(item) }}
                      actions={
                        used === 0 ? [{ label: 'Удалить', onClick: () => handleDelete(item), danger: true }] : []
                      }
                    />
                  ) : (
                    <RowActions
                      primary={{ label: 'Изменить', onClick: () => startEdit(item) }}
                      actions={[
                        { label: 'В архив', onClick: () => handleArchive(item) },
                        ...(used === 0
                          ? [{ label: 'Удалить', onClick: () => handleDelete(item), danger: true }]
                          : []),
                      ]}
                    />
                  )
                }
              />
            );
          })}
        </div>
      )}
    </PlannerLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  editRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginTop: '6px',
  },
  hint: {
    margin: '0 0 16px',
    fontSize: '14px',
    lineHeight: 1.6,
    color: COLORS.mutedText,
  },
  createForm: {
    display: 'flex',
    gap: '8px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  skillPicker: {
    minWidth: '200px',
  },
  normInput: {
    width: '130px',
    padding: '10px 12px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.lightGrayBg,
    fontSize: '15px',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '12px',
    flexWrap: 'wrap',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '14px',
    color: COLORS.mutedText,
    cursor: 'pointer',
  },
  archivedRow: {
    opacity: 0.6,
  },
  muted: {
    color: COLORS.mutedText,
  },
};
