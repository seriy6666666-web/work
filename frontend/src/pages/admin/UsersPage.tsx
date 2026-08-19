import { Fragment, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api, ApiError, type AdminUser, type Role, type Site } from '../../api/client';
import { ROLES, ROLE_LABELS, SITE_BOUND_ROLES } from '../../constants/roles';
import { AdminLayout } from './AdminLayout';
import { downloadCredentials, type Credential } from '../../credentials';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { useToast } from '../../components/ToastProvider';
import { useConfirm } from '../../components/ConfirmProvider';
import { SkeletonTable } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { useTableControls, SearchInput, SortHeader } from '../../components/TableControls';
import { RowActions } from '../../components/RowActions';
import { SearchSelect } from '../../components/SearchSelect';
import { Select } from '../../components/Select';
import { COLORS, RADIUS } from '../../theme';
import { Table, Th, Td, Button, LinkButton, Input, ToggleCreateButton } from '../../components/ui';

interface UserFormState {
  username: string;
  password: string;
  fullName: string;
  role: Role;
  siteId: string;
  managerId: string;
}

/** «belmy-7413»: пароль диктуют вслух и набирают на терминале в цеху. */
function makePassword(): string {
  const n = (crypto.getRandomValues(new Uint32Array(1))[0] % 9000) + 1000;
  return `belmy-${n}`;
}

const EMPTY_FORM: UserFormState = {
  username: '',
  password: '',
  fullName: '',
  role: 'WORKER',
  siteId: '',
  managerId: '',
};

export function UsersPage() {
  const { token } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [withArchived, setWithArchived] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  // Смена пароля живёт отдельно от общего редактирования: сбросить пароль нужно
  // часто и быстро, не трогая роль и участок.
  const [pwdForId, setPwdForId] = useState<string | null>(null);
  const [pwdValue, setPwdValue] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);
  /**
   * Только что выданные доступы — и при смене пароля, и при заведении сотрудника.
   *
   * Пароль виден один раз: в базе лежит хэш, восстановить его нельзя, можно лишь
   * задать новый. Раньше список появлялся только после импорта из Excel, а при
   * добавлении по одному пароль взять было негде — приходилось держать в голове
   * или заводить людей пачкой ради выгрузки.
   *
   * Копим списком: заводя смену по одному, администратор получает в конце готовый
   * файл на всех, а не двадцать разрозненных сообщений.
   */
  const [issued, setIssued] = useState<Credential[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    fullName: string;
    role: Role;
    siteId: string;
    managerId: string;
  }>({
    fullName: '',
    role: 'WORKER',
    siteId: '',
    managerId: '',
  });

  async function refresh() {
    if (!token) return;
    setLoading(true);
    try {
      const [usersData, sitesData] = await Promise.all([
        api.listUsers(token, withArchived),
        api.listSites(token),
      ]);
      setUsers(usersData);
      setSites(sitesData);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось загрузить пользователей');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, withArchived]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    // За участок раньше отвечал нативный required у <select>. У своего компонента его
    // нет, поэтому проверяем сами — иначе уйдёт пустой siteId и придёт непонятная
    // ошибка валидации с сервера.
    if (SITE_BOUND_ROLES.includes(form.role) && !form.siteId) {
      toast.error(`Для роли «${ROLE_LABELS[form.role]}» нужно выбрать участок`);
      return;
    }
    setCreating(true);
    try {
      await api.createUser(token, {
        username: form.username.trim(),
        password: form.password,
        fullName: form.fullName.trim(),
        role: form.role,
        siteId: SITE_BOUND_ROLES.includes(form.role) ? form.siteId : undefined,
        managerId: form.managerId || undefined,
      });
      setIssued((prev) => [
        { fullName: form.fullName.trim(), username: form.username.trim(), password: form.password },
        ...prev,
      ]);
      setForm(EMPTY_FORM);
      setShowCreate(false);
      toast.success('Пользователь создан — сохраните пароль, второй раз он не покажется');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось создать пользователя');
    } finally {
      setCreating(false);
    }
  }

  function startEdit(u: AdminUser) {
    setEditingId(u.id);
    setEditForm({
      fullName: u.fullName,
      role: u.role,
      siteId: u.siteId ?? '',
      managerId: u.managerId ?? '',
    });
  }

  async function saveEdit(id: string) {
    if (!token) return;
    if (SITE_BOUND_ROLES.includes(editForm.role) && !editForm.siteId) {
      toast.error(`Для роли «${ROLE_LABELS[editForm.role]}» нужно выбрать участок`);
      return;
    }
    try {
      await api.updateUser(token, id, {
        fullName: editForm.fullName.trim(),
        role: editForm.role,
        siteId: SITE_BOUND_ROLES.includes(editForm.role) ? editForm.siteId : undefined,
        managerId: editForm.managerId || null,
      });
      setEditingId(null);
      toast.success('Изменения сохранены');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось сохранить изменения');
    }
  }

  function startPassword(u: AdminUser) {
    setPwdForId(u.id);
    setPwdValue(makePassword());
    setEditingId(null);
  }

  async function savePassword(u: AdminUser) {
    if (!token || pwdValue.length < 6) return;
    setPwdSaving(true);
    try {
      await api.updateUser(token, u.id, { password: pwdValue });
      setIssued((prev) => [{ fullName: u.fullName, username: u.username, password: pwdValue }, ...prev]);
      setPwdForId(null);
      setPwdValue('');
      toast.success(`Пароль изменён: ${u.fullName}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось изменить пароль');
    } finally {
      setPwdSaving(false);
    }
  }

  async function handleArchive(u: AdminUser) {
    if (!token) return;
    const ok = await confirm({
      title: 'В архив',
      message: `Отправить «${u.fullName}» в архив? Вход закроется, из распределения и смен человек пропадёт, но вся его история останется в отчётах.`,
      confirmLabel: 'В архив',
    });
    if (!ok) return;
    try {
      await api.archiveUser(token, u.id);
      toast.success(`${u.fullName} — в архиве`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось отправить в архив');
    }
  }

  async function handleRestore(u: AdminUser) {
    if (!token) return;
    try {
      await api.restoreUser(token, u.id);
      toast.success(`${u.fullName} снова в работе`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось вернуть из архива');
    }
  }

  async function handleDelete(u: AdminUser) {
    if (!token) return;
    const ok = await confirm({
      title: 'Удаление пользователя',
      message: `Удалить пользователя «${u.fullName}» (${u.username})?`,
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteUser(token, u.id);
      toast.success('Пользователь удалён');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось удалить пользователя');
    }
  }

  // Руководителем может быть только начальник участка или начальник производства.
  const managerOptions = users.filter(
    (u) => (u.role === 'SITE_LEAD' || u.role === 'PRODUCTION_HEAD') && !u.archivedAt,
  );

  const controls = useTableControls(users, {
    searchText: (u) =>
      `${u.username} ${u.fullName} ${ROLE_LABELS[u.role]} ${u.siteName ?? ''} ${u.managerName ?? ''}`,
    sortAccessors: {
      username: (u) => u.username,
      fullName: (u) => u.fullName,
      role: (u) => ROLE_LABELS[u.role],
      site: (u) => u.siteName ?? '',
      manager: (u) => u.managerName ?? '',
    },
  });

  return (
    <AdminLayout title="Пользователи" breadcrumb="Администрирование">

      <div style={styles.topBar}>
        <ToggleCreateButton
          open={showCreate}
          label="+ Добавить сотрудника"
          onClick={() => setShowCreate((v) => !v)}
        />
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} style={styles.createCard}>
          <div style={styles.formGrid}>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>ФИО</span>
              <Input
                placeholder="Иванов Иван"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                required
              />
            </label>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Логин</span>
              <Input
                placeholder="ivanov"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                required
              />
            </label>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Пароль</span>
              <Input
                placeholder="belmy-7413"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
              <button
                type="button"
                style={styles.tinyLink}
                onClick={() => setForm({ ...form, password: makePassword() })}
              >
                Сгенерировать
              </button>
            </label>
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Роль</span>
              <Select
                ariaLabel="Роль"
                value={form.role}
                onChange={(role) => setForm({ ...form, role: role as Role })}
                options={ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }))}
              />
            </label>
            {SITE_BOUND_ROLES.includes(form.role) && (
              <label style={styles.field}>
                <span style={styles.fieldLabel}>Участок</span>
                <Select
                  ariaLabel="Участок"
                  placeholder="Выберите участок"
                  value={form.siteId}
                  onChange={(siteId) => setForm({ ...form, siteId })}
                  options={sites.map((site) => ({ value: site.id, label: site.name }))}
                />
              </label>
            )}
            <label style={styles.field}>
              <span style={styles.fieldLabel}>Руководитель</span>
              <SearchSelect
                width="100%"
                value={form.managerId}
                onChange={(managerId) => setForm({ ...form, managerId })}
                options={managerOptions.map((m) => ({
                  value: m.id,
                  label: m.fullName,
                  hint: ROLE_LABELS[m.role],
                }))}
                placeholder="Без руководителя"
              />
            </label>
          </div>

          <div style={styles.formActions}>
            <button type="button" style={styles.ghostButton} onClick={() => setShowCreate(false)}>
              Отмена
            </button>
            <Button type="submit" disabled={creating}>
              Добавить
            </Button>
          </div>
        </form>
      )}

      {issued.length > 0 && (
        <div style={styles.issuedBox}>
          <div style={{ flex: 1 }}>
            <div style={{ marginBottom: '6px' }}>
              <b>Выданные доступы ({issued.length})</b> — запишите, продиктуйте или скачайте.
              Второй раз пароли не показать.
            </div>
            <table style={styles.issuedTable}>
              <tbody>
                {issued.map((c) => (
                  <tr key={c.username}>
                    <td style={styles.issuedCell}>{c.fullName}</td>
                    <td style={styles.issuedCell}>
                      <code style={styles.issuedCode}>{c.username}</code>
                    </td>
                    <td style={styles.issuedCell}>
                      <code style={styles.issuedCode}>{c.password}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button
              style={styles.linkButton}
              onClick={() => {
                downloadCredentials(issued);
                toast.success('Список выгружен — сохраните его, второй раз пароли не показать');
              }}
            >
              Скачать CSV
            </button>
            <LinkButton onClick={() => setIssued([])}>
              Скрыть
            </LinkButton>
          </div>
        </div>
      )}

      {!loading && users.length > 0 && (
        <div style={styles.toolbar}>
          <SearchInput value={controls.query} onChange={controls.setQuery} placeholder="Поиск по логину, ФИО, роли..." />
          <label style={styles.archiveToggle}>
            <input
              type="checkbox"
              checked={withArchived}
              onChange={(e) => setWithArchived(e.target.checked)}
            />
            Показывать архив
          </label>
        </div>
      )}

      {loading ? (
        <SkeletonTable rows={5} cols={6} />
      ) : users.length === 0 ? (
        <EmptyState icon="users" title="Пользователей пока нет" hint="Добавьте первого пользователя в форме выше." />
      ) : controls.result.length === 0 ? (
        <EmptyState icon="search" title="Ничего не найдено" hint="Измените поисковый запрос." />
      ) : (
        <Table>
          <thead>
            <tr>
              <SortHeader label="Логин" sortKey="username" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
              <SortHeader label="ФИО" sortKey="fullName" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
              <SortHeader label="Роль" sortKey="role" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
              <SortHeader label="Участок" sortKey="site" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
              <SortHeader label="Руководитель" sortKey="manager" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {controls.result.map((u) => (
              <Fragment key={u.id}>
              <tr>
                {editingId === u.id ? (
                  <>
                    <Td>{u.username}</Td>
                    <Td>
                      <Input
                        value={editForm.fullName}
                        onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                      />
                    </Td>
                    <Td>
                      <Select
                        ariaLabel="Роль"
                        value={editForm.role}
                        onChange={(role) => setEditForm({ ...editForm, role: role as Role })}
                        options={ROLES.map((role) => ({ value: role, label: ROLE_LABELS[role] }))}
                      />
                    </Td>
                    <Td>
                      {SITE_BOUND_ROLES.includes(editForm.role) ? (
                        <Select
                          ariaLabel="Участок"
                          placeholder="Выберите участок"
                          value={editForm.siteId}
                          onChange={(siteId) => setEditForm({ ...editForm, siteId })}
                          options={sites.map((site) => ({ value: site.id, label: site.name }))}
                        />
                      ) : (
                        '—'
                      )}
                    </Td>
                    <Td>
                      <Select
                        ariaLabel="Руководитель"
                        value={editForm.managerId}
                        onChange={(managerId) => setEditForm({ ...editForm, managerId })}
                        // Пустой вариант нужен именно как выбор: руководителя надо уметь снять,
                        // а placeholder показывается, но выбрать его нельзя.
                        options={[
                          { value: '', label: 'Без руководителя' },
                          ...managerOptions
                            .filter((m) => m.id !== u.id)
                            .map((m) => ({
                              value: m.id,
                              label: m.fullName,
                              hint: ROLE_LABELS[m.role],
                            })),
                        ]}
                      />
                    </Td>
                    <Td align="right">
                      <LinkButton onClick={() => saveEdit(u.id)}>
                        Сохранить
                      </LinkButton>
                      <LinkButton onClick={() => setEditingId(null)}>
                        Отмена
                      </LinkButton>
                    </Td>
                  </>
                ) : (
                  <>
                    <Td>{u.username}</Td>
                    <Td>
                      <div style={styles.nameCell}>
                        <Avatar name={u.fullName} size={28} />
                        {u.fullName}
                      </div>
                    </Td>
                    <Td>
                      <Badge variant={u.archivedAt ? 'muted' : 'accent'}>{ROLE_LABELS[u.role]}</Badge>
                      {u.archivedAt && (
                        <span style={styles.archivedMark}>в архиве</span>
                      )}
                    </Td>
                    <Td>{u.siteName ?? '—'}</Td>
                    <Td>{u.managerName ?? '—'}</Td>
                    <Td align="right">
                      {u.archivedAt ? (
                        <RowActions
                          primary={{ label: 'Вернуть в работу', onClick: () => handleRestore(u) }}
                          actions={[{ label: 'Удалить', onClick: () => handleDelete(u), danger: true }]}
                        />
                      ) : (
                        <RowActions
                          primary={{ label: 'Редактировать', onClick: () => startEdit(u) }}
                          actions={[
                            { label: 'Сменить пароль', onClick: () => startPassword(u) },
                            { label: 'В архив', onClick: () => handleArchive(u) },
                            { label: 'Удалить', onClick: () => handleDelete(u), danger: true },
                          ]}
                        />
                      )}
                    </Td>
                  </>
                )}
              </tr>
              {pwdForId === u.id && (
                <tr>
                  <td style={styles.pwdCell} colSpan={6}>
                    <div style={styles.pwdRow}>
                      <span style={styles.pwdLabel}>Новый пароль для {u.fullName}:</span>
                      <input
                        style={{ ...styles.input, fontFamily: 'monospace', minWidth: '160px' }}
                        value={pwdValue}
                        onChange={(e) => setPwdValue(e.target.value)}
                        autoFocus
                      />
                      <button
                        type="button"
                        style={styles.ghostButton}
                        onClick={() => setPwdValue(makePassword())}
                      >
                        Сгенерировать
                      </button>
                      <button
                        style={styles.button}
                        onClick={() => savePassword(u)}
                        disabled={pwdSaving || pwdValue.length < 6}
                      >
                        Сохранить
                      </button>
                      <LinkButton onClick={() => setPwdForId(null)}>
                        Отмена
                      </LinkButton>
                      {pwdValue.length < 6 && (
                        <span style={styles.pwdWarn}>минимум 6 символов</span>
                      )}
                    </div>
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </Table>
      )}
    </AdminLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  topBar: { marginBottom: '16px' },
  createCard: {
    background: COLORS.white,
    border: `1px solid ${COLORS.lightGreenBg}`,
    borderRadius: RADIUS.md,
    padding: '18px 20px',
    marginBottom: '20px',
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '14px 18px',
  },
  field: { display: 'flex', flexDirection: 'column', gap: '6px' },
  fieldLabel: { fontSize: '12px', color: COLORS.mutedText },
  tinyLink: {
    alignSelf: 'flex-start',
    border: 'none',
    background: 'none',
    color: COLORS.accentDark,
    fontSize: '13px',
    cursor: 'pointer',
    padding: 0,
  },
  formActions: { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px' },
  toolbar: {
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
  },
  archiveToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '14px',
    color: COLORS.mutedText,
    cursor: 'pointer',
  },
  archivedMark: { marginLeft: '8px', fontSize: '12px', color: COLORS.mutedText },
  issuedBox: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    padding: '12px 16px',
    marginBottom: '16px',
    borderRadius: RADIUS.sm,
    background: COLORS.lightGreenBg,
    fontSize: '14px',
    color: COLORS.darkText,
  },
  issuedTable: {
    borderCollapse: 'collapse',
    fontSize: '14px',
  },
  issuedCell: {
    padding: '3px 12px 3px 0',
  },
  issuedCode: { fontFamily: 'monospace', fontSize: '15px' },
  pwdCell: { padding: '0 8px 12px', background: COLORS.lightGrayBg },
  pwdRow: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '10px 0' },
  pwdLabel: { fontSize: '14px', color: COLORS.mutedText },
  pwdWarn: { fontSize: '13px', color: COLORS.error },
  ghostButton: {
    padding: '10px 14px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.white,
    color: COLORS.darkText,
    fontSize: '14px',
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
    padding: '10px 20px',
    borderRadius: RADIUS.sm,
    border: 'none',
    background: COLORS.accent,
    color: COLORS.white,
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  nameCell: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  linkButton: {
    border: 'none',
    background: 'none',
    color: COLORS.accentDark,
    cursor: 'pointer',
    fontSize: '14px',
    marginLeft: '12px',
  },
};
