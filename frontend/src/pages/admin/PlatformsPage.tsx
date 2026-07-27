import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api, ApiError, type Platform } from '../../api/client';
import { AdminLayout } from './AdminLayout';
import { useToast } from '../../components/ToastProvider';
import { useConfirm } from '../../components/ConfirmProvider';
import { SkeletonTable } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { useTableControls, SearchInput } from '../../components/TableControls';
import { COLORS, RADIUS } from '../../theme';

export function PlatformsPage() {
  const { token } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);

  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [editingAddress, setEditingAddress] = useState('');

  async function refresh() {
    if (!token) return;
    setLoading(true);
    try {
      setPlatforms(await api.listPlatforms(token));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось загрузить площадки');
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
      await api.createPlatform(token, { name: newName.trim(), address: newAddress.trim() || undefined });
      setNewName('');
      setNewAddress('');
      toast.success('Площадка создана');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось создать площадку');
    } finally {
      setCreating(false);
    }
  }

  function startEdit(p: Platform) {
    setEditingId(p.id);
    setEditingName(p.name);
    setEditingAddress(p.address ?? '');
  }

  async function saveEdit(id: string) {
    if (!token || !editingName.trim()) return;
    try {
      await api.updatePlatform(token, id, {
        name: editingName.trim(),
        address: editingAddress.trim() || null,
      });
      setEditingId(null);
      toast.success('Сохранено');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось сохранить площадку');
    }
  }

  async function handleDelete(p: Platform) {
    if (!token) return;
    const ok = await confirm({
      title: 'Удаление площадки',
      message: `Удалить площадку «${p.name}»?`,
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deletePlatform(token, p.id);
      toast.success('Площадка удалена');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось удалить площадку');
    }
  }

  const controls = useTableControls(platforms, { searchText: (p) => `${p.name} ${p.address ?? ''}` });

  return (
    <AdminLayout title="Площадки" breadcrumb="Администрирование">
      <p style={styles.hint}>
        Производственные площадки — адреса/филиалы. Планировщик привязывает их к проектам, а склад
        материалов делится по площадкам.
      </p>

      <form onSubmit={handleCreate} style={styles.createForm}>
        <input
          style={styles.input}
          placeholder="Название (например «Площадка Минск»)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <input
          style={styles.input}
          placeholder="Адрес (необязательно)"
          value={newAddress}
          onChange={(e) => setNewAddress(e.target.value)}
        />
        <button style={styles.button} type="submit" disabled={creating || !newName.trim()}>
          Добавить
        </button>
      </form>

      {!loading && platforms.length > 0 && (
        <div style={styles.toolbar}>
          <SearchInput value={controls.query} onChange={controls.setQuery} placeholder="Поиск площадки..." />
        </div>
      )}

      {loading ? (
        <SkeletonTable rows={3} cols={3} />
      ) : platforms.length === 0 ? (
        <EmptyState icon="building" title="Площадок пока нет" hint="Добавьте первую площадку в форме выше." />
      ) : controls.result.length === 0 ? (
        <EmptyState icon="search" title="Ничего не найдено" hint="Измените поисковый запрос." />
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Название</th>
              <th style={styles.th}>Адрес</th>
              <th style={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {controls.result.map((p) => (
              <tr key={p.id}>
                <td style={styles.td}>
                  {editingId === p.id ? (
                    <input
                      style={styles.input}
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      autoFocus
                    />
                  ) : (
                    p.name
                  )}
                </td>
                <td style={styles.td}>
                  {editingId === p.id ? (
                    <input
                      style={styles.input}
                      value={editingAddress}
                      onChange={(e) => setEditingAddress(e.target.value)}
                      placeholder="Адрес"
                    />
                  ) : (
                    p.address || <span style={styles.muted}>—</span>
                  )}
                </td>
                <td style={{ ...styles.td, textAlign: 'right' }}>
                  {editingId === p.id ? (
                    <>
                      <button style={styles.linkButton} onClick={() => saveEdit(p.id)}>
                        Сохранить
                      </button>
                      <button style={styles.linkButton} onClick={() => setEditingId(null)}>
                        Отмена
                      </button>
                    </>
                  ) : (
                    <>
                      <button style={styles.linkButton} onClick={() => startEdit(p)}>
                        Изменить
                      </button>
                      <button style={styles.linkButtonDanger} onClick={() => handleDelete(p)}>
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
  hint: { color: COLORS.mutedText, fontSize: '14px', marginTop: 0, marginBottom: '16px' },
  muted: { color: COLORS.mutedText },
  createForm: { display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' },
  toolbar: { marginBottom: '16px' },
  input: {
    flex: 1,
    minWidth: '180px',
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
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left',
    padding: '10px 8px',
    borderBottom: `2px solid ${COLORS.lightGreenBg}`,
    color: COLORS.mutedText,
    fontSize: '13px',
  },
  td: { padding: '10px 8px', borderBottom: `1px solid ${COLORS.lightGreenBg}` },
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
