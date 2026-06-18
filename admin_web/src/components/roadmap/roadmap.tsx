import { m } from '@/locale/paraglide/messages';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
interface Task {
  id: string;
  title: string;
  priority: 'low' | 'medium' | 'high';
  description?: string;
  assignee?: string;
  dueDate?: string;
}
export function Roadmap() {
  const columnTitles = {
    backlog: m.roadmap_columns_backlog(),
    inProgress: m.roadmap_columns_in_progress(),
    done: m.roadmap_columns_done(),
  };
  const columns = {
    backlog: [
      {
        id: '1',
        title: m.roadmap_board_tasks_backlog_0_title(),
        priority: 'high',
        assignee: 'John Doe',
        dueDate: '2026-04-01',
      },
      {
        id: '2',
        title: m.roadmap_board_tasks_backlog_1_title(),
        priority: 'medium',
        assignee: 'Jane Smith',
        dueDate: '2026-04-05',
      },
      {
        id: '3',
        title: m.roadmap_board_tasks_backlog_2_title(),
        priority: 'low',
        assignee: 'Bob Johnson',
        dueDate: '2026-04-10',
      },
    ],
    inProgress: [
      {
        id: '4',
        title: m.roadmap_board_tasks_in_progress_0_title(),
        priority: 'high',
        assignee: 'Alice Brown',
        dueDate: '2026-03-28',
      },
      {
        id: '5',
        title: m.roadmap_board_tasks_in_progress_1_title(),
        priority: 'medium',
        assignee: 'Charlie Wilson',
        dueDate: '2026-04-02',
      },
    ],
    done: [
      {
        id: '7',
        title: m.roadmap_board_tasks_done_0_title(),
        priority: 'high',
        assignee: 'Eve Davis',
        dueDate: '2026-03-25',
      },
      {
        id: '8',
        title: m.roadmap_board_tasks_done_1_title(),
        priority: 'low',
        assignee: 'Frank White',
        dueDate: '2026-03-24',
      },
    ],
  } satisfies Record<string, Task[]>;
  return (
    <div className="grid w-full auto-rows-auto grid-cols-1 gap-4 md:grid-cols-2 md:auto-rows-fr lg:grid-cols-3">
      {Object.entries(columns).map(([columnValue, tasks]) => (
        <TaskColumn
          key={columnValue}
          value={columnValue}
          tasks={tasks}
          title={
            columnTitles[columnValue as keyof typeof columnTitles] ??
            columnValue
          }
        />
      ))}
    </div>
  );
}
interface TaskCardProps {
  task: Task;
}
function TaskCard({ task }: TaskCardProps) {
  const priority = {
    high: m.roadmap_board_priority_high(),
    medium: m.roadmap_board_priority_medium(),
    low: m.roadmap_board_priority_low(),
  }[task.priority];
  return (
    <div className="rounded-md border bg-card p-3 shadow-sm">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="line-clamp-1 font-medium text-sm">{task.title}</span>
          <Badge
            variant="outline"
            className={cn(
              'pointer-events-none h-5 rounded-sm px-1.5 text-[11px] capitalize border-transparent',
              task.priority === 'high'
                ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                : task.priority === 'medium'
                  ? 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400'
                  : 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
            )}
          >
            {priority}
          </Badge>
        </div>
        <div className="flex items-center justify-between text-muted-foreground text-xs">
          {task.assignee && (
            <div className="flex items-center gap-1">
              <div className="size-2 rounded-full bg-primary/20" />
              <span className="line-clamp-1">{task.assignee}</span>
            </div>
          )}
          {task.dueDate && (
            <time className="text-[10px] tabular-nums">{task.dueDate}</time>
          )}
        </div>
      </div>
    </div>
  );
}
interface TaskColumnProps {
  value: string;
  tasks: Task[];
  title: string;
}
function TaskColumn({ value, tasks, title }: TaskColumnProps) {
  return (
    <div key={value} className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{title}</span>
          <Badge variant="secondary" className="pointer-events-none rounded-sm">
            {tasks.length}
          </Badge>
        </div>
      </div>
      <div className="flex flex-col gap-2 p-0.5">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}
