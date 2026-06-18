import { m } from "@/locale/paraglide/messages";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger, } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { Option } from '@/components/data-table/types/data-table';
import type { Column } from '@tanstack/react-table';
import { IconCheck, IconCirclePlus, IconCircleX } from '@tabler/icons-react';
import * as React from 'react';
interface DataTableFacetedFilterProps<TData, TValue> {
    column?: Column<TData, TValue>;
    title?: string;
    options: Option[];
    multiple?: boolean;
}
export function DataTableFacetedFilter<TData, TValue>({ column, title, options, multiple, }: DataTableFacetedFilterProps<TData, TValue>) {
    const [open, setOpen] = React.useState(false);
    const columnFilterValue = column?.getFilterValue();
    const selectedValues = new Set(Array.isArray(columnFilterValue) ? columnFilterValue : []);
    const onItemSelect = React.useCallback((option: Option, isSelected: boolean) => {
        if (!column)
            return;
        if (multiple) {
            const newSelectedValues = new Set(selectedValues);
            if (isSelected) {
                newSelectedValues.delete(option.value);
            }
            else {
                newSelectedValues.add(option.value);
            }
            const filterValues = Array.from(newSelectedValues);
            column.setFilterValue(filterValues.length ? filterValues : undefined);
        }
        else {
            column.setFilterValue(isSelected ? undefined : [option.value]);
            setOpen(false);
        }
    }, [column, multiple, selectedValues]);
    const onReset = React.useCallback((event?: React.MouseEvent) => {
        event?.stopPropagation();
        column?.setFilterValue(undefined);
    }, [column]);
    return (<Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={(props) => (<Button {...props} variant="outline" size="sm" className="border-dashed font-normal">
            {selectedValues?.size > 0 ? (<div 
            // biome-ignore lint/a11y/useSemanticElements: Using div with role="button" for clear filter functionality within a composite widget
            role="button" tabIndex={0} aria-label={`Clear ${title} filter`} className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" onMouseDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onReset();
                }}>
                <IconCircleX />
              </div>) : (<IconCirclePlus />)}
            {title}
            {selectedValues?.size > 0 && (<>
                <Separator orientation="vertical" className="mx-0.5 h-4 self-auto!"/>
                <Badge variant="secondary" className="rounded-sm px-1 font-normal lg:hidden">
                  {selectedValues.size}
                </Badge>
                <div className="hidden items-center gap-1 lg:flex">
                  {selectedValues.size > 2 ? (<Badge variant="secondary" className="rounded-sm px-1 font-normal">
                      {selectedValues.size} {m.common_table_selected()}
                    </Badge>) : (options
                    .filter((option) => selectedValues.has(option.value))
                    .map((option) => (<Badge variant="secondary" key={option.value} className="rounded-sm px-1 font-normal">
                          {option.label}
                        </Badge>)))}
                </div>
              </>)}
          </Button>)}/>
      <PopoverContent className="w-50 p-0" align="start">
        <Command>
          <CommandInput placeholder={title}/>
          <CommandList className="max-h-full">
            <CommandEmpty>{m.common_table_no_results_found()}</CommandEmpty>
            <CommandGroup className="max-h-[300px] scroll-py-1 overflow-y-auto overflow-x-hidden">
              {options.map((option) => {
            const isSelected = selectedValues.has(option.value);
            return (<CommandItem key={option.value} onSelect={() => onItemSelect(option, isSelected)}>
                    <div className={cn('flex size-4 items-center justify-center rounded-sm border border-primary', isSelected
                    ? 'bg-primary'
                    : 'opacity-50 [&_svg]:invisible')}>
                      <IconCheck />
                    </div>
                    {option.icon && <option.icon />}
                    <span className="truncate">{option.label}</span>
                    {option.count && (<span className="ml-auto font-mono text-xs">
                        {option.count}
                      </span>)}
                  </CommandItem>);
        })}
            </CommandGroup>
            {selectedValues.size > 0 && (<>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem onSelect={() => onReset()} className="justify-center text-center">
                    {m.common_table_clear_filters()}
                  </CommandItem>
                </CommandGroup>
              </>)}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>);
}
