import { m } from "@/locale/paraglide/messages";
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Table } from '@tanstack/react-table';
import { IconChevronLeft, IconChevronRight, IconChevronsLeft, IconChevronsRight, } from '@tabler/icons-react';
interface DataTablePaginationProps<TData> extends React.ComponentProps<'div'> {
    table: Table<TData>;
    pageSizeOptions?: number[];
}
export function DataTablePagination<TData>({ table, pageSizeOptions = [10, 20, 30, 40, 50], className, ...props }: DataTablePaginationProps<TData>) {
    const currentPage = table.getState().pagination.pageIndex + 1;
    const totalPages = table.getPageCount();
    return (<div className={cn('flex w-full flex-col-reverse items-center justify-between gap-4 overflow-auto p-1 sm:flex-row sm:gap-8', className)} {...props}>
      <div className="flex-1 whitespace-nowrap text-muted-foreground text-sm"/>
      <div className="flex flex-col-reverse items-center gap-4 sm:flex-row sm:gap-6 lg:gap-8">
        <div className="flex items-center space-x-2">
          <p className="whitespace-nowrap font-medium text-sm">
            {m.common_table_rows_per_page()}
          </p>
          <Select value={`${table.getState().pagination.pageSize}`} onValueChange={(value: string | null) => {
            if (value)
                table.setPageSize(Number(value));
        }}>
            <SelectTrigger className="h-8 w-18 data-size:h-8">
              <SelectValue placeholder={table.getState().pagination.pageSize}/>
            </SelectTrigger>
            <SelectContent side="top">
              {pageSizeOptions.map((pageSize) => (<SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-center font-medium text-sm">
          {m.common_table_page()} {currentPage} / {totalPages}
        </div>
        <div className="flex items-center space-x-2">
          <Button aria-label={m.common_table_first_page()} variant="outline" size="icon" className="hidden size-8 lg:flex" onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>
            <IconChevronsLeft />
          </Button>
          <Button aria-label={m.common_table_previous_page()} variant="outline" size="icon" className="size-8" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            <IconChevronLeft />
          </Button>
          <Button aria-label={m.common_table_next_page()} variant="outline" size="icon" className="size-8" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            <IconChevronRight />
          </Button>
          <Button aria-label={m.common_table_last_page()} variant="outline" size="icon" className="hidden size-8 lg:flex" onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}>
            <IconChevronsRight />
          </Button>
        </div>
      </div>
    </div>);
}
