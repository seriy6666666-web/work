import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api, ApiError, type CompetencyMatrix, type CompetencyLevel } from '../../api/client';
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

/**
 * Как выглядит каждая ступень. Цвет несёт смысл и только его: серое — допуска
 * нет, янтарное — учится, зелёное — работает сам, тёмно-зелёное — учит других.
 */
const LEVEL_META: Record<string, { label: string; short: string; background: string; color: string }> = {
  NONE: { label: 'нет допуска', short: '—', background: 'var(--surf2)', color: 'var(--tx3)' },
  LEARNING: { label: 'учится', short: 'У', background: 'var(--warnsoft)', color: 'var(--warn)' },
  ALLOWED: { label: 'допуск', short: 'Д', background: 'var(--accsoft)', color: 'var(--accd)' },
  MENTOR: { label: 'наставник', short: 'Н', background: 'var(--acc)', color: '#fff' },
};

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

  /**
   * Щелчок ведёт по кругу: нет допуска → учится → допуск → наставник → нет.
   *
   * Круг, а не выпадающий список: ячеек в матрице сотни, и открывать список ради
   * каждой невозможно. Цель нажатия крупная — в цеху работают в перчатках.
   */
  async function cycle(userId: string, skillId: string, current: CompetencyLevel | null) {
    if (!token) return;
    const order: (CompetencyLevel | null)[] = [null, 'LEARNING', 'ALLOWED', 'MENTOR'];
    const next = order[(order.indexOf(current) + 1) % order.length];
    const k = key(userId, skillId);
    setPending((prev) => new Set(prev).add(k));
    try {
      await api.setCompetency(token, { userId, skillId, level: next ?? undefined });
      setMatrix((prev) => {
        if (!prev) return prev;
        const rest = prev.competencies.filter((c) => !(c.userId === userId && c.skillId === skillId));
        return {
          ...prev,
          competencies: next ? [...rest, { userId, skillId, level: next }] : rest,
        };
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось изменить допуск');
    } finally {
      setPending((prev) => {
        const copy = new Set(prev);
        copy.delete(k);
        return copy;
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

  const levelByCell = new Map(matrix.competencies.map((c) => [key(c.userId, c.skillId), c.level]));

  return (
    <SiteLeadLayout title="Матрица компетенций" breadcrumb="Начальник участка">
      {/*
        Без подписи «У / Д / Н» пришлось бы угадывать. Ставим её над таблицей, а
        не подсказкой при наведении: наведения на планшете нет.
      */}
      <div style={styles.legend}>
        <span style={styles.legendHint}>Нажмите ячейку, чтобы изменить допуск:</span>
        {(['NONE', 'LEARNING', 'ALLOWED', 'MENTOR'] as const).map((k) => (
          <span key={k} style={styles.legendItem}>
            <i
              style={{
                ...styles.legendMark,
                background: LEVEL_META[k].background,
                color: LEVEL_META[k].color,
              }}
            >
              {LEVEL_META[k].short}
            </i>
            {LEVEL_META[k].label}
          </span>
        ))}
      </div>

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
                  const level = levelByCell.get(k) ?? null;
                  const meta = LEVEL_META[level ?? 'NONE'];
                  return (
                    <td key={skill.id} style={{ ...styles.td, textAlign: 'center', padding: '4px' }}>
                      <button
                        style={{ ...styles.levelCell, background: meta.background, color: meta.color }}
                        disabled={pending.has(k)}
                        onClick={() => cycle(user.id, skill.id, level)}
                        title={`${user.fullName} · ${skill.name}: ${meta.label}. Нажмите, чтобы изменить`}
                        aria-label={`${user.fullName}, ${skill.name}: ${meta.label}`}
                      >
                        {meta.short}
                      </button>
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
  legend: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    flexWrap: 'wrap',
    marginBottom: '14px',
    fontSize: '13px',
    color: 'var(--tx2)',
  },
  legendHint: {
    color: 'var(--tx3)',
  },
  legendItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  },
  legendMark: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '26px',
    height: '26px',
    borderRadius: '8px',
    border: '1px solid var(--line)',
    fontStyle: 'normal',
    fontWeight: 700,
    fontSize: '13px',
  },
  /** Цель нажатия 44px: ячеек сотни, и в перчатках по мелкому не попасть. */
  levelCell: {
    width: '44px',
    height: '44px',
    borderRadius: '12px',
    border: '1px solid var(--line)',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
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
  error: {
    color: COLORS.error,
    fontSize: '13px',
  },
};
