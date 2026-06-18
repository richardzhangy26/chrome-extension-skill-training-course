import { m } from "@/locale/paraglide/messages";
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu';
import type { Table } from '@tanstack/react-table';
import { IconSettings2 } from '@tabler/icons-react';
import * as React from 'react';
interface DataTableViewOptionsProps<TData> extends React.ComponentProps<typeof DropdownMenuContent> {
    table: Table<TData>;
}
export function DataTableViewOptions<TData>({ table, ...props }: DataTableViewOptionsProps<TData>) {
    const columns = React.useMemo(() => table
        .getAllColumns()
        .filter((column) => typeof column.accessorFn !== 'undefined' && column.getCanHide()), [table]);
    return (<DropdownMenu>
      <DropdownMenuTrigger render={(props) => (<Button {...props} type="button" aria-label={m.common_table_view_options()} variant="outline" size="sm" className="ml-auto hidden h-8 font-normal lg:flex">
            <IconSettings2 className="text-muted-foreground"/>
            {m.common_table_view_options()}
          </Button>)}/>
      <DropdownMenuContent className="w-44" align="end" {...props}>
        <DropdownMenuGroup>
          <DropdownMenuLabel>{m.common_table_view_options()}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {columns.map((column) => (<DropdownMenuCheckboxItem key={column.id} checked={column.getIsVisible()} onCheckedChange={(checked) => column.toggleVisibility(checked)}>
              <span className="truncate">
                {(column.columnDef.meta as {
                label?: string;
            } | undefined)
                ?.label ?? column.id}
              </span>
            </DropdownMenuCheckboxItem>))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>);
}
