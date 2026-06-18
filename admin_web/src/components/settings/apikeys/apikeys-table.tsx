import { m } from '@/locale/paraglide/messages';
('use client');
import { DataTablePagination } from '@/components/data-table/data-table-pagination';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ApiKey } from '@/db/types';
import { formatDate } from '@/lib/formatter';
import { cn } from '@/lib/utils';
import {
  type ColumnDef,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  IconCheck,
  IconCopy,
  IconDots,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { useMemo, useState } from 'react';
function TableRowSkeleton({ columns }: { columns: number }) {
  return (
    <TableRow className="h-14">
      {Array.from({ length: columns }).map((_, index) => (
        <TableCell key={index} className="py-3">
          <Skeleton className="h-4 w-24" />
        </TableCell>
      ))}
    </TableRow>
  );
}
function maskApiKey(start: string | null | undefined): string {
  if (!start) return '••••••••••••••••';
  return `${start}••••••••••••`;
}
function toDate(value: number | Date | undefined | null): Date | null {
  if (value == null) return null;
  return value instanceof Date ? value : new Date(value);
}
interface ApiKeysTableProps {
  data: ApiKey[];
  total: number;
  pageIndex: number;
  pageSize: number;
  loading?: boolean;
  creating?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onDelete: (keyId: string) => void;
  onCreate: (name: string) => Promise<
    | {
        key: string;
      }
    | undefined
  >;
}
export function ApiKeysTable({
  data,
  total,
  pageIndex,
  pageSize,
  loading,
  creating,
  onPageChange,
  onPageSizeChange,
  onDelete,
  onCreate,
}: ApiKeysTableProps) {
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyDialogOpen, setNewKeyDialogOpen] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState('');
  const [copied, setCopied] = useState(false);
  const columns: ColumnDef<ApiKey>[] = useMemo(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        header: m.settings_api_keys_columns_name(),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <span className="font-medium">{row.original.name ?? '—'}</span>
          </div>
        ),
        minSize: 120,
        size: 140,
        enableSorting: false,
      },
      {
        id: 'key',
        accessorKey: 'start',
        header: m.settings_api_keys_columns_key(),
        cell: ({ row }) => <span>{maskApiKey(row.original.start)}</span>,
        minSize: 180,
        size: 220,
        enableSorting: false,
      },
      {
        id: 'createdAt',
        accessorKey: 'createdAt',
        header: m.settings_api_keys_columns_created_at(),
        cell: ({ row }) => {
          const d = toDate(row.original.createdAt);
          return d ? formatDate(d) : '—';
        },
        minSize: 140,
        size: 160,
        enableSorting: false,
      },
      {
        id: 'expiresAt',
        accessorKey: 'expiresAt',
        header: m.settings_api_keys_columns_expires_at(),
        cell: ({ row }) => {
          const d = toDate(row.original.expiresAt ?? null);
          return d ? formatDate(d) : m.settings_api_keys_never();
        },
        minSize: 140,
        size: 160,
        enableSorting: false,
      },
      {
        id: 'actions',
        header: m.settings_api_keys_columns_actions(),
        cell: ({ row }) => {
          const keyId = row.original.id;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'icon' })
                )}
              >
                <IconDots className="size-4" />
                <span className="sr-only">
                  {m.settings_api_keys_columns_actions()}
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onDelete(keyId)}>
                  <IconTrash className="mr-2 size-4" />
                  {m.settings_api_keys_delete()}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
        minSize: 80,
        size: 100,
        enableSorting: false,
      },
    ],
    [onDelete]
  );
  const table = useReactTable({
    data,
    columns,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    state: {
      columnFilters: [],
      columnVisibility,
      pagination: { pageIndex, pageSize },
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
    manualFiltering: true,
    enableMultiSort: false,
  });
  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    const result = await onCreate(newKeyName.trim());
    setNewKeyName('');
    setCreateDialogOpen(false);
    if (result?.key) {
      setNewKeyValue(result.key);
      setNewKeyDialogOpen(true);
    }
  };
  const handleCopyKey = async () => {
    await navigator.clipboard.writeText(newKeyValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const handleCloseNewKeyDialog = () => {
    setNewKeyDialogOpen(false);
    setNewKeyValue('');
    setCopied(false);
  };
  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger
            className={cn(
              buttonVariants({ variant: 'default', size: 'default' })
            )}
          >
            <IconPlus className="size-4" />
            {m.settings_api_keys_create_button()}
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {m.settings_api_keys_create_dialog_title()}
              </DialogTitle>
              <DialogDescription>
                {m.settings_api_keys_create_dialog_description()}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="flex items-center gap-4">
                <Label htmlFor="key-name" className="shrink-0">
                  {m.settings_api_keys_key_name_label()}
                </Label>
                <Input
                  id="key-name"
                  placeholder={m.settings_api_keys_key_name_placeholder()}
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !creating) handleCreate();
                  }}
                  disabled={creating}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
                disabled={creating}
              >
                {m.settings_api_keys_cancel()}
              </Button>
              <Button onClick={handleCreate} disabled={creating}>
                {creating
                  ? m.settings_api_keys_creating()
                  : m.settings_api_keys_create()}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={newKeyDialogOpen} onOpenChange={handleCloseNewKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {m.settings_api_keys_new_key_dialog_title()}
            </DialogTitle>
            <DialogDescription>
              {m.settings_api_keys_new_key_dialog_description()}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex items-center gap-2">
              <Input readOnly value={newKeyValue} className="text-sm" />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyKey}
                className="shrink-0"
              >
                {copied ? (
                  <IconCheck className="size-4 text-green-500" />
                ) : (
                  <IconCopy className="size-4" />
                )}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleCloseNewKeyDialog}>
              {m.settings_api_keys_done()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="relative flex flex-col gap-4 overflow-auto">
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted sticky top-0 z-10">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
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
                Array.from({ length: pageSize }).map((_, index) => (
                  <TableRowSkeleton key={index} columns={columns.length} />
                ))
              ) : table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() ? 'selected' : undefined}
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
                    {m.settings_api_keys_no_results()}
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
