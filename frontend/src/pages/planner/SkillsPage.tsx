import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api, ApiError, type Skill } from '../../api/client';
import { PlannerLayout } from './PlannerLayout';
import { RowActions } from '../../components/RowActions';
import { useToast } from '../../components/ToastProvider';
import { useConfirm } from '../../components/ConfirmProvider';
import { SkeletonTable } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { useTableControls, SearchInput, SortHeader } from '../../components/TableControls';
import { COLORS, RADIUS } from '../../theme';

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
        <input
          style={styles.input}
          placeholder="Название навыка (например «Пайка»)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button style={styles.button} type="submit" disabled={creating || !newName.trim()}>
          Добавить
        </button>
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
        <table style={styles.table}>
          <thead>
            <tr>
              <SortHeader label="Название" sortKey="name" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
              <th style={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {controls.result.map((skill) => (
              <tr key={skill.id}>
                <td style={styles.td}>
                  {editingId === skill.id ? (
                    <input
                      style={styles.input}
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      autoFocus
                    />
                  ) : (
                    skill.name
                  )}
                </td>
                <td style={{ ...styles.td, textAlign: 'right' }}>
                  {editingId === skill.id ? (
                    <>
                      <button style={styles.linkButton} onClick={() => saveEdit(skill.id)}>
                        Сохранить
                      </button>
                      <button style={styles.linkButton} onClick={() => setEditingId(null)}>
                        Отмена
                      </button>
                    </>
                  ) : (
                    <>
                      <RowActions
                        primary={{ label: 'Переименовать', onClick: () => startEdit(skill) }}
                        actions={[{ label: 'Удалить', onClick: () => handleDelete(skill), danger: true }]}
                      />
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PlannerLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  hint: {
    color: COLORS.mutedText,
    fontSize: '14px',
    marginTop: 0,
    marginBottom: '16px',
  },
  muted: {
    color: COLORS.mutedText,
  },
  normInput: {
    width: '130px',
    padding: '10px 12px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.lightGrayBg,
    fontSize: '15px',
  },
  createForm: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
  },
  toolbar: {
    marginBottom: '16px',
  },
  input: {
    flex: 1,
    padding: '10px 12px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.lightGrayBg,
    fontSize: '15px',
  },
  button: {
    padding: '10px 20px',
    borderRadius: RADIUS.sm,
    border: 'none',
    background: COLORS.accent,
    color: COLORS.white,
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '10px 8px',
    borderBottom: `2px solid ${COLORS.lightGreenBg}`,
    color: COLORS.mutedText,
    fontSize: '13px',
  },
  td: {
    padding: '10px 8px',
    borderBottom: `1px solid ${COLORS.lightGreenBg}`,
  },
  linkButton: {
    border: 'none',
    background: 'none',
    color: COLORS.accentDark,
    cursor: 'pointer',
    fontSize: '14px',
    marginLeft: '12px',
  },
  linkButtonDanger: {
    border: 'none',
    background: 'none',
    color: COLORS.error,
    cursor: 'pointer',
    fontSize: '14px',
    marginLeft: '12px',
  },
};
