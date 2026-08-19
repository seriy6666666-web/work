import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api, ApiError, type Skill } from '../../api/client';
import { PlannerLayout } from './PlannerLayout';
import { RowActions } from '../../components/RowActions';
import { useToast } from '../../components/ToastProvider';
import { useConfirm } from '../../components/ConfirmProvider';
import { SkeletonTable } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { useTableControls, SearchInput } from '../../components/TableControls';
import { COLORS } from '../../theme';
import { Button, LinkButton, Input } from '../../components/ui';
import { ListCard } from '../../components/ListCard';

export function SkillsPage() {
  const { token } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  async function refresh() {
    if (!token) return;
    setLoading(true);
    try {
      setSkills(await api.listSkills(token));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось загрузить навыки');
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
      await api.createSkill(token, { name: newName.trim() });
      setNewName('');
      toast.success('Навык создан');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось создать навык');
    } finally {
      setCreating(false);
    }
  }

  function startEdit(skill: Skill) {
    setEditingId(skill.id);
    setEditingName(skill.name);
  }

  async function saveEdit(id: string) {
    if (!token || !editingName.trim()) return;
    try {
      await api.updateSkill(token, id, { name: editingName.trim() });
      setEditingId(null);
      toast.success('Сохранено');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось сохранить навык');
    }
  }

  async function handleDelete(skill: Skill) {
    if (!token) return;
    const ok = await confirm({
      title: 'Удаление навыка',
      message: `Удалить навык «${skill.name}»?`,
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteSkill(token, skill.id);
      toast.success('Навык удалён');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось удалить навык');
    }
  }

  const controls = useTableControls(skills, {
    searchText: (s) => s.name,
    sortAccessors: { name: (s) => s.name },
    defaultSortKey: 'name',
    storageKey: 'planner-skills',
  });

  return (
    <PlannerLayout title="Навыки" breadcrumb="Планирование">

      <p style={styles.hint}>
        Навык — это квалификация человека: «Пайка», «Ручная сварка», «Гравер». Он
        отвечает на вопрос «что сотрудник умеет» и отмечается в матрице компетенций.
        Что именно делают на производстве, задаётся в разделе «Операции»: там же
        живёт и норма выработки, потому что у одного навыка разные операции идут с
        разной скоростью.
      </p>

      <form onSubmit={handleCreate} style={styles.createForm}>
        <Input style={{ flex: 1 }}
          placeholder="Название навыка (например «Пайка»)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <Button type="submit" disabled={creating || !newName.trim()}>
          Добавить
        </Button>
      </form>

      {!loading && skills.length > 0 && (
        <div style={styles.toolbar}>
          <SearchInput value={controls.query} onChange={controls.setQuery} placeholder="Поиск навыка..." />
        </div>
      )}

      {loading ? (
        <SkeletonTable rows={4} cols={2} />
      ) : skills.length === 0 ? (
        <EmptyState icon="star" title="Навыков пока нет" hint="Добавьте первый навык в форме выше." />
      ) : controls.result.length === 0 ? (
        <EmptyState icon="search" title="Ничего не найдено" hint="Измените поисковый запрос." />
      ) : (
        <div style={styles.list}>
          {controls.result.map((skill) => (
            <ListCard
              key={skill.id}
              title={
                editingId === skill.id ? (
                  <Input
                    style={{ width: '100%', minWidth: '240px' }}
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    autoFocus
                  />
                ) : (
                  skill.name
                )
              }
              actions={
                editingId === skill.id ? (
                  <>
                    <LinkButton onClick={() => saveEdit(skill.id)}>Сохранить</LinkButton>
                    <LinkButton onClick={() => setEditingId(null)}>Отмена</LinkButton>
                  </>
                ) : (
                  <RowActions
                            primary={{ label: 'Переименовать', onClick: () => startEdit(skill) }}
                            actions={[{ label: 'Удалить', onClick: () => handleDelete(skill), danger: true }]}
                          />
                )
              }
            />
          ))}
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
  hint: {
    color: COLORS.mutedText,
    fontSize: '14px',
    marginTop: 0,
    marginBottom: '16px',
  },
  createForm: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
  },
  toolbar: {
    marginBottom: '16px',
  },
};
