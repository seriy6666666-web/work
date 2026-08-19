import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api, ApiError, type Platform } from '../../api/client';
import { AdminLayout } from './AdminLayout';
import { RowActions } from '../../components/RowActions';
import { useToast } from '../../components/ToastProvider';
import { useConfirm } from '../../components/ConfirmProvider';
import { SkeletonTable } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { useTableControls, SearchInput, SortHeader } from '../../components/TableControls';
import { COLORS } from '../../theme';
import { Table, Th, Td, Button, LinkButton, Input, CreateBlock } from '../../components/ui';

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

  const controls = useTableControls(platforms, {
    searchText: (p) => `${p.name} ${p.address ?? ''}`,
    sortAccessors: {
      name: (p) => p.name,
      // Площадки без адреса уходят в конец: сравнивать там нечего.
      address: (p) => p.address ?? null,
    },
    defaultSortKey: 'name',
    storageKey: 'admin-platforms',
  });

  return (
    <AdminLayout title="Площадки" breadcrumb="Администрирование">
      <p style={styles.hint}>
        Производственные площадки — адреса/филиалы. Планировщик привязывает их к проектам, а склад
        материалов делится по площадкам.
      </p>

      <CreateBlock label="+ Площадка">
        <form onSubmit={handleCreate} style={styles.createForm}>
          <Input style={{ flex: 1, minWidth: '180px' }}
            placeholder="Название (например «Площадка Минск»)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Input style={{ flex: 1, minWidth: '180px' }}
            placeholder="Адрес (необязательно)"
            value={newAddress}
            onChange={(e) => setNewAddress(e.target.value)}
          />
          <Button type="submit" disabled={creating || !newName.trim()}>
            Добавить
          </Button>
        </form>
      </CreateBlock>

      {!loading && platforms.length > 0 && (
        <div style={styles.toolbar}>
          <SearchInput value={controls.query} onChange={controls.setQuery} placeholder="Поиск площадки..." />
        </div>
      )}

      {loading ? (
        <SkeletonTable rows={3} cols={3} />
      ) : platforms.length === 0 ? (
        <EmptyState icon="building" title="Площадок пока нет" hint="Добавьте первую площадку кнопкой «+ Площадка»." />
      ) : controls.result.length === 0 ? (
        <EmptyState icon="search" title="Ничего не найдено" hint="Измените поисковый запрос." />
      ) : (
        <Table>
          <thead>
            <tr>
              <SortHeader label="Название" sortKey="name" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
              <SortHeader label="Адрес" sortKey="address" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {controls.result.map((p) => (
              <tr key={p.id}>
                <Td>
                  {editingId === p.id ? (
                    <Input style={{ flex: 1, minWidth: '180px' }}
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      autoFocus
                    />
                  ) : (
                    p.name
                  )}
                </Td>
                <Td>
                  {editingId === p.id ? (
                    <Input style={{ flex: 1, minWidth: '180px' }}
                      value={editingAddress}
                      onChange={(e) => setEditingAddress(e.target.value)}
                      placeholder="Адрес"
                    />
                  ) : (
                    p.address || <span style={styles.muted}>—</span>
                  )}
                </Td>
                <Td align="right">
                  {editingId === p.id ? (
                    <>
                      <LinkButton onClick={() => saveEdit(p.id)}>
                        Сохранить
                      </LinkButton>
                      <LinkButton onClick={() => setEditingId(null)}>
                        Отмена
                      </LinkButton>
                    </>
                  ) : (
                    <>
                      <RowActions
                        primary={{ label: 'Изменить', onClick: () => startEdit(p) }}
                        actions={[{ label: 'Удалить', onClick: () => handleDelete(p), danger: true }]}
                      />
                    </>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </AdminLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  hint: { color: COLORS.mutedText, fontSize: '14px', marginTop: 0, marginBottom: '16px' },
  muted: { color: COLORS.mutedText },
  createForm: { display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' },
  toolbar: { marginBottom: '16px' },
};
