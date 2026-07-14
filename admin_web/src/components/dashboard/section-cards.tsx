import { Badge } from '@/components/ui/badge';
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import type { TrainingDashboardSummary } from './training-dashboard-utils';
import { IconClock, IconHistory, IconMessageCircle, IconTarget } from '@tabler/icons-react';

interface SectionCardsProps {
  summary: TrainingDashboardSummary;
  formatTime: (value: number) => string;
}

export function SectionCards({ summary, formatTime }: SectionCardsProps) {
  const lastUpdatedText = summary.lastUpdatedAt ? formatTime(summary.lastUpdatedAt) : '暂无训练记录';

  const cards = [
    {
      label: '今日训练次数',
      value: summary.todaySessions.toLocaleString(),
      badge: '今天',
      icon: IconHistory,
      footerTitle: `累计 ${summary.totalSessions.toLocaleString()} 次训练`,
      footerText: '按每条插件历史会话统计',
    },
    {
      label: '今日对话轮次',
      value: summary.todayEntries.toLocaleString(),
      badge: '今天',
      icon: IconMessageCircle,
      footerTitle: `累计 ${summary.totalEntries.toLocaleString()} 轮对话`,
      footerText: '按会话内对话日志条数统计',
    },
    {
      label: '今日覆盖能力',
      value: summary.todayTaskCount.toLocaleString(),
      badge: '去重',
      icon: IconTarget,
      footerTitle: `累计 ${summary.totalTaskCount.toLocaleString()} 个能力`,
      footerText: '按训练任务 taskId 去重统计',
    },
    {
      label: '最近训练时间',
      value: lastUpdatedText,
      badge: '同步',
      icon: IconClock,
      valueClassName: 'text-lg @[250px]/card:text-xl',
      footerTitle: '来自插件历史同步',
      footerText: '登录后展示当前账号的训练复盘',
    },
  ];

  return (
    <div className="@xl/main:grid-cols-2 @5xl/main:grid-cols-4 grid grid-cols-1 gap-4 px-4 lg:px-6">
      {cards.map(card => {
        const Icon = card.icon;
        return (
          <Card key={card.label} className="@container/card">
            <CardHeader>
              <CardDescription>{card.label}</CardDescription>
              <CardTitle
                className={card.valueClassName ?? '@[250px]/card:text-3xl text-2xl font-semibold tabular-nums'}>
                {card.value}
              </CardTitle>
              <CardAction>
                <Badge
                  variant="outline"
                  className="border-transparent bg-cyan-100 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-300">
                  <Icon className="size-3.5" />
                  {card.badge}
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="line-clamp-1 flex gap-2 font-medium">{card.footerTitle}</div>
              <div className="text-muted-foreground">{card.footerText}</div>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
