import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api/client';
import { PlannerLayout } from './PlannerLayout';
import { ImportBlock } from '../../components/ImportBlock';
import { COLORS } from '../../theme';
import { Input } from '../../components/ui';

export function ImportPage() {
  const { token } = useAuth();
  const [defaultSite, setDefaultSite] = useState('');

  return (
    <PlannerLayout title="Импорт из Excel" breadcrumb="Планирование">
      <p style={styles.pageHint}>
        Загрузите рабочий файл Excel — система сама разберёт его по нужным справочникам. Сначала
        выполняется проверка: видно, что найдено и какие строки будут пропущены. Данные записываются
        только после нажатия «Импортировать».
      </p>

      <ImportBlock
        title="Матрица компетенций"
        hint={
          'Листы вида «<Участок> навыки»: шапка с навыками и отметки 0/1 по сотрудникам. ' +
          'Записывает навыки и компетенции уже заведённых сотрудников. Новых людей этот импорт ' +
          'не создаёт — незнакомые ФИО попадут в замечания, их заводит администратор. ' +
          'Участки берутся из существующих. Листы «желания» не учитываются.'
        }
        onRun={(file, dryRun) => api.importCompetency(token!, file, dryRun)}
      />

      <ImportBlock
        title="Посуточные задачи (нормы и изделия)"
        hint="Лист «НОРМЫ»: изделие → проект, операция → навык и шаг техкарты, время на операцию → норма выработки (за 8-часовую смену)."
        onRun={(file, dryRun) => api.importNorms(token!, file, dryRun, defaultSite || undefined)}
        extra={
          <div style={styles.row}>
            <Input style={{ flex: 1, minWidth: '240px', padding: '9px 12px' }}
              placeholder="Участок по умолчанию (для строк без участка)"
              value={defaultSite}
              onChange={(e) => setDefaultSite(e.target.value)}
            />
          </div>
        }
      />
    </PlannerLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  pageHint: { color: COLORS.mutedText, fontSize: '14px', marginTop: 0, marginBottom: '20px' },
  row: { display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' },
};
