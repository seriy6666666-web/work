import { Fragment, useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api, ApiError, type AdminUser, type Role, type Site } from '../../api/client';
import { ROLES, ROLE_LABELS, SITE_BOUND_ROLES } from '../../constants/roles';
import { AdminLayout } from './AdminLayout';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { useToast } from '../../components/ToastProvider';
import { useConfirm } from '../../components/ConfirmProvider';
import { SkeletonTable } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { useTableControls, SearchInput, SortHeader } from '../../components/TableControls';
import { COLORS, RADIUS } from '../../theme';

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

  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  // Смена пароля живёт отдельно от общего редактирования: сбросить пароль нужно
  // часто и быстро, не трогая роль и участок.
  const [pwdForId, setPwdForId] = useState<string | null>(null);
  const [pwdValue, setPwdValue] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);
  const [issued, setIssued] = useState<{ fullName: string; password: string } | null>(null);

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
      const [usersData, sitesData] = await Promise.all([api.listUsers(token), api.listSites(token)]);
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
  }, [token]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
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
      setForm(EMPTY_FORM);
      toast.success('Пользователь создан');
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
      setIssued({ fullName: u.fullName, password: pwdValue });
      setPwdForId(null);
      setPwdValue('');
      toast.success(`Пароль изменён: ${u.fullName}`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось изменить пароль');
    } finally {
      setPwdSaving(false);
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
    (u) => u.role === 'SITE_LEAD' || u.role === 'PRODUCTION_HEAD',
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

      <form onSubmit={handleCreate} style={styles.createForm}>
        <input
          style={styles.input}
          placeholder="Логин"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          required
        />
        <input
          style={styles.input}
          placeholder="Пароль"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />
        <button
          type="button"
          style={styles.ghostButton}
          onClick={() => setForm({ ...form, password: makePassword() })}
        >
          Сгенерировать
        </button>
        <input
          style={styles.input}
          placeholder="ФИО"
          value={form.fullName}
          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
          required
        />
        <select
          style={styles.input}
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
        >
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
        {SITE_BOUND_ROLES.includes(form.role) && (
          <select
            style={styles.input}
            value={form.siteId}
            onChange={(e) => setForm({ ...form, siteId: e.target.value })}
            required
          >
            <option value="">Выберите участок</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        )}
        <select
          style={styles.input}
          value={form.managerId}
          onChange={(e) => setForm({ ...form, managerId: e.target.value })}
        >
          <option value="">Без руководителя</option>
          {managerOptions.map((m) => (
            <option key={m.id} value={m.id}>
              {m.fullName} — {ROLE_LABELS[m.role]}
            </option>
          ))}
        </select>
        <button style={styles.button} type="submit" disabled={creating}>
          Добавить
        </button>
      </form>

      {issued && (
        <div style={styles.issuedBox}>
          <span>
            Новый пароль для <b>{issued.fullName}</b>:{' '}
            <code style={styles.issuedCode}>{issued.password}</code> — запишите или продиктуйте, второй
            раз его не показать.
          </span>
          <button style={styles.linkButton} onClick={() => setIssued(null)}>
            Скрыть
          </button>
        </div>
      )}

      {!loading && users.length > 0 && (
        <div style={styles.toolbar}>
          <SearchInput value={controls.query} onChange={controls.setQuery} placeholder="Поиск по логину, ФИО, роли..." />
        </div>
      )}

      {loading ? (
        <SkeletonTable rows={5} cols={6} />
      ) : users.length === 0 ? (
        <EmptyState icon="users" title="Пользователей пока нет" hint="Добавьте первого пользователя в форме выше." />
      ) : controls.result.length === 0 ? (
        <EmptyState icon="search" title="Ничего не найдено" hint="Измените поисковый запрос." />
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <SortHeader label="Логин" sortKey="username" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
              <SortHeader label="ФИО" sortKey="fullName" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
              <SortHeader label="Роль" sortKey="role" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
              <SortHeader label="Участок" sortKey="site" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
              <SortHeader label="Руководитель" sortKey="manager" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
              <th style={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {controls.result.map((u) => (
              <Fragment key={u.id}>
              <tr>
                {editingId === u.id ? (
                  <>
                    <td style={styles.td}>{u.username}</td>
                    <td style={styles.td}>
                      <input
                        style={styles.input}
                        value={editForm.fullName}
                        onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                      />
                    </td>
                    <td style={styles.td}>
                      <select
                        style={styles.input}
                        value={editForm.role}
                        onChange={(e) => setEditForm({ ...editForm, role: e.target.value as Role })}
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td style={styles.td}>
                      {SITE_BOUND_ROLES.includes(editForm.role) ? (
                        <select
                          style={styles.input}
                          value={editForm.siteId}
                          onChange={(e) => setEditForm({ ...editForm, siteId: e.target.value })}
                        >
                          <option value="">Выберите участок</option>
                          {sites.map((site) => (
                            <option key={site.id} value={site.id}>
                              {site.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td style={styles.td}>
                      <select
                        style={styles.input}
                        value={editForm.managerId}
                        onChange={(e) => setEditForm({ ...editForm, managerId: e.target.value })}
                      >
                        <option value="">Без руководителя</option>
                        {managerOptions
                          .filter((m) => m.id !== u.id)
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.fullName} — {ROLE_LABELS[m.role]}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      <button style={styles.linkButton} onClick={() => saveEdit(u.id)}>
                        Сохранить
                      </button>
                      <button style={styles.linkButton} onClick={() => setEditingId(null)}>
                        Отмена
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td style={styles.td}>{u.username}</td>
                    <td style={styles.td}>
                      <div style={styles.nameCell}>
                        <Avatar name={u.fullName} size={28} />
                        {u.fullName}
                      </div>
                    </td>
                    <td style={styles.td}>
                      <Badge variant="accent">{ROLE_LABELS[u.role]}</Badge>
                    </td>
                    <td style={styles.td}>{u.siteName ?? '—'}</td>
                    <td style={styles.td}>{u.managerName ?? '—'}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      <button style={styles.linkButton} onClick={() => startEdit(u)}>
                        Редактировать
                      </button>
                      <button style={styles.linkButton} onClick={() => startPassword(u)}>
                        Пароль
                      </button>
                      <button style={styles.linkButtonDanger} onClick={() => handleDelete(u)}>
                        Удалить
                      </button>
                    </td>
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
                      <button style={styles.linkButton} onClick={() => setPwdForId(null)}>
                        Отмена
                      </button>
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
        </table>
      )}
    </AdminLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  createForm: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    marginBottom: '16px',
    alignItems: 'center',
  },
  toolbar: {
    marginBottom: '16px',
  },
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
  linkButtonDanger: {
    border: 'none',
    background: 'none',
    color: COLORS.error,
    cursor: 'pointer',
    fontSize: '14px',
    marginLeft: '12px',
  },
};
