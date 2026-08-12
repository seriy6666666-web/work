import { useAuth } from '../../auth/AuthContext';
import { api } from '../../api/client';
import { AdminLayout } from './AdminLayout';
import { ImportBlock } from '../../components/ImportBlock';
import { COLORS } from '../../theme';

/**
 * Заведение сотрудников из матрицы компетенций. Отдельно от планировщика: пароли
 * заведённых людей видит только та роль, которая по ТЗ и отвечает за учётные записи.
 */
export function ImportUsersPage() {
  const { token } = useAuth();

  return (
    <AdminLayout title="Импорт сотрудников" breadcrumb="Администрирование">
      <p style={styles.pageHint}>
        Тот же файл матрицы компетенций, что загружает планировщик, но здесь из него заводятся
        сотрудники. У каждого будет свой пароль — список показывается один раз, сразу после
        импорта, и его нужно сохранить: восстановить пароль нельзя, можно только задать новый.
      </p>

      <ImportBlock
        title="Сотрудники из матрицы компетенций"
        hint={
          'Листы вида «<Участок> навыки»: ФИО берутся из колонки «Сотрудник», участок — из ' +
          'названия листа. Участки должны быть заранее созданы в разделе «Участки»: импорт их ' +
          'не создаёт, иначе в системе появляются участки, которых на производстве нет. ' +
          'Уже заведённые сотрудники не дублируются, им лишь дописываются навыки.'
        }
        onRun={(file, dryRun) => api.importEmployees(token!, file, dryRun)}
      />
    </AdminLayout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  pageHint: { color: COLORS.mutedText, fontSize: '14px', marginTop: 0, marginBottom: '20px', maxWidth: '760px' },
};
