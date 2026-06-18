import { m } from '@/locale/paraglide/messages';
import { UserDetailViewer } from '@/components/admin/users/user-detail-viewer';
import { DataTableAdvancedToolbar } from '@/components/data-table/data-table-advanced-toolbar';
import { DataTableColumnHeader } from '@/components/data-table/data-table-column-header';
import { DataTableFacetedFilter } from '@/components/data-table/data-table-faceted-filter';
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { User } from '@/db/types';
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  IconMailCheck,
  IconMailQuestion,
  IconUserCheck,
  IconUserX,
  IconX,
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatDateTime } from '@/lib/formatter';
import { cn } from '@/lib/utils';
function TableRowSkeleton({ columns }: { columns: number }) {
  return (
    <TableRow className="h-14">
      {Array.from({ length: columns }).map((_, i) => {
        if (i === 0) {
          return (
            <TableCell key={i} className="py-3">
              <div className="flex items-center gap-2">
                <Skeleton className="size-8 rounded-full shrink-0" />
                <Skeleton className="h-4 w-20" />
              </div>
            </TableCell>
          );
        }
        if (i === 1) {
          return (
            <TableCell key={i} className="py-3">
              <Skeleton className="h-6 w-32" />
            </TableCell>
          );
        }
        if (i === 2 || i === 4) {
          return (
            <TableCell key={i} className="py-3">
              <Skeleton className="h-6 w-16" />
            </TableCell>
          );
        }
        return (
          <TableCell key={i} className="py-3">
            <Skeleton className="h-4 w-24" />
          </TableCell>
        );
      })}
    </TableRow>
  );
}
interface UsersTableProps {
  data: User[];
  total: number;
  pageIndex: number;
  pageSize: number;
  search: string;
  sorting: SortingState;
  filters?: ColumnFiltersState;
  loading?: boolean;
  onSearch: (value: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onSortingChange: (sorting: SortingState) => void;
  onFiltersChange?: (filters: ColumnFiltersState) => void;
}
export function UsersTable({
  data,
  total,
  pageIndex,
  pageSize,
  search,
  sorting,
  filters = [],
  loading,
  onSearch,
  onPageChange,
  onPageSizeChange,
  onSortingChange,
  onFiltersChange,
}: UsersTableProps) {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const columns: ColumnDef<User>[] = useMemo(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        enableHiding: true,
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            label={m.admin_users_columns_name()}
          />
        ),
        cell: ({ row }) => <UserDetailViewer user={row.original} />,
        meta: { label: m.admin_users_columns_name() },
        minSize: 120,
        size: 160,
      },
      {
        id: 'email',
        accessorKey: 'email',
        enableHiding: true,
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            label={m.admin_users_columns_email()}
          />
        ),
        cell: ({ row }) => {
          const u = row.original;
          return (
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-sm border-transparent px-1.5 py-2 hover:cursor-pointer hover:underline hover:underline-offset-4"
                onClick={() => {
                  navigator.clipboard.writeText(u.email);
                  toast.success(m.admin_users_email_copied());
                }}
              >
                {u.emailVerified ? (
                  <IconMailCheck className="stroke-green-500 dark:stroke-green-400" />
                ) : (
                  <IconMailQuestion className="stroke-red-500 dark:stroke-red-400" />
                )}
                {u.email}
              </Badge>
            </div>
          );
        },
        meta: { label: m.admin_users_columns_email() },
        minSize: 180,
        size: 220,
      },
      {
        id: 'role',
        accessorKey: 'role',
        enableHiding: true,
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            label={m.admin_users_columns_role()}
          />
        ),
        cell: ({ row }) => {
          const r = row.original.role ?? 'user';
          return (
            <Badge
              variant="outline"
              className={cn(
                'px-1.5 border-transparent',
                r === 'admin'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'
                  : 'bg-secondary text-secondary-foreground'
              )}
            >
              {r === 'admin' ? m.admin_users_admin() : m.admin_users_user()}
            </Badge>
          );
        },
        meta: { label: m.admin_users_columns_role() },
        minSize: 100,
        size: 120,
      },
      {
        id: 'createdAt',
        accessorKey: 'createdAt',
        enableHiding: true,
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            label={m.admin_users_columns_created_at()}
          />
        ),
        cell: ({ row }) => formatDateTime(new Date(row.original.createdAt)),
        meta: { label: m.admin_users_columns_created_at() },
        minSize: 140,
        size: 160,
      },
      {
        id: 'status',
        accessorFn: (row) => (row.banned ? 'inactive' : 'active'),
        enableHiding: true,
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            label={m.admin_users_columns_status()}
          />
        ),
        cell: ({ row }) => {
          const banned = row.original.banned;
          return (
            <Badge
              variant="outline"
              className={cn(
                'px-1.5 border-transparent',
                banned
                  ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400'
                  : 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
              )}
            >
              {banned ? (
                <>
                  <IconUserX />
                  {m.admin_users_inactive()}
                </>
              ) : (
                <>
                  <IconUserCheck />
                  {m.admin_users_active()}
                </>
              )}
            </Badge>
          );
        },
        meta: { label: m.admin_users_columns_status() },
        minSize: 100,
        size: 120,
      },
      {
        id: 'banReason',
        accessorKey: 'banReason',
        enableHiding: true,
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            label={m.admin_users_columns_ban_reason()}
          />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.banReason ?? '-'}
          </span>
        ),
        meta: { label: m.admin_users_columns_ban_reason() },
        minSize: 120,
        size: 140,
      },
      {
        id: 'banExpires',
        accessorKey: 'banExpires',
        enableHiding: true,
        enableSorting: false,
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            label={m.admin_users_columns_ban_expires()}
          />
        ),
        cell: ({ row }) => {
          const exp = row.original.banExpires;
          return (
            <span className="text-muted-foreground">
              {exp ? formatDate(new Date(exp)) : '-'}
            </span>
          );
        },
        meta: { label: m.admin_users_columns_ban_expires() },
        minSize: 140,
        size: 160,
      },
    ],
    []
  );
  const roleFilterOptions = useMemo(
    () => [
      { label: m.admin_users_admin(), value: 'admin' },
      { label: m.admin_users_user(), value: 'user' },
    ],
    []
  );
  const statusFilterOptions = useMemo(
    () => [
      { label: m.admin_users_active(), value: 'active' },
      { label: m.admin_users_inactive(), value: 'inactive' },
    ],
    []
  );
  const table = useReactTable({
    data,
    columns,
    pageCount: Math.ceil(total / pageSize) || 1,
    state: {
      sorting,
      columnFilters: filters,
      columnVisibility,
      pagination: { pageIndex, pageSize },
    },
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      onSortingChange(next);
    },
    onColumnFiltersChange: (updater) => {
      const next = typeof updater === 'function' ? updater(filters) : updater;
      onFiltersChange?.(next);
      onPageChange(0);
    },
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: (updater) => {
      const next =
        typeof updater === 'function'
          ? updater({ pageIndex, pageSize })
          : updater;
      if (next.pageSize !== pageSize) {
        onPageSizeChange(next.pageSize);
        if (pageIndex !== 0) onPageChange(0);
      } else if (next.pageIndex !== pageIndex) {
        onPageChange(next.pageIndex);
      }
    },
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    enableMultiSort: false,
  });
  return (
    <div className="w-full space-y-4">
      <DataTableAdvancedToolbar table={table}>
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative">
            <Input
              placeholder={m.admin_users_search()}
              value={search}
              onChange={(e) => {
                onSearch(e.target.value);
                onPageChange(0);
              }}
              className="h-8 w-[260px] pr-8"
            />
            {search.length > 0 ? (
              <button
                type="button"
                aria-label={m.admin_users_clear_search()}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => {
                  onSearch('');
                  onPageChange(0);
                }}
              >
                <IconX className="size-3.5" />
              </button>
            ) : null}
          </div>
          <DataTableFacetedFilter
            column={table.getColumn('role')}
            title={m.admin_users_columns_role()}
            options={roleFilterOptions}
          />
          <DataTableFacetedFilter
            column={table.getColumn('status')}
            title={m.admin_users_columns_status()}
            options={statusFilterOptions}
          />
        </div>
      </DataTableAdvancedToolbar>
      <div className="relative flex flex-col gap-4 overflow-auto">
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted sticky top-0 z-10">
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: pageSize }).map((_, i) => (
                  <TableRowSkeleton key={i} columns={columns.length} />
                ))
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                    className="h-14"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-3">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    {m.admin_users_no_results()}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <DataTablePagination table={table} className="px-0" />
      </div>
    </div>
  );
}
