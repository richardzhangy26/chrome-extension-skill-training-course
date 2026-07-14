import { m } from '@/locale/paraglide/messages';
import { ChartAreaInteractive } from '@/components/dashboard/chart-area-interactive';
import { DashboardHeader } from '@/components/layout/dashboard-header';
import { DataTable } from '@/components/dashboard/data-table';
import { SectionCards } from '@/components/dashboard/section-cards';
import { getMyHistory } from '@/api/extension-history';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { getLocale } from '@/lib/locale';
import { Routes } from '@/lib/routes';
import type { AgentLogSessionInput } from '@/lib/agent-log-schema';
import { buildTrainingDashboardView } from '@/components/dashboard/training-dashboard-utils';
import { createFileRoute } from '@tanstack/react-router';
import { Link } from '@tanstack/react-router';
import { IconHistory } from '@tabler/icons-react';
import { useEffect, useMemo, useState } from 'react';

export const Route = createFileRoute('/dashboard/')({
  component: DashboardPage,
});

function DashboardPage() {
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [sessions, setSessions] = useState<AgentLogSessionInput[]>([]);
  const breadcrumbs = [
    {
      label: m.dashboard_title(),
      isCurrentPage: true,
    },
  ];
  const localeCode = getLocale() === 'zh' ? 'zh-CN' : 'en-US';
  const formatTime = useMemo(
    () =>
      new Intl.DateTimeFormat(localeCode, {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format,
    [localeCode],
  );
  const dashboardView = useMemo(() => buildTrainingDashboardView(sessions), [sessions]);

  useEffect(() => {
    let disposed = false;

    getMyHistory()
      .then(({ sessions: rows }) => {
        if (disposed) {
          return;
        }
        setSessions(rows);
        setLoadFailed(false);
      })
      .catch(() => {
        if (disposed) {
          return;
        }
        setLoadFailed(true);
      })
      .finally(() => {
        if (!disposed) {
          setLoaded(true);
        }
      });

    return () => {
      disposed = true;
    };
  }, []);

  return (
    <>
      <DashboardHeader breadcrumbs={breadcrumbs} />
      <div className="flex flex-1 flex-col">
        <div className="@container/main flex flex-1 flex-col gap-2">
          <div className="flex flex-col gap-4 py-4 lg:gap-6 lg:py-6">
            {!loaded ? (
              <p className="text-muted-foreground px-4 text-sm lg:px-6">正在加载训练数据...</p>
            ) : loadFailed ? (
              <DashboardEmptyState
                title="训练数据加载失败"
                description="请稍后刷新页面，或先确认账号登录状态是否正常。"
              />
            ) : sessions.length === 0 ? (
              <DashboardEmptyState
                title="暂无训练数据"
                description="在 Chrome 插件里完成一次能力训练后，登录账号会自动同步到这里。"
                showHistoryLink
              />
            ) : (
              <>
                <SectionCards summary={dashboardView.summary} formatTime={formatTime} />
                <div className="px-4 lg:px-6">
                  <ChartAreaInteractive dailyStats={dashboardView.dailyStats} />
                </div>
                <DataTable
                  taskStats={dashboardView.taskStats}
                  recentSessions={dashboardView.recentSessions}
                  formatTime={formatTime}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function DashboardEmptyState({
  title,
  description,
  showHistoryLink = false,
}: {
  title: string;
  description: string;
  showHistoryLink?: boolean;
}) {
  return (
    <div className="px-4 lg:px-6">
      <Empty className="min-h-72 border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconHistory className="size-4" />
          </EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
        {showHistoryLink ? (
          <EmptyContent>
            <Button variant="outline" render={<Link to={Routes.SettingsHistory} />}>
              查看插件历史
            </Button>
          </EmptyContent>
        ) : null}
      </Empty>
    </div>
  );
}
