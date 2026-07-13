import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api, ApiError, type Site } from '../../api/client';
import { AdminLayout } from './AdminLayout';
import { useToast } from '../../components/ToastProvider';
import { useConfirm } from '../../components/ConfirmProvider';
import { SkeletonTable } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { useTableControls, SearchInput } from '../../components/TableControls';
import { COLORS, RADIUS } from '../../theme';

export function SitesPage() {
  const { token } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  async function refresh() {
    if (!token) return;
    setLoading(true);
    try {
      setSites(await api.listSites(token));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось загрузить участки');
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
      await api.createSite(token, { name: newName.trim() });
      setNewName('');
      toast.success('Участок создан');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось создать участок');
    } finally {
      setCreating(false);
    }
  }

  function startEdit(site: Site) {
    setEditingId(site.id);
    setEditingName(site.name);
  }

  async function saveEdit(id: string) {
    if (!token || !editingName.trim()) return;
    try {
      await api.updateSite(token, id, { name: editingName.trim() });
      setEditingId(null);
      toast.success('Сохранено');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось переименовать участок');
    }
  }

  async function handleDelete(site: Site) {
    if (!token) return;
    const ok = await confirm({
      title: 'Удаление участка',
      message: `Удалить участок «${site.name}»?`,
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteSite(token, site.id);
      toast.success('Участок удалён');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось удалить участок');
    }
  }

  const controls = useTableControls(sites, { searchText: (s) => s.name });

  return (
    <AdminLayout title="Участки" breadcrumb="Администрирование">
      <form onSubmit={handleCreate} style={styles.createForm}>
        <input
          style={styles.input}
          placeholder="Название участка (например «Сварка»)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <button style={styles.button} type="submit" disabled={creating || !newName.trim()}>
          Добавить
        </button>
      </form>

      {!loading && sites.length > 0 && (
        <div style={styles.toolbar}>
          <SearchInput value={controls.query} onChange={controls.setQuery} placeholder="Поиск участка..." />
        </div>
      )}

      {loading ? (
        <SkeletonTable rows={4} cols={2} />
      ) : sites.length === 0 ? (
        <EmptyState icon="building" title="Участков пока нет" hint="Добавьте первый участок в форме выше." />
      ) : controls.result.length === 0 ? (
        <EmptyState icon="search" title="Ничего не найдено" hint="Измените поисковый запрос." />
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Название</th>
              <th style={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {controls.result.map((site) => (
              <tr key={site.id}>
                <td style={styles.td}>
                  {editingId === site.id ? (
                    <input
                      style={styles.input}
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      autoFocus
                    />
                  ) : (
                    site.name
                  )}
                </td>
                <td style={{ ...styles.td, textAlign: 'right' }}>
                  {editingId === site.id ? (
                    <>
                      <button style={styles.linkButton} onClick={() => saveEdit(site.id)}>
                        Сохранить
                      </button>
                      <button style={styles.linkButton} onClick={() => setEditingId(null)}>
                        Отмена
                      </button>
                    </>
                  ) : (
                    <>
                      <button style={styles.linkButton} onClick={() => startEdit(site)}>
                        Переименовать
                      </button>
                      <button style={styles.linkButtonDanger} onClick={() => handleDelete(site)}>
                        Удалить
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AdminLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
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
