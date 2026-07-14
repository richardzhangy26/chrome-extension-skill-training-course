import * as React from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';

import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { TrainingDailyStat } from './training-dashboard-utils';

const chartConfig = {
  sessions: {
    label: '训练次数',
    color: 'var(--chart-1)',
  },
  entries: {
    label: '对话轮次',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig;

interface ChartAreaInteractiveProps {
  dailyStats: TrainingDailyStat[];
}

export function ChartAreaInteractive({ dailyStats }: ChartAreaInteractiveProps) {
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = React.useState('30d');

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange('7d');
    }
  }, [isMobile]);

  const filteredData = React.useMemo(() => {
    const days = timeRange === '90d' ? 90 : timeRange === '7d' ? 7 : 30;
    return dailyStats.slice(-days);
  }, [dailyStats, timeRange]);

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>训练趋势</CardTitle>
        <CardDescription>
          <span className="@[540px]/card:block hidden">按天统计训练次数与对话轮次</span>
          <span className="@[540px]/card:hidden">每日训练复盘</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            multiple={false}
            value={timeRange ? [timeRange] : []}
            onValueChange={value => {
              setTimeRange(value[0] ?? '30d');
            }}
            variant="outline"
            className="*:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex hidden">
            <ToggleGroupItem value="90d">近 90 天</ToggleGroupItem>
            <ToggleGroupItem value="30d">近 30 天</ToggleGroupItem>
            <ToggleGroupItem value="7d">近 7 天</ToggleGroupItem>
          </ToggleGroup>
          <Select
            value={timeRange}
            onValueChange={value => {
              if (value !== null) {
                setTimeRange(value);
              }
            }}>
            <SelectTrigger
              className="**:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden flex w-32"
              size="sm"
              aria-label="选择时间范围">
              <SelectValue placeholder="近 30 天" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">
                近 90 天
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                近 30 天
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                近 7 天
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer config={chartConfig} className="aspect-auto h-[280px] w-full">
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillSessions" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-sessions)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-sessions)" stopOpacity={0.08} />
              </linearGradient>
              <linearGradient id="fillEntries" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-entries)" stopOpacity={0.5} />
                <stop offset="95%" stopColor="var(--color-entries)" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} width={32} allowDecimals={false} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dot" />} />
            <Area
              dataKey="entries"
              type="natural"
              fill="url(#fillEntries)"
              stroke="var(--color-entries)"
              strokeWidth={2}
            />
            <Area
              dataKey="sessions"
              type="natural"
              fill="url(#fillSessions)"
              stroke="var(--color-sessions)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
