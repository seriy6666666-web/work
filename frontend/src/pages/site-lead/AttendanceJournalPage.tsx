import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api, ApiError, type JournalEntry } from '../../api/client';
import { SiteLeadLayout } from './SiteLeadLayout';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { useToast } from '../../components/ToastProvider';
import { SkeletonTable } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/Icon';
import { COLORS, RADIUS, SHADOW } from '../../theme';

function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function timeOf(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function AttendanceJournalPage() {
  const { token } = useAuth();
  const toast = useToast();

  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return ymd(d);
  });
  const [to, setTo] = useState(() => ymd(new Date()));
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      setEntries(await api.getAttendanceJournal(token, from, to));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось загрузить журнал');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleExport() {
    if (!token) return;
    setExporting(true);
    try {
      const blob = await api.exportAttendanceJournal(token, from, to);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `attendance_${from}_${to}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Журнал выгружен');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Не удалось выгрузить журнал');
    } finally {
      setExporting(false);
    }
  }

  const totalHours = entries.reduce((sum, e) => sum + (e.hours ?? 0), 0);
  const openShifts = entries.filter((e) => !e.checkOutAt).length;

  return (
    <SiteLeadLayout title="Журнал приходов и уходов" breadcrumb="Участок">
      <p style={styles.hint}>
        Отметки прихода и ухода сотрудников участка за период. Выгрузка в CSV открывается в Excel.
      </p>

      <div style={styles.toolbar}>
        <label style={styles.dateLabel}>
          <span style={styles.dateCaption}>С</span>
          <input style={styles.input} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label style={styles.dateLabel}>
          <span style={styles.dateCaption}>По</span>
          <input style={styles.input} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button style={styles.button} onClick={handleExport} disabled={exporting || entries.length === 0}>
          <Icon name="download" size={16} />
          Скачать CSV
        </button>
      </div>

      {!loading && entries.length > 0 && (
        <div style={styles.summary}>
          <span>
            Смен: <strong>{entries.length}</strong>
          </span>
          <span>
            Всего часов: <strong>{Math.round(totalHours * 10) / 10}</strong>
          </span>
          {openShifts > 0 && <Badge variant="priority-medium">Без ухода: {openShifts}</Badge>}
        </div>
      )}

      {loading ? (
        <SkeletonTable rows={5} cols={5} />
      ) : entries.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="Отметок за период нет"
          hint="Выберите другой период или дождитесь отметок сотрудников."
        />
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Сотрудник</th>
                <th style={styles.th}>Дата</th>
                <th style={styles.th}>Приход</th>
                <th style={styles.th}>Уход</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Отработано</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={`${e.userId}-${e.checkInAt}-${i}`}>
                  <td style={styles.td}>
                    <div style={styles.nameCell}>
                      <Avatar name={e.fullName} size={26} />
                      {e.fullName}
                    </div>
                  </td>
                  <td style={styles.td}>{e.date.split('-').reverse().join('.')}</td>
                  <td style={styles.td}>{timeOf(e.checkInAt)}</td>
                  <td style={styles.td}>
                    {e.checkOutAt ? (
                      timeOf(e.checkOutAt)
                    ) : (
                      <span style={styles.open}>не отмечен</span>
                    )}
                  </td>
                  <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600 }}>
                    {e.hours === null ? '—' : `${e.hours} ч`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SiteLeadLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  hint: { color: COLORS.mutedText, fontSize: '14px', marginTop: 0 },
  toolbar: { display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: '16px' },
  dateLabel: { display: 'flex', flexDirection: 'column', gap: '4px' },
  dateCaption: { fontSize: '12px', color: COLORS.mutedText },
  input: {
    padding: '9px 12px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.lightGrayBg,
    fontSize: '14px',
  },
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 18px',
    borderRadius: RADIUS.sm,
    border: 'none',
    background: COLORS.accent,
    color: COLORS.white,
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  summary: { display: 'flex', gap: '18px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '14px', fontSize: '14px', color: COLORS.mutedText },
  tableWrap: {
    background: COLORS.white,
    border: `1px solid ${COLORS.lightGreenBg}`,
    borderRadius: RADIUS.md,
    boxShadow: SHADOW.card,
    padding: '8px 12px',
    overflowX: 'auto',
  },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
  th: {
    textAlign: 'left',
    padding: '10px 8px',
    color: COLORS.mutedText,
    fontWeight: 600,
    fontSize: '13px',
    borderBottom: `1px solid ${COLORS.lightGreenBg}`,
    whiteSpace: 'nowrap',
  },
  td: { padding: '8px', borderBottom: `1px solid ${COLORS.lightGrayBg}`, whiteSpace: 'nowrap' },
  nameCell: { display: 'flex', alignItems: 'center', gap: '10px' },
  open: { color: COLORS.warning, fontWeight: 600 },
};
