import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api, ApiError, type Site } from '../../api/client';
import { AdminLayout } from './AdminLayout';
import { RowActions } from '../../components/RowActions';
import { useToast } from '../../components/ToastProvider';
import { useConfirm } from '../../components/ConfirmProvider';
import { SkeletonTable } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { useTableControls, SearchInput, SortHeader } from '../../components/TableControls';
import { Table, Th, Td, Button, LinkButton, Input, CreateBlock } from '../../components/ui';

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

  const controls = useTableControls(sites, {
    searchText: (s) => s.name,
    sortAccessors: { name: (s) => s.name },
    defaultSortKey: 'name',
    storageKey: 'admin-sites',
  });

  return (
    <AdminLayout title="Участки" breadcrumb="Администрирование">
      <CreateBlock label="+ Участок">
        <form onSubmit={handleCreate} style={styles.createForm}>
          <Input style={{ flex: 1 }}
            placeholder="Название участка (например «Сварка»)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Button type="submit" disabled={creating || !newName.trim()}>
            Добавить
          </Button>
        </form>
      </CreateBlock>

      {!loading && sites.length > 0 && (
        <div style={styles.toolbar}>
          <SearchInput value={controls.query} onChange={controls.setQuery} placeholder="Поиск участка..." />
        </div>
      )}

      {loading ? (
        <SkeletonTable rows={4} cols={2} />
      ) : sites.length === 0 ? (
        <EmptyState icon="building" title="Участков пока нет" hint="Добавьте первый участок кнопкой «+ Участок»." />
      ) : controls.result.length === 0 ? (
        <EmptyState icon="search" title="Ничего не найдено" hint="Измените поисковый запрос." />
      ) : (
        <Table>
          <thead>
            <tr>
              <SortHeader label="Название" sortKey="name" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {controls.result.map((site) => (
              <tr key={site.id}>
                <Td>
                  {editingId === site.id ? (
                    <Input style={{ flex: 1 }}
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      autoFocus
                    />
                  ) : (
                    site.name
                  )}
                </Td>
                <Td align="right">
                  {editingId === site.id ? (
                    <>
                      <LinkButton onClick={() => saveEdit(site.id)}>
                        Сохранить
                      </LinkButton>
                      <LinkButton onClick={() => setEditingId(null)}>
                        Отмена
                      </LinkButton>
                    </>
                  ) : (
                    <>
                      <RowActions
                        primary={{ label: 'Переименовать', onClick: () => startEdit(site) }}
                        actions={[{ label: 'Удалить', onClick: () => handleDelete(site), danger: true }]}
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
  createForm: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
  },
  toolbar: {
    marginBottom: '16px',
  },
};
