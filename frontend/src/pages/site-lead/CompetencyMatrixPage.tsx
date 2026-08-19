import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api, ApiError, type CompetencyMatrix } from '../../api/client';
import { SiteLeadLayout } from './SiteLeadLayout';
import { Avatar } from '../../components/Avatar';
import { useToast } from '../../components/ToastProvider';
import { Skeleton } from '../../components/Skeleton';
import { COLORS } from '../../theme';
import { useTableControls, SortHeader } from '../../components/TableControls';
import { Table, Td } from '../../components/ui';

function key(userId: string, skillId: string) {
  return `${userId}:${skillId}`;
}

export function CompetencyMatrixPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [matrix, setMatrix] = useState<CompetencyMatrix | null>(null);

  // Сортируем только сотрудников: навыки здесь — столбцы, их порядок задаёт
  // справочник, и переставлять их построчно нечем.
  const controls = useTableControls(matrix?.users ?? [], {
    searchText: (u) => u.fullName,
    sortAccessors: { user: (u) => u.fullName },
    defaultSortKey: 'user',
    storageKey: 'site-lead-competency',
  });
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Set<string>>(new Set());

  async function refresh() {
    if (!token) return;
    setLoading(true);
    try {
      setMatrix(await api.getCompetencyMatrix(token));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось загрузить матрицу компетенций');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function toggle(userId: string, skillId: string, canDo: boolean) {
    if (!token || !matrix) return;
    const k = key(userId, skillId);
    setPending((prev) => new Set(prev).add(k));
    try {
      await api.setCompetency(token, { userId, skillId, canDo });
      setMatrix((prev) => {
        if (!prev) return prev;
        const competencies = canDo
          ? [...prev.competencies, { userId, skillId }]
          : prev.competencies.filter((c) => !(c.userId === userId && c.skillId === skillId));
        return { ...prev, competencies };
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось сохранить изменение');
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(k);
        return next;
      });
    }
  }

  if (loading) {
    return (
      <SiteLeadLayout title="Матрица компетенций" breadcrumb="Начальник участка">
        <Skeleton height={240} />
      </SiteLeadLayout>
    );
  }

  if (!matrix) {
    return (
      <SiteLeadLayout title="Матрица компетенций" breadcrumb="Начальник участка">
        <p style={styles.error}>Не удалось загрузить данные</p>
      </SiteLeadLayout>
    );
  }

  const competentSet = new Set(matrix.competencies.map((c) => key(c.userId, c.skillId)));

  return (
    <SiteLeadLayout title="Матрица компетенций" breadcrumb="Начальник участка">

      {matrix.skills.length === 0 ? (
        <p>Справочник навыков пуст — навыки создаёт планировщик.</p>
      ) : matrix.users.length === 0 ? (
        <p>На вашем участке пока нет сотрудников.</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <SortHeader label="Сотрудник" sortKey="user" activeKey={controls.sortKey} dir={controls.sortDir} onSort={controls.toggleSort} />
              {matrix.skills.map((skill) => (
                <th key={skill.id} style={styles.th}>
                  {skill.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {controls.result.map((user) => (
              <tr key={user.id}>
                <Td>
                  <div style={styles.nameCell}>
                    <Avatar name={user.fullName} size={26} />
                    {user.fullName}
                  </div>
                </Td>
                {matrix.skills.map((skill) => {
                  const k = key(user.id, skill.id);
                  const canDo = competentSet.has(k);
                  return (
                    <td key={skill.id} style={{ ...styles.td, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={canDo}
                        disabled={pending.has(k)}
                        onChange={(e) => toggle(user.id, skill.id, e.target.checked)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </SiteLeadLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
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
  error: {
    color: COLORS.error,
    fontSize: '13px',
  },
};
