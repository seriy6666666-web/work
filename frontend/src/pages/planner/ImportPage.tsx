import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api, ApiError, type ImportCredential, type ImportReport } from '../../api/client';
import { PlannerLayout } from './PlannerLayout';
import { Badge } from '../../components/Badge';
import { useToast } from '../../components/ToastProvider';
import { COLORS, RADIUS, SHADOW } from '../../theme';

type ImportKind = 'competency' | 'norms';

interface KindState {
  file: File | null;
  report: ImportReport | null;
  busy: boolean;
}

const EMPTY: KindState = { file: null, report: null, busy: false };

export function ImportPage() {
  const { token } = useAuth();
  const toast = useToast();
  const [state, setState] = useState<Record<ImportKind, KindState>>({
    competency: { ...EMPTY },
    norms: { ...EMPTY },
  });
  const [defaultSite, setDefaultSite] = useState('');

  /**
   * Пароли видно только здесь и только сейчас: в базе лежит хэш, восстановить их
   * потом нельзя — админ сможет лишь задать новый.
   */
  function downloadCredentials(credentials: ImportCredential[]) {
    const rows = [
      'ФИО,Логин,Пароль',
      ...credentials.map((c) => `"${c.fullName}","${c.username}","${c.password}"`),
    ];
    // BOM — иначе Excel открывает кириллицу кракозябрами.
    const blob = new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logins_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success('Список выгружен — сохраните его, второй раз пароли не показать');
  }

  function patch(kind: ImportKind, next: Partial<KindState>) {
    setState((prev) => ({ ...prev, [kind]: { ...prev[kind], ...next } }));
  }

  async function run(kind: ImportKind, dryRun: boolean) {
    const file = state[kind].file;
    if (!token || !file) return;
    patch(kind, { busy: true });
    try {
      const report =
        kind === 'competency'
          ? await api.importCompetency(token, file, dryRun)
          : await api.importNorms(token, file, dryRun, defaultSite || undefined);
      patch(kind, { report });
      if (!dryRun) {
        toast.success('Импорт выполнен — данные загружены');
      }
    } catch (err) {
      patch(kind, { report: null });
      toast.error(err instanceof ApiError ? err.message : 'Не удалось разобрать файл');
    } finally {
      patch(kind, { busy: false });
    }
  }

  function renderBlock(kind: ImportKind, title: string, hint: string, extra?: React.ReactNode) {
    const s = state[kind];
    const report = s.report;
    return (
      <div style={styles.card}>
        <p style={styles.cardTitle}>{title}</p>
        <p style={styles.hint}>{hint}</p>

        <div style={styles.row}>
          <input
            style={styles.file}
            type="file"
            accept=".xlsx"
            onChange={(e) => patch(kind, { file: e.target.files?.[0] ?? null, report: null })}
          />
          <button
            style={styles.button}
            disabled={!s.file || s.busy}
            onClick={() => run(kind, true)}
          >
            {s.busy ? 'Читаю...' : 'Проверить файл'}
          </button>
        </div>
        {extra}

        {report && (
          <div style={styles.report}>
            <div style={styles.summaryRow}>
              {report.summary.map((item) => (
                <div key={item.label} style={styles.stat}>
                  <span style={styles.statValue}>{item.value}</span>
                  <span style={styles.statLabel}>{item.label}</span>
                </div>
              ))}
            </div>

            {report.issues.length > 0 && (
              <details style={styles.issues}>
                <summary style={styles.issuesSummary}>
                  <Badge variant="priority-medium">Замечаний: {report.issues.length}</Badge>
                  <span style={styles.issuesHintText}>
                    — эти строки будут пропущены, остальное загрузится
                  </span>
                </summary>
                <ul style={styles.issueList}>
                  {report.issues.slice(0, 50).map((i, idx) => (
                    <li key={idx} style={styles.issueItem}>
                      <span style={styles.issueWhere}>
                        {i.sheet}
                        {i.row ? `, стр. ${i.row}` : ''}
                      </span>
                      {' — '}
                      {i.message}
                    </li>
                  ))}
                  {report.issues.length > 50 && (
                    <li style={styles.issueItem}>…и ещё {report.issues.length - 50}</li>
                  )}
                </ul>
              </details>
            )}

            {report.dryRun ? (
              <div style={styles.confirmRow}>
                <span style={styles.confirmText}>Проверка пройдена. Загрузить эти данные в систему?</span>
                <button style={styles.applyButton} disabled={s.busy} onClick={() => run(kind, false)}>
                  {s.busy ? 'Загружаю...' : 'Импортировать'}
                </button>
              </div>
            ) : (
              <>
                <div style={styles.doneRow}>
                  <Badge variant="accent">Загружено</Badge>
                </div>

                {report.credentials && report.credentials.length > 0 && (
                  <div style={styles.credsBox}>
                    <div style={styles.credsHead}>
                      <div>
                        <strong style={styles.credsTitle}>Пароли для раздачи</strong>
                        <p style={styles.credsHint}>
                          Показываются один раз. Дальше пароль восстановить нельзя — только задать
                          новый в разделе «Пользователи». Сохраните список.
                        </p>
                      </div>
                      <button
                        style={styles.applyButton}
                        onClick={() => downloadCredentials(report.credentials ?? [])}
                      >
                        Скачать CSV
                      </button>
                    </div>
                    <div style={styles.credsTableWrap}>
                      <table style={styles.credsTable}>
                        <thead>
                          <tr>
                            <th style={styles.credsTh}>ФИО</th>
                            <th style={styles.credsTh}>Логин</th>
                            <th style={styles.credsTh}>Пароль</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.credentials.map((c) => (
                            <tr key={c.username}>
                              <td style={styles.credsTd}>{c.fullName}</td>
                              <td style={styles.credsTd}>{c.username}</td>
                              <td style={{ ...styles.credsTd, fontFamily: 'monospace' }}>{c.password}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <PlannerLayout title="Импорт из Excel" breadcrumb="Планирование">
      <p style={styles.pageHint}>
        Загрузите рабочий файл Excel — система сама разберёт его по нужным справочникам. Сначала
        выполняется проверка: видно, что найдено и какие строки будут пропущены. Данные записываются
        только после нажатия «Импортировать».
      </p>

      {renderBlock(
        'competency',
        'Матрица компетенций',
        'Листы вида «<Участок> навыки»: шапка с навыками и отметки 0/1 по сотрудникам. Создаёт навыки, сотрудников и их компетенции. Участки берутся из уже существующих — если участка в системе нет, об этом будет сказано в проверке, создайте его заранее. Листы «желания» не учитываются.',
      )}

      {renderBlock(
        'norms',
        'Посуточные задачи (нормы и изделия)',
        'Лист «НОРМЫ»: изделие → проект, операция → навык и шаг техкарты, время на операцию → норма выработки (за 8-часовую смену).',
        <div style={styles.row}>
          <input
            style={styles.input}
            placeholder="Участок по умолчанию (для строк без участка)"
            value={defaultSite}
            onChange={(e) => setDefaultSite(e.target.value)}
          />
        </div>,
      )}
    </PlannerLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  credsBox: {
    marginTop: '14px',
    border: `1px solid ${COLORS.lightGreenBg}`,
    borderRadius: RADIUS.md,
    background: COLORS.lightGrayBg,
    padding: '14px 16px',
  },
  credsHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    flexWrap: 'wrap',
  },
  credsTitle: { fontSize: '15px', color: COLORS.darkText },
  credsHint: { margin: '4px 0 0', fontSize: '13px', color: COLORS.mutedText, maxWidth: '560px' },
  credsTableWrap: { marginTop: '12px', maxHeight: '320px', overflow: 'auto', background: COLORS.white, borderRadius: RADIUS.sm },
  credsTable: { width: '100%', borderCollapse: 'collapse', fontSize: '14px' },
  credsTh: {
    position: 'sticky',
    top: 0,
    background: COLORS.white,
    textAlign: 'left',
    padding: '10px 12px',
    color: COLORS.mutedText,
    fontWeight: 600,
    fontSize: '13px',
    borderBottom: `1px solid ${COLORS.lightGreenBg}`,
  },
  credsTd: { padding: '8px 12px', borderBottom: `1px solid ${COLORS.lightGrayBg}` },
  pageHint: { color: COLORS.mutedText, fontSize: '14px', marginTop: 0, marginBottom: '20px' },
  card: {
    background: COLORS.white,
    border: `1px solid ${COLORS.lightGreenBg}`,
    borderRadius: RADIUS.md,
    boxShadow: SHADOW.card,
    padding: '18px',
    marginBottom: '18px',
  },
  cardTitle: { margin: '0 0 6px', fontSize: '16px', fontWeight: 700, color: COLORS.darkText },
  hint: { margin: '0 0 14px', fontSize: '13px', color: COLORS.mutedText, lineHeight: 1.5 },
  row: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' },
  file: { fontSize: '14px', flex: 1, minWidth: '240px' },
  input: {
    flex: 1,
    minWidth: '240px',
    padding: '9px 12px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.lightGrayBg,
    fontSize: '14px',
  },
  button: {
    padding: '10px 18px',
    borderRadius: RADIUS.sm,
    border: `1px solid ${COLORS.lightGreenBg}`,
    background: COLORS.lightGrayBg,
    color: COLORS.darkText,
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  applyButton: {
    padding: '10px 20px',
    borderRadius: RADIUS.sm,
    border: 'none',
    background: COLORS.accent,
    color: COLORS.white,
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  report: { marginTop: '14px', borderTop: `1px solid ${COLORS.lightGreenBg}`, paddingTop: '14px' },
  summaryRow: { display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '12px' },
  stat: { display: 'flex', flexDirection: 'column' },
  statValue: { fontSize: '22px', fontWeight: 700, color: COLORS.accentDark },
  statLabel: { fontSize: '12px', color: COLORS.mutedText },
  issues: { marginBottom: '12px' },
  issuesSummary: { cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' },
  issuesHintText: { fontSize: '13px', color: COLORS.mutedText },
  issueList: {
    margin: '10px 0 0',
    paddingLeft: '18px',
    maxHeight: '220px',
    overflowY: 'auto',
    fontSize: '13px',
    color: COLORS.mutedText,
  },
  issueItem: { marginBottom: '4px' },
  issueWhere: { color: COLORS.darkText, fontWeight: 600 },
  confirmRow: { display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' },
  confirmText: { fontSize: '14px', color: COLORS.darkText },
  doneRow: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
};
