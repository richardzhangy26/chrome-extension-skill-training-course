import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Routes } from '@/lib/routes';
import { Link } from '@tanstack/react-router';
import { IconArrowRight, IconHistory, IconMessageCircle, IconTarget } from '@tabler/icons-react';
import type { TrainingRecentSession, TrainingTaskStat } from './training-dashboard-utils';

interface DataTableProps {
  taskStats: TrainingTaskStat[];
  recentSessions: TrainingRecentSession[];
  formatTime: (value: number) => string;
}

export function DataTable({ taskStats, recentSessions, formatTime }: DataTableProps) {
  const topTasks = taskStats.slice(0, 8);

  return (
    <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
      <Card>
        <CardHeader>
          <CardTitle>能力训练排行</CardTitle>
          <CardDescription>按训练次数优先排序，次数相同则比较对话轮次</CardDescription>
          <CardAction>
            <Badge variant="secondary">{taskStats.length} 个能力</Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          {topTasks.length === 0 ? (
            <p className="text-muted-foreground text-sm">暂无任务统计。</p>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader className="bg-muted">
                  <TableRow>
                    <TableHead>能力训练</TableHead>
                    <TableHead className="w-28 text-right">训练次数</TableHead>
                    <TableHead className="w-28 text-right">对话轮次</TableHead>
                    <TableHead className="w-44">最近训练</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topTasks.map(task => (
                    <TableRow key={task.taskId}>
                      <TableCell className="min-w-56 whitespace-normal">
                        <div className="font-medium">{task.taskName}</div>
                        {task.metaSummary ? (
                          <div className="text-muted-foreground mt-1 text-xs">{task.metaSummary}</div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{task.sessions.toLocaleString()}</TableCell>
                      <TableCell className="text-right tabular-nums">{task.entries.toLocaleString()}</TableCell>
                      <TableCell className="text-muted-foreground">{formatTime(task.lastUpdatedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>最近训练记录</CardTitle>
          <CardDescription>最近同步到账号下的插件历史会话</CardDescription>
          <CardAction>
            <Button variant="outline" size="sm" render={<Link to={Routes.SettingsHistory} />}>
              查看历史
              <IconArrowRight className="size-3.5" />
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {recentSessions.length === 0 ? (
            <p className="text-muted-foreground text-sm">暂无最近记录。</p>
          ) : (
            <ul className="divide-y">
              {recentSessions.map(session => (
                <li key={session.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{session.name}</div>
                      {session.metaSummary ? (
                        <div className="text-muted-foreground mt-1 truncate text-xs">{session.metaSummary}</div>
                      ) : null}
                    </div>
                    <div className="text-muted-foreground shrink-0 text-xs">{formatTime(session.updatedAt)}</div>
                  </div>
                  <div className="text-muted-foreground mt-2 flex flex-wrap gap-3 text-xs">
                    <span className="inline-flex min-w-0 items-start gap-1">
                      <IconTarget className="mt-0.5 size-3.5 shrink-0" />
                      <span className="break-all">{session.taskId}</span>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <IconMessageCircle className="size-3.5" />
                      {session.entries.toLocaleString()} 轮对话
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <IconHistory className="size-3.5" />
                      会话记录
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
