import { useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api, type SiteLeadBadges } from '../../api/client';
import { useDistributionUpdates } from '../../realtime';
import { SidebarLayout, type SidebarTab } from '../../components/SidebarLayout';

const TABS: SidebarTab[] = [
  { path: '/site-lead/distribution', label: 'Распределение', icon: 'shuffle' },
  { path: '/site-lead/competency', label: 'Матрица компетенций', icon: 'checklist' },
  { path: '/site-lead/absences', label: 'Отсутствия', icon: 'calendar-x' },
  { path: '/site-lead/transfers', label: 'Переводы', icon: 'swap' },
  { path: '/site-lead/shifts', label: 'Планирование смен', icon: 'calendar' },
  { path: '/site-lead/journal', label: 'Журнал смен', icon: 'list' },
  { path: '/site-lead/equipment', label: 'Оборудование', icon: 'wrench' },
  /*
   * «Цели сотрудников» убраны из меню по решению заказчика: за весь пилот не
   * заведено ни одной, а план на человека и так задаётся дважды — «план на
   * смену» у операции и количество при назначении. Экран и данные оставлены на
   * месте: если через месяц никто не хватится, вычистим совсем.
   */
  { path: '/site-lead/stats', label: 'Статистика', icon: 'bar-chart' },
  { path: '/handover', label: 'Пересменка', icon: 'swap' },
  { path: '/my-work', label: 'Моя работа', icon: 'check' },
  { path: '/tasks', label: 'Задачи', icon: 'checklist' },
];

/**
 * Счётчики у пунктов меню: где начальника участка ждёт работа.
 *
 * Считаем поводы, а не события, поэтому значок гаснет сам — «прочитать» его
 * нельзя. Значок, который надо гасить руками, копится и превращается в шум:
 * его перестают замечать, и он не срабатывает там, где действительно важен.
 *
 * Обновляем по тому же живому каналу, что и доску: рабочий отметил выработку —
 * значок «Распределение» пересчитался сам, без перезагрузки страницы.
 */
function useBadges(): SiteLeadBadges | null {
  const { token, user } = useAuth();
  const [badges, setBadges] = useState<SiteLeadBadges | null>(null);

  async function load() {
    if (!token) return;
    try {
      setBadges(await api.getSiteLeadBadges(token));
    } catch {
      // Значки — подсказка, а не работа. Если не посчитались, меню просто без них.
      setBadges(null);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useDistributionUpdates(user?.siteId, load);
  return badges;
}

export function SiteLeadLayout({
  title,
  breadcrumb,
  headerExtra,
  children,
}: {
  title: string;
  breadcrumb?: string;
  headerExtra?: ReactNode;
  children: ReactNode;
}) {
  const badges = useBadges();

  const tabs = TABS.map((tab) => {
    if (!badges) return tab;
    switch (tab.path) {
      case '/site-lead/transfers':
        return { ...tab, badge: badges.transfers };
      /*
        На «Распределении» два повода сразу: некого поставить и не успеваем сдать.
        Складываем их в одно число — значок отвечает на «есть ли там работа для
        меня», а что именно, видно уже на самой странице. Два значка на одном
        пункте меню только запутали бы.
      */
      case '/site-lead/distribution':
        return { ...tab, badge: badges.unassigned + badges.overdue };
      case '/site-lead/absences':
        return { ...tab, badge: badges.absences };
      case '/tasks':
        return { ...tab, badge: badges.tasks };
      // Пересменка — точка без числа: сколько там записей, значения не имеет,
      // важно только, что смена что-то передала.
      case '/handover':
        return { ...tab, dot: badges.handover };
      default:
        return tab;
    }
  });

  return (
    <SidebarLayout
      roleLabel="Начальник участка"
      tabs={tabs}
      title={title}
      breadcrumb={breadcrumb}
      headerExtra={headerExtra}
    >
      {children}
    </SidebarLayout>
  );
}
